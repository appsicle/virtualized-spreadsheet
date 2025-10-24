import { memo } from 'react'
import { CELL_W, CELL_H } from '@/features/sheet/constants'

interface ReadOnlyCellProps {
  a1: string
  value: string | number | undefined
  error: boolean
  offsetX: number
  offsetY: number
}

export const ReadOnlyCell = memo(function ReadOnlyCell({
  a1,
  value,
  error,
  offsetX,
  offsetY,
}: ReadOnlyCellProps) {
  const display = value === undefined ? '' : String(value)

  return (
    <div
      data-a1={a1}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: CELL_W,
        height: CELL_H,
        boxSizing: 'border-box',
        border: 'none',
        borderRight: '1px solid #e5e7eb',
        borderBottom: '1px solid #e5e7eb',
        padding: '0 8px',
        lineHeight: `${CELL_H}px`,
        background: '#fff',
        color: error ? '#dc2626' : '#111827',
        fontSize: 'inherit',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        cursor: 'default',
        transform: `translate(${offsetX}px, ${offsetY}px)`,
      }}
      title={display}
    >
      {display}
    </div>
  )
})
