import { useCallback, useRef } from 'react'
import { useSheetActions, useSheetState } from '@/features/sheet/hooks'
import { CELL_H, CELL_W, HEADER_H, HEADER_W } from '@/features/sheet/constants'
import { useDragSelect } from './Cell/hooks/useDragSelect'
import { useClipboard } from './Cell/hooks/useClipboard'
import {
  deleteColumn as doDeleteColumn,
  deleteRow as doDeleteRow,
  selectEntireColumn,
  selectEntireRow,
} from './utils/headerActions'
import { useEditingActions, useEditingState } from '@/features/sheet/editing'
import { useGridVirtualizers } from './hooks/useGridVirtualizers'
import { useScrollTracking } from './hooks/useScrollTracking'
import { useHeaderMenu } from './hooks/useHeaderMenu'
import { ColumnHeaders } from './ColumnHeaders'
import { RowHeaders } from './RowHeaders'
import { VirtualCells } from './VirtualCells'
import { SelectionOverlay } from './SelectionOverlay'
import { HeaderContextMenu } from './HeaderContextMenu'

export default function Grid() {
  const { dims, selection: storeSelection } = useSheetState()

  const {
    setSelection: setSelectionAction,
    setSelectionRange,
    setCellInput,
    getValue,
    getCellInput,
    deleteRow,
    deleteCol,
  } = useSheetActions()
  const editing = useEditingState()
  const { endEdit } = useEditingActions()
  const parentRef = useRef<HTMLDivElement>(null)

  // Use extracted hooks
  const { virtualRows, virtualCols, virtualCells, totalHeight, totalWidth } = useGridVirtualizers({
    dims,
    parentRef,
    cellWidth: CELL_W,
    cellHeight: CELL_H,
  })

  const scroll = useScrollTracking(parentRef)
  const { headerMenu, setHeaderMenu, clearHeaderMenu } = useHeaderMenu()

  const { onMouseDownCell } = useDragSelect({
    containerRef: parentRef as React.RefObject<HTMLDivElement>,
    headerW: HEADER_W,
    headerH: HEADER_H,
    cellW: CELL_W,
    cellH: CELL_H,
  })
  useClipboard(parentRef)

  // No on-demand prefetch; hydration streams top-to-bottom in the store

  // Memoize callbacks to prevent unnecessary re-renders of GridCell
  const handleCellSelect = useCallback(
    (a1: string, editing: boolean) => {
      setSelectionAction(a1, editing)
    },
    [setSelectionAction]
  )

  const handleCellCommit = useCallback(
    (a1: string, input: string) => {
      setCellInput(a1, input)
    },
    [setCellInput]
  )

  const commitActiveEditIfAny = useCallback(() => {
    if (storeSelection.editing && editing.a1 && editing.buffer !== undefined) {
      setCellInput(editing.a1, editing.buffer)
      endEdit()
    }
  }, [storeSelection.editing, editing.a1, editing.buffer, setCellInput, endEdit])

  const handleColumnSelect = useCallback(
    (col: number) => {
      commitActiveEditIfAny()
      selectEntireColumn(col, dims, setSelectionAction, setSelectionRange)
    },
    [commitActiveEditIfAny, dims, setSelectionAction, setSelectionRange]
  )

  const handleColumnContextMenu = useCallback(
    (col: number, x: number, y: number) => {
      commitActiveEditIfAny()
      setHeaderMenu({ type: 'col', index: col, x, y })
    },
    [commitActiveEditIfAny, setHeaderMenu]
  )

  const handleRowSelect = useCallback(
    (row: number) => {
      commitActiveEditIfAny()
      selectEntireRow(row, dims, setSelectionAction, setSelectionRange)
    },
    [commitActiveEditIfAny, dims, setSelectionAction, setSelectionRange]
  )

  const handleRowContextMenu = useCallback(
    (row: number, x: number, y: number) => {
      commitActiveEditIfAny()
      setHeaderMenu({ type: 'row', index: row, x, y })
    },
    [commitActiveEditIfAny, setHeaderMenu]
  )

  const handleDelete = useCallback(
    (type: 'row' | 'col', index: number) => {
      if (type === 'row') doDeleteRow(index, deleteRow)
      else doDeleteColumn(index, deleteCol)
    },
    [deleteRow, deleteCol]
  )

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <div
        ref={parentRef}
        tabIndex={0}
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'auto',
          background: '#fff',
          outline: 'none',
          userSelect: 'none' as const,
        }}
      >
        <div
          style={{ height: totalHeight, width: totalWidth, position: 'relative' }}
          onMouseDown={(e) => {
            const target = e.target as HTMLElement | null
            let el: HTMLElement | null = target
            const container = e.currentTarget as HTMLElement
            let a1: string | null = null
            while (el && el !== container) {
              const id = el.getAttribute('data-a1')
              if (id) {
                a1 = id
                break
              }
              el = el.parentElement
            }
            if (a1) {
              // Allow caret interactions inside the editing cell's input
              if (storeSelection.editing && storeSelection.a1 === a1) return
              onMouseDownCell(a1, e)
            }
          }}
          onDoubleClick={(e) => {
            const target = e.target as HTMLElement | null
            let el: HTMLElement | null = target
            const container = e.currentTarget as HTMLElement
            let a1: string | null = null
            while (el && el !== container) {
              const id = el.getAttribute('data-a1')
              if (id) {
                a1 = id
                break
              }
              el = el.parentElement
            }
            if (a1) handleCellSelect(a1, true)
          }}
        >
          <ColumnHeaders
            virtualCols={virtualCols}
            dims={dims}
            onColumnSelect={handleColumnSelect}
            onColumnContextMenu={handleColumnContextMenu}
          />

          <RowHeaders
            virtualRows={virtualRows}
            onRowSelect={handleRowSelect}
            onRowContextMenu={handleRowContextMenu}
          />

          <VirtualCells
            virtualCells={virtualCells}
            selection={storeSelection}
            getValue={getValue}
            getCellInput={getCellInput}
            onCellSelect={handleCellSelect}
            onCellCommit={handleCellCommit}
          />

          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: HEADER_W,
              height: HEADER_H,
              background: '#f8fafc',
              borderBottom: '1px solid #e5e7eb',
              borderRight: '1px solid #e5e7eb',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      <SelectionOverlay selection={storeSelection} scroll={scroll} />

      <HeaderContextMenu
        headerMenu={headerMenu}
        onDelete={handleDelete}
        onClose={clearHeaderMenu}
      />
    </div>
  )
}
