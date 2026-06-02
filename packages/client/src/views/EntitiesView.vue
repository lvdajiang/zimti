<template>
  <div class="entities">
    <div class="toolbar">
      <h2 class="page-title">供应商管理</h2>
      <div class="toolbar-actions">
        <button v-if="selectedIds.length >= 2" class="btn-warning" @click="showMergeModal = true">
          合并 ({{ selectedIds.length }})
        </button>
        <button class="btn-primary" @click="openCreateModal">+ 新增供应商</button>
      </div>
    </div>

    <div class="filters">
      <input v-model="store.filterKeyword" class="input" placeholder="搜索名称/别名/地址..." style="width: 240px" @keyup.enter="search" />
      <select v-model="store.filterType" class="input" style="width: 140px" @change="search">
        <option value="all">全部类型</option>
        <option v-for="(label, key) in ENTITY_TYPE_LABELS" :key="key" :value="key">{{ label }}</option>
      </select>
      <button class="btn" @click="search">搜索</button>
    </div>

    <div v-if="store.loading" class="loading-wrapper">加载中...</div>
    <div v-else-if="store.entities.length === 0" class="empty-state">
      <div class="empty-icon">🏢</div>
      <div class="empty-text">暂无供应商数据</div>
      <button class="btn-link" @click="showAmapModal = true">从高德地图搜索创建</button>
    </div>
    <table v-else class="data-table">
      <thead>
        <tr>
          <th style="width:36px"><input type="checkbox" :checked="allSelected" @change="toggleAll" /></th>
          <th>名称</th><th>别名</th><th>类型</th><th>城市</th><th>电话</th><th>资源数</th><th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="e in store.entities" :key="e.id" :class="{ selected: selectedIds.includes(e.id) }">
          <td><input type="checkbox" :checked="selectedIds.includes(e.id)" @change="store.toggleSelect(e.id)" /></td>
          <td class="name-cell" @click="openDetail(e)">{{ e.name }}</td>
          <td class="alias-cell">{{ formatAliases(e.aliases) }}</td>
          <td><span class="type-badge" :class="'type-' + e.entity_type">{{ ENTITY_TYPE_LABELS[e.entity_type as EntityType] || e.entity_type }}</span></td>
          <td>{{ e.city || '-' }}</td>
          <td>{{ e.phone || '-' }}</td>
          <td>{{ e.resource_count }}</td>
          <td class="actions-cell">
            <button class="btn-link" @click="openEditModal(e)">编辑</button>
            <button class="btn-link" @click="openDetail(e)">资源</button>
            <button class="btn-link btn-danger" @click="handleDelete(e.id)">删除</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="store.total > store.pageSize" class="pagination">
      <button :disabled="store.currentPage <= 1" @click="store.currentPage--; store.loadEntities()">上一页</button>
      <span class="page-info">{{ store.currentPage }} / {{ Math.ceil(store.total / store.pageSize) }}</span>
      <button :disabled="store.currentPage >= Math.ceil(store.total / store.pageSize)" @click="store.currentPage++; store.loadEntities()">下一页</button>
    </div>

    <!-- 新增/编辑弹窗 -->
    <div v-if="showEditModal" class="modal-overlay" @click.self="showEditModal = false">
      <div class="modal">
        <h3 class="modal-title">{{ editingId ? '编辑供应商' : '新增供应商' }}</h3>
        <div class="form-group">
          <label>名称 *</label>
          <input v-model="form.name" class="input" placeholder="如：美丽豪酒店" maxlength="200" />
        </div>
        <div class="form-row">
          <div class="form-group"><label>类型 *</label>
            <select v-model="form.entity_type" class="input">
              <option v-for="(label, key) in ENTITY_TYPE_LABELS" :key="key" :value="key">{{ label }}</option>
            </select>
          </div>
          <div class="form-group"><label>城市</label>
            <input v-model="form.city" class="input" placeholder="如：喀什" />
          </div>
        </div>
        <div class="form-group"><label>别名</label>
          <input v-model="form.aliases" class="input" placeholder="多个别名用逗号分隔，如：美丽豪,美丽豪酒店" />
        </div>
        <div class="form-row">
          <div class="form-group"><label>区域</label><input v-model="form.region" class="input" placeholder="如：新疆" /></div>
          <div class="form-group"><label>电话</label><input v-model="form.phone" class="input" placeholder="联系电话" /></div>
        </div>
        <div class="form-group"><label>地址</label><input v-model="form.address" class="input" placeholder="详细地址" /></div>
        <div class="form-row">
          <div class="form-group"><label>经度</label><input v-model="form.longitude" class="input" placeholder="75.9891" /></div>
          <div class="form-group"><label>纬度</label><input v-model="form.latitude" class="input" placeholder="39.4677" /></div>
        </div>
        <div class="form-group"><label>备注</label><textarea v-model="form.remark" class="input" rows="2" placeholder="备注信息" /></div>
        <div class="modal-actions">
          <button class="btn" @click="showEditModal = false">取消</button>
          <button class="btn-primary" :disabled="submitting" @click="handleSubmit">{{ submitting ? '提交中...' : '确定' }}</button>
        </div>
      </div>
    </div>

    <!-- 合并弹窗 -->
    <div v-if="showMergeModal" class="modal-overlay" @click.self="showMergeModal = false">
      <div class="modal">
        <h3 class="modal-title">合并供应商</h3>
        <p class="merge-hint">选择要保留的主记录，其他记录将被合并进来（名称自动加入别名）：</p>
        <div v-for="e in selectedEntities" :key="e.id" class="merge-item" :class="{ 'merge-target': mergeTargetId === e.id }" @click="mergeTargetId = e.id">
          <input type="radio" :checked="mergeTargetId === e.id" />
          <span class="type-badge" :class="'type-' + e.entity_type">{{ ENTITY_TYPE_LABELS[e.entity_type as EntityType] }}</span>
          <strong>{{ e.name }}</strong>
          <span v-if="e.city" class="merge-detail">{{ e.city }}</span>
          <span v-if="e.address" class="merge-detail">{{ e.address }}</span>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="showMergeModal = false">取消</button>
          <button class="btn-warning" :disabled="!mergeTargetId || submitting" @click="handleMerge">{{ submitting ? '合并中...' : '确认合并' }}</button>
        </div>
      </div>
    </div>

    <!-- 高德搜索弹窗 -->
    <div v-if="showAmapModal" class="modal-overlay" @click.self="showAmapModal = false">
      <div class="modal" style="width:640px">
        <h3 class="modal-title">从高德地图创建</h3>
        <div class="filters" style="margin-bottom:12px">
          <input v-model="amapKeyword" class="input" placeholder="搜索酒店/餐厅/景区..." style="width:200px" @keyup.enter="doAmapSearch" />
          <input v-model="amapCity" class="input" placeholder="城市（可选）" style="width:120px" />
          <select v-model="amapType" class="input" style="width:120px">
            <option value="">全部类型</option>
            <option v-for="(label, key) in ENTITY_TYPE_LABELS" :key="key" :value="key">{{ label }}</option>
          </select>
          <button class="btn-primary" :disabled="store.amapLoading" @click="doAmapSearch">{{ store.amapLoading ? '搜索中...' : '搜索' }}</button>
        </div>
        <div v-if="store.amapResults.length === 0 && !store.amapLoading" class="empty-state" style="padding:24px">
          <div class="empty-text">输入关键词搜索高德地图 POI</div>
        </div>
        <div v-else class="amap-list">
          <div v-for="(poi, idx) in store.amapResults" :key="idx" class="amap-item">
            <div class="amap-info">
              <strong>{{ poi.name }}</strong>
              <span class="amap-address">{{ poi.address }}</span>
              <span v-if="poi.phone" class="amap-phone">{{ poi.phone }}</span>
            </div>
            <button class="btn-primary" style="white-space:nowrap" @click="handleAmapCreate(poi)">创建</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 详情/资源弹窗 -->
    <div v-if="showDetailModal && detailEntity" class="modal-overlay" @click.self="showDetailModal = false">
      <div class="modal" style="width:720px">
        <h3 class="modal-title">{{ detailEntity.name }} — 资源管理</h3>
        <div class="detail-info">
          <span class="type-badge" :class="'type-' + detailEntity.entity_type">{{ ENTITY_TYPE_LABELS[detailEntity.entity_type as EntityType] }}</span>
          <span v-if="detailEntity.city">{{ detailEntity.city }}</span>
          <span v-if="detailEntity.address">{{ detailEntity.address }}</span>
          <span v-if="detailEntity.phone">{{ detailEntity.phone }}</span>
          <span v-if="detailEntity.aliases" class="alias-tag">别名: {{ detailEntity.aliases }}</span>
        </div>
        <div class="toolbar" style="margin:12px 0 8px">
          <span style="font-size:14px;font-weight:500">资源列表</span>
          <button class="btn-primary" style="font-size:12px;padding:4px 12px" @click="showResourceForm = true">+ 添加资源</button>
        </div>
        <div v-if="showResourceForm" class="resource-form">
          <div class="form-row">
            <input v-model="resForm.name" class="input" placeholder="资源名称" style="flex:2" />
            <select v-model="resForm.resource_type" class="input" style="width:100px">
              <option v-for="(label, key) in RESOURCE_TYPE_LABELS" :key="key" :value="key">{{ label }}</option>
            </select>
            <input v-model="resForm.unit_price" class="input" placeholder="单价" style="width:80px" />
            <input v-model="resForm.unit" class="input" placeholder="单位" style="width:60px" />
          </div>
          <div class="form-row" style="margin-top:8px">
            <input v-model="resForm.remark" class="input" placeholder="备注" style="flex:1" />
            <button class="btn-primary" style="font-size:12px;padding:4px 12px" @click="handleAddResource">添加</button>
            <button class="btn" style="font-size:12px;padding:4px 12px" @click="showResourceForm = false">取消</button>
          </div>
        </div>
        <table v-if="store.resources.length > 0" class="data-table" style="font-size:13px">
          <thead><tr><th>名称</th><th>类型</th><th>单价</th><th>单位</th><th>备注</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="r in store.resources" :key="r.id">
              <td>{{ r.name }}</td>
              <td>{{ RESOURCE_TYPE_LABELS[r.resource_type as ResourceType] || r.resource_type }}</td>
              <td>{{ r.unit_price ? '¥' + r.unit_price : '-' }}</td>
              <td>{{ r.unit || '-' }}</td>
              <td>{{ r.remark || '-' }}</td>
              <td><button class="btn-link btn-danger" @click="handleDeleteResource(r.id)">删除</button></td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty-state" style="padding:20px"><div class="empty-text">暂无资源，点击上方按钮添加</div></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useEntityStore } from '@/stores/entity'
