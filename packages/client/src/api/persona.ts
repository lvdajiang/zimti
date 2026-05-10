import api from './client'

export interface CatchphraseItem {
  type: '开场' | '转折' | '揭晓' | '结束'
  content: string
}

export interface SampleFile {
  id: number
  url: string
  filename: string
  size: number
  type: 'text' | 'audio'
}

export interface PersonaConfig {
  id: number
  display_name: string
  age: number | null
  career_background: string
  years_of_experience: number | null
  core_experience: string
  one_line_positioning: string
  core_philosophy: string
  unique_selling_point: string[]
  language_styles: string[]
  style_description: string
  catchphrases: CatchphraseItem[]
  narrative_viewpoint: 'first' | 'third'
  sample_texts: SampleFile[]
  sample_audios: SampleFile[]
  created_at: string
  updated_at: string
}

export interface SavePersonaParams {
  display_name: string
  age: number | null
  career_background: string
  years_of_experience: number | null
  core_experience: string
  one_line_positioning: string
  core_philosophy: string
  unique_selling_point: string[]
  language_styles: string[]
  style_description: string
  catchphrases: CatchphraseItem[]
  narrative_viewpoint: 'first' | 'third'
  sample_texts: SampleFile[]
  sample_audios: SampleFile[]
}

export async function fetchPersonaConfig(): Promise<PersonaConfig> {
  const res: { data: PersonaConfig } = await api.get('/persona')
  return res.data
}

export async function savePersonaConfig(params: SavePersonaParams): Promise<{ data: { id: number; updated_at: string } }> {
  return await api.put('/persona', params)
}

export async function uploadSampleFile(file: File, type: 'text' | 'audio'): Promise<{ data: SampleFile }> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('type', type)
  return await api.post('/persona/samples', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export async function deleteSampleFile(sampleId: number): Promise<{ success: boolean }> {
  return await api.delete(`/persona/samples/${sampleId}`)
}

export interface PreviewResult {
  preview_text: string
  highlights: { type: 'violation' | 'persona'; start: number; end: number }[]
}

export async function previewPersonaEffect(params: {
  display_name: string
  language_styles: string[]
  catchphrases: CatchphraseItem[]
  narrative_viewpoint: 'first' | 'third'
  core_philosophy: string
  one_line_positioning: string
}): Promise<{ data: PreviewResult }> {
  return await api.post('/persona/preview', params, { timeout: 15000 })
}
