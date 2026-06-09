<template>
  <div class="fact-extract-page">
    <div class="back-nav">
      <RouterLink to="/geo" class="back-link">← 返回 GEO</RouterLink>
    </div>
    <div class="title-bar">
      <h2>事实提取</h2>
      <span class="subtitle">从视频文案中提取客观、可验证的原子事实</span>
    </div>

    <div class="two-panel">
      <!-- 左栏：输入 -->
      <div class="panel-left">
        <div class="panel">
          <div class="panel-header">
            <h3>粘贴文案</h3>
            <span class="char-count">{{ store.transcript.length }} 字</span>
          </div>
          <div class="form-group">
            <label>主题（可选，帮助 AI 聚焦）</label>
            <input v-model="store.topic" class="input" placeholder="如：新疆旅行、阿勒泰路线..." />
          </div>
          <textarea
            v-model="store.transcript"
            class="transcript-input"
            placeholder="在此粘贴视频号文案、旅游攻略文本...&#10;&#10;系统将自动提取其中所有客观、可验证的原子事实，如：&#10;• 乌鲁木齐到阿勒泰约570公里&#10;• 赛里木湖环湖全程约92公里&#10;• 独库公路每年6月到10月开放"
          ></textarea>
          <div class="input-actions">
            <label class="toggle-label">
              <input type="checkbox" v-model="store.autoVerify" />
              <span>提取后自动验证（用搜索引擎交叉检查）</span>
            </label>
            <button
              class="btn btn-primary"
              :disabled="store.transcript.trim().length < 50 || store.extracting"
              @click="handleExtract"
            >
              {{ store.extracting ? '提取中...' : '提取事实' }}
            </button>
          </div>
        </div>

        <!-- 提取结果摘要 -->
        <div v-if="store.extractResult" class="panel result-summary">
          <h3>提取完成</h3>
          <div class="result-stats">
            <div class="stat-item">
              <span class="stat-num">{{ store.extractResult.total_extracted }}</span>
              <span>条事实</span>
            </div>
            <div class="stat-item">
              <span class="stat-num">{{ store.extractResult.saved_count }}</span>
              <span>已入库</span>
            </div>
            <div v-if="store.extractResult.facts" class="stat-item">
              <span class="stat-num">{{ store.extractResult.facts.filter(f => f.verification_status === 'verified').length }}</span>
              <span>已验证</span>
            </div>
            <div v-if="store.extractResult.facts" class="stat-item">
              <span class="stat-num">{{ store.extractResult.facts.filter(f => f.verification_status === 'pending').length }}</span>
              <span>待验证</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 右栏：事实列表 -->
      <div class="panel-right">
        <div v-if="store.extracting" class="loading-area">
          <div class="spinner"></div>
          <p>正在提取事实，请稍候...</p>
        </div>

        <div v-else-if="store.extractResult && store.extractResult.facts.length > 0" class="facts-list">
          <div class="facts-toolbar">
            <select v-model="filterType" class="input input-sm" @change="applyFilter">
              <option value="all">全部类型</option>
              <option value="statistic">统计数据</option>
              <option value="definition">定义</option>
              <option value="procedure">流程步骤</option>
              <option value="tip">实用建议</option>
              <option value="warning">注意事项</option>
              <option value="comparison">对比数据</option>
            </select>
            <select v-model="filterStatus" class="input input-sm" @change="applyFilter">
              <option value="all">全部状态</option>
              <option value="verified">已验证</option>
              <option value="pending">待验证</option>
              <option value="unverified">未验证</option>
              <option value="rejected">已否决</option>
            </select>
            <button
              v-if="selectedFacts.length > 0"
              class="btn btn-sm btn-verify"
              :disabled="store.verifying"
              @click="handleVerifySelected"
            >
              {{ store.verifying ? '验证中...' : `验证选中 (${selectedFacts.length})` }}
            </button>
          </div>

          <div v-for="(fact, idx) in filteredFacts" :key="idx" class="fact-card" :class="fact.verification_status || ''">
            <div class="fact-header">
              <label class="fact-select">
                <input type="checkbox" :value="idx" v-model="selectedIndices" />
              </label>
              <span class="fact-type-badge" :class="fact.fact_type">{{ factTypeLabel(fact.fact_type) }}</span>
              <span v-if="fact.verification_status" class="verify-badge" :class="fact.verification_status">
                {{ verifyLabel(fact.verification_status) }}
              </span>
              <span class="confidence">{{ Math.round(fact.confidence * 100) }}%</span>
            </div>
            <p class="fact-content">{{ fact.content }}</p>
            <div v-if="fact.fact_context" class="fact-context">
              <span class="context-label">原文：</span>{{ fact.fact_context }}
            </div>
            <div v-if="fact.tags && fact.tags.length" class="fact-tags">
              <span v-for="tag in fact.tags" :key="tag" class="tag-chip">{{ tag }}</span>
            </div>
            <div v-if="fact.verification_note" class="fact-note">{{ fact.verification_note }}</div>
          </div>

          <div v-if="filteredFacts.length === 0" class="empty-hint">无匹配事实</div>
        </div>

        <div v-else-if="!store.extracting" class="empty-state">
          <p class="empty-icon">📋</p>
          <p>粘贴文案后点击"提取事实"</p>
          <p class="empty-hint">系统将从中提取所有客观、可验证的原子事实</p>
        </div>
      </div>
    </div>

    <!-- 事实库 -->
    <div class="facts-section">
      <div class="section-header">
        <h3>事实库 ({{ store.factsTotal }})</h3>
        <button class="btn btn-sm" @click="handleLoadFacts">刷新</button>
      </div>
      <div v-if="store.factsLoading" class="loading-area">加载中...</div>
      <div v-else-if="store.factsList.length > 0" class="facts-grid">
        <div v-for="fact in store.factsList" :key="fact.id" class="fact-row">
          <span class="fact-type-badge sm" :class="fact.fact_type">{{ factTypeLabel(fact.fact_type) }}</span>
          <span class="fact-text">{{ fact.content }}</span>
          <span v-if="fact.verification_status" class="verify-badge sm" :class="fact.verification_status">
            {{ verifyLabel(fact.verification_status) }}
          </span>
          <button class="btn-icon" @click="handleDeleteFact(fact)" title="删除">✕</button>
        </div>
      </div>
      <div v-else class="empty-hint">事实库为空，提取文案后将自动入库</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useFactExtractStore } from '../stores/factExtract'
