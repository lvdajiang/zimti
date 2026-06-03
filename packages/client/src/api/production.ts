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

export async function rollbackProductionStep(
  jobId: string,
  step: number,
): Promise<{ job_id: string; rolled_back_to: number; status: string }> {
  return api.post(`/pipeline/production/${jobId}/rollback`, { step }) as unknown as Promise<{
    job_id: string
    rolled_back_to: number
    status: string
  }>
}

export interface PipelineTemplateItem {
  id: string
  name: string
  mode: string
  steps: { step: number; service: string; config: Record<string, unknown> }[]
}

export async function fetchPipelineTemplates(): Promise<{ items: PipelineTemplateItem[] }> {
  return api.get('/pipeline/templates') as unknown as Promise<{ items: PipelineTemplateItem[] }>
}

export async function createPipelineTemplate(data: {
  name: string
  steps: { step: number; service: string; config: Record<string, unknown> }[]
}): Promise<{ id: string; name: string }> {
  return api.post('/pipeline/templates', data) as unknown as Promise<{ id: string; name: string }>
}

export async function deletePipelineTemplate(id: string): Promise<{ id: string; status: string }> {
  return api.delete(`/pipeline/templates/${id}`) as unknown as Promise<{ id: string; status: string }>
}
