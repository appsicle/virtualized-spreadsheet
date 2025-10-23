zingage-sheet/
├─ index.html
├─ package.json
├─ postcss.config.cjs
├─ tailwind.config.cjs
├─ tsconfig.json
├─ vite.config.ts
└─ src/
   ├─ App.tsx
   ├─ main.tsx
   ├─ styles.css
   ├─ lib/
   │  └─ util.ts
   ├─ hooks/
   │  └─ useVirtualGrid.ts
   ├─ state/
   │  ├─ sheetStore.ts
   │  ├─ types.ts
   │  ├─ persistence.ts
   │  
   ├─ eval/
   │  ├─ ast.ts
   │  ├─ tokenizer.ts
   │  ├─ parser.ts
   │  ├─ evaluator.ts
   │  ├─ dependencyGraph.ts
   │  ├─ errors.ts
   │  ├─ refs.ts
   │  ├─ ranges.ts
   │  └─ rebase.ts
   └─ components/
      ├─ Toolbar/
      │  └─ Toolbar.tsx
      ├─ FormulaBar/
      │  └─ FormulaBar.tsx
      ├─ Grid/
      │  ├─ Grid.tsx
      │  ├─ Cell.tsx
      │  └─ CellEditor.tsx
      ├─ Panels/
      │  └─ StatusBar.tsx
      └─ ui/           // shadcn-lean: minimal copies to keep repo self-contained
         ├─ button.tsx
         ├─ input.tsx
         └─ separator.tsx

// src/state/types.ts
import type { AST } from '@/eval/ast'
import type { ErrorCode } from '@/eval/errors'

export type A1 = string

export type Value = number | string | ErrorCode

export interface CellData {
  input: string // exactly what the user typed
  ast?: AST     // parsed formula (if input starts with "=")
  value?: Value // evaluated value (undefined means empty)
}

export type Cells = Map<A1, CellData>

export interface SheetDimensions {
  rows: number
  cols: number
}

export interface CellAddress { row: number; col: number } // 0-based

export interface Selection {
  a1: A1 | null
  editing: boolean
}

// src/eval/errors.ts
export type ErrorCode = '#CYCLE' | '#REF!' | '#DIV/0!' | '#VALUE!'

export const ERR = {
  CYCLE: '#CYCLE' as ErrorCode,
  REF: '#REF!' as ErrorCode,
  DIV0: '#DIV/0!' as ErrorCode,
  VALUE: '#VALUE!' as ErrorCode
}

export const isError = (v: unknown): v is ErrorCode =>
  v === ERR.CYCLE || v === ERR.REF || v === ERR.DIV0 || v === ERR.VALUE

// src/eval/refs.ts
import type { A1, CellAddress } from '@/state/types'

const A = 'A'.charCodeAt(0)

export function colToIndex(label: string): number {
  let n = 0
  for (let i = 0; i < label.length; i++) {
    n = n * 26 + (label.charCodeAt(i) - A + 1)
  }
  return n - 1
}

