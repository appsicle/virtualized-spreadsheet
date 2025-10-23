import { memo } from 'react'
import type { HeaderMenuState } from './hooks/useHeaderMenu'

interface HeaderContextMenuProps {
  headerMenu: HeaderMenuState | null
  onDelete: (type: 'row' | 'col', index: number) => void
  onClose: () => void
}

export const HeaderContextMenu = memo(function HeaderContextMenu({
  headerMenu,
  onDelete,
  onClose,
}: HeaderContextMenuProps) {
  if (!headerMenu) {
    return null
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: headerMenu.x,
        top: headerMenu.y,
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 6,
        boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
        zIndex: 10000,
        minWidth: 160,
        color: '#111827',
      }}
    >
      <div
        onMouseDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onDelete(headerMenu.type, headerMenu.index)
          onClose()
        }}
        style={{ padding: '8px 12px', cursor: 'pointer', userSelect: 'none' }}
      >
        {headerMenu.type === 'row' ? 'Delete Row' : 'Delete Column'}
      </div>
    </div>
  )
})
