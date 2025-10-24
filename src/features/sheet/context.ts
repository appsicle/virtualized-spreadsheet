import { createContext } from 'react'
import type { A1, Cells, Selection, SheetDimensions, Graph, Value } from './types'

export type SheetState = {
  dims: SheetDimensions
  cells: Cells
  graph: Graph
  selection: Selection
}

export type Actions = {
  setSelection: (a1: A1 | null, editing?: boolean) => void
  setSelectionRange: (anchor: A1, focus: A1) => void
  clearSelectionRange: () => void
  setEditorSize: (size: { width: number; height: number } | null) => void
  setCellInput: (a1: A1, input: string) => void
  setCellsBulk: (updates: Array<{ a1: A1; input: string }>) => void
  getValue: (a1: A1) => Value
  getCellInput: (a1: A1) => string
  deleteRow: (row: number) => void
  deleteCol: (col: number) => void
  clearAll: () => void
  smokeTest: () => void
}

// Split contexts for granular subscriptions
export const SelectionContext = createContext<Selection | null>(null)
export const CellsContext = createContext<Cells | null>(null)
export const DimsContext = createContext<SheetDimensions | null>(null)
export const GraphContext = createContext<Graph | null>(null)

// Keep legacy context for backwards compatibility
export const SheetStateContext = createContext<SheetState | null>(null)
export const SheetActionsContext = createContext<Actions | null>(null)