export function indexToCol(i: number): string {
  let n = i + 1
  let s = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(A + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

export function a1ToAddress(a1: A1): CellAddress {
  const m = /^([A-Z]+)(\d+)$/.exec(a1.toUpperCase())
  if (!m) throw new Error(`Invalid A1: ${a1}`)
  return { col: colToIndex(m[1]), row: parseInt(m[2], 10) - 1 }
}

export function addressToA1(addr: CellAddress): A1 {
  return `${indexToCol(addr.col)}${addr.row + 1}`
}

export function normalizeA1(a1: A1): A1 {
  return addressToA1(a1ToAddress(a1))
}

// src/eval/ranges.ts
import { a1ToAddress, addressToA1 } from './refs'
import type { A1 } from '@/state/types'

export interface RangeRef { start: A1; end: A1 } // inclusive

export function expandRange(r: RangeRef): A1[] {
  const s = a1ToAddress(r.start)
  const e = a1ToAddress(r.end)
  const rMin = Math.min(s.row, e.row), rMax = Math.max(s.row, e.row)
  const cMin = Math.min(s.col, e.col), cMax = Math.max(s.col, e.col)
  const out: A1[] = []
  for (let rIdx = rMin; rIdx <= rMax; rIdx++) {
    for (let cIdx = cMin; cIdx <= cMax; cIdx++) {
      out.push(addressToA1({ row: rIdx, col: cIdx }))
    }
  }
  return out
}


// src/eval/ast.ts
import type { RangeRef } from './ranges'

export type AST =
  | { type: 'num'; value: number }
  | { type: 'ref'; a1: string }
  | { type: 'range'; ref: RangeRef }
  | { type: 'bin'; op: '+' | '-' | '*' | '/'; left: AST; right: AST }
  | { type: 'call'; name: 'SUM' | 'AVG'; args: (AST | { type: 'range'; ref: RangeRef })[] }

// src/eval/tokenizer.ts
export type Tok =
  | { t: 'num'; v: number }
  | { t: 'id'; v: string }         // "SUM", "A1", "AA10"
  | { t: 'op'; v: '+' | '-' | '*' | '/' | ':' }
  | { t: 'comma' }
  | { t: 'lparen' }
  | { t: 'rparen' }
  | { t: 'eof' }

export function tokenize(src: string): Tok[] {
  let i = 0; const out: Tok[] = []
  const s = src.trim()

  const isDigit = (ch: string) => ch >= '0' && ch <= '9'
  const isAlpha = (ch: string) => /[A-Za-z]/.test(ch)

  while (i < s.length) {
    const ch = s[i]
    if (ch === ' ' || ch === '\t') { i++; continue }
    if ('+-*/:'.includes(ch)) { out.push({ t: 'op', v: ch as any }); i++; continue }
    if (ch === ',') { out.push({ t: 'comma' }); i++; continue }
    if (ch === '(') { out.push({ t: 'lparen' }); i++; continue }
    if (ch === ')') { out.push({ t: 'rparen' }); i++; continue }
    if (isDigit(ch) || (ch === '.' && isDigit(s[i+1]))) {
      let j = i + 1
      while (j < s.length && (isDigit(s[j]) || s[j] === '.')) j++
      out.push({ t: 'num', v: parseFloat(s.slice(i, j)) })
      i = j; continue
    }
    if (isAlpha(ch)) {
      let j = i + 1
      while (j < s.length && /[A-Za-z0-9]/.test(s[j])) j++
      out.push({ t: 'id', v: s.slice(i, j).toUpperCase() })
      i = j; continue
    }
    throw new Error(`Unexpected "${ch}"`)
  }
  out.push({ t: 'eof' })
  return out
}

// src/eval/parser.ts
import type { AST } from './ast'
import { tokenize, Tok } from './tokenizer'
import { colToIndex } from './refs'

const PRECEDENCE: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 }

export function parseFormula(input: string): AST {
  // assumes input starts after '='
  const toks = tokenize(input.startsWith('=') ? input.slice(1) : input)
  let pos = 0
  const peek = () => toks[pos]
  const consume = <T extends Tok['t']>(t: T): Extract<Tok, { t: T }> => {
    const tk = toks[pos]
    if (tk.t !== t) throw new Error(`Expected ${t}, got ${tk.t}`)
    pos++; return tk as any
  }

  function parsePrimary(): AST {
    const tk = peek()
    if (tk.t === 'num') { pos++; return { type: 'num', value: (tk as any).v } }
    if (tk.t === 'id') {
      const id = (tk as any).v; pos++
      if (peek().t === 'lparen') {
        // function call
        consume('lparen')
        const args: AST[] = []
        if (peek().t !== 'rparen') {
          args.push(parseExpr())
          while (peek().t === 'comma') { consume('comma'); args.push(parseExpr()) }
        }
        consume('rparen')
        if (id !== 'SUM' && id !== 'AVG') throw new Error('Unknown function: ' + id)
        return { type: 'call', name: id, args }
      } else {
        // Could be cell ref like "A1" or identifier; validate A1 (letters+digits, at least one letter and digit)
        if (!/[A-Z]+[0-9]+/.test(id)) throw new Error('Unknown identifier: ' + id)
        return { type: 'ref', a1: id }
      }
    }
    if (tk.t === 'lparen') { consume('lparen'); const e = parseExpr(); consume('rparen'); return e }
    throw new Error(`Unexpected token ${tk.t}`)
  }

  function parseRangeOrPrimary(): AST {
    const left = parsePrimary()
    if (peek().t === 'op' && (peek() as any).v === ':') {
      // range: require left be a ref; right should also be a ref
      if (left.type !== 'ref') throw new Error('Left side of range must be a cell ref')
      consume('op') // :
      const right = parsePrimary()
      if (right.type !== 'ref') throw new Error('Right side of range must be a cell ref')
      return { type: 'range', ref: { start: left.a1, end: right.a1 } }
    }
    return left
  }

  function parseExpr(minPrec = 0): AST {
    let left = parseRangeOrPrimary()
    while (peek().t === 'op' && (PRECEDENCE as any)[(peek() as any).v] >= minPrec) {
      const opTok = consume('op'); const op = (opTok as any).v as '+' | '-' | '*' | '/'
      const nextMin = PRECEDENCE[op] + 1
      let right = parseRangeOrPrimary()
      while (peek().t === 'op' && PRECEDENCE[(peek() as any).v] >= nextMin) {
        right = parseExpr(nextMin)
      }
      left = { type: 'bin', op, left, right }
    }
    return left
  }

  const ast = parseExpr()
  if (peek().t !== 'eof') throw new Error('Trailing input')
  // cheap validation for cell refs like "A0" (row >=1)
  function validate(a: AST): void {
    if (a.type === 'ref') {
      if (!/[A-Z]+[1-9][0-9]*/.test(a.a1)) throw new Error('Bad ref ' + a.a1)
      // also validate column label is valid
      colToIndex(a.a1.match(/[A-Z]+/)![0])
    } else if (a.type === 'bin') { validate(a.left); validate(a.right) }
    else if (a.type === 'call') { a.args.forEach(validate) }
    else if (a.type === 'range') {
      const m1 = a.ref.start.match(/[A-Z]+[1-9][0-9]*/); const m2 = a.ref.end.match(/[A-Z]+[1-9][0-9]*/)
      if (!m1 || !m2) throw new Error('Bad range')
    }
  }
  validate(ast)
  return ast
}
5) Evaluator & dependency graph (with cycle detection)

