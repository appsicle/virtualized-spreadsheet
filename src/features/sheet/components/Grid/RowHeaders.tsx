import { memo } from 'react'
import type { VirtualItem } from '@tanstack/react-virtual'
import { CELL_H, HEADER_H, HEADER_W } from '@/features/sheet/constants'

interface RowHeadersProps {
  virtualRows: VirtualItem[]
  onRowSelect: (row: number) => void
  onRowContextMenu: (row: number, x: number, y: number) => void
}

export const RowHeaders = memo(function RowHeaders({
  virtualRows,
  onRowSelect,
  onRowContextMenu,
}: RowHeadersProps) {
  return (
    <>
      {virtualRows.map((virtualRow) => {
        const r = virtualRow.index
        return (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: HEADER_W,
              height: CELL_H,
              background: '#f8fafc',
              borderBottom: '1px solid #e5e7eb',
              borderRight: '1px solid #e5e7eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              color: '#6b7280',
              transform: `translateY(${HEADER_H + virtualRow.start}px)`,
              boxSizing: 'border-box',
            }}
            onMouseDown={() => onRowSelect(r)}
            onContextMenu={(e) => {
              e.preventDefault()
              onRowContextMenu(r, e.clientX, e.clientY)
            }}
          >
            {r + 1}
          </div>
        )
      })}
    </>
  )
})