import { toast } from '../utils/toast'

const store = useFactExtractStore()

const filterType = ref('all')
const filterStatus = ref('all')
const selectedIndices = ref<number[]>([])

const selectedFacts = computed(() => {
  if (!store.extractResult) return []
  return selectedIndices.value
    .map(i => store.extractResult!.facts[i])
    .filter(Boolean)
})

const filteredFacts = computed(() => {
  if (!store.extractResult) return []
  return store.extractResult.facts.filter(f => {
    if (filterType.value !== 'all' && f.fact_type !== filterType.value) return false
    if (filterStatus.value !== 'all' && f.verification_status !== filterStatus.value) return false
    return true
  })
})

function factTypeLabel(type: string | null): string {
  const map: Record<string, string> = {
    definition: '定义', statistic: '数据', procedure: '流程',
    tip: '建议', warning: '注意', comparison: '对比',
  }
  return map[type || ''] || type || '—'
}

function verifyLabel(status: string | null): string {
  const map: Record<string, string> = {
    verified: '✓ 已验证', pending: '⏳ 待验证', unverified: '未验证', rejected: '✗ 已否决',
  }
  return map[status || ''] || ''
}

function applyFilter(): void {
  // 筛选由 computed 处理
}

async function handleExtract(): Promise<void> {
  try {
    await store.startExtract()
    toast.success(`提取完成，共 ${store.extractResult?.total_extracted || 0} 条事实`)
    await store.loadFacts()
  } catch (e) {
    console.error(e)
    toast.error(e instanceof Error ? e.message : '提取失败')
  }
}

