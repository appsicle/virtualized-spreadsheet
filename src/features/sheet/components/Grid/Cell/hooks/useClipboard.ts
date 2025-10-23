import { useEffect } from 'react'
import { useSheetActions, useSheetState } from '@/features/sheet/hooks'
import { selectionToText, pasteTextAtSelection, clearSelectionContents } from '../utils/rangeActions'

export function useClipboard(containerRef: React.RefObject<HTMLElement | null>) {
  const { cells, selection, dims } = useSheetState()
  const { setCellsBulk } = useSheetActions()

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function onCopy(e: ClipboardEvent) {
      if (!selection.a1) return
      const text = selectionToText(cells, selection)
      e.clipboardData?.setData('text/plain', text)
      e.preventDefault()
    }

    function onPaste(e: ClipboardEvent) {
      const text = e.clipboardData?.getData('text/plain')
      if (!text || !selection.a1) return
      pasteTextAtSelection(text, selection, dims, setCellsBulk)
      e.preventDefault()
    }

    function onCut(e: ClipboardEvent) {
      if (!selection.a1) return
      const text = selectionToText(cells, selection)
      e.clipboardData?.setData('text/plain', text)
      // Clear range after copying to clipboard
      clearSelectionContents(selection, setCellsBulk)
      e.preventDefault()
    }

    el.addEventListener('copy', onCopy)
    el.addEventListener('paste', onPaste)
    el.addEventListener('cut', onCut)
    return () => {
      el.removeEventListener('copy', onCopy)
      el.removeEventListener('paste', onPaste)
      el.removeEventListener('cut', onCut)
    }
  }, [
    cells,
    containerRef,
    dims.cols,
    dims.rows,
    selection.a1,
    selection.anchor,
    selection.focus,
    setCellsBulk,
  ])
}