import { ENTITY_TYPE_LABELS, RESOURCE_TYPE_LABELS } from '@zimti/shared'
import type { EntityType, ResourceType } from '@zimti/shared'
import type { Entity, AmapPOI } from '@/api/entities'
import { toast } from '@/utils/toast'

const store = useEntityStore()
const selectedIds = computed(() => store.selectedIds)
const allSelected = computed(() => store.entities.length > 0 && store.entities.every((e) => selectedIds.value.includes(e.id)))
const selectedEntities = computed(() => store.entities.filter((e) => selectedIds.value.includes(e.id)))

const showEditModal = ref(false)
const editingId = ref<string | null>(null)
const submitting = ref(false)
const form = ref({ name: '', entity_type: 'hotel' as EntityType, aliases: '', region: '', city: '', address: '', phone: '', longitude: '', latitude: '', remark: '' })

const showMergeModal = ref(false)
const mergeTargetId = ref('')

const showAmapModal = ref(false)
const amapKeyword = ref('')
const amapCity = ref('')
const amapType = ref('')

const showDetailModal = ref(false)
const detailEntity = ref<Entity | null>(null)
const showResourceForm = ref(false)
const resForm = ref({ name: '', resource_type: 'room' as ResourceType, unit_price: '', unit: '', remark: '' })