async function handleVerifySelected(): Promise<void> {
  const ids = selectedFacts.value.map(f => (f as any).id || '').filter(Boolean)
  if (ids.length === 0) {
    toast.warning('请先选择要验证的事实')
    return
  }
  try {
    await store.verifySelected(ids)
    toast.success('验证完成')
    selectedIndices.value = []
  } catch (e) {
    console.error(e)
    toast.error('验证失败')
  }
}

async function handleLoadFacts(): Promise<void> {
  await store.loadFacts()
}

async function handleDeleteFact(fact: { id: string; is_active: boolean }): Promise<void> {
  try {
    await store.editFact(fact.id, { is_active: false })
    toast.success('已删除')
  } catch (e) {
    console.error(e)
    toast.error('删除失败')
  }
}

onMounted(() => {
  store.loadFacts()
})
</script>

<style scoped>
.back-nav { margin-bottom: var(--space-3); }
.back-link { font-size: var(--font-size-sm); color: var(--color-text-secondary); text-decoration: none; }
.back-link:hover { color: var(--color-primary); }
.title-bar { margin-bottom: var(--space-5); display: flex; align-items: baseline; gap: var(--space-3); }
.title-bar h2 { margin: 0; font-size: var(--font-size-xl); }
.subtitle { font-size: var(--font-size-sm); color: var(--color-text-tertiary); }

.two-panel { display: flex; gap: var(--space-5); margin-bottom: var(--space-6); }
.panel-left { width: 45%; flex-shrink: 0; }
.panel-right { flex: 1; min-width: 0; }

.panel { background: var(--color-bg); border: 1px solid var(--color-border-light); border-radius: var(--radius-lg); padding: var(--space-4); margin-bottom: var(--space-4); }
.panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3); }
.panel-header h3 { margin: 0; font-size: var(--font-size-base); }
.char-count { font-size: var(--font-size-xs); color: var(--color-text-tertiary); }

.form-group { margin-bottom: var(--space-3); }
.form-group label { display: block; font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-1); }
.input { width: 100%; padding: var(--space-2) 10px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: var(--font-size-sm); box-sizing: border-box; outline: none; }
.input-sm { width: auto; padding: 4px 8px; font-size: var(--font-size-xs); }
.input:focus { border-color: var(--color-primary); }

.transcript-input {
  width: 100%; min-height: 300px; padding: var(--space-3); border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); font-size: var(--font-size-sm); line-height: 1.8; resize: vertical;
  font-family: inherit; box-sizing: border-box; outline: none;
}
.transcript-input:focus { border-color: var(--color-primary); }

