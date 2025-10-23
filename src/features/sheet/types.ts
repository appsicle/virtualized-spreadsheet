export type A1 = string

export type ErrorCode = '#CYCLE' | '#REF!' | '#DIV/0!' | '#VALUE!'

export type Value = number | string | ErrorCode | undefined

export interface CellAddress {
  row: number
  col: number
}

// Formula engine types
export interface RangeRef {
  start: A1
  end: A1
}

export type AST =
  | { type: 'num'; value: number }
  | { type: 'ref'; a1: string }
  | { type: 'range'; ref: RangeRef }
  | { type: 'bin'; op: '+' | '-' | '*' | '/'; left: AST; right: AST }
  | { type: 'call'; name: 'SUM' | 'AVG'; args: AST[] }

export type Graph = {
  depsOf: Map<string, Set<string>>
  dependentsOf: Map<string, Set<string>>
}

export interface CellData {
  input: string
  ast?: AST
  value?: Value
}

export type Cells = Map<A1, CellData>

export interface SheetDimensions {
  rows: number
  cols: number
}

export interface Selection {
  a1: A1 | null
  editing: boolean
  // Optional rectangular selection range
  anchor?: A1 | null
  focus?: A1 | null
  // Optional expanded editor dimensions (px)
  editorSize?: { width: number; height: number } | null
}
