<template>
  <div class="topic-inspiration">
    <!-- 素材概览 -->
    <div class="sources-bar" @click="showSources = !showSources">
      <span class="sources-toggle">{{ showSources ? '▼' : '▶' }} 素材概览</span>
      <span class="sources-summary">
        <span v-if="sourceCount.hotspots" class="source-chip">🔥 {{ sourceCount.hotspots }} 热点</span>
        <span v-if="sourceCount.painPoints" class="source-chip">💡 {{ sourceCount.painPoints }} 痛点</span>
        <span v-if="sourceCount.crm" class="source-chip">👥 {{ sourceCount.crm }} 意向</span>
        <span v-if="sourceCount.geo" class="source-chip">🔍 {{ sourceCount.geo }} 搜索</span>
        <span v-if="sourceCount.signals" class="source-chip">📌 {{ sourceCount.signals }} 标记</span>
        <span v-if="!hasAnySource" class="source-chip">暂无素材数据</span>
      </span>
    </div>
    <div v-if="showSources" class="sources-detail">
      <!-- 发现信号（从 Phase 1 摘要步骤标记的内容） -->
      <div v-if="store.discoverySignals.length > 0" class="source-section signals-section">
        <h5>📌 你的发现标记 ({{ store.discoverySignals.length }})</h5>
        <div v-for="s in store.discoverySignals" :key="s.id" class="source-item signal-item">
          <span class="signal-source">{{ sourceLabel(s.source) }}</span>
          <span class="signal-content">{{ s.content }}</span>
          <button class="signal-remove" @click.stop="store.removeDiscoverySignal(s.id)" title="移除">×</button>
        </div>
      </div>
      <div v-if="store.topicSources?.hotspotHints?.length" class="source-section">
        <h5>热点</h5>
        <div v-for="h in store.topicSources.hotspotHints.slice(0, 5)" :key="h.title" class="source-item">
          {{ h.title }} <span class="heat">热度{{ h.heatValue }}</span>
        </div>
      </div>
      <div v-if="store.topicSources?.chatInsights?.painPoints?.length" class="source-section">
        <h5>客户痛点</h5>
        <div v-for="p in store.topicSources.chatInsights.painPoints.slice(0, 5)" :key="p" class="source-item">{{ p }}</div>
      </div>
      <div v-if="store.topicSources?.crmInsights?.length" class="source-section">
        <h5>CRM 出行意向</h5>
        <div v-for="c in store.topicSources.crmInsights.slice(0, 5)" :key="c.destination" class="source-item">{{ c.destination }} ({{ c.count }}人)</div>
      </div>
      <div v-if="store.topicSources?.geoHints?.length" class="source-section">
        <h5>GEO 搜索意图</h5>
        <div v-for="q in store.topicSources.geoHints.slice(0, 5)" :key="q.question" class="source-item">{{ q.question }}</div>
      </div>
      <!-- 历史数据分析洞察（闭环反馈） -->
      <div v-if="store.topicSources?.historicalInsights?.totalSnapshots" class="source-section insights-section">
        <h5>📈 历史表现洞察</h5>
        <p class="insight-summary">{{ store.topicSources.historicalInsights.summary }}</p>
        <div v-if="store.topicSources.historicalInsights.recentInsight" class="insight-action">
          💡 {{ store.topicSources.historicalInsights.recentInsight }}
        </div>
        <div v-if="store.topicSources.historicalInsights.topPerformers.length > 0" class="top-performers">
          <div v-for="tp in store.topicSources.historicalInsights.topPerformers.slice(0, 3)" :key="tp.title" class="performer-row">
            <span class="performer-title">{{ tp.title }}</span>
            <span class="performer-platform">{{ tp.platform }}</span>
            <span class="performer-rate">完播 {{ tp.completionRate }}%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 操作栏 -->
    <div class="action-bar">
      <button class="btn btn-primary" :disabled="store.topicLoading" @click="handleGenerate">
        <template v-if="store.topicLoading">⏳ AI 分析中...</template>
        <template v-else-if="store.topicProposals.length > 0">🔄 换一批</template>
        <template v-else>✨ AI 生成选题</template>
      </button>
    </div>

    <!-- 选题卡片网格 -->
    <div v-if="store.topicLoading && store.topicProposals.length === 0" class="loading-state">
      <div class="loading-spinner" />
      <p>AI 正在分析素材，生成选题方案...</p>
    </div>

    <div v-else-if="store.topicProposals.length > 0" class="proposal-grid">
      <div
        v-for="p in store.topicProposals"
        :key="p.id"
        class="proposal-card"
        :class="{ selected: p.status === 'selected', discarded: p.status === 'discarded' }"
      >
        <div class="card-status" :class="p.status">{{ statusLabel(p.status) }}</div>
        <h4 class="card-title">{{ p.title }}</h4>

        <!-- 骨架预览 -->
        <div class="skeleton-preview">
          <div v-if="skeleton(p).hook" class="skeleton-line"><strong>钩子:</strong> {{ skeleton(p).hook }}</div>
          <div v-if="skeleton(p).main_points?.length" class="skeleton-line">
            <strong>要点:</strong> {{ skeleton(p).main_points.slice(0, 3).join('、') }}
          </div>
        </div>

        <!-- 5维评分 -->
        <div v-if="p.dimension_scores" class="dimension-scores">
          <div v-for="d in dimensions" :key="d.key" class="dim-row">
            <span class="dim-label">{{ d.label }}</span>
            <div class="dim-bar"><div class="dim-fill" :style="{ width: (p.dimension_scores as any)[d.key] + '%', background: d.color }" /></div>
            <span class="dim-value">{{ (p.dimension_scores as any)[d.key] }}</span>
          </div>
        </div>

        <!-- AI 理由 -->
        <div v-if="p.reasoning" class="reasoning">💡 {{ p.reasoning }}</div>

        <!-- 操作 -->
        <div class="card-actions">
          <button v-if="p.status !== 'selected' && p.status !== 'discarded'" class="btn btn-sm btn-select" @click="handleSelect(p.id)">选用</button>
          <button v-if="p.status === 'discarded'" class="btn btn-sm" @click="handleRestore(p.id)">恢复</button>
          <span v-if="p.status === 'selected'" class="selected-badge">✅ 已选用</span>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <p>点击上方按钮，AI 将基于素材自动生成选题方案</p>
    </div>

    <!-- 已选定提示 -->
    <div v-if="store.topicSelected" class="selected-bar">
      <span>✅ 已选定：「{{ store.topicTitle }}」</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useProductionStore } from '@/stores/production'