// src/eval/dependencyGraph.ts
// Maintains deps for recalculation + cycle detection
export type Graph = {
  depsOf: Map<string, Set<string>>        // A -> {B,C} means A depends on B and C
  dependentsOf: Map<string, Set<string>>  // B -> {A}
}

export function newGraph(): Graph {
  return { depsOf: new Map(), dependentsOf: new Map() }
}

export function setDeps(g: Graph, a: string, deps: Set<string>) {
  // remove old
  const old = g.depsOf.get(a) ?? new Set<string>()
  for (const d of old) {
    const rev = g.dependentsOf.get(d)
    if (rev) { rev.delete(a); if (rev.size === 0) g.dependentsOf.delete(d) }
  }
  g.depsOf.set(a, new Set(deps))
  for (const d of deps) {
    if (!g.dependentsOf.has(d)) g.dependentsOf.set(d, new Set())
    g.dependentsOf.get(d)!.add(a)
  }
}

export function removeNode(g: Graph, a: string) {
  const deps = g.depsOf.get(a)
  if (deps) {
    for (const d of deps) g.dependentsOf.get(d)?.delete(a)
    g.depsOf.delete(a)
  }
  const rev = g.dependentsOf.get(a)
  if (rev) {
    for (const r of rev) g.depsOf.get(r)?.delete(a)
    g.dependentsOf.delete(a)
  }
}

export function affectedAfterChange(g: Graph, start: string): Set<string> {
  const out = new Set<string>(); const q = [start]
  while (q.length) {
    const x = q.shift()!
    if (out.has(x)) continue
    out.add(x)
    for (const dep of g.dependentsOf.get(x) ?? []) q.push(dep)
  }
  return out
}

// Kahn topological order with cycle residue
export function topoOrder(g: Graph, nodes: Set<string>): { order: string[]; cyclic: Set<string> } {
  const inDeg = new Map<string, number>()
  for (const n of nodes) {
    let deg = 0
    for (const d of g.depsOf.get(n) ?? []) if (nodes.has(d)) deg++
    inDeg.set(n, deg)
  }
  const q: string[] = []
  for (const [n, deg] of inDeg) if (deg === 0) q.push(n)
  const order: string[] = []

  while (q.length) {
    const n = q.shift()!
    order.push(n)
    for (const dep of g.dependentsOf.get(n) ?? []) {
      if (!nodes.has(dep)) continue
      const d = inDeg.get(dep)!
      inDeg.set(dep, d - 1)
      if (d - 1 === 0) q.push(dep)
    }
  }
  const cyclic = new Set<string>()
  for (const [n, deg] of inDeg) if (deg > 0) cyclic.add(n)
  return { order, cyclic }
}

// src/eval/evaluator.ts
import type { AST } from './ast'
import { expandRange } from './ranges'
import { isError, ERR, type ErrorCode } from './errors'
import type { Value } from '@/state/types'

