import { useEffect, useState } from 'react'

export interface HeaderMenuState {
  type: 'row' | 'col'
  index: number
  x: number
  y: number
}

export function useHeaderMenu() {
  const [headerMenu, setHeaderMenu] = useState<HeaderMenuState | null>(null)

  useEffect(() => {
    function onClick() {
      if (headerMenu) setHeaderMenu(null)
    }
    window.addEventListener('click', onClick)
    return () => window.removeEventListener('click', onClick)
  }, [headerMenu])

  return {
    headerMenu,
    setHeaderMenu,
    clearHeaderMenu: () => setHeaderMenu(null),
  }
}