const store = useProductionStore()
const showSources = ref(false)

const dimensions = [
  { key: 'hotspot', label: '热点', color: '#EF4444' },
  { key: 'viral', label: '爆款', color: '#F59E0B' },
  { key: 'persona', label: '人设', color: '#10B981' },
  { key: 'brand', label: '品牌', color: '#3B82F6' },
  { key: 'painPoint', label: '痛点', color: '#8B5CF6' },
]

const sourceCount = computed(() => ({
  hotspots: store.topicSources?.hotspotHints?.length || 0,
  painPoints: store.topicSources?.chatInsights?.painPoints?.length || 0,
  crm: store.topicSources?.crmInsights?.length || 0,
  geo: store.topicSources?.geoHints?.length || 0,
  signals: store.discoverySignals.length,
}))

const hasAnySource = computed(() =>
  sourceCount.value.hotspots + sourceCount.value.painPoints + sourceCount.value.crm + sourceCount.value.geo + sourceCount.value.signals > 0,
)

function sourceLabel(source: string): string {
  const map: Record<string, string> = {
    hotspot: '🔥', benchmark: '📊', collect: '📥', transcript: '📝',
  }
  return map[source] || source
}

function skeleton(p: any) {
  return p.content_skeleton ?? { hook: '', main_points: [], visual_direction: '' }
}

function statusLabel(status: string): string {
  const map: Record<string, string> = { generated: '候选', selected: '已选用', discarded: '已废弃', pipeline_draft: '草稿' }
  return map[status] ?? status
}

async function handleGenerate() {
  // 收集多源素材数据（含系统自动聚合的热点/CRM/GEO/聊天洞察）
  await store.loadTopicSources()
  await store.generateTopics(3)
}

async function handleSelect(id: number) {
  await store.selectTopicAction(id)
}

async function handleRestore(id: number) {
  // 通过 updateTopicProposal 恢复状态
  const { updateTopicProposal } = await import('@/api/topicProposals')
  await updateTopicProposal(id, { status: 'generated' } as any)
  await store.loadExistingTopics()
}

onMounted(() => {
  if (!store.topicSources) store.loadTopicSources()
})
</script>

<style scoped>
.topic-inspiration { display: flex; flex-direction: column; gap: 16px; }