// Evaluate an AST given a getter for cell values.
// Also collect dependency A1 ids used by the AST.
export function evaluateAST(ast: AST, get: (a1: string) => Value | undefined): { value: Value; deps: Set<string> } {
  const deps = new Set<string>()

  function read(a1: string): Value {
    deps.add(a1)
    const v = get(a1)
    return v === undefined ? 0 : v // empty cells read as 0 in arithmetic
  }

  function coerceNum(v: Value): number | ErrorCode {
    if (isError(v)) return v
    if (typeof v === 'number') return v
    if (typeof v === 'string') {
      const n = Number(v)
      if (Number.isFinite(n)) return n
      return ERR.VALUE
    }
    return ERR.VALUE
  }

  function evalNode(n: AST): Value {
    switch (n.type) {
      case 'num': return n.value
      case 'ref': return read(n.a1)
      case 'range': {
        // Range alone is invalid in expression context; only allowed inside SUM/AVG
        return ERR.VALUE
      }
      case 'bin': {
        const l = evalNode(n.left)
        const r = evalNode(n.right)
        if (isError(l)) return l
        if (isError(r)) return r
        const ln = coerceNum(l); if (isError(ln)) return ln
        const rn = coerceNum(r); if (isError(rn)) return rn
        switch (n.op) {
          case '+': return ln + rn
          case '-': return ln - rn
          case '*': return ln * rn
          case '/': return rn === 0 ? ERR.DIV0 : ln / rn
        }
      }
      case 'call': {
        const nums: number[] = []
        for (const a of n.args) {
          if (a.type === 'range') {
            const cells = expandRange(a.ref)
            for (const id of cells) {
              const v = read(id)
              const cv = coerceNum(v)
              if (isError(cv)) return cv
              nums.push(cv)
            }
          } else {
            const v = evalNode(a)
            if (isError(v)) return v
            const cv = coerceNum(v)
            if (isError(cv)) return cv
            nums.push(cv)
          }
        }
        if (n.name === 'SUM') return nums.reduce((a, b) => a + b, 0)
        if (n.name === 'AVG') return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : ERR.DIV0
        return ERR.VALUE
      }
    }
  }

  const value = evalNode(ast)
  return { value, deps }
}
6) Rebase rules for delete row/column

// src/eval/rebase.ts
import type { AST } from './ast'
import { a1ToAddress, addressToA1 } from './refs'

export function rebaseAfterDeleteRow(ast: AST, deletedRow: number): AST {
  function go(n: AST): AST {
    switch (n.type) {
      case 'ref': {
        const a = a1ToAddress(n.a1)
        if (a.row > deletedRow) a.row -= 1
        return { ...n, a1: addressToA1(a) }
      }
      case 'range': {
        const s = a1ToAddress(n.ref.start)
        const e = a1ToAddress(n.ref.end)
        if (s.row > deletedRow) s.row -= 1
        if (e.row > deletedRow) e.row -= 1
        // do not #REF! a range when an inner row is deleted; it naturally shrinks
        return { type: 'range', ref: { start: addressToA1(s), end: addressToA1(e) } }
      }
      case 'bin': return { ...n, left: go(n.left), right: go(n.right) }
      case 'call': return { ...n, args: n.args.map(go) }
      case 'num': return n
    }
  }
  return go(ast)
}

export function rebaseAfterDeleteCol(ast: AST, deletedCol: number): AST {
  function go(n: AST): AST {
    switch (n.type) {
      case 'ref': {
        const a = a1ToAddress(n.a1)
        if (a.col > deletedCol) a.col -= 1
        return { ...n, a1: addressToA1(a) }
      }
      case 'range': {
        const s = a1ToAddress(n.ref.start)
        const e = a1ToAddress(n.ref.end)
        if (s.col > deletedCol) s.col -= 1
        if (e.col > deletedCol) e.col -= 1
        return { type: 'range', ref: { start: addressToA1(s), end: addressToA1(e) } }
      }
      case 'bin': return { ...n, left: go(n.left), right: go(n.right) }
      case 'call': return { ...n, args: n.args.map(go) }
      case 'num': return n
    }
  }
  return go(ast)
}
7) Store, persistence, selectors

// src/state/persistence.ts
import type { Cells } from './types'

const KEY = 'zingage-sheet:v1'

export function saveToLocalStorage(cells: Cells) {
  const obj: Record<string, any> = {}
  for (const [k, v] of cells) {
    if (v.input?.length) obj[k] = { input: v.input }
  }
  localStorage.setItem(KEY, JSON.stringify(obj))
}

export function loadFromLocalStorage(): Cells {
  const s = localStorage.getItem(KEY)
  const map: Cells = new Map()
  if (!s) return map
  try {
    const obj = JSON.parse(s) as Record<string, { input: string }>
    for (const [k, v] of Object.entries(obj)) map.set(k, { input: v.input })
  } catch { /* ignore */ }
  return map
}


