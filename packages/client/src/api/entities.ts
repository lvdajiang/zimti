import api from './client'
import type { EntityType, ResourceType } from '@zimti/shared'

export interface Entity {
  id: string
  name: string
  aliases: string
  entity_type: EntityType
  region: string | null
  city: string | null
  address: string | null
  phone: string | null
  longitude: string | null
  latitude: string | null
  remark: string | null
  resource_count: number
  created_at: string
  updated_at: string
}

export interface Resource {
  id: string
  entity_id: string
  name: string
  resource_type: ResourceType
  unit: string | null
  unit_price: string | null
  remark: string | null
  created_at: string
  updated_at: string
}

export interface AmapPOI {
  name: string
  address: string
  phone: string
  city: string
  region: string
  longitude: string | null
  latitude: string | null
  amap_type: string
}

// --- 实体 CRUD ---

export async function fetchEntities(params?: {
  entity_type?: string
  keyword?: string
  city?: string
  page?: number
  page_size?: number
}): Promise<{ items: Entity[]; total: number }> {
  const query = new URLSearchParams()
  if (params?.entity_type && params.entity_type !== 'all') query.set('entity_type', params.entity_type)
  if (params?.keyword) query.set('keyword', params.keyword)
  if (params?.city) query.set('city', params.city)
  if (params?.page) query.set('page', String(params.page))
  if (params?.page_size) query.set('page_size', String(params.page_size))
  return api.get(`/entities?${query}`) as unknown as Promise<{ items: Entity[]; total: number }>
}

export async function createEntity(data: {
  name: string
  entity_type: EntityType
  aliases?: string
  region?: string
  city?: string
  address?: string
  phone?: string
  longitude?: string
  latitude?: string
  remark?: string
}): Promise<{ id: string }> {
  return api.post('/entities', data) as unknown as Promise<{ id: string }>
}

export async function updateEntity(
  id: string,
  data: Partial<Omit<Entity, 'id' | 'created_at' | 'updated_at' | 'resource_count'>>,
): Promise<{ id: string }> {
  return api.put(`/entities/${id}`, data) as unknown as Promise<{ id: string }>
}

export async function deleteEntity(id: string): Promise<void> {
  return api.delete(`/entities/${id}`) as unknown as Promise<void>
}

// --- 合并 ---

export async function mergeEntities(sourceIds: string[], targetId: string): Promise<{
  success: boolean
  merged_count: number
  aliases_added: number
}> {
  return api.post('/entities/merge', { source_ids: sourceIds, target_id: targetId }) as unknown as Promise<{
    success: boolean
    merged_count: number
    aliases_added: number
  }>
}

// --- 高德 POI ---

export async function amapSearch(params: {
  keyword: string
  city?: string
  entity_type?: string
}): Promise<{ items: AmapPOI[]; total: number }> {
  const query = new URLSearchParams({ keyword: params.keyword })
  if (params.city) query.set('city', params.city)
  if (params.entity_type) query.set('entity_type', params.entity_type)
  return api.get(`/entities/amap-search?${query}`) as unknown as Promise<{ items: AmapPOI[]; total: number }>
}

export async function createEntityFromAmap(data: {
  name: string
  address: string
  phone: string
  city: string
  region: string
  longitude: string
  latitude: string
  entity_type?: EntityType
  amap_type?: string
}): Promise<{ id: string }> {
  return api.post('/entities/from-amap', data) as unknown as Promise<{ id: string }>
}

// --- 资源 CRUD ---

export async function fetchResources(entityId: string): Promise<{ items: Resource[] }> {
  return api.get(`/entities/${entityId}/resources`) as unknown as Promise<{ items: Resource[] }>
}

export async function createResource(entityId: string, data: {
  name: string
  resource_type: ResourceType
  unit?: string
  unit_price?: string
  remark?: string
}): Promise<{ id: string }> {
  return api.post(`/entities/${entityId}/resources`, data) as unknown as Promise<{ id: string }>
}

export async function updateResource(
  id: string,
  data: Partial<Pick<Resource, 'name' | 'resource_type' | 'unit' | 'unit_price' | 'remark'>>,
): Promise<{ id: string }> {
  return api.put(`/entities/resources/${id}`, data) as unknown as Promise<{ id: string }>
}

export async function deleteResource(id: string): Promise<void> {
  return api.delete(`/entities/resources/${id}`) as unknown as Promise<void>
}
