<template>
  <div class="monitor-page">
    <div class="title-bar">
      <h2>数据监控面板</h2>
      <button class="btn btn-primary" @click="showAdd = true">+ 添加关键词</button>
    </div>
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="monitors.length === 0" class="empty-state"><p>暂无监控关键词，点击上方按钮添加</p></div>
    <div v-else class="monitor-list">
      <div v-for="m in monitors" :key="m.id" class="monitor-card">
        <div class="monitor-info">
          <span class="keyword">{{ m.keyword }}</span>
          <span class="status-dot" :class="m.is_active ? 'active' : 'inactive'"></span>
        </div>
        <button class="btn-sm btn-danger" @click="deleteMonitor(m.id)">删除</button>
      </div>
    </div>

    <div v-if="showAdd" class="overlay" @click.self="showAdd = false">
      <div class="dialog dialog-sm">
        <div class="dialog-header"><h3>添加监控关键词</h3><button class="dialog-close" @click="showAdd = false">&times;</button></div>
        <div class="dialog-body">
          <div class="form-field"><label>关键词 <span class="required">*</span></label><input v-model="newKeyword" placeholder="输入关键词" @keyup.enter="addMonitor" /></div>
          <div class="form-actions"><button class="btn btn-primary" @click="addMonitor">添加</button><button class="btn" @click="showAdd = false">取消</button></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '@/api/client'
import { toast } from '@/utils/toast'

interface Monitor { id: number; keyword: string; is_active: boolean; created_at: string }
const monitors = ref<Monitor[]>([])
const loading = ref(false)
const showAdd = ref(false)
const newKeyword = ref('')

async function loadMonitors(): Promise<void> {
  loading.value = true
  try { const res = await api.get<{ items: Monitor[] }>('/keyword-monitors'); monitors.value = res.items } catch (e) { console.error(e); toast.error('加载监控列表失败') }
  finally { loading.value = false }
}

async function addMonitor(): Promise<void> {
  if (!newKeyword.value.trim()) return
  try { await api.post('/keyword-monitors', { keyword: newKeyword.value }); newKeyword.value = ''; showAdd.value = false; await loadMonitors() } catch (e) { console.error(e); toast.error('添加监控失败') }
}

async function deleteMonitor(id: number): Promise<void> {
  if (!confirm('确定删除此监控？')) return
  try { await api.delete(`/keyword-monitors/${id}`); await loadMonitors() } catch (e) { console.error(e); toast.error('删除监控失败') }
}

onMounted(loadMonitors)
</script>

<style scoped>
.monitor-page { max-width: 700px; margin: 0 auto; }
.title-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.title-bar h2 { margin: 0; font-size: 22px; color: #1a1a2e; }
.btn { padding: 8px 20px; border-radius: 6px; border: none; cursor: pointer; font-size: 14px; font-weight: 500; }
.btn-primary { background: #4a6cf7; color: #fff; }
.btn-sm { padding: 4px 12px; border-radius: 4px; border: 1px solid #ddd; background: #fff; cursor: pointer; font-size: 12px; }
.btn-sm.btn-danger { border-color: #ffcdd2; color: #e53935; }
.monitor-list { display: flex; flex-direction: column; gap: 8px; }
.monitor-card { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #fff; border: 1px solid #eee; border-radius: 8px; }
.keyword { font-size: 14px; font-weight: 500; color: #333; }
.monitor-info { display: flex; align-items: center; gap: 8px; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; }
.status-dot.active { background: #22c55e; }
.status-dot.inactive { background: #ccc; }
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.dialog { background: #fff; border-radius: 12px; width: 480px; }
.dialog-sm { width: 400px; }
.dialog-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #eee; }
.dialog-header h3 { margin: 0; font-size: 16px; }
.dialog-close { background: none; border: none; font-size: 20px; cursor: pointer; color: #999; }
.dialog-body { padding: 20px; }
.form-field { margin-bottom: 16px; }
.form-field label { display: block; margin-bottom: 6px; font-size: 13px; color: #666; font-weight: 500; }
.required { color: #e53935; }
.form-field input { width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; box-sizing: border-box; }
.form-field input:focus { outline: none; border-color: #4a6cf7; }
.form-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 8px; }
.empty-state, .loading { text-align: center; padding: 60px; color: #999; background: #fff; border-radius: 10px; }
</style>
