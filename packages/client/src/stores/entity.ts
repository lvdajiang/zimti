import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  fetchEntities, createEntity, updateEntity, deleteEntity,
  mergeEntities, amapSearch, createEntityFromAmap,
  fetchResources, createResource, updateResource, deleteResource,
} from '../api/entities'
import type { Entity, Resource, AmapPOI } from '../api/entities'
import type { EntityType, ResourceType } from '@zimti/shared'

export const useEntityStore = defineStore('entity', () => {
  const entities = ref<Entity[]>([])
  const total = ref(0)
  const loading = ref(false)
  const currentPage = ref(1)
  const pageSize = ref(20)
  const filterType = ref<string>('all')
  const filterKeyword = ref('')
  const filterCity = ref('')

  // 资源
  const resources = ref<Resource[]>([])
  const resourcesLoading = ref(false)

  // 高德搜索
  const amapResults = ref<AmapPOI[]>([])
  const amapLoading = ref(false)

  // 合并
  const selectedIds = ref<string[]>([])

  async function loadEntities(): Promise<void> {
    loading.value = true
    try {
      const res = await fetchEntities({
        entity_type: filterType.value,
        keyword: filterKeyword.value || undefined,
        city: filterCity.value || undefined,
        page: currentPage.value,
        page_size: pageSize.value,
      })
      entities.value = res.items
      total.value = res.total
    } finally {
      loading.value = false
    }
  }

  async function addEntity(data: {
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
  }): Promise<string> {
    const res = await createEntity(data)
    await loadEntities()
    return res.id
  }

  async function editEntity(id: string, data: Partial<Entity>): Promise<void> {
    await updateEntity(id, data)
    await loadEntities()
  }

  async function removeEntity(id: string): Promise<void> {
    await deleteEntity(id)
    selectedIds.value = selectedIds.value.filter((sid) => sid !== id)
    await loadEntities()
  }

  async function doMerge(targetId: string): Promise<void> {
    const sourceIds = selectedIds.value.filter((id) => id !== targetId)
    if (sourceIds.length === 0) return
    await mergeEntities(sourceIds, targetId)
    selectedIds.value = []
    await loadEntities()
  }

  async function searchAmap(keyword: string, city?: string, entityType?: string): Promise<void> {
    amapLoading.value = true
    try {
      const res = await amapSearch({ keyword, city, entity_type: entityType })
      amapResults.value = res.items
    } finally {
      amapLoading.value = false
    }
  }

  async function addFromAmap(poi: AmapPOI, entityType?: EntityType): Promise<string> {
    const res = await createEntityFromAmap({
      name: poi.name,
      address: poi.address,
      phone: poi.phone,
      city: poi.city,
      region: poi.region,
      longitude: poi.longitude ?? '',
      latitude: poi.latitude ?? '',
      entity_type: entityType,
      amap_type: poi.amap_type,
    })
    await loadEntities()
    return res.id
  }

  async function loadResources(entityId: string): Promise<void> {
    resourcesLoading.value = true
    try {
      const res = await fetchResources(entityId)
      resources.value = res.items
    } finally {
      resourcesLoading.value = false
    }
  }

  async function addResource(entityId: string, data: {
    name: string
    resource_type: ResourceType
    unit?: string
    unit_price?: string
    remark?: string
  }): Promise<string> {
    const res = await createResource(entityId, data)
    await loadResources(entityId)
    return res.id
  }

  async function editResource(id: string, entityId: string, data: Partial<Resource>): Promise<void> {
    await updateResource(id, data)
    await loadResources(entityId)
  }

  async function removeResource(id: string, entityId: string): Promise<void> {
    await deleteResource(id)
    await loadResources(entityId)
  }

  function toggleSelect(id: string): void {
    const idx = selectedIds.value.indexOf(id)
    if (idx >= 0) selectedIds.value.splice(idx, 1)
    else selectedIds.value.push(id)
  }

  return {
    entities, total, loading, currentPage, pageSize,
    filterType, filterKeyword, filterCity,
    resources, resourcesLoading,
    amapResults, amapLoading,
    selectedIds,
    loadEntities, addEntity, editEntity, removeEntity,
    doMerge, searchAmap, addFromAmap,
    loadResources, addResource, editResource, removeResource,
    toggleSelect,
  }
})