function search() { store.currentPage = 1; store.loadEntities() }
function toggleAll() { store.selectedIds = allSelected.value ? [] : store.entities.map((e) => e.id) }
function formatAliases(aliases: string): string {
  if (!aliases) return '-'
  const list = aliases.split(',').map((s) => s.trim()).filter(Boolean)
  if (list.length === 0) return '-'
  if (list.length <= 2) return list.join('、')
  return list.slice(0, 2).join('、') + ` (+${list.length - 2})`
}

function openCreateModal() {
  editingId.value = null
  form.value = { name: '', entity_type: 'hotel', aliases: '', region: '', city: '', address: '', phone: '', longitude: '', latitude: '', remark: '' }
  showEditModal.value = true
}

function openEditModal(e: Entity) {
  editingId.value = e.id
  form.value = { name: e.name, entity_type: e.entity_type, aliases: e.aliases, region: e.region ?? '', city: e.city ?? '', address: e.address ?? '', phone: e.phone ?? '', longitude: e.longitude ?? '', latitude: e.latitude ?? '', remark: e.remark ?? '' }
  showEditModal.value = true
}

async function handleSubmit() {
  if (!form.value.name.trim()) { toast.warning('名称不能为空'); return }
  submitting.value = true
  try {
    if (editingId.value) { await store.editEntity(editingId.value, form.value); toast.success('更新成功') }
    else { await store.addEntity(form.value); toast.success('创建成功') }
    showEditModal.value = false
  } catch { toast.error(editingId.value ? '更新失败' : '创建失败') }
  finally { submitting.value = false }
}

