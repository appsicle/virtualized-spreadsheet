import { useContext } from 'react'
import {
  SheetStateContext,
  SheetActionsContext,
  SelectionContext,
  CellsContext,
  DimsContext,
  GraphContext,
} from './context'

// Granular hooks - subscribe only to specific parts of state
export function useSelection() {
  const ctx = useContext(SelectionContext)
  if (!ctx) throw new Error('No SheetProvider')
  return ctx
}

export function useCells() {
  const ctx = useContext(CellsContext)
  if (!ctx) throw new Error('No SheetProvider')
  return ctx
}

export function useDims() {
  const ctx = useContext(DimsContext)
  if (!ctx) throw new Error('No SheetProvider')
  return ctx
}

export function useGraph() {
  const ctx = useContext(GraphContext)
  if (!ctx) throw new Error('No SheetProvider')
  return ctx
}

// Legacy hook - returns all state (use sparingly)
export function useSheetState() {
  const ctx = useContext(SheetStateContext)
  if (!ctx) throw new Error('No SheetProvider')
  return ctx
}

export function useSheetActions() {
  const ctx = useContext(SheetActionsContext)
  if (!ctx) throw new Error('No SheetProvider')
  return ctx
}
