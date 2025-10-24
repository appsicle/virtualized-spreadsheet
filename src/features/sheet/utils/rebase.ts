import type { AST } from './ast'
import { ERR } from './errors'
import { a1ToAddress, addressToA1 } from './refs'

export function rebaseAfterDeleteRow(ast: AST, deletedRow: number): AST {
  function go(n: AST): AST {
    switch (n.type) {
      case 'ref': {
        const a = a1ToAddress(n.a1)
        if (a.row === deletedRow) return { type: 'error', code: ERR.REF }
        if (a.row > deletedRow) a.row -= 1
        return { ...n, a1: addressToA1(a) }
      }
      case 'range': {
        const s = a1ToAddress(n.ref.start)
        const e = a1ToAddress(n.ref.end)
        if (s.row === deletedRow || e.row === deletedRow) {
          return { type: 'error', code: ERR.REF }
        }
        if (s.row > deletedRow) s.row -= 1
        if (e.row > deletedRow) e.row -= 1
        return { type: 'range', ref: { start: addressToA1(s), end: addressToA1(e) } }
      }
      case 'bin':
        return { ...n, left: go(n.left), right: go(n.right) }
      case 'call':
        return { ...n, args: n.args.map(go) }
      case 'num':
        return n
      case 'error':
        return n
    }
  }
  return go(ast)
}

export function rebaseAfterDeleteCol(ast: AST, deletedCol: number): AST {
  function go(n: AST): AST {
    switch (n.type) {
      case 'ref': {
        const a = a1ToAddress(n.a1)
        if (a.col === deletedCol) return { type: 'error', code: ERR.REF }
        if (a.col > deletedCol) a.col -= 1
        return { ...n, a1: addressToA1(a) }
      }
      case 'range': {
        const s = a1ToAddress(n.ref.start)
        const e = a1ToAddress(n.ref.end)
        if (s.col === deletedCol || e.col === deletedCol) {
          return { type: 'error', code: ERR.REF }
        }
        if (s.col > deletedCol) s.col -= 1
        if (e.col > deletedCol) e.col -= 1
        return { type: 'range', ref: { start: addressToA1(s), end: addressToA1(e) } }
      }
      case 'bin':
        return { ...n, left: go(n.left), right: go(n.right) }
      case 'call':
        return { ...n, args: n.args.map(go) }
      case 'num':
        return n
      case 'error':
        return n
    }
  }
  return go(ast)
}
