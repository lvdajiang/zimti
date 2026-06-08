<template>
  <div class="tracking-panel">
    <div class="section-header">
      <h4>📊 数据追踪</h4>
      <span class="hint">发布后手动录入播放数据，追踪效果趋势</span>
    </div>

    <!-- 摘要卡片 -->
    <div v-if="trendData" class="summary-row">
      <div class="summary-card">
        <div class="summary-value">{{ trendData.summary.total_plays.toLocaleString() }}</div>
        <div class="summary-label">总播放量</div>
        <div v-if="trendData.summary.plays_trend !== null" class="trend-badge" :class="trendData.summary.plays_trend >= 0 ? 'up' : 'down'">
          {{ trendData.summary.plays_trend >= 0 ? '↑' : '↓' }} {{ Math.abs(trendData.summary.plays_trend) }}%
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-value">{{ trendData.summary.avg_completion_rate }}%</div>
        <div class="summary-label">平均完播率</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">{{ trendData.summary.avg_bounce_rate }}%</div>
        <div class="summary-label">3秒流失率</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">{{ trendData.summary.total_comments }}</div>
        <div class="summary-label">评论数</div>
      </div>
    </div>

    <!-- 趋势图 -->
    <div v-if="trendData && trendData.snapshots.length > 0" class="chart-section">
      <h5>播放量趋势</h5>
      <div class="bar-chart">
        <div
          v-for="(point, idx) in trendData.snapshots"
          :key="idx"
          class="bar-wrapper"
        >
          <div
            class="bar"
            :style="{ height: barHeight(point.play_count) + '%' }"
            :title="`${formatDate(point.snapshot_at)}: ${point.play_count}播放`"
          />
          <span class="bar-label">{{ formatDate(point.snapshot_at) }}</span>
        </div>
      </div>
    </div>

    <!-- 数据录入 -->
    <div class="input-section">
      <h5>录入数据</h5>
      <div class="form-grid">
        <div class="form-field">
          <label>日期</label>
          <input v-model="form.snapshot_at" type="datetime-local" class="input" />
        </div>
        <div class="form-field">
          <label>播放量</label>
          <input v-model.number="form.play_count" type="number" class="input" placeholder="0" />
        </div>
        <div class="form-field">
          <label>完播率 (%)</label>
          <input v-model.number="form.completion_rate" type="number" class="input" placeholder="0-100" min="0" max="100" />
        </div>
        <div class="form-field">
          <label>3秒流失率 (%)</label>
          <input v-model.number="form.three_second_bounce_rate" type="number" class="input" placeholder="0-100" min="0" max="100" />
        </div>
        <div class="form-field">
          <label>评论数</label>
          <input v-model.number="form.comment_count" type="number" class="input" placeholder="0" />
        </div>
        <div class="form-field">
          <label>私信数</label>
          <input v-model.number="form.private_message_count" type="number" class="input" placeholder="0" />
        </div>
      </div>
      <button class="btn btn-primary" :disabled="saving" @click="handleSave">
        {{ saving ? '保存中...' : '保存快照' }}
      </button>
      <span v-if="saveMsg" class="save-msg">{{ saveMsg }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { createSnapshot, fetchMetricsTrend } from '@/api/dataTracking'
import type { MetricsTrendResponse } from '@zimti/shared'

const props = defineProps<{
  publishRecordId: string
}>()

const trendData = ref<MetricsTrendResponse | null>(null)
const saving = ref(false)
const saveMsg = ref('')

const form = ref({
  snapshot_at: new Date().toISOString().slice(0, 16),
  play_count: 0,
  completion_rate: 0,
  three_second_bounce_rate: 0,
  comment_count: 0,
  private_message_count: 0,
})

const maxPlays = computed(() => {
  if (!trendData.value || trendData.value.snapshots.length === 0) return 1
  return Math.max(...trendData.value.snapshots.map(s => s.play_count), 1)
})

function barHeight(count: number): number {
  return Math.max(4, (count / maxPlays.value) * 100)
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

async function loadTrend() {
  try {
    trendData.value = await fetchMetricsTrend(props.publishRecordId, 30)
  } catch (err) {
    console.error('[DataTrackingPanel] loadTrend failed:', err)
    saveMsg.value = '⚠️ 加载趋势数据失败'
    setTimeout(() => { saveMsg.value = '' }, 3000)
  }
}

async function handleSave() {
  saving.value = true
  saveMsg.value = ''
  try {
    await createSnapshot({
      publish_record_id: props.publishRecordId,
      snapshot_at: new Date(form.value.snapshot_at).toISOString(),
      play_count: form.value.play_count,
      completion_rate: form.value.completion_rate,
      three_second_bounce_rate: form.value.three_second_bounce_rate,
      comment_count: form.value.comment_count,
      private_message_count: form.value.private_message_count,
    })
    // 刷新趋势
    await loadTrend()
    saveMsg.value = '✅ 保存成功'
    // 重置表单
    form.value = {
      snapshot_at: new Date().toISOString().slice(0, 16),
      play_count: 0,
      completion_rate: 0,
      three_second_bounce_rate: 0,
      comment_count: 0,
      private_message_count: 0,
    }
  } catch (err) {
    console.error('[DataTrackingPanel] save failed:', err)
    saveMsg.value = '❌ 保存失败，请重试'
    setTimeout(() => { saveMsg.value = '' }, 3000)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadTrend()
})
</script>

<style scoped>
.tracking-panel {
  margin-top: 20px;
  padding: 16px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}
.section-header h4 { margin: 0; font-size: 14px; }
.hint { font-size: 12px; color: var(--color-text-secondary); }

.summary-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.summary-card {
  text-align: center;
  padding: 12px 8px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  position: relative;
}
.summary-value { font-size: 20px; font-weight: 700; color: var(--color-text); }
.summary-label { font-size: 11px; color: var(--color-text-secondary); margin-top: 4px; }
.trend-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}
.trend-badge.up { background: rgba(16, 185, 129, 0.1); color: #10b981; }
.trend-badge.down { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

.chart-section { margin-bottom: 16px; }
.chart-section h5 { margin: 0 0 8px; font-size: 13px; }

.bar-chart {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 100px;
  padding: 8px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
}

.bar-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  justify-content: flex-end;
  min-width: 20px;
}
.bar {
  width: 100%;
  max-width: 30px;
  background: var(--color-primary);
  border-radius: 3px 3px 0 0;
  transition: height 0.3s;
}
.bar-label {
  font-size: 9px;
  color: var(--color-text-secondary);
  margin-top: 4px;
  white-space: nowrap;
}

.input-section { }
.input-section h5 { margin: 0 0 10px; font-size: 13px; }

.form-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}
.form-field label {
  display: block;
  font-size: 11px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}
.input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 13px;
  box-sizing: border-box;
}

.btn {
  padding: 8px 16px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font-size: 13px;
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }

.save-msg {
  display: inline-block;
  margin-left: 8px;
  font-size: 12px;
  color: var(--color-text-secondary);
  animation: fadeIn 0.2s;
}
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }

@media (max-width: 768px) {
  .summary-row { grid-template-columns: repeat(2, 1fr); }
  .form-grid { grid-template-columns: 1fr; }
}
</style>
