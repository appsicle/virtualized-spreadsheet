import React, { createContext, useCallback, useContext, useMemo, useReducer } from 'react'

type Source = 'cell' | 'formula' | 'keyboard' | null

export interface EditingState {
  a1: string | null
  buffer: string
  source: Source
}

interface EditingActions {
  startEdit: (a1: string, initial: string, source?: Source) => void
  changeBuffer: (value: string, source?: Source) => void
  endEdit: () => void
}

const EditingStateContext = createContext<EditingState | null>(null)
const EditingActionsContext = createContext<EditingActions | null>(null)

type Action =
  | { t: 'start'; a1: string; initial: string; source: Source }
  | { t: 'change'; value: string; source: Source }
  | { t: 'end' }

function reducer(state: EditingState, action: Action): EditingState {
  switch (action.t) {
    case 'start':
      return { a1: action.a1, buffer: action.initial, source: action.source }
    case 'change':
      if (!state.a1) return state
      return { ...state, buffer: action.value, source: action.source }
    case 'end':
      return { a1: null, buffer: '', source: null }
  }
}

export function EditingProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { a1: null, buffer: '', source: null })

  const startEdit = useCallback((a1: string, initial: string, source: Source = null) => {
    dispatch({ t: 'start', a1, initial, source })
  }, [])
  const changeBuffer = useCallback((value: string, source: Source = null) => {
    dispatch({ t: 'change', value, source })
  }, [])
  const endEdit = useCallback(() => dispatch({ t: 'end' }), [])

  const actions = useMemo<EditingActions>(
    () => ({ startEdit, changeBuffer, endEdit }),
    [startEdit, changeBuffer, endEdit]
  )

  return (
    <EditingStateContext.Provider value={state}>
      <EditingActionsContext.Provider value={actions}>{children}</EditingActionsContext.Provider>
    </EditingStateContext.Provider>
  )
}

export function useEditingState() {
  const ctx = useContext(EditingStateContext)
  if (!ctx) throw new Error('No EditingProvider')
  return ctx
}

export function useEditingActions() {
  const ctx = useContext(EditingActionsContext)
  if (!ctx) throw new Error('No EditingProvider')
  return ctx
}