/* 素材概览 */
.sources-bar { display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: var(--color-background); border: 1px solid var(--color-border); border-radius: 8px; cursor: pointer; }
.sources-bar:hover { background: var(--color-surface-hover, rgba(0,0,0,0.04)); }
.sources-toggle { font-size: 13px; color: var(--color-text-secondary); flex-shrink: 0; }
.sources-summary { display: flex; gap: 8px; flex-wrap: wrap; }
.source-chip { font-size: 12px; padding: 2px 8px; background: var(--color-surface); border-radius: 10px; color: var(--color-text-secondary); }
.sources-detail { padding: 12px 14px; background: var(--color-background); border: 1px solid var(--color-border); border-top: none; border-radius: 0 0 8px 8px; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.source-section h5 { margin: 0 0 6px; font-size: 13px; color: var(--color-text-secondary); }
.source-item { font-size: 12px; color: var(--color-text); padding: 3px 0; }
.heat { color: #EF4444; font-weight: 600; }

/* 操作栏 */
.action-bar { display: flex; gap: 8px; }

/* 选题卡片 */
.proposal-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
.proposal-card { background: var(--color-surface); border: 2px solid var(--color-border); border-radius: 10px; padding: 16px; position: relative; transition: all 0.2s; }
.proposal-card:hover { border-color: var(--color-primary); box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.proposal-card.selected { border-color: #10B981; background: rgba(16,185,129,0.03); }
.proposal-card.discarded { opacity: 0.5; }
.card-status { position: absolute; top: 10px; right: 10px; font-size: 11px; padding: 2px 8px; border-radius: 10px; }
.card-status.generated { background: #F3F4F6; color: #6B7280; }
.card-status.selected { background: #D1FAE5; color: #059669; }
.card-status.discarded { background: #FEE2E2; color: #DC2626; }
.card-title { margin: 0 0 8px; padding-right: 60px; font-size: 15px; font-weight: 600; color: var(--color-text); line-height: 1.4; }

/* 骨架预览 */
.skeleton-preview { font-size: 13px; color: var(--color-text-secondary); margin-bottom: 10px; }
.skeleton-line { margin-bottom: 3px; }
.skeleton-line strong { color: var(--color-text-tertiary); }

/* 5维评分 */
.dimension-scores { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
.dim-row { display: flex; align-items: center; gap: 6px; }
.dim-label { font-size: 11px; width: 28px; color: var(--color-text-secondary); flex-shrink: 0; }
.dim-bar { flex: 1; height: 5px; background: var(--color-border); border-radius: 3px; overflow: hidden; }
.dim-fill { height: 100%; border-radius: 3px; transition: width 0.4s ease; }
.dim-value { font-size: 11px; width: 24px; text-align: right; color: var(--color-text-secondary); }

/* AI理由 */
.reasoning { font-size: 12px; color: var(--color-text-secondary); padding: 6px 10px; background: var(--color-background); border-radius: 6px; margin-bottom: 10px; line-height: 1.4; }

/* 操作 */
.card-actions { display: flex; gap: 6px; padding-top: 10px; border-top: 1px solid var(--color-border); }
.btn-select { color: var(--color-primary); border-color: var(--color-primary); }
.btn-select:hover { background: rgba(59,130,246,0.06); }
.selected-badge { font-size: 13px; color: #10B981; font-weight: 600; }

/* 加载 */
.loading-state { text-align: center; padding: 40px; color: var(--color-text-secondary); }
.loading-spinner { width: 32px; height: 32px; border: 3px solid var(--color-border); border-top-color: var(--color-primary); border-radius: 50%; margin: 0 auto 12px; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* 空状态 */
.empty-state { text-align: center; padding: 30px; color: var(--color-text-tertiary); font-size: 14px; }

/* 发现信号 */
.signals-section { border: 1px dashed var(--color-primary); border-radius: 6px; padding: 8px 10px; background: rgba(59,130,246,0.03); }
.signal-item { display: flex; align-items: center; gap: 6px; padding: 4px 0; }
.signal-source { font-size: 14px; flex-shrink: 0; }
.signal-content { flex: 1; font-size: 12px; color: var(--color-text); }
.signal-remove { background: none; border: none; color: var(--color-text-tertiary); cursor: pointer; font-size: 14px; padding: 0 2px; }
.signal-remove:hover { color: #EF4444; }

/* 历史洞察 */
.insights-section { border-left: 3px solid #10B981; padding-left: 8px; }
.insight-summary { font-size: 12px; color: var(--color-text); margin: 4px 0; line-height: 1.5; }
.insight-action { font-size: 12px; color: #059669; background: rgba(16,185,129,0.06); padding: 6px 8px; border-radius: 4px; margin: 4px 0; line-height: 1.4; }
.top-performers { margin-top: 6px; }
.performer-row { display: flex; align-items: center; gap: 6px; padding: 3px 0; font-size: 12px; }
.performer-title { flex: 1; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.performer-platform { font-size: 10px; padding: 1px 4px; background: var(--color-border); border-radius: 3px; color: var(--color-text-secondary); }
.performer-rate { color: #10B981; font-weight: 600; white-space: nowrap; }

/* 已选定 */
.selected-bar { padding: 10px 16px; background: #D1FAE5; border-radius: 8px; font-size: 14px; color: #059669; font-weight: 500; }

/* 按钮复用 */
.btn { padding: 8px 16px; border: 1px solid var(--color-border); border-radius: 6px; background: transparent; color: var(--color-text); cursor: pointer; font-size: 14px; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
.btn-primary:hover:not(:disabled) { opacity: 0.9; }
.btn-sm { padding: 4px 12px; font-size: 12px; border-radius: 4px; }
</style>
