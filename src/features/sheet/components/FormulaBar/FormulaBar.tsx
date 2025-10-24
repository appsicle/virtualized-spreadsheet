import { memo, useEffect, useMemo } from 'react'
import { useSheetActions, useSelection, useCells } from '@/features/sheet/hooks'
import { useEditingActions, useEditingState } from '@/features/sheet/editing'
import { a1ToAddress, addressToA1 } from '@/features/sheet/utils/refs'

function FormulaBar() {
  const selection = useSelection()
  const cells = useCells()
  const { setCellInput, setSelection } = useSheetActions()
  const editing = useEditingState()
  const { startEdit, changeBuffer, endEdit } = useEditingActions()

  const committed = useMemo(
    () => (selection.a1 ? (cells.get(selection.a1)?.input ?? '') : ''),
    [cells, selection]
  )

  // Keep buffer matched with selection
  useEffect(() => {
    if (!selection.editing) return
    if (selection.a1 && editing.a1 !== selection.a1) {
      startEdit(selection.a1, committed, 'formula')
    }
  }, [selection.editing, selection.a1, editing.a1, committed, startEdit])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    if (!selection.a1) return
    // Update editing context first so Grid cells see editing.source === 'formula'
    if (!editing.a1 || editing.a1 !== selection.a1) startEdit(selection.a1, val, 'formula')
    else changeBuffer(val, 'formula')
    // Then mark selection as editing (if not already)
    if (!selection.editing) setSelection(selection.a1, true)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && selection.a1) {
      const buf = editing.a1 === selection.a1 ? editing.buffer : committed
      setCellInput(selection.a1, buf)
      // Move selection to cell below after commit
      const { row, col } = a1ToAddress(selection.a1)
      const next = addressToA1({ row: row + 1, col })
      setSelection(next, false)
      endEdit()
      e.preventDefault()
    }
    if (e.key === 'Escape' && selection.a1) {
      setSelection(selection.a1, false)
      endEdit()
      e.preventDefault()
    }
  }

  function handleBlur() {
    if (!selection.a1) return
    // If actively editing a formula and user clicks into grid to insert refs, don't auto-commit
    if (editing.a1 === selection.a1 && editing.buffer?.startsWith('=')) return
    const buf = editing.a1 === selection.a1 ? editing.buffer : committed
    setCellInput(selection.a1, buf)
    // Keep selection on current cell; simply exit edit mode
    setSelection(selection.a1, false)
    endEdit()
  }

  return (
    <div
      style={{
        borderBottom: '1px solid #e5e7eb',
        padding: 8,
        display: 'flex',
        gap: 8,
        alignItems: 'center',
      }}
    >
      <div style={{ fontSize: 12, color: '#6b7280', width: 24 }}>fx</div>
      <input
        style={{
          flex: 1,
          height: 28,
          border: '1px solid #d1d5db',
          borderRadius: 4,
          padding: '0 8px',
        }}
        value={selection.editing && editing.a1 === selection.a1 ? editing.buffer : committed}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder="Enter value or =formula"
      />
    </div>
  )
}

export default memo(FormulaBar)
