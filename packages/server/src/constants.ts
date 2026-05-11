export const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QsValue = any

export function toInt(value: QsValue, defaultValue = 0): number {
  const v = Array.isArray(value) ? value[0] : value
  if (!v) return defaultValue
  const n = Number(String(v))
  return Number.isFinite(n) ? n : defaultValue
}

export function str(value: QsValue, defaultValue = ''): string {
  const v = Array.isArray(value) ? value[0] : value
  return (v != null ? String(v) : defaultValue)
}
