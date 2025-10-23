import { memo } from 'react'
import { useSheetActions } from '@/features/sheet/hooks'

function Toolbar() {
  const { smokeTest, clearAll } = useSheetActions()
  const btn = (
    children: React.ReactNode,
    onClick?: () => void,
    disabled?: boolean,
    variant?: 'default' | 'secondary' | 'danger'
  ) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 32,
        padding: '0 12px',
        borderRadius: 6,
        border: '1px solid ' + (variant === 'secondary' ? '#d1d5db' : 'transparent'),
        background: variant === 'danger' ? '#ef4444' : variant === 'secondary' ? '#fff' : '#111827',
        color: variant === 'secondary' ? '#111827' : '#fff',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  )
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
      <div style={{ width: 1, height: 24, background: '#e5e7eb' }} />
      {btn('Scale Smoke Test', smokeTest)}
      {btn('Clear All', clearAll, false, 'danger')}
    </div>
  )
}

export default memo(Toolbar)
