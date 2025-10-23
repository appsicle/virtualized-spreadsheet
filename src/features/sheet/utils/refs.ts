import type { A1, CellAddress } from '../types'

const A = 'A'.charCodeAt(0)

export function colToIndex(label: string): number {
  let n = 0
  const L = label.toUpperCase()
  for (let i = 0; i < L.length; i++) n = n * 26 + (L.charCodeAt(i) - A + 1)
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
  if (!m) throw new Error('Invalid A1')
  return { col: colToIndex(m[1]), row: parseInt(m[2], 10) - 1 }
}

export function addressToA1(addr: CellAddress): A1 {
  return `${indexToCol(addr.col)}${addr.row + 1}`
}

export function normalizeA1(a1: A1): A1 {
  return addressToA1(a1ToAddress(a1))
}
