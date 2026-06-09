<template>
  <div class="prohibited-check-panel">
    <!-- 检测按钮 -->
    <div class="check-header">
      <h3>违禁词检测</h3>
      <div class="header-actions">
        <button class="btn btn-primary" :disabled="loading || !hasCopy" @click="handleCheck">
          {{ loading ? '检测中...' : report ? '重新检测' : '开始检测' }}
        </button>
      </div>
    </div>

    <!-- 无报告 -->
    <div v-if="!report && !loading" class="empty-state">
      <p>点击"开始检测"检查文案中的违禁词和敏感表述</p>
    </div>

    <!-- 检测中 -->
    <div v-if="loading" class="loading-state">
      <p>正在检测违禁词...</p>
    </div>

    <!-- 检测结果 -->
    <div v-if="report && !loading" class="report-section">
      <!-- 统计 -->
      <div class="report-summary">
        <span v-if="report.total_risks === 0" class="pass-badge">✅ 未发现风险</span>
        <span v-else class="risk-badge">⚠️ 发现 {{ report.total_risks }} 处风险</span>
      </div>

      <!-- 风险列表 -->
      <div v-if="report.items.length > 0" class="risk-list">
        <div v-for="(item, idx) in report.items" :key="idx" class="risk-item" :class="item.risk">
          <div class="risk-header">
            <span class="risk-word">{{ item.word }}</span>
            <span class="risk-tag" :class="item.category">{{ categoryLabel(item.category) }}</span>
            <span class="risk-level">{{ item.risk === 'high' ? '高风险' : item.risk === 'medium' ? '中风险' : '低风险' }}</span>
          </div>
          <div class="risk-detail">
            <span class="risk-platforms">{{ item.platform.join('、') }}</span>
            <span v-if="item.suggestion" class="risk-suggestion">建议替换为："{{ item.suggestion }}"</span>
          </div>
        </div>
      </div>

      <!-- 一键替换 -->
      <div v-if="replaceableItems.length > 0" class="action-bar">
        <button class="btn btn-primary" @click="handleReplace">
          一键替换 {{ replaceableItems.length }} 个违禁词
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCopyWritingStore } from '@/stores/copyWriting'
import { PROHIBITED_CATEGORY_LABELS } from '@zimti/shared'
import type { ProhibitedCategory, ProhibitedCheckItem } from '@zimti/shared'

const store = useCopyWritingStore()

const loading = computed(() => store.loading)
const report = computed(() => store.prohibitedReport)
const hasCopy = computed(() => !!store.currentCopy)
const replaceableItems = computed(() =>
  (report.value?.items ?? []).filter((i: ProhibitedCheckItem) => i.suggestion && !i.suggestion.startsWith('避免使用')),
)

function categoryLabel(cat: ProhibitedCategory) {
  return PROHIBITED_CATEGORY_LABELS[cat] ?? cat
}

async function handleCheck() {
  await store.doCheck()
}

async function handleReplace() {
  if (!replaceableItems.value.length) return
  await store.doReplace(replaceableItems.value)
}
</script>

<style scoped>
.prohibited-check-panel { padding: 12px 0; }
.check-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.check-header h3 { margin: 0; font-size: 15px; }
.btn {
  padding: 6px 16px; border: 1px solid var(--color-border); border-radius: 6px;
  font-size: 13px; cursor: pointer; background: white;
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--color-primary); color: white; border-color: var(--color-primary); }
.empty-state, .loading-state { text-align: center; padding: 32px 0; color: var(--color-text-secondary); font-size: 14px; }
.report-summary { margin-bottom: 16px; }
.pass-badge { color: #2e7d32; font-weight: 500; }
.risk-badge { color: #ef6c00; font-weight: 500; }
.risk-list { display: flex; flex-direction: column; gap: 8px; }
.risk-item {
  padding: 10px 12px; border-radius: 8px; border-left: 3px solid #ef4444;
  background: #fef2f2;
}
.risk-item.medium { border-left-color: #f59e0b; background: #fffbeb; }
.risk-item.low { border-left-color: #6b7280; background: #f9fafb; }
.risk-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.risk-word { font-weight: 600; font-size: 14px; }
.risk-tag {
  font-size: 11px; padding: 1px 6px; border-radius: 3px;
  background: rgba(0,0,0,0.06);
}
.risk-tag.absolute { background: #fecaca; color: #991b1b; }
.risk-tag.high_risk { background: #fed7aa; color: #9a3412; }
.risk-tag.medium_risk { background: #fef08a; color: #854d0e; }
.risk-tag.sensitive { background: #e5e7eb; color: #374151; }
.risk-level { font-size: 11px; color: var(--color-text-tertiary); }
.risk-detail { font-size: 12px; color: var(--color-text-secondary); display: flex; gap: 12px; }
.risk-platforms { color: var(--color-text-tertiary); }
.risk-suggestion { color: #15803d; }
.action-bar { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--color-border); }
</style>
