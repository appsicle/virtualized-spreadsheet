import { a1ToAddress, addressToA1 } from '@/features/sheet/utils/refs'

export function clientPointToCell(args: {
  clientX: number
  clientY: number
  container: HTMLElement
  scrollLeft: number
  scrollTop: number
  headerW: number
  headerH: number
  cellW: number
  cellH: number
  maxRows: number
  maxCols: number
}): { row: number; col: number } {
  const rect = args.container.getBoundingClientRect()
  const x = args.clientX - rect.left + args.scrollLeft - args.headerW
  const y = args.clientY - rect.top + args.scrollTop - args.headerH
  const col = Math.max(0, Math.min(args.maxCols - 1, Math.floor(x / args.cellW)))
  const row = Math.max(0, Math.min(args.maxRows - 1, Math.floor(y / args.cellH)))
  return { row, col }
}

export function rectForRange(args: {
  r1: number
  c1: number
  r2: number
  c2: number
  headerW: number
  headerH: number
  cellW: number
  cellH: number
  scrollLeft: number
  scrollTop: number
}) {
  const rMin = Math.min(args.r1, args.r2)
  const rMax = Math.max(args.r1, args.r2)
  const cMin = Math.min(args.c1, args.c2)
  const cMax = Math.max(args.c1, args.c2)
  const left = args.headerW + cMin * args.cellW - args.scrollLeft
  const top = args.headerH + rMin * args.cellH - args.scrollTop
  const width = (cMax - cMin + 1) * args.cellW
  const height = (rMax - rMin + 1) * args.cellH
  return { left, top, width, height }
}

export const a1Of = addressToA1
export const addrOf = a1ToAddress
