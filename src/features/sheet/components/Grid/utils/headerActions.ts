import { indexToCol } from '@/features/sheet/utils/refs'
import type { SheetDimensions } from '@/features/sheet/types'

export function selectEntireColumn(
  col: number,
  dims: SheetDimensions,
  setSelection: (a1: string, editing?: boolean) => void,
  setSelectionRange: (anchor: string, focus: string) => void
) {
  const top = `${indexToCol(col)}1`
  const bottom = `${indexToCol(col)}${dims.rows}`
  setSelection(top, false)
  setSelectionRange(top, bottom)
}

export function selectEntireRow(
  row: number,
  dims: SheetDimensions,
  setSelection: (a1: string, editing?: boolean) => void,
  setSelectionRange: (anchor: string, focus: string) => void
) {
  const left = `A${row + 1}`
  const right = `${indexToCol(dims.cols - 1)}${row + 1}`
  setSelection(left, false)
  setSelectionRange(left, right)
}

export function deleteColumn(col: number, doDelete: (col: number) => void) {
  doDelete(col)
}

export function deleteRow(row: number, doDelete: (row: number) => void) {
  doDelete(row)
}
