import { memo } from 'react'
import { useSheetActions, useSelection } from '@/features/sheet/hooks'
import { isError } from '@/features/sheet/utils/errors'

function StatusBar() {
  const selection = useSelection()
  const { getValue } = useSheetActions()
  const value = selection.a1 ? getValue(selection.a1) : undefined
  return (
    <div
      style={{
        borderTop: '1px solid #e5e7eb',
        padding: 8,
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 12,
        color: '#6b7280',
      }}
    >
      <div>Selected: {selection.a1 ?? '—'}</div>
      <div>Value: {value === undefined ? '—' : String(value)}</div>
      <div>{isError(value) ? 'Error' : ''}</div>
    </div>
  )
}

export default memo(StatusBar)
