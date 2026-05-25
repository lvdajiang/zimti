// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useEntityStore } from '../entity'
import {
  fetchEntities,
  createEntity,
  updateEntity,
  deleteEntity,
  mergeEntities,
  amapSearch,
  createEntityFromAmap,
  fetchResources,
  createResource,
  updateResource,
  deleteResource,
} from '../../api/entities'
import type { Entity, Resource, AmapPOI } from '../../api/entities'

vi.mock('../../api/entities', () => ({
  fetchEntities: vi.fn(),
  createEntity: vi.fn(),
  updateEntity: vi.fn(),
  deleteEntity: vi.fn(),
  mergeEntities: vi.fn(),
  amapSearch: vi.fn(),
  createEntityFromAmap: vi.fn(),
  fetchResources: vi.fn(),
  createResource: vi.fn(),
  updateResource: vi.fn(),
  deleteResource: vi.fn(),
}))

const mockFetchEntities = vi.mocked(fetchEntities)
const mockCreateEntity = vi.mocked(createEntity)
const mockUpdateEntity = vi.mocked(updateEntity)
const mockDeleteEntity = vi.mocked(deleteEntity)
const mockMergeEntities = vi.mocked(mergeEntities)
const mockAmapSearch = vi.mocked(amapSearch)
const mockCreateEntityFromAmap = vi.mocked(createEntityFromAmap)
const mockFetchResources = vi.mocked(fetchResources)
const mockCreateResource = vi.mocked(createResource)
const mockUpdateResource = vi.mocked(updateResource)
const mockDeleteResource = vi.mocked(deleteResource)

// --- 测试数据 ---

const fakeEntities: Entity[] = [
  {
    id: 'ent-1', name: '星巴克', aliases: 'Starbucks',
    entity_type: 'brand', region: '北京', city: '北京',
    address: '朝阳区xxx', phone: '010-12345678',
    longitude: '116.46', latitude: '39.92',
    remark: null, resource_count: 3, created_at: '2026-01-01', updated_at: '2026-01-01',
  },
  {
    id: 'ent-2', name: '瑞幸咖啡', aliases: 'Luckin',
    entity_type: 'brand', region: '上海', city: '上海',
    address: '浦东新区xxx', phone: '021-87654321',
    longitude: '121.47', latitude: '31.23',
    remark: null, resource_count: 1, created_at: '2026-01-02', updated_at: '2026-01-02',
  },
]

const fakeResources: Resource[] = [
  {
    id: 'res-1', entity_id: 'ent-1', name: '咖啡豆供应商A',
    resource_type: 'supplier', unit: 'kg', unit_price: '50.00',
    remark: null, created_at: '2026-01-01', updated_at: '2026-01-01',
  },
  {
    id: 'res-2', entity_id: 'ent-1', name: '咖啡豆供应商B',
    resource_type: 'supplier', unit: 'kg', unit_price: '45.00',
    remark: '优质阿拉比卡', created_at: '2026-01-02', updated_at: '2026-01-02',
  },
]

