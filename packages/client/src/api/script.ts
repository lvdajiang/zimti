import api from './client'
import { API } from '@zimti/shared'
import type { StoryboardSegment } from '@zimti/shared'

export interface ScriptData {
  id: number
  full_text: string
  video_type: string | null
  oral_ratio: number
  status: string
  segments: StoryboardSegment[]
}

export interface AiCheckResult {
  score: number
  issues: { type: string; message: string; position: number }[]
  suggestions: unknown[]
}

export function fetchScript(id: number): Promise<ScriptData> {
  return api.get<ScriptData>(API.SCRIPTS.GET(id))
}

export function createScript(params: {
  task_id: string
  topic_id: number
  full_text?: string
}): Promise<{ id: number; full_text: string; video_type: string | null; oral_ratio: number; status: string }> {
  return api.post(API.SCRIPTS.CREATE, params)
}

export function saveScript(id: number, data: {
  full_text?: string
  video_type?: string
  oral_ratio?: number
}): Promise<void> {
  return api.put(API.SCRIPTS.SAVE(id), data)
}

export function saveSegment(
  scriptId: number,
  segmentId: number,
  data: Partial<Pick<StoryboardSegment, 'segment_type' | 'oral_text' | 'visual_description' | 'duration'>>,
): Promise<StoryboardSegment> {
  return api.put(API.SCRIPTS.SAVE_SEGMENT(scriptId, segmentId), data)
}

export function addSegment(
  scriptId: number,
  data: { segment_type: string; visual_description: string; duration: number; oral_text?: string },
): Promise<StoryboardSegment> {
  return api.post(API.SCRIPTS.ADD_SEGMENT(scriptId), data)
}

export function deleteSegment(scriptId: number, segmentId: number): Promise<void> {
  return api.delete(API.SCRIPTS.DELETE_SEGMENT(scriptId, segmentId))
}

export function reorderSegments(scriptId: number, segmentIds: number[]): Promise<void> {
  return api.put(API.SCRIPTS.REORDER_SEGMENTS(scriptId), { segment_ids: segmentIds })
}

export function duplicateSegment(scriptId: number, _segmentId: number): Promise<StoryboardSegment> {
  return api.post<StoryboardSegment>(API.SCRIPTS.ADD_SEGMENT(scriptId), {
    segment_type: 'oral',
    visual_description: '',
    duration: 3.0,
  })
}

export function runAiCheck(scriptId: number): Promise<AiCheckResult> {
  return api.post<AiCheckResult>(API.SCRIPTS.AI_CHECK(scriptId))
}

export function confirmScript(scriptId: number): Promise<void> {
  return api.put(API.SCRIPTS.CONFIRM(scriptId), { status: 'confirmed' })
}

export function saveProgress(scriptId: string, segments: Partial<StoryboardSegment>[]): Promise<void> {
  return api.post(API.SCRIPTS.SAVE_PROGRESS(scriptId), { segments })
}

export function generateStoryboard(scriptId: number): Promise<{ task_id: string }> {
  return api.post<{ task_id: string }>(API.SCRIPTS.GENERATE_STORYBOARD(scriptId))
}

export function getStoryboardStatus(scriptId: number, taskId: string): Promise<{ status: string }> {
  return api.get<{ status: string }>(API.SCRIPTS.STORYBOARD_STATUS(scriptId, taskId))
}