async function handleDelete(id: string) {
  try { await store.removeEntity(id); toast.success('已删除') } catch { toast.error('删除失败') }
}

async function handleMerge() {
  if (!mergeTargetId.value) return
  submitting.value = true
  try { await store.doMerge(mergeTargetId.value); toast.success('合并成功'); showMergeModal.value = false; mergeTargetId.value = '' }
  catch { toast.error('合并失败') } finally { submitting.value = false }
}

async function doAmapSearch() {
  if (!amapKeyword.value.trim()) { toast.warning('请输入搜索关键词'); return }
  await store.searchAmap(amapKeyword.value, amapCity.value || undefined, amapType.value || undefined)
}

async function handleAmapCreate(poi: AmapPOI) {
  try { await store.addFromAmap(poi, (amapType.value || undefined) as EntityType | undefined); toast.success(`已创建：${poi.name}`) }
  catch { toast.error('创建失败') }
}

async function openDetail(e: Entity) {
  detailEntity.value = e; showDetailModal.value = true; showResourceForm.value = false
  resForm.value = { name: '', resource_type: 'room', unit_price: '', unit: '', remark: '' }
  await store.loadResources(e.id)
}

async function handleAddResource() {
  if (!resForm.value.name.trim() || !detailEntity.value) return
  try {
    await store.addResource(detailEntity.value.id, resForm.value)
    toast.success('资源已添加'); resForm.value = { name: '', resource_type: 'room', unit_price: '', unit: '', remark: '' }; showResourceForm.value = false
  } catch { toast.error('添加失败') }
}

async function handleDeleteResource(id: string) {
  if (!detailEntity.value) return
  try { await store.removeResource(id, detailEntity.value.id); toast.success('已删除') } catch { toast.error('删除失败') }
}

onMounted(() => store.loadEntities())
</script>

