import { memo, useEffect, useRef, useState } from 'react'
import type { CellData } from '@/features/sheet/types'
import { useEditingActions, type EditingState } from '@/features/sheet/editing'
import { a1ToAddress, addressToA1 } from '@/features/sheet/utils/refs'
import { CELL_H, CELL_W } from '@/features/sheet/constants'

interface CellProps {
  a1: string
  value: string | number | undefined
  input: string
  selected: boolean
  error: boolean
  onSelect: (a1: string, editing: boolean) => void
  onCommit: (a1: string, input: string) => void
  editingState: EditingState
  offsetX: number
  offsetY: number
}

export const Cell = memo(function Cell({
  a1,
  value,
  input,
  selected,
  error,
  onSelect,
  onCommit,
  editingState: editing,
  offsetX,
  offsetY,
}: CellProps) {
  // Track when full Cell component is rendered (should only be 1 for selected cell)
  if (!(window as any).__fullCellCount) {
    (window as any).__fullCellCount = 0
  }
  ;(window as any).__fullCellCount++
  console.log(`[Cell] Full editing cell rendered for ${a1} (count: ${(window as any).__fullCellCount})`)

  const display = value === undefined ? '' : String(value)
  const [editValue, setEditValue] = useState<CellData>({ input: '' })
  const inputRef = useRef<HTMLInputElement>(null)
  const { startEdit, changeBuffer, endEdit } = useEditingActions()

  // Initialize edit value when entering edit mode
  useEffect(() => {
    if (selected) {
      // Seed from editing context if it targets this cell; otherwise from committed input
      const seed = editing.a1 === a1 ? editing.buffer : input
      setEditValue({ input: seed })
      if (editing.a1 !== a1) startEdit(a1, seed, 'cell')
    }
  }, [selected])

  // Focus input when entering edit mode
  useEffect(() => {
    if (selected) {
      const el = inputRef.current
      if (el) {
        el.focus()
        const len = editValue.input?.length ?? 0
        try {
          el.setSelectionRange(len, len)
        } catch {
          console.error('Error setting selection range')
        }
      }
    }
  }, [selected, editValue.input])

  // Keep local edit value in sync with Formula Bar edits
  useEffect(() => {
    if (selected && editing.a1 === a1) setEditValue({ input: editing.buffer })
  }, [a1, selected, editing.a1, editing.buffer])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!selected) return
    if (e.key === 'Enter') {
      onCommit(a1, editValue.input)
      endEdit()
      // Move selection to cell below after commit
      const { row, col } = a1ToAddress(a1)
      const next = addressToA1({ row: row + 1, col })
      onSelect(next, false)
    } else if (e.key === 'Escape') {
      endEdit()
      onSelect(a1, false)
    }
  }

  function handleBlur() {
    if (selected) {
      // If actively editing a formula and the user clicks elsewhere to insert refs,
      // do not auto-commit on blur.
      if (editing.a1 === a1 && editing.buffer?.startsWith('=')) return
      onCommit(a1, editValue.input)
      endEdit()
      // Move selection to cell below after commit
      const { row, col } = a1ToAddress(a1)
      const next = addressToA1({ row: row + 1, col })
      onSelect(next, false)
    }
  }

  return (
    <input
      data-a1={a1}
      ref={inputRef}
      value={selected ? editValue.input : display}
      onChange={(e) => {
        if (!selected) return
        const next: CellData = { input: e.target.value }
        setEditValue(next)
        if (editing.a1 !== a1) startEdit(a1, next.input, 'cell')
        else changeBuffer(next.input, 'cell')
      }}
      onMouseDown={(e) => {
        if (!selected) {
          // If currently editing a formula in another cell, use clicks for ref insertion
          if (editing.a1 && editing.buffer?.startsWith('=')) {
            // Prevent selection change so Grid hook can handle formula ref insertion
            e.preventDefault()
            return
          }
          onSelect(a1, false)
        }
      }}
      onDoubleClick={() => {
        // If currently editing a formula in another cell, ignore double click
        if (editing.a1 && editing.a1 !== a1 && editing.buffer?.startsWith('=')) return
        if (!selected) onSelect(a1, true)
        if (editing.a1 !== a1) startEdit(a1, input, 'cell')
      }}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      readOnly={!selected}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: CELL_W,
        height: CELL_H,
        boxSizing: 'border-box',
        border: selected ? '2px solid #3b82f6' : 'none',
        borderRight: selected ? '2px solid #3b82f6' : '1px solid #e5e7eb',
        borderBottom: selected ? '2px solid #3b82f6' : '1px solid #e5e7eb',
        borderRadius: 0,
        padding: '0 8px',
        lineHeight: `${CELL_H}px`,
        background: '#fff',
        color: error ? '#dc2626' : '#111827',
        outline: 'none',
        fontSize: 'inherit',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        cursor: selected ? 'text' : 'default',
        transform: `translate(${offsetX}px, ${offsetY}px)`,
      }}
      title={display}
    />
  )
})
