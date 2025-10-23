import type { ErrorCode } from '../types'

export const ERR = {
  CYCLE: '#CYCLE' as ErrorCode,
  REF: '#REF!' as ErrorCode,
  DIV0: '#DIV/0!' as ErrorCode,
  VALUE: '#VALUE!' as ErrorCode,
}

export const isError = (v: unknown): v is ErrorCode =>
  v === ERR.CYCLE || v === ERR.REF || v === ERR.DIV0 || v === ERR.VALUE