<style scoped>
.entities { max-width: 1100px; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4); }
.toolbar-actions { display: flex; gap: var(--space-2); }
.page-title { font-size: var(--font-size-xl); font-weight: 600; margin: 0; }
.filters { display: flex; gap: var(--space-3); margin-bottom: var(--space-4); }
.input { padding: 6px var(--space-2); border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: var(--font-size-sm); outline: none; transition: border-color var(--transition-fast); }
.input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2); }
.btn { padding: 6px var(--space-4); border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-bg); font-size: var(--font-size-sm); cursor: pointer; }
.btn-primary { padding: 6px var(--space-4); background: var(--color-primary); color: var(--color-bg); border: none; border-radius: var(--radius-sm); font-size: var(--font-size-sm); cursor: pointer; }
.btn-primary:hover:not(:disabled) { background: var(--color-primary-hover); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-warning { padding: 6px var(--space-4); background: var(--color-warning); color: var(--color-bg); border: none; border-radius: var(--radius-sm); font-size: var(--font-size-sm); cursor: pointer; }
.btn-warning:hover { background: #d48806; }
.btn-warning:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-link { background: none; border: none; color: var(--color-primary); font-size: var(--font-size-xs); cursor: pointer; padding: 0 4px; }
.btn-danger { color: var(--color-danger); }
.loading-wrapper { display: flex; justify-content: center; padding: 60px; color: var(--color-text-tertiary); }
.empty-state { display: flex; flex-direction: column; align-items: center; padding: 60px var(--space-5); color: var(--color-text-tertiary); }
.empty-icon { font-size: 40px; margin-bottom: var(--space-3); }
.empty-text { font-size: var(--font-size-base); }
.data-table { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); }
.data-table th { text-align: left; padding: var(--space-2) 10px; border-bottom: 2px solid var(--color-border-light); color: var(--color-text-tertiary); font-weight: 500; font-size: var(--font-size-xs); }
.data-table td { padding: var(--space-2) 10px; border-bottom: 1px solid var(--color-border-light); }
.data-table tr.selected { background: var(--color-primary-light); }
.data-table tr:hover td { background: var(--color-bg-tertiary); }
.name-cell { font-weight: 500; color: var(--color-text); cursor: pointer; }
.name-cell:hover { color: var(--color-primary); }
.alias-cell { color: var(--color-text-secondary); max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.actions-cell { white-space: nowrap; }
.type-badge { display: inline-block; padding: 1px var(--space-2); border-radius: var(--radius-sm); font-size: 11px; color: var(--color-bg); }
.type-hotel { background: #6366f1; } .type-restaurant { background: var(--color-warning); } .type-scenic { background: #10b981; } .type-vehicle { background: var(--color-primary); } .type-other { background: #6b7280; }
.pagination { display: flex; align-items: center; justify-content: flex-end; gap: var(--space-3); margin-top: var(--space-4); font-size: var(--font-size-sm); }
.page-info { color: var(--color-text-tertiary); }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: var(--color-bg); border-radius: var(--radius-lg); padding: var(--space-6); width: 560px; max-height: 80vh; overflow-y: auto; box-shadow: var(--shadow-lg); }
.modal-title { margin: 0 0 var(--space-5); font-size: var(--font-size-lg); font-weight: 600; }
.form-group { margin-bottom: var(--space-4); }
.form-group label { display: block; font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-1); }
.form-group .input { width: 100%; box-sizing: border-box; }
.form-group textarea.input { resize: vertical; }
.form-row { display: flex; gap: var(--space-3); }
.form-row .form-group { flex: 1; }
.modal-actions { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-5); }
.merge-hint { font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-3); }
.merge-item { display: flex; align-items: center; gap: var(--space-2); padding: 10px; border: 1px solid var(--color-border-light); border-radius: var(--radius-sm); margin-bottom: var(--space-2); cursor: pointer; }
.merge-item:hover { border-color: var(--color-primary); }
.merge-item.merge-target { border-color: var(--color-warning); background: var(--color-warning-bg); }
.merge-detail { color: var(--color-text-tertiary); font-size: var(--font-size-xs); margin-left: var(--space-1); }
.amap-list { max-height: 400px; overflow-y: auto; }
.amap-item { display: flex; justify-content: space-between; align-items: center; padding: 10px; border: 1px solid var(--color-border-light); border-radius: var(--radius-sm); margin-bottom: var(--space-2); }
.amap-item:hover { border-color: var(--color-primary); }
.amap-info { display: flex; flex-direction: column; gap: 2px; }
.amap-info strong { font-size: var(--font-size-base); }
.amap-address, .amap-phone { font-size: var(--font-size-xs); color: var(--color-text-secondary); }
.detail-info { display: flex; flex-wrap: wrap; gap: var(--space-2); font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-3); align-items: center; }
.alias-tag { background: var(--color-primary-light); color: var(--color-primary); padding: 1px var(--space-2); border-radius: var(--radius-sm); font-size: 11px; }
.resource-form { background: var(--color-bg-secondary); padding: var(--space-3); border-radius: var(--radius); margin-bottom: var(--space-3); }
</style>
