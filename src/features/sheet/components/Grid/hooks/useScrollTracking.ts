import { useEffect, useState } from 'react'

interface ScrollState {
  left: number
  top: number
  w: number
  h: number
}

export function useScrollTracking(parentRef: React.RefObject<HTMLDivElement | null>) {
  const [scroll, setScroll] = useState<ScrollState>({ left: 0, top: 0, w: 800, h: 600 })

  useEffect(() => {
    const el = parentRef.current
    if (!el) return

    function onScroll() {
      setScroll((s) => ({ ...s, left: el!.scrollLeft, top: el!.scrollTop }))
    }

    function onResize() {
      setScroll((s) => ({ ...s, w: el!.clientWidth, h: el!.clientHeight }))
    }

    onResize()
    el.addEventListener('scroll', onScroll)
    window.addEventListener('resize', onResize)

    return () => {
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    }
  }, [parentRef])

  return scroll
}
