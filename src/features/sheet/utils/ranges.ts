import { a1ToAddress, addressToA1 } from './refs'
import type { A1, RangeRef } from '../types'

export function expandRange(r: RangeRef): A1[] {
  const s = a1ToAddress(r.start)
  const e = a1ToAddress(r.end)
  const rMin = Math.min(s.row, e.row),
    rMax = Math.max(s.row, e.row)
  const cMin = Math.min(s.col, e.col),
    cMax = Math.max(s.col, e.col)
  const out: A1[] = []
  for (let rr = rMin; rr <= rMax; rr++) {
    for (let cc = cMin; cc <= cMax; cc++) out.push(addressToA1({ row: rr, col: cc }))
  }
  return out
}
