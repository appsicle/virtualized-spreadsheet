import { useRef } from 'react'
import { useSheetActions, useSheetState } from '@/features/sheet/hooks'
import { clientPointToCell } from '../utils/geometry'
import { addressToA1 } from '@/features/sheet/utils/refs'
import { useEditingActions, useEditingState } from '@/features/sheet/editing'

export function useDragSelect(params: {
  containerRef: React.RefObject<HTMLDivElement>
  headerW: number
  headerH: number
  cellW: number
  cellH: number
}) {
  const { dims, selection } = useSheetState()
  const { setSelection, setSelectionRange, clearSelectionRange } = useSheetActions()
  const editing = useEditingState()
  const { changeBuffer } = useEditingActions()
  const dragging = useRef(false)
  const anchor = useRef<{ row: number; col: number } | null>(null)
  const lastFocus = useRef<string | null>(null)
  // When editing a formula (buffer starts with '=') and clicking/dragging, we build a ref/range string
  const formulaDragging = useRef(false)
  const formulaAnchor = useRef<{ row: number; col: number } | null>(null)
  const formulaInsert = useRef<{ start: number; len: number } | null>(null)

  const onMouseMove = (e: MouseEvent) => {
    if (!params.containerRef.current) return
    const { row, col } = clientPointToCell({
      clientX: e.clientX,
      clientY: e.clientY,
      container: params.containerRef.current,
      scrollLeft: params.containerRef.current.scrollLeft,
      scrollTop: params.containerRef.current.scrollTop,
      headerW: params.headerW,
      headerH: params.headerH,
      cellW: params.cellW,
      cellH: params.cellH,
      maxRows: dims.rows,
      maxCols: dims.cols,
    })
    const a1 = addressToA1({ row, col })
    // If dragging a normal selection
    if (dragging.current && anchor.current) {
      // Only update if we've moved to a different cell
      if (lastFocus.current !== a1) {
        setSelectionRange(addressToA1(anchor.current), a1)
        lastFocus.current = a1
      }
      return
    }
    // If dragging a formula range insertion
    if (formulaDragging.current && formulaAnchor.current && formulaInsert.current && editing.a1) {
      const startA1 = addressToA1(formulaAnchor.current)
      const refStr = startA1 === a1 ? startA1 : `${startA1}:${a1}`
      const buf = editing.buffer
      const { start, len } = formulaInsert.current
      const newBuf = buf.slice(0, start) + refStr + buf.slice(start + len)
      formulaInsert.current = { start, len: refStr.length }
      changeBuffer(newBuf, 'cell')
      return
    }
  }
  const onMouseUp = () => {
    // Finish both modes
    dragging.current = false
    anchor.current = null
    lastFocus.current = null
    formulaDragging.current = false
    formulaAnchor.current = null
    formulaInsert.current = null
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }

  function onMouseDownCell(a1: string, e: React.MouseEvent) {
    if (e.button !== 0) return
    // Prevent native text selection start
    e.preventDefault()
    // If currently editing a formula, use clicks to insert refs/ranges instead of changing selection
    const isEditingFormula = selection.editing && editing.buffer.startsWith('=')
    if (isEditingFormula && editing.a1) {
      // Begin formula ref/range insertion
      const addr = /([A-Z]+)(\d+)/.exec(a1)!
      const row = parseInt(addr[2], 10) - 1
      const col = [...addr[1]].reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0) - 1
      formulaAnchor.current = { row, col }
      formulaDragging.current = true
      const buf = editing.buffer
      const insertAt = buf.length
      // Append initial ref now; will be updated during drag
      changeBuffer(buf + a1, 'cell')
      formulaInsert.current = { start: insertAt, len: a1.length }
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
      return
    }
    // For normal selection flows, focus container to capture keyboard nav
    params.containerRef.current.focus()
    if (e.shiftKey && selection.anchor) {
      setSelectionRange(selection.anchor, a1)
      setSelection(a1, false)
      return
    }
    clearSelectionRange()
    setSelection(a1, false)
    const addr = /([A-Z]+)(\d+)/.exec(a1)!
    const row = parseInt(addr[2], 10) - 1
    const col = [...addr[1]].reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0) - 1
    anchor.current = { row, col }
    lastFocus.current = a1 // Start with the anchor cell
    dragging.current = true
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  return { onMouseDownCell }
}
