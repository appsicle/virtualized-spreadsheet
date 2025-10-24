import { memo } from 'react'
import { indexToCol } from '@/features/sheet/utils/refs'
import { isError } from '@/features/sheet/utils/errors'
import type { Selection, Value } from '@/features/sheet/types'
import { Cell } from './Cell/Cell'
import { ReadOnlyCell } from './Cell/ReadOnlyCell'
import { useEditingState } from '@/features/sheet/editing'
import { HEADER_H, HEADER_W } from '@/features/sheet/constants'

interface VirtualCell {
  key: string
  row: number
  col: number
  rowStart: number
  colStart: number
}

interface VirtualCellsProps {
  virtualCells: VirtualCell[]
  selection: Selection
  getValue: (a1: string) => Value
  getCellInput: (a1: string) => string
  onCellSelect: (a1: string, editing: boolean) => void
  onCellCommit: (a1: string, input: string) => void
}

export const VirtualCells = memo(function VirtualCells({
  virtualCells,
  selection,
  getValue,
  getCellInput,
  onCellSelect,
  onCellCommit,
}: VirtualCellsProps) {
  const editing = useEditingState()

  const result = (
    <>
      {virtualCells.map((cell) => {

        const a1 = `${indexToCol(cell.col)}${cell.row + 1}`
        const selected = selection.a1 === a1 && selection.editing

        const value = getValue(a1)

        const input = getCellInput(a1)
        const error = isError(value)

        const offsetX = HEADER_W + cell.colStart
        const offsetY = HEADER_H + cell.rowStart

        // Render Cell or ReadOnlyCell directly with positioning applied to the element itself
        return selected ? (
          <Cell
            key={cell.key}
            a1={a1}
            value={value}
            input={input}
            selected={selected}
            error={error}
            onSelect={onCellSelect}
            onCommit={onCellCommit}
            editingState={editing}
            offsetX={offsetX}
            offsetY={offsetY}
          />
        ) : (
          <ReadOnlyCell
            key={cell.key}
            a1={a1}
            value={value}
            error={error}
            offsetX={offsetX}
            offsetY={offsetY}
          />
        )
      })}
    </>
  )
  return result
})
