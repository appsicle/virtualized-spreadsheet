// Small IndexedDB helper for spreadsheet persistence
// Database: SpreadsheetDB v1

export const DB_NAME = 'SpreadsheetDB'
export const DB_VERSION = 3

export type CellKey = { sheetId: string; cellId: string }

export interface CellRecord {
  sheetId: string
  cellId: string
  row: number // zero-based
  col: number // zero-based
  input: string
  updatedAt: number
}

export interface RowRecord {
  sheetId: string
  row: number // zero-based
  cells: Array<[number, string]> // [col, input]
  updatedAt: number
}

let dbPromise: Promise<IDBDatabase> | null = null

function promisifyRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function wrapTx(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction error'))
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'))
  })
}

export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (ev) => {
      const db = req.result
      if (!db.objectStoreNames.contains('cells')) {
        const cells = db.createObjectStore('cells', { keyPath: ['sheetId', 'cellId'] })
        cells.createIndex('by_sheet', 'sheetId', { unique: false })
        cells.createIndex('by_sheet_row', ['sheetId', 'row'], { unique: false })
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' })
      }
      // v2: drop by_updatedAt index to reduce write overhead
      try {
        const tx = req.transaction
        if (tx) {
          const cells = tx.objectStore('cells')
          if (Array.from((cells as any).indexNames || cells.indexNames).includes('by_updatedAt')) {
            cells.deleteIndex('by_updatedAt')
          }
        }
      } catch {}

      // v3: Add row-chunked store for higher write throughput
      if (!db.objectStoreNames.contains('rows')) {
        db.createObjectStore('rows', { keyPath: ['sheetId', 'row'] })
        // No secondary indexes to minimize write overhead
      }
    }
    req.onsuccess = () => {
      const db = req.result
      // In case of version change from another tab, close this connection
      db.onversionchange = () => {
        db.close()
      }
      resolve(db)
    }
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

export async function bulkPutCells(cells: CellRecord[]): Promise<void> {
  if (!cells.length) return
  const db = await openDB()
  const tx = (db as any).transaction
    ? db.transaction(['cells'], 'readwrite', { durability: 'relaxed' as any })
    : db.transaction(['cells'], 'readwrite')
  const store = tx.objectStore('cells')
  for (const c of cells) store.put(c)
  await wrapTx(tx)
}

export async function bulkDeleteCells(keys: CellKey[]): Promise<void> {
  if (!keys.length) return
  const db = await openDB()
  const tx = (db as any).transaction
    ? db.transaction(['cells'], 'readwrite', { durability: 'relaxed' as any })
    : db.transaction(['cells'], 'readwrite')
  const store = tx.objectStore('cells')
  for (const k of keys) store.delete([k.sheetId, k.cellId])
  await wrapTx(tx)
}

export async function atomicBatch(puts: CellRecord[], deletes: CellKey[]): Promise<void> {
  if (!puts.length && !deletes.length) return
  const db = await openDB()
  const tx = (db as any).transaction
    ? db.transaction(['cells'], 'readwrite', { durability: 'relaxed' as any })
    : db.transaction(['cells'], 'readwrite')
  const store = tx.objectStore('cells')
  for (const d of deletes) store.delete([d.sheetId, d.cellId])
  for (const p of puts) store.put(p)
  await wrapTx(tx)
}

export async function getCell(sheetId: string, cellId: string): Promise<CellRecord | undefined> {
  const db = await openDB()
  const tx = db.transaction(['cells'], 'readonly')
  const store = tx.objectStore('cells')
  const rec = await promisifyRequest<CellRecord | undefined>(store.get([sheetId, cellId]))
  await wrapTx(tx)
  return rec
}

export async function getCellsBySheet(sheetId: string): Promise<CellRecord[]> {
  const db = await openDB()
  const tx = db.transaction(['cells'], 'readonly')
  const idx = tx.objectStore('cells').index('by_sheet')
  const req = idx.getAll(IDBKeyRange.only(sheetId)) as IDBRequest<CellRecord[]>
  const res = await promisifyRequest<CellRecord[]>(req)
  await wrapTx(tx)
  return res
}

export async function getCellsBySheetRow(sheetId: string, row: number): Promise<CellRecord[]> {
  const db = await openDB()
  const tx = db.transaction(['cells'], 'readonly')
  const idx = tx.objectStore('cells').index('by_sheet_row')
  const key = IDBKeyRange.only([sheetId, row])
  const req = idx.getAll(key) as IDBRequest<CellRecord[]>
  const res = await promisifyRequest<CellRecord[]>(req)
  await wrapTx(tx)
  return res
}

