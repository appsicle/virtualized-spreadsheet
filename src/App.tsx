import { useEffect } from 'react'
import Grid from '@/features/sheet/components/Grid'
import Toolbar from '@/features/sheet/components/Toolbar'
import FormulaBar from '@/features/sheet/components/FormulaBar'
import StatusBar from '@/features/sheet/components/StatusBar'
import { SheetProvider } from '@/features/sheet/store'
import { useSheetActions, useSelection, useDims } from '@/features/sheet/hooks'
import { EditingProvider, useEditingActions } from '@/features/sheet/editing'
import {
  clearSelectionContents,
  isFullColumnSelection,
  isFullRowSelection,
} from '@/features/sheet/components/Grid/Cell/utils/rangeActions'
import { colToIndex, indexToCol } from '@/features/sheet/utils/refs'

function Shell() {
  const selection = useSelection()
  const dims = useDims()
  const { setSelection, setCellsBulk, deleteCol, deleteRow } = useSheetActions()
  const { startEdit } = useEditingActions()
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // If user is typing in an editable element (Formula Bar or any input/textarea/contenteditable),
      // do not intercept the keystroke for grid-level shortcuts.
      const target = e.target as HTMLElement | null
      const active = (document.activeElement as HTMLElement | null) || null
      const isEditable = (el: HTMLElement | null) =>
        !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
      if (isEditable(target) || isEditable(active)) return

      if (!selection.a1) return
      const addr = selection.a1
      if (e.key === 'Enter') {
        // Start editing if not already; if already editing, let input handle commit
        if (!selection.editing) {
          setSelection(addr, true)
          e.preventDefault()
        }
        return
      }
      if (
        !selection.editing &&
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
      ) {
        const m = /^([A-Z]+)(\d+)$/.exec(addr)!
        let col = m[1],
          row = parseInt(m[2], 10)
        const ci = colToIndex(col)
        if (e.key === 'ArrowUp') row = Math.max(1, row - 1)
        if (e.key === 'ArrowDown') row = row + 1
        if (e.key === 'ArrowLeft') col = indexToCol(Math.max(0, ci - 1))
        if (e.key === 'ArrowRight') col = indexToCol(ci + 1)
        setSelection(`${col}${row}`, false)
        e.preventDefault()
        return
      }

      // Start typing to edit selected cell (ephemeral), or clear range on Delete/Backspace
      if (!selection.editing) {
        if (!e.metaKey && !e.ctrlKey && !e.altKey) {
          if (e.key === 'Backspace' || e.key === 'Delete') {
            const fullCol = isFullColumnSelection(selection, dims)
            const fullRow = isFullRowSelection(selection, dims)
            if (fullCol) {
              deleteCol(fullCol.col)
            } else if (fullRow) {
              deleteRow(fullRow.row)
            } else {
              clearSelectionContents(selection, setCellsBulk)
            }
            e.preventDefault()
            return
          }
          if (e.key.length === 1) {
            // Start editing context first to avoid focus races, then mark selection editing
            startEdit(addr, e.key, 'keyboard')
            setSelection(addr, true)
            e.preventDefault()
            return
          }
          if (e.key === 'F2') {
            setSelection(addr, true)
            e.preventDefault()
            return
          }
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selection, setSelection])

  return (
    <div style={{ height: '100vh', display: 'grid', gridTemplateRows: 'auto auto 1fr auto' }}>
      <Toolbar />
      <FormulaBar />
      <Grid />
      <StatusBar />
    </div>
  )
}

export default function App() {
  return (
    <SheetProvider>
      <EditingProvider>
        <Shell />
      </EditingProvider>
    </SheetProvider>
  )
}
