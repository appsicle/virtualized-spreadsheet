import type { AST } from './ast'
import { expandRange } from './ranges'
import { ERR, isError } from './errors'
import type { Value } from '../types'

export function evaluateAST(
  ast: AST,
  get: (a1: string) => Value
): { value: Value; deps: Set<string> } {
  const deps = new Set<string>()

  function read(a1: string): Value {
    deps.add(a1)
    const v = get(a1)
    return v === undefined ? 0 : v
  }

  function coerceNum(v: Value): number | typeof ERR.VALUE | typeof ERR.DIV0 | string {
    if (isError(v)) return v
    if (typeof v === 'number') return v
    if (typeof v === 'string') {
      const n = Number(v)
      return Number.isFinite(n) ? n : ERR.VALUE
    }
    return 0
  }

  function evalNode(n: AST): Value {
    switch (n.type) {
      case 'num':
        return n.value
      case 'error':
        return n.code
      case 'ref':
        return read(n.a1)
      case 'range':
        return ERR.VALUE
      case 'bin': {
        const l = evalNode(n.left)
        const r = evalNode(n.right)
        if (isError(l)) return l
        if (isError(r)) return r
        const ln = coerceNum(l)
        if (isError(ln)) return ln
        const rn = coerceNum(r)
        if (isError(rn)) return rn
        switch (n.op) {
          case '+':
            return (ln as number) + (rn as number)
          case '-':
            return (ln as number) - (rn as number)
          case '*':
            return (ln as number) * (rn as number)
          case '/':
            return (rn as number) === 0 ? ERR.DIV0 : (ln as number) / (rn as number)
        }
        return ERR.VALUE
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
              nums.push(cv as number)
            }
          } else {
            const v = evalNode(a)
            if (isError(v)) return v
            const cv = coerceNum(v)
            if (isError(cv)) return cv
            nums.push(cv as number)
          }
        }
        if (n.name === 'SUM') return nums.reduce((a, b) => a + b, 0)
        if (n.name === 'AVG')
          return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : ERR.DIV0
        return ERR.VALUE
      }
    }
  }

  const value = evalNode(ast)
  return { value, deps }
}
