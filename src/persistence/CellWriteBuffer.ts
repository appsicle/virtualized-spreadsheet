import { atomicBatch, type CellKey, type CellRecord } from '@/db/idb'
import { a1ToAddress } from '@/features/sheet/utils/refs'
import type { Cells } from '@/features/sheet/types'

type DBOp =
  | { type: 'put'; store: 'cells'; key: string; record: CellRecord }
  | { type: 'delete'; store: 'cells'; key: string; keyParts: CellKey }

export interface BufferMetrics {
  flushes: number
  lastFlushSize: number
  lastFlushMs: number
  failures: number
}

export interface CellWriteBufferOptions {
  sheetId: string
  flushIntervalMs?: number | null
  maxBufferItems?: number
  maxBatchPerTx?: number
  clock?: () => number
  onFlush?: (info: { size: number; ms: number; reason?: string }) => void
  disableIdleFlush?: boolean
  minFlushItems?: number
}

export class CellWriteBuffer {
  private readonly sheetId: string
  private readonly flushIntervalMs: number | null
  private readonly maxBufferItems: number
  private readonly maxBatchPerTx: number
  private readonly clock: () => number
  private readonly minFlushItems: number
  private readonly disableIdleFlush: boolean | undefined
  private timer: number | null = null
  private idleId: number | null = null
  private backoffMs = 0
  private buffer = new Map<string, DBOp>()
  private pendingFlush: Promise<void> | null = null
  readonly metrics: BufferMetrics = { flushes: 0, lastFlushSize: 0, lastFlushMs: 0, failures: 0 }
  private onFlush?: (info: { size: number; ms: number; reason?: string }) => void

  constructor(opts: CellWriteBufferOptions) {
    this.sheetId = opts.sheetId
    this.flushIntervalMs = opts.flushIntervalMs ?? 500
    this.maxBufferItems = opts.maxBufferItems ?? 5000
    this.maxBatchPerTx = opts.maxBatchPerTx ?? 50000
    this.clock = opts.clock ?? (() => Date.now())
    this.onFlush = opts.onFlush
    this.minFlushItems = opts.minFlushItems ?? 1
    this.disableIdleFlush = opts.disableIdleFlush
  }

  start() {
    if (this.timer != null) return
    if (this.flushIntervalMs && this.flushIntervalMs > 0) {
      this.timer = window.setInterval(() => {
        if (this.buffer.size >= this.minFlushItems) this.flush('interval')
      }, this.flushIntervalMs)
    }
    document.addEventListener('visibilitychange', this.onVisibility)
    window.addEventListener('pagehide', this.onPageHide)
    if (!this.disableIdleFlush) this.scheduleIdleFlush()
  }

  stop() {
    if (this.timer != null) {
      clearInterval(this.timer)
      this.timer = null
    }
    if (this.idleId != null && 'cancelIdleCallback' in window) {
      ;(window as any).cancelIdleCallback(this.idleId)
      this.idleId = null
    }
    document.removeEventListener('visibilitychange', this.onVisibility)
    window.removeEventListener('pagehide', this.onPageHide)
  }

  async shutdown() {
    this.stop()
    await this.flush('shutdown')
  }

  private onVisibility = () => {
    if (document.visibilityState === 'hidden') this.flush('visibility')
  }

  private onPageHide = () => {
    this.flush('pagehide')
  }

  private scheduleIdleFlush() {
    if ('requestIdleCallback' in window) {
      this.idleId = (window as any).requestIdleCallback(() => {
        if (this.buffer.size > 0) this.flush('idle')
        this.scheduleIdleFlush()
      }, { timeout: this.flushIntervalMs })
    }
  }

  enqueuePutA1(a1: string, input: string) {
    const { row, col } = a1ToAddress(a1 as any)
    const record: CellRecord = {
      sheetId: this.sheetId,
      cellId: a1,
      row,
      col,
      input,
      updatedAt: this.clock(),
    }
    this.enqueuePut(record)
  }

  enqueuePut(record: CellRecord) {
    const key = this.dedupeKey('cells', record.sheetId, record.cellId)
    this.buffer.set(key, { type: 'put', store: 'cells', key, record })
    if (this.buffer.size >= this.maxBufferItems) this.flush('threshold')
  }

  enqueueDelete(key: CellKey) {
    const k = this.dedupeKey('cells', key.sheetId, key.cellId)
    this.buffer.set(k, { type: 'delete', store: 'cells', key: k, keyParts: key })
    if (this.buffer.size >= this.maxBufferItems) this.flush('threshold')
  }

  enqueueBulkFromCellsMap(cells: Cells) {
    const now = this.clock()
    for (const [a1, cell] of cells) {
      const { row, col } = a1ToAddress(a1 as any)
      const record: CellRecord = {
        sheetId: this.sheetId,
        cellId: a1,
        row,
        col,
        input: cell.input,
        updatedAt: now,
      }
      const key = this.dedupeKey('cells', record.sheetId, record.cellId)
      this.buffer.set(key, { type: 'put', store: 'cells', key, record })
    }
    if (this.buffer.size >= this.maxBufferItems) this.flush('threshold')
  }

  async flush(reason?: string): Promise<void> {
    if (this.pendingFlush) return this.pendingFlush
    if (this.buffer.size === 0) return Promise.resolve()

    const snapshot = this.buffer
    this.buffer = new Map()

    const ops = [...snapshot.values()]
    // Note: we chunk and derive puts/deletes per chunk below

    const start = performance.now()
    const doFlush = async () => {
      // Chunk into batches per transaction
      for (let i = 0; i < ops.length; i += this.maxBatchPerTx) {
        const chunk = ops.slice(i, i + this.maxBatchPerTx)
        const cPuts = chunk
          .filter((o): o is Extract<DBOp, { type: 'put' }> => o.type === 'put')
          .map((o) => o.record)
        const cDels = chunk
          .filter((o): o is Extract<DBOp, { type: 'delete' }> => o.type === 'delete')
          .map((o) => o.keyParts)
        await atomicBatch(cPuts, cDels)
      }
    }

    const p = (async () => {
      try {
        await doFlush()
        const ms = performance.now() - start
        this.metrics.flushes += 1
        this.metrics.lastFlushSize = ops.length
        this.metrics.lastFlushMs = ms
        this.backoffMs = 0
        this.onFlush?.({ size: ops.length, ms, reason })
      } catch (err) {
        // Requeue snapshot
        this.metrics.failures += 1
        for (const op of ops) this.buffer.set(op.key, op)
        // Backoff with jitter
        this.backoffMs = Math.min(5000, this.backoffMs ? this.backoffMs * 2 : 250)
        const jitter = Math.floor(Math.random() * 100)
        setTimeout(() => this.flush('retry'), this.backoffMs + jitter)
        throw err
      } finally {
        this.pendingFlush = null
      }
    })()

    this.pendingFlush = p
    return p
  }

  private dedupeKey(store: string, sheetId: string, cellId: string) {
    return `${store}|${sheetId}|${cellId}`
  }
}
