import api from './client'

export interface BenchmarkAccount {
  id: string
  account_name: string
  platform: string
  profile_url: string | null
  avatar_url: string | null
  followers: number
  monitor_status: string
  note: string | null
  created_at: string
}

export function fetchBenchmarkAccounts(params?: { platform?: string; monitor_status?: string; page?: number; page_size?: number }) {
  return api.get<{ items: BenchmarkAccount[]; total: number }>('/benchmark-accounts', { params } as any) as Promise<{ items: BenchmarkAccount[]; total: number }>
}

export function createBenchmarkAccount(data: { account_name: string; platform: string; profile_url?: string }) {
  return api.post<BenchmarkAccount>('/benchmark-accounts', data) as Promise<BenchmarkAccount>
}

export function updateBenchmarkAccount(id: string, data: Partial<BenchmarkAccount>) {
  return api.put<BenchmarkAccount>(`/benchmark-accounts/${id}`, data) as Promise<BenchmarkAccount>
}

export function deleteBenchmarkAccount(id: string) {
  return api.delete(`/benchmark-accounts/${id}`) as Promise<{ success: boolean }>
}

export function toggleMonitor(id: string, monitor: boolean) {
  return api.put<BenchmarkAccount>(`/benchmark-accounts/${id}/monitor`, { monitor_status: monitor ? 'active' : 'paused' }) as Promise<BenchmarkAccount>
}

export function getAccountStats() {
  return api.get('/benchmark-accounts/stats') as Promise<{ total: number; by_platform: Record<string, number> }>
}