// src/state/sheetStore.ts
import { create } from 'zustand'
import type { A1, Cells, Selection, SheetDimensions, Value } from './types'
import { loadFromLocalStorage, saveToLocalStorage } from './persistence'
import { parseFormula } from '@/eval/parser'
import { evaluateAST } from '@/eval/evaluator'
import { ERR, isError } from '@/eval/errors'
import { newGraph, setDeps, affectedAfterChange, topoOrder, removeNode } from '@/eval/dependencyGraph'
import { addressToA1 } from '@/eval/refs'
import { rebaseAfterDeleteRow, rebaseAfterDeleteCol } from '@/eval/rebase'

const DEFAULT_DIMS: SheetDimensions = { rows: 1000, cols: 1000 }

type SheetState = {
  dims: SheetDimensions
  cells: Cells
  graph: ReturnType<typeof newGraph>
  selection: Selection
  setSelection: (a1: A1 | null, editing?: boolean) => void
  setCellInput: (a1: A1, input: string) => void
  getValue: (a1: A1) => Value | undefined
  deleteRow: (row: number) => void
  deleteCol: (col: number) => void
  clearAll: () => void
  smokeTest: () => void
}

function evaluateAndUpdate(store: SheetState, a1: A1) {
  const cell = store.cells.get(a1)
  if (!cell) return
  if (cell.input.startsWith('=')) {
    try {
      cell.ast = parseFormula(cell.input)
      const { value, deps } = evaluateAST(cell.ast, (id) => store.cells.get(id)?.value)
      setDeps(store.graph, a1, deps)
      cell.value = value
    } catch {
      setDeps(store.graph, a1, new Set())
      cell.value = ERR.VALUE
    }
  } else if (cell.input === '') {
    setDeps(store.graph, a1, new Set())
    cell.ast = undefined
    cell.value = undefined
  } else {
    const n = Number(cell.input)
    cell.ast = undefined
    setDeps(store.graph, a1, new Set())
    cell.value = Number.isFinite(n) ? n : cell.input
  }
}

function recalcAffected(store: SheetState, start: A1) {
  const affected = affectedAfterChange(store.graph, start)
  const { order, cyclic } = topoOrder(store.graph, affected)
  // set #CYCLE first
  for (const id of cyclic) {
    const c = store.cells.get(id)
    if (c) c.value = ERR.CYCLE
  }
  // recalc in order
  for (const id of order) evaluateAndUpdate(store, id)
}