.input-actions { display: flex; justify-content: space-between; align-items: center; margin-top: var(--space-3); }
.toggle-label { display: flex; align-items: center; gap: 6px; font-size: var(--font-size-sm); color: var(--color-text-secondary); cursor: pointer; }
.toggle-label input { accent-color: var(--color-primary); }
.btn { padding: var(--space-2) var(--space-5); border-radius: var(--radius-sm); border: none; cursor: pointer; font-size: var(--font-size-sm); font-weight: 500; }
.btn-primary { background: var(--color-primary); color: #fff; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-sm { padding: 4px 10px; font-size: var(--font-size-xs); border: 1px solid var(--color-border); background: var(--color-bg); border-radius: var(--radius-sm); cursor: pointer; }
.btn-verify { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
.btn-icon { background: none; border: none; cursor: pointer; color: var(--color-text-tertiary); font-size: var(--font-size-sm); padding: 2px 6px; }
.btn-icon:hover { color: var(--color-danger); }

.result-stats { display: flex; gap: var(--space-5); }
.stat-item { display: flex; flex-direction: column; align-items: center; }
.stat-num { font-size: var(--font-size-lg); font-weight: 700; color: var(--color-primary); }

.facts-list { max-height: 600px; overflow-y: auto; }
.facts-toolbar { display: flex; gap: var(--space-2); margin-bottom: var(--space-3); align-items: center; }

.fact-card { padding: var(--space-3); border: 1px solid var(--color-border-light); border-radius: var(--radius-sm); margin-bottom: var(--space-2); transition: border-color 0.2s; }
.fact-card:hover { border-color: var(--color-primary); }
.fact-card.rejected { opacity: 0.5; background: var(--color-bg-secondary); }
.fact-header { display: flex; align-items: center; gap: var(--space-2); margin-bottom: 6px; }
.fact-select input { accent-color: var(--color-primary); }
.fact-content { margin: 0; font-size: var(--font-size-sm); line-height: 1.6; color: var(--color-text); }
.fact-context { font-size: var(--font-size-xs); color: var(--color-text-tertiary); margin-top: 6px; padding: 6px; background: var(--color-bg-secondary); border-radius: var(--radius-sm); }
.context-label { color: var(--color-primary); font-weight: 500; }
.fact-tags { margin-top: 6px; display: flex; gap: 4px; flex-wrap: wrap; }
.tag-chip { display: inline-block; padding: 1px 6px; background: var(--color-border-light); border-radius: var(--radius-sm); font-size: 11px; }
.fact-note { font-size: var(--font-size-xs); color: var(--color-warning); margin-top: 4px; }

.fact-type-badge { display: inline-block; padding: 2px 8px; border-radius: var(--radius-sm); font-size: 11px; font-weight: 500; }
.fact-type-badge.sm { font-size: 10px; padding: 1px 6px; }
.fact-type-badge.statistic { background: #dbeafe; color: #2563eb; }
.fact-type-badge.definition { background: #f3e8ff; color: #7c3aed; }
.fact-type-badge.procedure { background: #dcfce7; color: #16a34a; }
.fact-type-badge.tip { background: #fef3c7; color: #d97706; }
.fact-type-badge.warning { background: #fee2e2; color: #dc2626; }
.fact-type-badge.comparison { background: #e0e7ff; color: #4338ca; }

.verify-badge { display: inline-block; padding: 1px 6px; border-radius: var(--radius-sm); font-size: 11px; }
.verify-badge.sm { font-size: 10px; }
.verify-badge.verified { background: #dcfce7; color: #16a34a; }
.verify-badge.pending { background: #fef3c7; color: #d97706; }
.verify-badge.unverified { background: #f3f4f6; color: #6b7280; }
.verify-badge.rejected { background: #fee2e2; color: #dc2626; }

.confidence { font-size: var(--font-size-xs); color: var(--color-text-tertiary); margin-left: auto; font-variant-numeric: tabular-nums; }

.loading-area { text-align: center; padding: var(--space-10); color: var(--color-text-tertiary); }
.spinner { width: 32px; height: 32px; border: 3px solid var(--color-border-light); border-top-color: var(--color-primary); border-radius: 50%; margin: 0 auto var(--space-3); animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.empty-state { text-align: center; padding: 60px var(--space-5); color: var(--color-text-tertiary); }
.empty-icon { font-size: 48px; margin: 0 0 var(--space-3); }
.empty-hint { font-size: var(--font-size-xs); color: var(--color-text-tertiary); }

.facts-section { margin-top: var(--space-6); }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3); }
.section-header h3 { margin: 0; font-size: var(--font-size-base); }
.facts-grid { display: flex; flex-direction: column; gap: 6px; }
.fact-row { display: flex; align-items: center; gap: var(--space-2); padding: 6px var(--space-2); border-radius: var(--radius-sm); border: 1px solid var(--color-border-light); }
.fact-row:hover { background: var(--color-bg-secondary); }
.fact-text { flex: 1; font-size: var(--font-size-sm); color: var(--color-text); }
</style>
