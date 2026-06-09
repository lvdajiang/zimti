/**
 * 音色管理 API
 */
import api from './client'

export interface VoiceProfileItem {
  id: string
  userId: string | null
  name: string
  type: 'preset' | 'clone' | 'uploaded'
  engine: 'edge_tts' | 'fish_audio' | 'uploaded'
  engineRef: string | null
  sampleUrl: string | null
  config: Record<string, unknown>
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/** 获取音色列表（系统预设 + 用户自定义） */
export async function fetchVoiceProfiles(): Promise<VoiceProfileItem[]> {
  const res = await api.get('/voice-profiles')
  return res as unknown as VoiceProfileItem[]
}

/** 创建自定义音色 */
export async function createVoiceProfile(data: {
  name: string
  type: string
  engine: string
  engineRef?: string
  sampleUrl?: string
  config?: Record<string, unknown>
}): Promise<VoiceProfileItem> {
  const res = await api.post('/voice-profiles', data)
  return res as unknown as VoiceProfileItem
}

/** 试听音色 */
export async function previewVoiceProfile(id: string, text?: string): Promise<{ filePath: string; url: string }> {
  const res = await api.post(`/voice-profiles/${id}/preview`, { text })
  return res as unknown as { filePath: string; url: string }
}

/** 上传录音克隆 */
export async function cloneVoiceProfile(voiceName: string, audioFile: File): Promise<VoiceProfileItem> {
  const formData = new FormData()
  formData.append('audio', audioFile)
  formData.append('voiceName', voiceName)
  const res = await api.post('/voice-profiles/clone', formData)
  return res as unknown as VoiceProfileItem
}

/** 上传自己录音（模式 C） */
export async function uploadRecording(voiceName: string, audioFile: File): Promise<VoiceProfileItem> {
  const formData = new FormData()
  formData.append('audio', audioFile)
  formData.append('voiceName', voiceName)
  const res = await api.post('/voice-profiles/upload', formData)
  return res as unknown as VoiceProfileItem
}

/** 删除自定义音色 */
export async function deleteVoiceProfile(id: string): Promise<void> {
  await api.delete(`/voice-profiles/${id}`)
}
