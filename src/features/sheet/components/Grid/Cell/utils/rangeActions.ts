import type { Cells, Selection, SheetDimensions } from '@/features/sheet/types'
import { addrOf, a1Of } from './geometry'

export function serializeTSV(block: string[][]): string {
  return block.map((row) => row.join('\t')).join('\n')
}

export function parseTSV(text: string): string[][] {
  const lines = text.replace(/\r/g, '').split('\n')
  return lines.map((line) => line.split(/\t|,/g))
}

export function getSelectionBounds(selection: Selection):
  | { rMin: number; rMax: number; cMin: number; cMax: number }
  | null {
  const anchor = selection.anchor !== undefined && selection.anchor !== null ? selection.anchor : selection.a1
  const focus = selection.focus !== undefined && selection.focus !== null ? selection.focus : selection.a1
  if (!anchor || !focus) return null
  const a = addrOf(anchor)
  const f = addrOf(focus)
  const rMin = Math.min(a.row, f.row)
  const rMax = Math.max(a.row, f.row)
  const cMin = Math.min(a.col, f.col)
  const cMax = Math.max(a.col, f.col)
  return { rMin, rMax, cMin, cMax }
}

export function selectionToText(cells: Cells, selection: Selection): string {
  const b = getSelectionBounds(selection)
  if (!b) return ''
  const lines: string[] = []
  const w = b.cMax - b.cMin + 1
  const rowBuf: string[] = new Array(w)
  for (let r = b.rMin; r <= b.rMax; r++) {
    let k = 0
    for (let c = b.cMin; c <= b.cMax; c++) {
      const id = a1Of({ row: r, col: c })
      const cell = cells.get(id)
      rowBuf[k++] = cell ? (cell.input !== undefined && cell.input !== null ? cell.input : '') : ''
    }
    lines.push(rowBuf.join('\t'))
  }
  return lines.join('\n')
}

export function isFullRowSelection(
  selection: Selection,
  dims: SheetDimensions
): { row: number } | null {
  const b = getSelectionBounds(selection)
  if (!b) return null
  if (b.cMin === 0 && b.cMax === dims.cols - 1 && b.rMin === b.rMax) return { row: b.rMin }
  return null
}

export function isFullColumnSelection(
  selection: Selection,
  dims: SheetDimensions
): { col: number } | null {
  const b = getSelectionBounds(selection)
  if (!b) return null
  if (b.rMin === 0 && b.rMax === dims.rows - 1 && b.cMin === b.cMax) return { col: b.cMin }
  return null
}

export function clearSelectionContents(
  selection: Selection,
  setCellsBulk: (updates: Array<{ a1: string; input: string }>) => void
) {
  const b = getSelectionBounds(selection)
  if (!b) return
  const updates: { a1: string; input: string }[] = []
  for (let r = b.rMin; r <= b.rMax; r++)
    for (let c = b.cMin; c <= b.cMax; c++) updates.push({ a1: a1Of({ row: r, col: c }), input: '' })
  setCellsBulk(updates)
}

export function pasteTextAtSelection(
  text: string,
  selection: Selection,
  dims: SheetDimensions,
  setCellsBulk: (updates: Array<{ a1: string; input: string }>) => void
) {
  const anchor = selection.anchor !== undefined && selection.anchor !== null ? selection.anchor : selection.a1
  if (!anchor) return
  const a = addrOf(anchor)
  const rows = parseTSV(text)
  const updates: { a1: string; input: string }[] = []
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]
    for (let c = 0; c < row.length; c++) {
      const rr = Math.min(dims.rows - 1, a.row + r)
      const cc = Math.min(dims.cols - 1, a.col + c)
      updates.push({ a1: a1Of({ row: rr, col: cc }), input: row[c] })
    }
  }
  setCellsBulk(updates)
}
