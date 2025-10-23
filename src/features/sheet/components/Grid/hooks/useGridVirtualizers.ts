import { useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { SheetDimensions } from '@/features/sheet/types'
import { HEADER_H, HEADER_W } from '@/features/sheet/constants'

interface UseGridVirtualizersParams {
  dims: SheetDimensions
  parentRef: React.RefObject<HTMLDivElement | null>
  cellWidth: number
  cellHeight: number
}

export function useGridVirtualizers({
  dims,
  parentRef,
  cellWidth,
  cellHeight,
}: UseGridVirtualizersParams) {
  const rowVirtualizer = useVirtualizer({
    count: dims.rows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => cellHeight,
    // Lower overscan to reduce initial mount cost
    overscan: 4,
  })

  const columnVirtualizer = useVirtualizer({
    count: dims.cols,
    getScrollElement: () => parentRef.current,
    estimateSize: () => cellWidth,
    // Lower overscan to reduce initial mount cost
    overscan: 6,
    horizontal: true,
  })

  const virtualRows = rowVirtualizer.getVirtualItems()
  const virtualCols = columnVirtualizer.getVirtualItems()

  // Flatten virtual cells into single array for better performance
  const virtualCells = useMemo(() => {
    const cells = []
    for (const virtualRow of virtualRows) {
      for (const virtualCol of virtualCols) {
        cells.push({
          key: `${virtualRow.key}-${virtualCol.key}`,
          row: virtualRow.index,
          col: virtualCol.index,
          rowStart: virtualRow.start,
          colStart: virtualCol.start,
        })
      }
    }
    return cells
  }, [virtualRows, virtualCols])

  const totalHeight = HEADER_H + rowVirtualizer.getTotalSize()
  const totalWidth = HEADER_W + columnVirtualizer.getTotalSize()

  return {
    rowVirtualizer,
    columnVirtualizer,
    virtualRows,
    virtualCols,
    virtualCells,
    totalHeight,
    totalWidth,
  }
}
