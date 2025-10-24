// Small IndexedDB helper for spreadsheet persistence
// Database: SpreadsheetDB v3 (row-chunked storage)

export const DB_NAME = 'SpreadsheetDB'
export const DB_VERSION = 3

// v3 stores rows only. Prior v1/v2 cell-based helpers are removed.

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
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' })
      }
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
  const tx = (db as unknown as { transaction: IDBTransaction }).transaction
    ? db.transaction(['rows'], 'readwrite', { durability: 'relaxed' as IDBTransactionDurability })
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
    const tx = (db as unknown as { transaction: IDBTransaction }).transaction
      ? db.transaction(['rows'], 'readwrite', { durability: 'relaxed' as IDBTransactionDurability })
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
