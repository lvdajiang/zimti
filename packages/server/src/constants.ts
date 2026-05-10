export const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001'

export function toInt(value: string, defaultValue = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : defaultValue
}