export const useSheetStore = create<SheetState>((set, get) => {
  const cells = loadFromLocalStorage()
  const graph = newGraph()
  // initial evaluation pass
  for (const [a1] of cells) evaluateAndUpdate({ cells, graph } as any, a1)
  return {
    dims: DEFAULT_DIMS,
    cells,
    graph,
    selection: { a1: null, editing: false },
    setSelection: (a1, editing = false) => set({ selection: { a1, editing } }),
    getValue: (a1) => get().cells.get(a1)?.value,
    setCellInput: (a1, input) => {
      const s = get()
      if (input === '') {
        // sparse state: remove empty entries entirely
        if (s.cells.has(a1)) {
          s.cells.delete(a1)
          removeNode(s.graph, a1)
          recalcAffected(s, a1)
          saveToLocalStorage(s.cells)
          set({ cells: s.cells, graph: s.graph })
        }
        return
      }
      if (!s.cells.has(a1)) s.cells.set(a1, { input })
      else s.cells.get(a1)!.input = input
      evaluateAndUpdate(s, a1)
      recalcAffected(s, a1)
      saveToLocalStorage(s.cells)
      set({ cells: s.cells })
    },
    deleteRow: (row) => {
      const s = get()
      const updates: [A1, string][] = []
      // Recreate map with shifted keys & rebased AST
      const next: Cells = new Map()
      for (const [id, cell] of s.cells) {
        const m = /^([A-Z]+)(\d+)$/.exec(id)!
        const r = parseInt(m[2], 10) - 1
        const cLabel = m[1]
        if (r === row) {
          removeNode(s.graph, id)
          continue // drop this row -> deletes cell
        }
        let newId = id
        let newCell = { ...cell }
        if (r > row) {
          const newR = r - 1
          newId = `${cLabel}${newR + 1}`
        }
        if (newCell.ast) {
          const ast = rebaseAfterDeleteRow(newCell.ast, row)
          newCell.ast = ast
          // re-eval collects new deps below
        }
        next.set(newId, newCell)
      }
      s.cells = next
      // rebuild graph & evaluate all
      s.graph = newGraph()
      for (const [a1] of s.cells) evaluateAndUpdate(s as any, a1)
      // Optionally maintain selection
      set({ cells: s.cells, graph: s.graph })
      saveToLocalStorage(s.cells)
    },
    deleteCol: (col) => {
      const s = get()
      const next: Cells = new Map()
      for (const [id, cell] of s.cells) {
        const m = /^([A-Z]+)(\d+)$/.exec(id)!
        const cLabel = m[1]
        const r = parseInt(m[2], 10)
        // derive col index
        const colIdx = [...cLabel].reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0)-64), 0) - 1
        if (colIdx === col) { removeNode(s.graph, id); continue }
        let newId = id
        let newCell = { ...cell }
        if (colIdx > col) {
          // decrement column label
          function indexToCol(i: number) {
            let n = i + 1, s=''; while(n>0){const rem=(n-1)%26; s=String.fromCharCode(65+rem)+s; n=Math.floor((n-1)/26)}; return s
          }
          newId = `${indexToCol(colIdx - 1)}${r}`
        }
        if (newCell.ast) {
          const ast = rebaseAfterDeleteCol(newCell.ast, col)
          newCell.ast = ast
        }
        next.set(newId, newCell)
      }
      s.cells = next
      s.graph = newGraph()
      for (const [a1] of s.cells) evaluateAndUpdate(s as any, a1)
      set({ cells: s.cells, graph: s.graph })
      saveToLocalStorage(s.cells)
    },
    clearAll: () => {
      const s = get()
      s.cells.clear()
      s.graph = newGraph()
      localStorage.removeItem('zingage-sheet:v1')
      set({ cells: s.cells, graph: s.graph, selection: { a1: null, editing: false } })
    },
    smokeTest: () => {
      const s = performance.now()
      const store = get()
      // 10k cells: 100x100 block
      for (let r = 0; r < 100; r++) {
        for (let c = 0; c < 100; c++) {
          const a1 = addressToA1({ row: r, col: c })
          store.setCellInput(a1, String(r * 100 + c))
        }
      }
      // a few SUM/AVG
      store.setCellInput('C105', '=SUM(A1:A100, B1:B100)')
      store.setCellInput('D105', '=AVG(A1:B100)')
      console.log('Smoke test ms:', performance.now() - s)
    }
  }
})
8) Grid virtualization & UI

// src/hooks/useVirtualGrid.ts
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'

export function useVirtualGrid(rows: number, cols: number) {
  const parentRef = useRef<HTMLDivElement>(null)
  const rowVirtualizer = useVirtualizer({
    count: rows + 1, // + header
    estimateSize: () => 28, // px
    getScrollElement: () => parentRef.current
  })
  const colVirtualizer = useVirtualizer({
    horizontal: true,
    count: cols + 1, // + header
    estimateSize: () => 120,
    getScrollElement: () => parentRef.current
  })
  return { parentRef, rowVirtualizer, colVirtualizer }
}



// src/components/Grid/Cell.tsx
import React, { memo } from 'react'
import { useSheetStore } from '@/state/sheetStore'
import { isError } from '@/eval/errors'
import clsx from 'clsx'

export const Cell = memo(function Cell({ a1, selected }: { a1: string; selected: boolean }) {
  const value = useSheetStore((s) => s.getValue(a1))
  const setSel = useSheetStore((s) => s.setSelection)
  const onMouseDown = () => setSel(a1, false)

  const display = value === undefined ? '' : String(value)
  const error = isError(value)

  return (
    <div
      onMouseDown={onMouseDown}
      className={clsx(
        'px-2 whitespace-nowrap overflow-hidden text-ellipsis border-b border-r border-[--grid-border] flex items-center',
        selected && 'outline outline-2 outline-blue-500',
        error && 'text-[--grid-error] font-medium'
      )}
      style={{ width: 'var(--cell-w)', height: 'var(--cell-h)' }}
      title={display}
    >
      {display}
    </div>
  )
})

// src/components/Grid/CellEditor.tsx
import React, { useEffect, useRef } from 'react'
import { useSheetStore } from '@/state/sheetStore'
import { Input } from '@/components/ui/input'

export default function CellEditor({ a1 }: { a1: string }) {
  const setInput = useSheetStore((s) => s.setCellInput)
  const cells = useSheetStore((s) => s.cells)
  const inputRef = useRef<HTMLInputElement>(null)
  const existing = cells.get(a1)?.input ?? ''

  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select() }, [a1])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      setInput(a1, (e.target as HTMLInputElement).value)
      useSheetStore.getState().setSelection(a1, false)
    } else if (e.key === 'Escape') {
      useSheetStore.getState().setSelection(a1, false)
    }
  }

  return (
    <Input
      ref={inputRef}
      defaultValue={existing}
      onKeyDown={onKeyDown}
      onBlur={(e) => { setInput(a1, e.currentTarget.value); useSheetStore.getState().setSelection(a1, false) }}
      className="absolute z-30 px-2 h-[var(--cell-h)] w-[var(--cell-w)]"
    />
  )
}

