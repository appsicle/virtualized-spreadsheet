import { memo } from 'react'
import type { VirtualItem } from '@tanstack/react-virtual'
import { indexToCol } from '@/features/sheet/utils/refs'
import type { SheetDimensions } from '@/features/sheet/types'
import { CELL_W, HEADER_H, HEADER_W } from '@/features/sheet/constants'

interface ColumnHeadersProps {
  virtualCols: VirtualItem[]
  dims: SheetDimensions
  onColumnSelect: (col: number) => void
  onColumnContextMenu: (col: number, x: number, y: number) => void
}

export const ColumnHeaders = memo(function ColumnHeaders({
  virtualCols,
  onColumnSelect,
  onColumnContextMenu,
}: ColumnHeadersProps) {
  return (
    <>
      {virtualCols.map((virtualCol) => {
        const c = virtualCol.index
        return (
          <div
            key={virtualCol.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: CELL_W,
              height: HEADER_H,
              background: '#f8fafc',
              borderBottom: '1px solid #e5e7eb',
              borderRight: '1px solid #e5e7eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              color: '#6b7280',
              transform: `translateX(${HEADER_W + virtualCol.start}px)`,
              boxSizing: 'border-box',
            }}
            onMouseDown={() => onColumnSelect(c)}
            onContextMenu={(e) => {
              e.preventDefault()
              onColumnContextMenu(c, e.clientX, e.clientY)
            }}
          >
            {indexToCol(c)}
          </div>
        )
      })}
    </>
  )
})
