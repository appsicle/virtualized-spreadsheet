import React, { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import type { A1, Cells, Graph, SheetDimensions } from './types'
import type { SheetState, Actions } from './context'
import {
  SheetStateContext,
  SheetActionsContext,
  SelectionContext,
  CellsContext,
  DimsContext,
  GraphContext,
} from './context'
import { parseFormula } from './utils/parser'
import { evaluateAST } from './utils/evaluator'
import { ERR } from './utils/errors'
import {
  newGraph,
  setDeps,
  affectedAfterChange,
  topoOrder,
  removeNode,
} from './utils/dependencyGraph'
import { indexToCol } from './utils/refs'
import { rebaseAfterDeleteRow, rebaseAfterDeleteCol } from './utils/rebase'

const DEFAULT_DIMS: SheetDimensions = { rows: 1000, cols: 1000 }

const KEY = 'spreadsheet:v1'

function saveToLocalStorage(cells: Cells, isSmokeTestActive: boolean) {
  if (isSmokeTestActive) return // Skip saving during smoke test
  const obj: Record<string, { input: string }> = {}
  for (const [k, v] of cells) if (v.input.length) obj[k] = { input: v.input }
  localStorage.setItem(KEY, JSON.stringify(obj))
}

function loadFromLocalStorage(): Cells {
  const s = localStorage.getItem(KEY)
  const map: Cells = new Map()
  if (!s) return map
  try {
    const obj = JSON.parse(s) as Record<string, { input: string }>
    for (const [k, v] of Object.entries(obj)) map.set(k, { input: v.input })
  } catch {
    console.error('Error loading from localStorage', s)
  }
  return map
}

function evaluateAndUpdate(state: SheetState, a1: A1, opts?: { useExistingAST?: boolean }) {
  const cell = state.cells.get(a1)
  if (!cell) return
  if (cell.input.startsWith('=')) {
    try {
      // During structural updates (row/col delete), we may provide a pre-rebased AST.
      const ast = (opts && opts.useExistingAST && cell.ast) ? cell.ast : parseFormula(cell.input)
      cell.ast = ast
      const { value, deps } = evaluateAST(ast, (id) => {
        const c = state.cells.get(id)
        return c ? c.value : undefined
      })
      setDeps(state.graph, a1, deps)
      cell.value = value
    } catch {
      setDeps(state.graph, a1, new Set())
      cell.value = ERR.VALUE
    }
  } else if (cell.input === '') {
    setDeps(state.graph, a1, new Set())
    cell.ast = undefined
    cell.value = undefined
  } else {
    const n = Number(cell.input)
    cell.ast = undefined
    setDeps(state.graph, a1, new Set())
    cell.value = Number.isFinite(n) ? n : cell.input
  }
}

function recalcAffected(state: SheetState, start: A1 | Set<A1>, opts?: { useExistingAST?: boolean }) {
  const seeds: Set<A1> = start instanceof Set ? start : new Set([start])
  const affected = new Set<string>()
  for (const s of seeds) for (const n of affectedAfterChange(state.graph, s)) affected.add(n)
  const { order, cyclic } = topoOrder(state.graph, affected)
  for (const id of cyclic) {
    const c = state.cells.get(id)
    if (c) c.value = ERR.CYCLE
  }
  const useExisting = opts ? opts.useExistingAST : undefined
  for (const id of order) evaluateAndUpdate(state, id as A1, { useExistingAST: useExisting })
}

type ReducerAction =
  | { t: 'init'; cells: Cells; graph: Graph }
  | { t: 'setSelection'; a1: A1 | null; editing: boolean }
  | { t: 'setRange'; anchor: A1 | null; focus: A1 | null }
  | { t: 'clearRange' }
  | { t: 'setEditorSize'; size: { width: number; height: number } | null }
  | { t: 'setCells'; cells: Cells; graph?: Graph }
  | { t: 'setCellsBulk'; cells: Cells; graph: Graph }
  | { t: 'setSmokeTest'; active: boolean }

function reducer(state: SheetState, action: ReducerAction): SheetState {
  switch (action.t) {
    case 'init':
      return { ...state, cells: action.cells, graph: action.graph }
    case 'setSelection':
      // Don't create new object if a1/editing haven't changed (prevents re-renders)
      if (
        state.selection.a1 === action.a1 &&
        state.selection.editing === action.editing &&
        state.selection.anchor === null &&
        state.selection.focus === null
      ) {
        return state
      }
      return {
        ...state,
        selection: {
          ...state.selection,
          a1: action.a1,
          editing: action.editing,
          anchor: null,
          focus: null,
        },
      }
    case 'setRange':
      // Don't create new object if anchor/focus haven't changed (prevents re-renders)
      if (
        state.selection.anchor === action.anchor &&
        state.selection.focus === action.focus
      ) {
        return state
      }
      return {
        ...state,
        selection: { ...state.selection, anchor: action.anchor, focus: action.focus },
      }
    case 'clearRange':
      return { ...state, selection: { ...state.selection, anchor: null, focus: null } }
    case 'setEditorSize':
      return { ...state, selection: { ...state.selection, editorSize: action.size } }
    case 'setCells':
      return { ...state, cells: action.cells, graph: action.graph !== undefined ? action.graph : state.graph }
    case 'setCellsBulk': {
      return { ...state, cells: action.cells, graph: action.graph }
    }
    case 'setSmokeTest':
      return { ...state, isSmokeTestActive: action.active }
  }
}

export function SheetProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    dims: DEFAULT_DIMS,
    cells: new Map(),
    graph: newGraph(),
    selection: { a1: null, editing: false, anchor: null, focus: null, editorSize: null },
    isSmokeTestActive: false,
  })

  // Use ref to keep stable reference to cells for getValue/getCellInput
  const cellsRef = useRef(state.cells)
  cellsRef.current = state.cells

  useEffect(() => {
    const cells = loadFromLocalStorage()
    const graph = newGraph()
    const init: SheetState = { ...state, cells, graph }
    for (const [a1] of cells) evaluateAndUpdate(init, a1)
    dispatch({ t: 'init', cells, graph })
  }, [])

  const setSelection = useCallback((a1: A1 | null, editing = false) => {
    dispatch({ t: 'setSelection', a1, editing })
  }, [])

  const setSelectionRange = useCallback((anchor: A1, focus: A1) => {
    dispatch({ t: 'setRange', anchor, focus })
  }, [])

  const clearSelectionRange = useCallback(() => {
    dispatch({ t: 'clearRange' })
  }, [])

  const setEditorSize = useCallback((size: { width: number; height: number } | null) => {
    dispatch({ t: 'setEditorSize', size })
  }, [])

  const setCellInput = useCallback(
    (a1: A1, input: string) => {
      const s: SheetState = { ...state, cells: new Map(state.cells), graph: state.graph }
      if (input === '') {
        if (s.cells.has(a1)) {
          // Capture dependents BEFORE removing from graph and include the changed id
          const seeds = new Set<A1>()
          const dependents = state.graph.dependentsOf.get(a1)
          if (dependents) for (const d of dependents) seeds.add(d as A1)
          seeds.add(a1)
          s.cells.delete(a1)
          removeNode(s.graph, a1)
          recalcAffected(s, seeds, { useExistingAST: true })
          saveToLocalStorage(s.cells, state.isSmokeTestActive)
          dispatch({ t: 'setCells', cells: s.cells, graph: s.graph })
        }
        return
      }
      if (!s.cells.has(a1)) s.cells.set(a1, { input })
      else s.cells.get(a1)!.input = input
      evaluateAndUpdate(s, a1)
      recalcAffected(s, a1)
      saveToLocalStorage(s.cells, state.isSmokeTestActive)
      dispatch({ t: 'setCells', cells: s.cells })
    },
    [state]
  )

  const setCellsBulk = useCallback(
    (updates: Array<{ a1: A1; input: string }>) => {
      if (updates.length === 0) return
      // Incremental update: avoid rebuilding the entire graph/cell set
      const s: SheetState = { ...state, cells: new Map(state.cells), graph: state.graph }

      // Collect seeds BEFORE mutating the graph (state.graph === s.graph)
      const willChange = new Set<A1>()
      for (const { a1 } of updates) willChange.add(a1)
      const seeds = new Set<A1>()
      for (const id of willChange) {
        const dependents = state.graph.dependentsOf.get(id)
        if (dependents) for (const d of dependents) seeds.add(d as A1)
        seeds.add(id)
      }

      const changed = new Set<A1>()
      for (const { a1, input } of updates) {
        changed.add(a1)
        if (input === '') {
          if (s.cells.has(a1)) {
            s.cells.delete(a1)
            removeNode(s.graph, a1)
          }
          continue
        }
        if (!s.cells.has(a1)) s.cells.set(a1, { input })
        else s.cells.get(a1)!.input = input
        evaluateAndUpdate(s, a1)
      }

      recalcAffected(s, seeds, { useExistingAST: true })

      // Bump graph identity to notify context consumers without deep cloning maps
      const graphRef = { depsOf: s.graph.depsOf, dependentsOf: s.graph.dependentsOf }

      saveToLocalStorage(s.cells, state.isSmokeTestActive)
      dispatch({ t: 'setCellsBulk', cells: s.cells, graph: graphRef as Graph })
    },
    [state]
  )

  const getValue = useCallback((a1: A1) => {
    const c = cellsRef.current.get(a1)
    return c ? c.value : undefined
  }, [])

  const getCellInput = useCallback((a1: A1) => {
    const cell = cellsRef.current.get(a1)
    return cell ? cell.input : ''
  }, [])

  const deleteRow = useCallback(
    (row: number) => {
      const s: SheetState = { ...state, cells: new Map(), graph: newGraph() }
      for (const [id, cell] of state.cells) {
        const m = /^([A-Z]+)(\d+)$/.exec(id)!
        const r = parseInt(m[2], 10) - 1
        const cLabel = m[1]
        if (r === row) continue
        let newId = id
        const newCell = { ...cell }
        if (r > row) {
          const newR = r - 1
          newId = `${cLabel}${newR + 1}`
        }
        if (newCell.ast) newCell.ast = rebaseAfterDeleteRow(newCell.ast, row)
        s.cells.set(newId, newCell)
      }
      for (const [a1] of s.cells) evaluateAndUpdate(s, a1, { useExistingAST: true })
      dispatch({ t: 'setCells', cells: s.cells, graph: s.graph })
      saveToLocalStorage(s.cells, state.isSmokeTestActive)
    },
    [state]
  )

  const deleteCol = useCallback(
    (col: number) => {
      const s: SheetState = { ...state, cells: new Map(), graph: newGraph() }
      for (const [id, cell] of state.cells) {
        const m = /^([A-Z]+)(\d+)$/.exec(id)!
        const cLabel = m[1]
        const r = parseInt(m[2], 10)
        const colIdx = [...cLabel].reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0) - 1
        if (colIdx === col) continue
        let newId = id
        const newCell = { ...cell }
        if (colIdx > col) newId = `${indexToCol(colIdx - 1)}${r}`
        if (newCell.ast) newCell.ast = rebaseAfterDeleteCol(newCell.ast, col)
        s.cells.set(newId, newCell)
      }
      for (const [a1] of s.cells) evaluateAndUpdate(s, a1, { useExistingAST: true })
      dispatch({ t: 'setCells', cells: s.cells, graph: s.graph })
      saveToLocalStorage(s.cells, state.isSmokeTestActive)
    },
    [state]
  )

  const clearAll = useCallback(() => {
    const s: SheetState = { ...state, cells: new Map(), graph: newGraph() }
    localStorage.removeItem(KEY)
    dispatch({ t: 'setCells', cells: s.cells, graph: s.graph })
    dispatch({ t: 'setSmokeTest', active: false })
  }, [state])

  const smokeTest = useCallback(() => {
    const t0 = performance.now()
    const totalRows = state.dims.rows
    const totalCols = state.dims.cols
    const totalCells = totalRows * totalCols
    console.log(`Starting smoke test: ${totalRows} rows × ${totalCols} cols = ${totalCells.toLocaleString()} cells`)

    // Set smoke test flag to prevent localStorage saves
    dispatch({ t: 'setSmokeTest', active: true })

    // Step 1: Generate values using Float64Array (fast single allocation)
    const data = new Float64Array(totalCells)
    for (let i = 0; i < totalCells; i++) {
      data[i] = i
    }

    // Step 2: Build Map directly without evaluation
    const cells: Cells = new Map()
    for (let row = 0; row < totalRows; row++) {
      for (let col = 0; col < totalCols; col++) {
        const a1 = `${indexToCol(col)}${row + 1}` as A1
        const value = data[row * totalCols + col]
        cells.set(a1, {
          input: String(value),
          value: value,  // Pre-computed, skip evaluation
          ast: undefined
        })
      }
    }
    console.log(`Built Map with ${cells.size.toLocaleString()} entries in ${(performance.now() - t0).toFixed(2)}ms`)

    // Step 3: Dispatch on next tick to allow UI to update
    const graph = newGraph()
    console.log('[smokeTest] Scheduling dispatch on next tick...')

    setTimeout(() => {
      console.log('[smokeTest] Dispatching state update...')
      dispatch({ t: 'setCellsBulk', cells, graph })
      const elapsed = performance.now() - t0
      console.log(`Smoke test complete! ${totalCells.toLocaleString()} cells in ${elapsed.toFixed(2)}ms`)

      // Force a paint by scheduling another microtask
      requestAnimationFrame(() => {
        console.log('[smokeTest] First paint opportunity')
        requestAnimationFrame(() => {
          console.log('[smokeTest] Second paint opportunity - cells should be visible now')
        })
      })
    }, 0)
  }, [state])

  const actions: Actions = useMemo(
    () => ({
      setSelection,
      setSelectionRange,
      clearSelectionRange,
      setEditorSize,
      setCellInput,
      setCellsBulk,
      getValue,
      getCellInput,
      deleteRow,
      deleteCol,
      clearAll,
      smokeTest,
    }),
    [
      setSelection,
      setSelectionRange,
      clearSelectionRange,
      setEditorSize,
      setCellInput,
      setCellsBulk,
      getValue,
      getCellInput,
      deleteRow,
      deleteCol,
      clearAll,
      smokeTest,
    ]
  )

  return (
    <SheetStateContext.Provider value={state}>
      <SheetActionsContext.Provider value={actions}>
        <SelectionContext.Provider value={state.selection}>
          <CellsContext.Provider value={state.cells}>
            <DimsContext.Provider value={state.dims}>
              <GraphContext.Provider value={state.graph}>{children}</GraphContext.Provider>
            </DimsContext.Provider>
          </CellsContext.Provider>
        </SelectionContext.Provider>
      </SheetActionsContext.Provider>
    </SheetStateContext.Provider>
  )
}