// src/components/Grid/Grid.tsx
import React, { useMemo } from 'react'
import { useSheetStore } from '@/state/sheetStore'
import { useVirtualGrid } from '@/hooks/useVirtualGrid'
import { indexToCol } from '@/eval/refs'
import { Cell } from './Cell'
import CellEditor from './CellEditor'

const CELL_W = 120
const CELL_H = 28
const HEADER_W = 48
const HEADER_H = 28

export default function Grid() {
  const { rows, cols } = useSheetStore((s) => s.dims)
  const sel = useSheetStore((s) => s.selection)
  const { parentRef, rowVirtualizer, colVirtualizer } = useVirtualGrid(rows, cols)

  const totalHeight = rowVirtualizer.getTotalSize() + HEADER_H
  const totalWidth = colVirtualizer.getTotalSize() + HEADER_W

  return (
    <div className="relative h-full w-full">
      <div
        ref={parentRef}
        className="absolute inset-0 overflow-auto bg-white"
      >
        {/* Scrollable content area */}
        <div style={{ height: totalHeight, width: totalWidth, position: 'relative' }}>
          {/* Column headers */}
          {colVirtualizer.getVirtualItems().map(col => (
            <div
              key={col.key}
              className="sticky top-0 z-20 bg-[--grid-header] border-b border-r border-[--grid-border] text-xs text-gray-600 flex items-center justify-center"
              style={{
                position: 'absolute',
                left: HEADER_W + col.start,
                width: col.size,
                height: HEADER_H
              }}
            >
              {indexToCol(col.index)}
            </div>
          ))}
          {/* Row headers */}
          {rowVirtualizer.getVirtualItems().map(row => (
            <div
              key={row.key}
              className="sticky left-0 z-20 bg-[--grid-header] border-b border-r border-[--grid-border] text-xs text-gray-600 flex items-center justify-center"
              style={{
                position: 'absolute',
                top: HEADER_H + row.start,
                width: HEADER_W,
                height: row.size
              }}
            >
              {row.index + 1}
            </div>
          ))}

          {/* Cells */}
          {rowVirtualizer.getVirtualItems().map(row => (
            colVirtualizer.getVirtualItems().map(col => {
              const a1 = `${indexToCol(col.index)}${row.index + 1}`
              const left = HEADER_W + col.start
              const top = HEADER_H + row.start
              const selected = sel.a1 === a1 && !sel.editing
              const isHeader = false
              return (
                <div
                  key={`${row.key}-${col.key}`}
                  style={{ position: 'absolute', top, left }}
                >
                  <Cell a1={a1} selected={selected}/>
                  {sel.a1 === a1 && sel.editing &&
                    <CellEditor a1={a1} />}
                </div>
              )
            })
          ))}

          {/* Top-left corner cell */}
          <div
            className="sticky top-0 left-0 z-30 bg-[--grid-header] border-b border-r border-[--grid-border]"
            style={{ width: HEADER_W, height: HEADER_H, position: 'absolute' }}
          />
        </div>
      </div>
    </div>
  )
}
9) Formula bar, toolbar, status

// src/components/FormulaBar/FormulaBar.tsx
import React, { useMemo } from 'react'
import { useSheetStore } from '@/state/sheetStore'
import { Input } from '@/components/ui/input'

export default function FormulaBar() {
  const sel = useSheetStore(s => s.selection)
  const val = useSheetStore(s => sel.a1 ? (s.cells.get(sel.a1)?.input ?? '') : '')
  const setInput = useSheetStore(s => s.setCellInput)

  return (
    <div className="border-b border-[--grid-border] p-2 flex gap-2 items-center">
      <div className="text-xs text-gray-500 w-12">fx</div>
      <Input
        value={val}
        onChange={e => sel.a1 && setInput(sel.a1, e.target.value)}
        placeholder="Enter value or =formula"
      />
    </div>
  )
}

// src/components/Toolbar/Toolbar.tsx
import React from 'react'
import { Button } from '@/components/ui/button'
import { useSheetStore } from '@/state/sheetStore'
import { a1ToAddress } from '@/eval/refs'