export async function countCellsBySheet(sheetId: string): Promise<number> {
  const db = await openDB()
  const tx = db.transaction(['cells'], 'readonly')
  const idx = tx.objectStore('cells').index('by_sheet')
  const req = idx.count(IDBKeyRange.only(sheetId))
  const res = await promisifyRequest<number>(req)
  await wrapTx(tx)
  return res
}

export async function streamCellsBySheet(
  sheetId: string,
  onChunk: (chunk: CellRecord[]) => void,
  chunkSize = 5000
): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(['cells'], 'readonly')
  const idx = tx.objectStore('cells').index('by_sheet')
  let acc: CellRecord[] = []
  await new Promise<void>((resolve, reject) => {
    const req = idx.openCursor(IDBKeyRange.only(sheetId)) as IDBRequest<IDBCursorWithValue | null>
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) {
        if (acc.length) onChunk(acc)
        resolve()
        return
      }
      acc.push(cursor.value as CellRecord)
      if (acc.length >= chunkSize) {
        onChunk(acc)
        acc = []
      }
      cursor.continue()
    }
    req.onerror = () => reject(req.error)
  })
  await wrapTx(tx)
}

// Row-chunked APIs (preferred for performance)

export async function countRowsBySheet(sheetId: string): Promise<number> {
  const db = await openDB()
  const tx = db.transaction(['rows'], 'readonly')
  const store = tx.objectStore('rows')
  const lower = [sheetId, 0]
  const upper = [sheetId, Number.MAX_SAFE_INTEGER]
  const req = store.count(IDBKeyRange.bound(lower, upper))
  const res = await promisifyRequest<number>(req)
  await wrapTx(tx)
  return res
}

export async function streamRowsBySheet(
  sheetId: string,
  onChunk: (chunk: RowRecord[]) => void,
  rowsPerChunk = 50
): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(['rows'], 'readonly')
  const store = tx.objectStore('rows')
  const lower = [sheetId, 0]
  const upper = [sheetId, Number.MAX_SAFE_INTEGER]
  const range = IDBKeyRange.bound(lower, upper)
  let acc: RowRecord[] = []
  await new Promise<void>((resolve, reject) => {
    const req = store.openCursor(range) as IDBRequest<IDBCursorWithValue | null>
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) {
        if (acc.length) onChunk(acc)
        resolve()
        return
      }
      acc.push(cursor.value as RowRecord)
      if (acc.length >= rowsPerChunk) {
        onChunk(acc)
        acc = []
      }
      cursor.continue()
    }
    req.onerror = () => reject(req.error)
  })
  await wrapTx(tx)
}

export async function putRows(rows: RowRecord[]): Promise<void> {
  if (!rows.length) return
  const db = await openDB()
  const tx = (db as any).transaction
    ? db.transaction(['rows'], 'readwrite', { durability: 'relaxed' as any })
    : db.transaction(['rows'], 'readwrite')
  const store = tx.objectStore('rows')
  for (const r of rows) store.put(r)
  await wrapTx(tx)
}

export async function mergeRowPatches(
  sheetId: string,
  patches: Array<{ row: number; set?: Array<[number, string]>; del?: number[]; full?: boolean; updatedAt: number }>,
  rowsPerTx = 2000
): Promise<void> {
  if (!patches.length) return
  const db = await openDB()
  for (let i = 0; i < patches.length; i += rowsPerTx) {
    const chunk = patches.slice(i, i + rowsPerTx)
    const tx = (db as any).transaction
      ? db.transaction(['rows'], 'readwrite', { durability: 'relaxed' as any })
      : db.transaction(['rows'], 'readwrite')
    const store = tx.objectStore('rows')
    for (const p of chunk) {
      let base: RowRecord | undefined
      if (!p.full) {
        base = await promisifyRequest<RowRecord | undefined>(store.get([sheetId, p.row]))
      }
      const map = new Map<number, string>()
      if (base) for (const [c, v] of base.cells) map.set(c, v)
      if (p.set) for (const [c, v] of p.set) map.set(c, v)
      if (p.del) for (const c of p.del) map.delete(c)
      const cells = Array.from(map.entries())
      const rec: RowRecord = { sheetId, row: p.row, cells, updatedAt: p.updatedAt }
      store.put(rec)
    }
    await wrapTx(tx)
  }
}
