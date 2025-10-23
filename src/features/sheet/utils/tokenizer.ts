export type Tok =
  | { t: 'num'; v: number }
  | { t: 'id'; v: string }
  | { t: 'op'; v: '+' | '-' | '*' | '/' | ':' }
  | { t: 'comma' }
  | { t: 'lparen' }
  | { t: 'rparen' }
  | { t: 'eof' }

export function tokenize(src: string): Tok[] {
  let i = 0
  const out: Tok[] = []
  const s = src.trim()
  const isDigit = (ch: string) => ch >= '0' && ch <= '9'
  const isAlpha = (ch: string) => /[A-Za-z]/.test(ch)
  const isOperator = (ch: string): ch is '+' | '-' | '*' | '/' | ':' => {
    return ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === ':'
  }
  while (i < s.length) {
    const ch = s[i]
    if (ch === ' ' || ch === '\t') {
      i++
      continue
    }
    if (isOperator(ch)) {
      out.push({ t: 'op', v: ch })
      i++
      continue
    }
    if (ch === ',') {
      out.push({ t: 'comma' })
      i++
      continue
    }
    if (ch === '(') {
      out.push({ t: 'lparen' })
      i++
      continue
    }
    if (ch === ')') {
      out.push({ t: 'rparen' })
      i++
      continue
    }
    if (isDigit(ch) || (ch === '.' && isDigit(s[i + 1]))) {
      let j = i + 1
      while (j < s.length && (isDigit(s[j]) || s[j] === '.')) j++
      out.push({ t: 'num', v: parseFloat(s.slice(i, j)) })
      i = j
      continue
    }
    if (isAlpha(ch)) {
      let j = i + 1
      while (j < s.length && /[A-Za-z0-9]/.test(s[j])) j++
      out.push({ t: 'id', v: s.slice(i, j).toUpperCase() })
      i = j
      continue
    }
    throw new Error(`Unexpected ${ch}`)
  }
  out.push({ t: 'eof' })
  return out
}
