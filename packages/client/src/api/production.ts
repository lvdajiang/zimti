import api from './client'

// --- 类型定义 ---

export interface StepState {
  step: number
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  data: Record<string, unknown>
}

export interface ProductionProgress {
  job_id: string
  job_status: string
  current_step: number
  steps: StepState[]
}

export interface CreateProductionResult {
  job_id: string
  task_id: string
  script_id: number
  status: string
}

// --- API 调用 ---

export async function createProductionJob(data: {
  title: string
  full_text?: string
  task_id?: string
  video_type?: string
  platforms?: string[]
}): Promise<CreateProductionResult> {
  return api.post('/pipeline/production', data) as unknown as Promise<CreateProductionResult>
}

export async function fetchProductionProgress(jobId: string): Promise<ProductionProgress> {
  return api.get(`/pipeline/production/${jobId}/progress`) as unknown as Promise<ProductionProgress>
}

export async function executeProductionStep(
  jobId: string,
  step: number,
  config?: Record<string, unknown>,
): Promise<{ job_id: string; step: number; status: string }> {
  return api.post(`/pipeline/production/${jobId}/execute-step`, { step, config }) as unknown as Promise<{
    job_id: string
    step: number
    status: string
  }>
}

export async function updateProductionStep(
  jobId: string,
  step: number,
  data: Record<string, unknown>,
): Promise<{ job_id: string; step: number; status: string }> {
  return api.post(`/pipeline/production/${jobId}/update-step`, { step, data }) as unknown as Promise<{
    job_id: string
    step: number
    status: string
  }>
}
