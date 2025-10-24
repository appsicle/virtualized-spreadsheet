import { memo } from 'react'
import type { Selection } from '@/features/sheet/types'
import { CELL_W, CELL_H, HEADER_H, HEADER_W } from '@/features/sheet/constants'

interface SelectionOverlayProps {
  selection: Selection
  scroll: { left: number; top: number }
}

export const SelectionOverlay = memo(function SelectionOverlay({
  selection,
  scroll,
}: SelectionOverlayProps) {
  if (!selection.a1 || selection.editing) {
    return null
  }

  const a = selection.anchor !== undefined && selection.anchor !== null ? selection.anchor : selection.a1
  const f = selection.focus !== undefined && selection.focus !== null ? selection.focus : selection.a1
  const mA = /^([A-Z]+)(\d+)$/.exec(a!)!
  const mF = /^([A-Z]+)(\d+)$/.exec(f!)!
  const colA = [...mA[1]].reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0) - 1
  const rowA = parseInt(mA[2], 10) - 1
  const colF = [...mF[1]].reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0) - 1
  const rowF = parseInt(mF[2], 10) - 1
  const cMin = Math.min(colA, colF)
  const cMax = Math.max(colA, colF)
  const rMin = Math.min(rowA, rowF)
  const rMax = Math.max(rowA, rowF)
  const left = HEADER_W + cMin * CELL_W - scroll.left
  const top = HEADER_H + rMin * CELL_H - scroll.top
  const width = (cMax - cMin + 1) * CELL_W
  const height = (rMax - rMin + 1) * CELL_H

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        border: '2px solid #3b82f6',
        borderRadius: 2,
        pointerEvents: 'none',
        boxSizing: 'border-box',
      }}
    />
  )
})
