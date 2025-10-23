import type { AST } from './ast'
import { tokenize, type Tok } from './tokenizer'
import { colToIndex } from './refs'

const PREC: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 }

type BinOp = '+' | '-' | '*' | '/'

function isBinOp(v: string): v is BinOp {
  return v === '+' || v === '-' || v === '*' || v === '/'
}

function isFunctionName(id: string): id is 'SUM' | 'AVG' {
  return id === 'SUM' || id === 'AVG'
}

export function parseFormula(input: string): AST {
  const toks = tokenize(input.startsWith('=') ? input.slice(1) : input)
  let pos = 0
  const peek = () => toks[pos]
  const consume = <T extends Tok['t']>(t: T): Extract<Tok, { t: T }> => {
    const tk = toks[pos]
    if (tk.t !== t) throw new Error('Expected ' + t)
    pos++
    return tk as Extract<Tok, { t: T }>
  }

  function parsePrimary(): AST {
    const tk = peek()
    if (tk.t === 'num') {
      pos++
      return { type: 'num', value: tk.v }
    }
    if (tk.t === 'id') {
      const id = tk.v
      pos++
      if (peek().t === 'lparen') {
        consume('lparen')
        const args: AST[] = []
        if (peek().t !== 'rparen') {
          args.push(parseExpr())
          while (peek().t === 'comma') {
            consume('comma')
            args.push(parseExpr())
          }
        }
        consume('rparen')
        if (!isFunctionName(id)) throw new Error('Unknown function ' + id)
        return { type: 'call', name: id, args }
      } else {
        if (!/[A-Z]+[0-9]+/.test(id)) throw new Error('Unknown identifier ' + id)
        return { type: 'ref', a1: id }
      }
    }
    if (tk.t === 'lparen') {
      consume('lparen')
      const e = parseExpr()
      consume('rparen')
      return e
    }
    throw new Error('Unexpected token')
  }

  function parseRangeOrPrimary(): AST {
    const left = parsePrimary()
    const next = peek()
    if (next.t === 'op' && next.v === ':') {
      if (left.type !== 'ref') throw new Error('Left of range not ref')
      consume('op')
      const right = parsePrimary()
      if (right.type !== 'ref') throw new Error('Right of range not ref')
      return { type: 'range', ref: { start: left.a1, end: right.a1 } }
    }
    return left
  }

  function parseExpr(minPrec = 0): AST {
    let left = parseRangeOrPrimary()
    let next = peek()
    while (next.t === 'op' && isBinOp(next.v) && PREC[next.v] >= minPrec) {
      const opTok = consume('op')
      const op = opTok.v
      if (!isBinOp(op)) throw new Error('Expected binary operator')
      const nextMin = PREC[op] + 1
      let right = parseRangeOrPrimary()
      next = peek()
      while (next.t === 'op' && isBinOp(next.v) && PREC[next.v] >= nextMin) {
        right = parseExpr(nextMin)
        next = peek()
      }
      left = { type: 'bin', op, left, right }
    }
    return left
  }

  const ast = parseExpr()
  if (peek().t !== 'eof') throw new Error('Trailing input')
  function validate(a: AST): void {
    if (a.type === 'ref') {
      if (!/[A-Z]+[1-9][0-9]*/.test(a.a1)) throw new Error('Bad ref ' + a.a1)
      colToIndex(a.a1.match(/[A-Z]+/)![0])
    } else if (a.type === 'bin') {
      validate(a.left)
      validate(a.right)
    } else if (a.type === 'call') {
      a.args.forEach(validate)
    } else if (a.type === 'range') {
      const m1 = a.ref.start.match(/[A-Z]+[1-9][0-9]*/)
      const m2 = a.ref.end.match(/[A-Z]+[1-9][0-9]*/)
      if (!m1 || !m2) throw new Error('Bad range')
    }
  }
  validate(ast)
  return ast
}