export default function Toolbar() {
  const delRow = useSheetStore(s => s.deleteRow)
  const delCol = useSheetStore(s => s.deleteCol)
  const smoke = useSheetStore(s => s.smokeTest)
  const clear = useSheetStore(s => s.clearAll)
  const sel = useSheetStore(s => s.selection.a1)

  const row = sel ? a1ToAddress(sel).row : null
  const col = sel ? a1ToAddress(sel).col : null

  return (
    <div className="border-b border-[--grid-border] p-2 flex gap-2 items-center">
      <Button variant="secondary" disabled={row === null} onClick={() => row !== null && delRow(row)}>
        Delete Row{row !== null ? ` ${row + 1}` : ''}
      </Button>
      <Button variant="secondary" disabled={col === null} onClick={() => col !== null && delCol(col)}>
        Delete Column{col !== null ? ` ${col + 1}` : ''}
      </Button>
      <div className="w-px h-6 bg-[--grid-border]" />
      <Button onClick={smoke}>Scale Smoke Test</Button>
      <Button variant="destructive" onClick={clear}>Clear All</Button>
    </div>
  )
}

// src/components/Panels/StatusBar.tsx
import React from 'react'
import { useSheetStore } from '@/state/sheetStore'
import { isError } from '@/eval/errors'

export default function StatusBar() {
  const sel = useSheetStore(s => s.selection.a1)
  const value = useSheetStore(s => sel ? s.getValue(sel) : undefined)
  return (
    <div className="border-t border-[--grid-border] p-2 text-xs text-gray-600 flex justify-between">
      <div>Selected: {sel ?? '—'}</div>
      <div>Value: {value === undefined ? '—' : String(value)}</div>
      <div>{isError(value) ? 'Error' : ''}</div>
    </div>
  )
}
10) App shell

// src/App.tsx
import React, { useEffect } from 'react'
import Grid from '@/components/Grid/Grid'
import Toolbar from '@/components/Toolbar/Toolbar'
import FormulaBar from '@/components/FormulaBar/FormulaBar'
import StatusBar from '@/components/Panels/StatusBar'
import { useSheetStore } from './state/sheetStore'

export default function App() {
  // very small keyboard affordance: Enter to edit, arrows to move
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const s = useSheetStore.getState()
      if (!s.selection.a1) return
      const addr = s.selection.a1
      if (e.key === 'Enter') {
        s.setSelection(addr, true)
        e.preventDefault()
      }
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
        const m = /^([A-Z]+)(\d+)$/.exec(addr)!
        let col = m[1], row = parseInt(m[2], 10)
        const colToIndex = (L:string) => [...L].reduce((a,ch)=>a*26+ch.charCodeAt(0)-64,0)-1
        const indexToCol = (i:number)=>{let n=i+1,s='';while(n>0){const r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26)}return s}
        const ci = colToIndex(col)
        if (e.key === 'ArrowUp') row = Math.max(1, row-1)
        if (e.key === 'ArrowDown') row = row + 1
        if (e.key === 'ArrowLeft') col = indexToCol(Math.max(0, ci-1))
        if (e.key === 'ArrowRight') col = indexToCol(ci+1)
        s.setSelection(`${col}${row}`, false)
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="h-full grid grid-rows-[auto_auto_1fr_auto]">
      <Toolbar />
      <FormulaBar />
      <Grid />
      <StatusBar />
    </div>
  )
}
11) Minimal shadcn-style primitives (checked in so it runs)

// src/components/ui/button.tsx
import * as React from 'react'
import clsx from 'clsx'

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'secondary' | 'destructive' | 'ghost'
}
export const Button = React.forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant='default', ...props }, ref
) {
  const base = 'inline-flex items-center justify-center rounded border text-sm h-8 px-3'
  const styles = {
    default: 'bg-black text-white border-transparent hover:opacity-90',
    secondary: 'bg-white text-black border-gray-300 hover:bg-gray-50',
    destructive: 'bg-red-600 text-white border-transparent hover:bg-red-700',
    ghost: 'bg-transparent border-transparent hover:bg-gray-100'
  }[variant]
  return <button ref={ref} className={clsx(base, styles, className)} {...props} />
})

// src/components/ui/input.tsx
import * as React from 'react'
import clsx from 'clsx'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={clsx("h-8 w-full rounded border border-gray-300 px-2 text-sm outline-none focus:ring-2 focus:ring-blue-500", className)}
        {...props}
      />
    )
  }
)

// src/components/ui/separator.tsx
import React from 'react'
export function Separator() {
  return <div className="h-px bg-gray-200 w-full" />
}

12) Utilities & hooks

// src/lib/util.ts
export function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)) }

// (Reserved hooks can be added as needed)
