import { a1ToAddress } from '@/features/sheet/utils/refs'
import { mergeRowPatches, putRows, type RowRecord } from '@/db/idb'

type PatchValue = string | null // null => delete

export interface RowWriteBufferOptions {
  sheetId: string
  flushIntervalMs?: number | null
  maxRowsPerTx?: number
  minFlushRows?: number
  clock?: () => number
  disableIdleFlush?: boolean
  onFlush?: (info: { rows: number; ms: number; reason?: string }) => void
}

export class RowWriteBuffer {
  private readonly sheetId: string
  private flushIntervalMs: number | null
  private maxRowsPerTx: number
  private minFlushRows: number
  private readonly clock: () => number
  private readonly onFlush?: (info: { rows: number; ms: number; reason?: string }) => void
  private timer: number | null = null
  private idleId: number | null = null
  private pendingFlush: Promise<void> | null = null

  // row -> Map<col, PatchValue>
  private buffer = new Map<number, Map<number, PatchValue>>()
  // rows we know we have full contents for (skip read-merge)
  private fullRows = new Set<number>()

  constructor(opts: RowWriteBufferOptions) {
    this.sheetId = opts.sheetId
    this.flushIntervalMs = opts.flushIntervalMs ?? 500
    this.maxRowsPerTx = opts.maxRowsPerTx ?? 2000
    this.minFlushRows = opts.minFlushRows ?? 1
    this.clock = opts.clock ?? (() => Date.now())
    this.onFlush = opts.onFlush
    this.startTimers(opts.disableIdleFlush)
    document.addEventListener('visibilitychange', this.onVisibility)
    window.addEventListener('pagehide', this.onPageHide)
  }

  private startTimers(disableIdle?: boolean) {
    if (!disableIdle) this.scheduleIdleFlush()
    if (this.flushIntervalMs && this.flushIntervalMs > 0) {
      this.timer = window.setInterval(() => {
        if (this.buffer.size >= this.minFlushRows) this.flush('interval')
      }, this.flushIntervalMs)
    }
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

  setPolicy(opts: Partial<RowWriteBufferOptions>) {
    const shouldRestartTimer = 'flushIntervalMs' in opts || 'minFlushRows' in opts
    if (typeof opts.flushIntervalMs !== 'undefined') this.flushIntervalMs = opts.flushIntervalMs
    if (typeof opts.maxRowsPerTx !== 'undefined') this.maxRowsPerTx = opts.maxRowsPerTx
    if (typeof opts.minFlushRows !== 'undefined') this.minFlushRows = opts.minFlushRows
    if (shouldRestartTimer) {
      if (this.timer != null) {
        clearInterval(this.timer)
        this.timer = null
      }
      if (this.idleId != null && 'cancelIdleCallback' in window) {
        ;(window as any).cancelIdleCallback(this.idleId)
        this.idleId = null
      }
      this.startTimers(opts.disableIdleFlush)
    }
  }

  async shutdown() {
    this.stop()
    await this.flush('shutdown')
  }

  private onVisibility = () => {
    if (document.visibilityState === 'hidden') this.flush('visibility')
  }

  private onPageHide = () => this.flush('pagehide')

  private scheduleIdleFlush() {
    if ('requestIdleCallback' in window) {
      this.idleId = (window as any).requestIdleCallback(() => {
        if (this.buffer.size > 0) this.flush('idle')
        this.scheduleIdleFlush()
      }, { timeout: this.flushIntervalMs ?? undefined })
    }
  }

  enqueuePutA1(a1: string, input: string) {
    const { row, col } = a1ToAddress(a1 as any)
    let m = this.buffer.get(row)
    if (!m) this.buffer.set(row, (m = new Map()))
    m.set(col, input)
    // We only know full rows when bulk-loading; single puts are patches
  }

  enqueueDeleteA1(a1: string) {
    const { row, col } = a1ToAddress(a1 as any)
    let m = this.buffer.get(row)
    if (!m) this.buffer.set(row, (m = new Map()))
    m.set(col, null)
  }

  enqueueBulkFromCellsMap(cells: Map<string, { input: string }>) {
    // Build per-row aggregates and mark as full rows
    for (const [a1, cell] of cells) {
      const { row, col } = a1ToAddress(a1 as any)
      let m = this.buffer.get(row)
      if (!m) this.buffer.set(row, (m = new Map()))
      m.set(col, cell.input)
      this.fullRows.add(row)
    }
  }

  async flush(reason?: string): Promise<void> {
    if (this.pendingFlush) return this.pendingFlush
    if (this.buffer.size === 0) return Promise.resolve()

    const snapshot = this.buffer
    const fullRowsSnap = new Set(this.fullRows)
    this.buffer = new Map()
    this.fullRows = new Set()

    const patches: Array<{ row: number; set?: Array<[number, string]>; del?: number[]; full?: boolean; updatedAt: number }>= []
    for (const [row, map] of snapshot) {
      const set: Array<[number, string]> = []
      const del: number[] = []
      for (const [col, v] of map) {
        if (v === null || v === '') del.push(col)
        else set.push([col, v])
      }
      patches.push({ row, set: set.length ? set : undefined, del: del.length ? del : undefined, full: fullRowsSnap.has(row), updatedAt: this.clock() })
    }

    const start = performance.now()
    const p = (async () => {
      try {
        // If all patches are full rows and have no del, we can put directly for max throughput
        const allFull = patches.every(p => p.full && (!p.del || p.del.length === 0))
        if (allFull) {
          const rows: RowRecord[] = patches.map(p => ({
            sheetId: this.sheetId,
            row: p.row,
            cells: (p.set ?? []).slice(),
            updatedAt: p.updatedAt,
          }))
          // Chunk per tx
          for (let i = 0; i < rows.length; i += this.maxRowsPerTx) {
            await putRows(rows.slice(i, i + this.maxRowsPerTx))
          }
        } else {
          // Merge patches inside IDB to avoid losing existing columns
          for (let i = 0; i < patches.length; i += this.maxRowsPerTx) {
            await mergeRowPatches(this.sheetId, patches.slice(i, i + this.maxRowsPerTx), this.maxRowsPerTx)
          }
        }
        const ms = performance.now() - start
        this.onFlush?.({ rows: patches.length, ms, reason })
      } finally {
        this.pendingFlush = null
      }
    })()
    this.pendingFlush = p
    return p
  }
}