const fakeAmapResults: AmapPOI[] = [
  {
    name: '星巴克(国贸店)', address: '朝阳区建国门外大街1号',
    phone: '010-65052288', city: '北京', region: '朝阳区',
    longitude: '116.460', latitude: '39.908', amap_type: '餐饮服务',
  },
  {
    name: '星巴克(CBD店)', address: '朝阳区光华路甲9号',
    phone: '010-65931166', city: '北京', region: '朝阳区',
    longitude: '116.461', latitude: '39.909', amap_type: '餐饮服务',
  },
]

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('useEntityStore', () => {
  // --- loadEntities ---
  describe('loadEntities', () => {
    it('应设置 entities 和 total', async () => {
      mockFetchEntities.mockResolvedValue({ items: fakeEntities, total: 2 })

      const store = useEntityStore()
      await store.loadEntities()

      expect(store.entities).toEqual(fakeEntities)
      expect(store.total).toBe(2)
      expect(store.loading).toBe(false)
    })

    it('应使用当前的筛选参数', async () => {
      mockFetchEntities.mockResolvedValue({ items: [], total: 0 })

      const store = useEntityStore()
      store.filterType = 'brand'
      store.filterKeyword = '星巴克'
      store.filterCity = '北京'
      store.currentPage = 2
      store.pageSize = 10

      await store.loadEntities()

      expect(mockFetchEntities).toHaveBeenCalledWith({
        entity_type: 'brand',
        keyword: '星巴克',
        city: '北京',
        page: 2,
        page_size: 10,
      })
    })
  })

  // --- addEntity ---
  describe('addEntity', () => {
    it('应调用 API 并刷新列表，返回 id', async () => {
      mockCreateEntity.mockResolvedValue({ id: 'ent-3' })
      mockFetchEntities.mockResolvedValue({ items: fakeEntities, total: 3 })

      const store = useEntityStore()
      const id = await store.addEntity({ name: '库迪咖啡', entity_type: 'brand' })

      expect(id).toBe('ent-3')
      expect(mockCreateEntity).toHaveBeenCalledWith({ name: '库迪咖啡', entity_type: 'brand' })
      expect(mockFetchEntities).toHaveBeenCalled()
    })
  })

  // --- editEntity ---
  describe('editEntity', () => {
    it('应调用 API 并刷新列表', async () => {
      mockUpdateEntity.mockResolvedValue({ id: 'ent-1' })
      mockFetchEntities.mockResolvedValue({ items: fakeEntities, total: 2 })

      const store = useEntityStore()
      await store.editEntity('ent-1', { name: '星巴克咖啡', remark: '更新备注' })

      expect(mockUpdateEntity).toHaveBeenCalledWith('ent-1', { name: '星巴克咖啡', remark: '更新备注' })
      expect(mockFetchEntities).toHaveBeenCalled()
    })
  })

  // --- removeEntity ---
  describe('removeEntity', () => {
    it('应调用 API 并从 selectedIds 移除该 id，再刷新列表', async () => {
      mockDeleteEntity.mockResolvedValue(undefined)
      mockFetchEntities.mockResolvedValue({ items: [fakeEntities[1]], total: 1 })

      const store = useEntityStore()
      store.selectedIds = ['ent-1', 'ent-2']

      await store.removeEntity('ent-1')

      expect(mockDeleteEntity).toHaveBeenCalledWith('ent-1')
      expect(store.selectedIds).toEqual(['ent-2'])
      expect(mockFetchEntities).toHaveBeenCalled()
    })
  })

  // --- doMerge ---
  describe('doMerge', () => {
    it('selectedIds 为空（排除自身后无 source）时应直接返回', async () => {
      const store = useEntityStore()
      store.selectedIds = []

      await store.doMerge('ent-1')

      expect(mockMergeEntities).not.toHaveBeenCalled()
      expect(mockFetchEntities).not.toHaveBeenCalled()
    })

    it('selectedIds 只有 targetId 时应直接返回', async () => {
      const store = useEntityStore()
      store.selectedIds = ['ent-1']

      await store.doMerge('ent-1')

      expect(mockMergeEntities).not.toHaveBeenCalled()
    })

    it('应调用 API 合并后清空 selectedIds 并刷新列表', async () => {
      mockMergeEntities.mockResolvedValue({ success: true, merged_count: 2, aliases_added: 3 })
      mockFetchEntities.mockResolvedValue({ items: [fakeEntities[0]], total: 1 })

      const store = useEntityStore()
      store.selectedIds = ['ent-2', 'ent-3', 'ent-4']

      await store.doMerge('ent-1')

      expect(mockMergeEntities).toHaveBeenCalledWith(['ent-2', 'ent-3', 'ent-4'], 'ent-1')
      expect(store.selectedIds).toEqual([])
      expect(mockFetchEntities).toHaveBeenCalled()
    })
  })

  // --- searchAmap ---
  describe('searchAmap', () => {
    it('应设置 amapResults', async () => {
      mockAmapSearch.mockResolvedValue({ items: fakeAmapResults, total: 2 })

      const store = useEntityStore()
      await store.searchAmap('星巴克', '北京', 'brand')

      expect(store.amapResults).toEqual(fakeAmapResults)
      expect(store.amapResults).toHaveLength(2)
      expect(store.amapLoading).toBe(false)
      expect(mockAmapSearch).toHaveBeenCalledWith({
        keyword: '星巴克',
        city: '北京',
        entity_type: 'brand',
      })
    })
  })

  // --- addFromAmap ---
  describe('addFromAmap', () => {
    it('应调用 API 并刷新实体列表，返回 id', async () => {
      mockCreateEntityFromAmap.mockResolvedValue({ id: 'ent-5' })
      mockFetchEntities.mockResolvedValue({ items: fakeEntities, total: 3 })

      const store = useEntityStore()
      const poi = fakeAmapResults[0]
      const id = await store.addFromAmap(poi, 'brand')

      expect(id).toBe('ent-5')
      expect(mockCreateEntityFromAmap).toHaveBeenCalledWith({
        name: poi.name,
        address: poi.address,
        phone: poi.phone,
        city: poi.city,
        region: poi.region,
        longitude: poi.longitude ?? '',
        latitude: poi.latitude ?? '',
        entity_type: 'brand',
        amap_type: poi.amap_type,
      })
      expect(mockFetchEntities).toHaveBeenCalled()
    })
  })

  // --- loadResources ---
  describe('loadResources', () => {
    it('应设置 resources', async () => {
      mockFetchResources.mockResolvedValue({ items: fakeResources })

      const store = useEntityStore()
      await store.loadResources('ent-1')

      expect(store.resources).toEqual(fakeResources)
      expect(store.resources).toHaveLength(2)
      expect(store.resourcesLoading).toBe(false)
      expect(mockFetchResources).toHaveBeenCalledWith('ent-1')
    })
  })

  // --- addResource ---
  describe('addResource', () => {
    it('应调用 API 并刷新指定实体的资源列表，返回 id', async () => {
      mockCreateResource.mockResolvedValue({ id: 'res-3' })
      mockFetchResources.mockResolvedValue({ items: fakeResources, total: 3 } as any)

      const store = useEntityStore()
      const id = await store.addResource('ent-1', { name: '新供应商', resource_type: 'supplier' })

      expect(id).toBe('res-3')
      expect(mockCreateResource).toHaveBeenCalledWith('ent-1', { name: '新供应商', resource_type: 'supplier' })
      expect(mockFetchResources).toHaveBeenCalledWith('ent-1')
    })
  })

  // --- editResource ---
  describe('editResource', () => {
    it('应调用 API 并刷新指定实体的资源列表', async () => {
      mockUpdateResource.mockResolvedValue({ id: 'res-1' })
      mockFetchResources.mockResolvedValue({ items: fakeResources } as any)

      const store = useEntityStore()
      await store.editResource('res-1', 'ent-1', { unit_price: '55.00' })

      expect(mockUpdateResource).toHaveBeenCalledWith('res-1', { unit_price: '55.00' })
      expect(mockFetchResources).toHaveBeenCalledWith('ent-1')
    })
  })

  // --- removeResource ---
  describe('removeResource', () => {
    it('应调用 API 并刷新指定实体的资源列表', async () => {
      mockDeleteResource.mockResolvedValue(undefined)
      mockFetchResources.mockResolvedValue({ items: [fakeResources[0]] } as any)

      const store = useEntityStore()
      await store.removeResource('res-2', 'ent-1')

      expect(mockDeleteResource).toHaveBeenCalledWith('res-2')
      expect(mockFetchResources).toHaveBeenCalledWith('ent-1')
    })
  })

  // --- toggleSelect ---
  describe('toggleSelect', () => {
    it('添加 id 到 selectedIds（未选中时）', () => {
      const store = useEntityStore()
      store.selectedIds = ['ent-1']

      store.toggleSelect('ent-2')

      expect(store.selectedIds).toEqual(['ent-1', 'ent-2'])
    })

    it('从 selectedIds 中移除 id（已选中时）', () => {
      const store = useEntityStore()
      store.selectedIds = ['ent-1', 'ent-2']

      store.toggleSelect('ent-1')

      expect(store.selectedIds).toEqual(['ent-2'])
    })
  })
})
