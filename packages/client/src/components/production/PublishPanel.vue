<template>
  <div class="publish-panel">
    <div class="panel-grid">
      <!-- 左侧：优化建议 + 平台适配 -->
      <div class="main-section">
        <!-- ─── 区域1：关键词建议 ─── -->
        <div class="optimize-section">
          <div class="section-header">
            <h4>🔑 关键词优化</h4>
            <button class="btn btn-sm" :disabled="keywordLoading" @click="handleSuggestKeywords">
              {{ keywordLoading ? '分析中...' : 'AI 推荐关键词' }}
            </button>
          </div>
          <div v-if="keywordResults.length > 0" class="keyword-list">
            <div
              v-for="kw in keywordResults"
              :key="kw.keyword"
              class="keyword-tag"
              :class="{ adopted: recordTags.includes(kw.keyword) }"
              @click="adoptKeyword(kw.keyword)"
              :title="kw.recommendation"
            >
              {{ kw.keyword }}
              <span class="kw-score">{{ kw.total_score }}</span>
            </div>
          </div>
          <div v-else-if="!keywordLoading" class="empty-hint">点击按钮获取 AI 推荐的关键词标签</div>
        </div>

        <!-- ─── 区域2：热点标签匹配 ─── -->
        <div class="optimize-section">
          <div class="section-header">
            <h4>🔥 热点标签</h4>
            <button class="btn btn-sm" :disabled="hotspotLoading" @click="handleMatchHotspots">
              {{ hotspotLoading ? '匹配中...' : '匹配热点标签' }}
            </button>
          </div>
          <div v-if="hotspotResults.length > 0" class="hotspot-list">
            <div v-for="h in hotspotResults" :key="h.hotspot_id" class="hotspot-card">
              <div class="hotspot-info">
                <span class="hotspot-title">{{ h.hotspot_title }}</span>
                <span class="hotspot-platform">{{ h.source_platform }}</span>
                <span class="hotspot-heat">🔥 {{ h.heat_value.toLocaleString() }}</span>
              </div>
              <div class="hotspot-actions">
                <span class="hotspot-tag-suggest">#{{ h.suggested_tag }}</span>
                <button
                  class="btn btn-sm btn-adopt"
                  :disabled="recordTags.includes(h.suggested_tag)"
                  @click="adoptKeyword(h.suggested_tag)"
                >
                  {{ recordTags.includes(h.suggested_tag) ? '已采纳' : '采纳' }}
                </button>
              </div>
            </div>
          </div>
          <div v-else-if="!hotspotLoading" class="empty-hint">匹配当前热点，获取蹭热点标签建议</div>
        </div>

        <!-- ─── 区域3：平台选择 + 适配 ─── -->
        <div class="optimize-section">
          <div class="section-header">
            <h4>📱 多平台发布</h4>
          </div>

          <!-- 无视频提示 -->
          <div v-if="!store.videoUrl" class="warn-banner">
            ⚠️ 尚未生成视频，请先完成前面步骤
          </div>

          <!-- 平台选择 -->
          <div class="platform-grid">
            <div
              v-for="p in platformList"
              :key="p.key"
              class="platform-card"
              :class="{ selected: store.targetPlatforms.includes(p.key) }"
              @click="togglePlatform(p.key)"
            >
              <span class="platform-icon">{{ p.icon }}</span>
              <span class="platform-name">{{ p.label }}</span>
            </div>
          </div>

          <!-- 已有标签展示 -->
          <div v-if="recordTags.length > 0" class="tags-display">
            <span class="tags-label">当前标签：</span>
            <span v-for="tag in recordTags" :key="tag" class="tag-chip">
              {{ tag }}
              <span class="tag-remove" @click="removeTag(tag)">×</span>
            </span>
          </div>

          <!-- 适配结果 -->
          <div v-if="adaptedPlatforms.length > 0" class="adapted-list">
            <h5>适配内容 ({{ adaptedPlatforms.length }} 个平台)</h5>
            <div v-for="item in adaptedPlatforms" :key="item.platform" class="adapted-card">
              <div class="adapted-header">
                <span class="platform-icon">{{ getPlatformIcon(item.platform) }}</span>
                <span class="platform-name">{{ getPlatformLabel(item.platform) }}</span>
                <span class="adapted-badge">{{ item._new ? '新适配' : '已适配' }}</span>
              </div>
              <div class="adapted-body">
                <div class="adapted-field">
                  <label>标题</label>
                  <input v-model="item.title" class="input" />
                </div>
                <div class="adapted-field">
                  <label>正文</label>
                  <textarea v-model="item.content" class="input textarea" rows="3" />
                </div>
                <div class="adapted-field">
                  <label>标签</label>
                  <input v-model="item.tags" class="input" placeholder="用空格分隔标签" />
                </div>
              </div>
            </div>
          </div>

          <!-- 已发布状态 -->
          <div v-if="published" class="published-banner">
            🎉 已成功发布到 {{ publishedCount }} 个平台
          </div>

          <!-- ─── 排期区 ─── -->
          <div v-if="published" class="optimize-section schedule-section">
            <div class="section-header">
              <h4>📅 发布排期</h4>
              <button class="btn btn-sm" @click="showScheduleForm = !showScheduleForm">
                {{ showScheduleForm ? '收起' : '快速创建排期' }}
              </button>
            </div>

            <!-- 已有关联的日历事件 -->
            <div v-if="scheduledEvents.length > 0" class="schedule-list">
              <div v-for="ev in scheduledEvents" :key="ev.id" class="schedule-item">
                <span class="schedule-date">{{ ev.event_date }}</span>
                <span class="schedule-title">{{ ev.title }}</span>
                <button class="btn btn-sm btn-danger" @click="deleteScheduleEvent(ev.id)">删除</button>
              </div>
            </div>

            <!-- 快速创建排期表单 -->
            <div v-if="showScheduleForm" class="schedule-form">
              <div class="form-grid">
                <div class="form-field">
                  <label>发布日期</label>
                  <input v-model="scheduleForm.date" type="date" class="input" />
                </div>
                <div class="form-field">
                  <label>标题</label>
                  <input v-model="scheduleForm.title" class="input" placeholder="发布视频：xxx" />
                </div>
              </div>
              <div class="form-grid">
                <div class="form-field" v-for="p in store.targetPlatforms" :key="p">
                  <label>{{ getPlatformLabel(p) }} 发布时间</label>
                  <input v-model="scheduleForm.platformTimes[p]" type="time" class="input" />
                </div>
              </div>
              <button class="btn btn-primary" :disabled="scheduleSaving" @click="handleCreateSchedule">
                {{ scheduleSaving ? '创建中...' : '创建排期' }}
              </button>
            </div>

            <div class="schedule-hint">
              <a :href="'/operation-calendar?ref_id=' + pipelineJobId" target="_blank">去运营日历查看 →</a>
            </div>
          </div>
        </div>

        <!-- ─── 区域4：数据追踪（发布后显示） ─── -->
        <DataTrackingPanel
          v-if="published && firstPublishRecordId"
          :publishRecordId="firstPublishRecordId"
        />
      </div>

      <!-- 右侧：操作面板 -->
      <div class="config-section">
        <div class="config-card">
          <h4>发布操作</h4>
          <p class="hint-text">先优化关键词和标签，再选择平台适配发布</p>

          <button
            class="btn btn-primary btn-block"
            :disabled="store.targetPlatforms.length === 0 || adapting"
            @click="handleAdapt"
          >
            {{ adapting ? '适配中...' : '一键适配' }}
          </button>

          <button
            v-if="adaptedPlatforms.length > 0 && !published"
            class="btn btn-block btn-publish"
            :disabled="publishing"
            style="margin-top: 8px"
            @click="handlePublish"
          >
            {{ publishing ? '发布中...' : '一键发布' }}
          </button>
        </div>

        <!-- 适配进度 -->
        <div v-if="adapting" class="config-card">
          <div class="loading-wrapper">AI 正在适配内容，请稍候...</div>
        </div>

        <!-- 发布状态 -->
        <div v-if="store.steps[4]?.status === 'completed'" class="config-card success-card">
          <span class="success-icon">✅</span>
          <h4>发布完成</h4>
          <p>已发布到 {{ publishedCount }} 个平台</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useProductionStore } from '@/stores/production'
import { PLATFORM_LABELS } from '@zimti/shared'
import api from '@/api/client'
import DataTrackingPanel from './DataTrackingPanel.vue'

interface AdaptedItem {
  platform: string
  title: string
  content: string
  tags: string
  _new?: boolean
}

interface KeywordResult {
  keyword: string
  total_score: number
  competition: string
  brand_relevance: number
  content_opportunity: number
  recommendation: string
}

interface HotspotResult {
  hotspot_id: number
  hotspot_title: string
  source_platform: string
  heat_value: number
  matched_keywords: string[]
  relevance_score: number
  suggested_tag: string
}

const store = useProductionStore()
const adaptedPlatforms = ref<AdaptedItem[]>([])
const adapting = ref(false)
const publishing = ref(false)
const published = ref(false)

// 关键词状态
const keywordLoading = ref(false)
const keywordResults = ref<KeywordResult[]>([])

// 热点匹配状态
const hotspotLoading = ref(false)
const hotspotResults = ref<HotspotResult[]>([])

// 标签管理
const recordTags = ref<string[]>([])

// 发布记录ID（用于数据追踪）
const publishRecordIds = ref<string[]>([])

// 从流水线步骤数据中提取发布记录ID
watch(() => store.steps[4]?.data, (data) => {
  if (data && Array.isArray(data.publish_records)) {
    publishRecordIds.value = data.publish_records
      .map((r: any) => r.publish_record_id || r.id)
      .filter(Boolean)
  }
}, { immediate: true, deep: true })
// 排期状态
const showScheduleForm = ref(false)
const scheduleSaving = ref(false)
const scheduledEvents = ref<Array<{ id: string; event_date: string; title: string }>>([])
const pipelineJobId = ref('')
const scheduleForm = ref<{
  date: string
  title: string
  platformTimes: Record<string, string>
}>({
  date: '',
  title: '',
  platformTimes: {},
})

const platformList = computed(() =>
  Object.entries(PLATFORM_LABELS).map(([key, label]) => {
    const icons: Record<string, string> = {
      xiaohongshu: '📕', douyin: '🎵', weixin: '📹',
      zhihu: '💡', baijiahao: '📰', toutiao: '📱',
      wechat_official: '💬', bilibili: '📺',
    }
    return { key, label, icon: icons[key] || '📄' }
  }),
)

const publishedCount = computed(() => adaptedPlatforms.value.length)

const firstPublishRecordId = computed(() => publishRecordIds.value[0] ?? '')

function getPlatformIcon(key: string): string {
  return platformList.value.find(p => p.key === key)?.icon || '📄'
}

function getPlatformLabel(key: string): string {
  return platformList.value.find(p => p.key === key)?.label || key
}

function togglePlatform(key: string) {
  const idx = store.targetPlatforms.indexOf(key)
  if (idx >= 0) {
    store.targetPlatforms.splice(idx, 1)
    adaptedPlatforms.value = adaptedPlatforms.value.filter(a => a.platform !== key)
  } else {
    store.targetPlatforms.push(key)
  }
}

// ─── 关键词优化 ───

async function handleSuggestKeywords() {
  keywordLoading.value = true
  try {
    const taskId = await startPublishTask('/suggest-keywords')
    if (!taskId) return
    const result = await pollTaskStatus(`/suggest-keywords/${taskId}/status`)
    if (result?.output) {
      const output = result.output as { extracted_keywords: KeywordResult[]; suggested_tags: string[] }
      keywordResults.value = output.extracted_keywords ?? []
      // 自动采纳高分标签
      for (const tag of (output.suggested_tags ?? []).slice(0, 3)) {
        if (!recordTags.value.includes(tag)) {
          recordTags.value.push(tag)
        }
      }
    }
  } catch (err) {
    console.error('[suggest-keywords] failed:', err)
  } finally {
    keywordLoading.value = false
  }
}

function adoptKeyword(keyword: string) {
  if (!recordTags.value.includes(keyword)) {
    recordTags.value.push(keyword)
  }
}

async function removeTag(tag: string) {
  recordTags.value = recordTags.value.filter(t => t !== tag)
  // 同步到后端
  try {
    const recordId = publishRecordIds.value[0]
    if (recordId) {
      await api.delete(`/publish-records/${recordId}/tags/${encodeURIComponent(tag)}`)
    }
  } catch { /* ignore */ }
}

// ─── 热点标签匹配 ───

async function handleMatchHotspots() {
  hotspotLoading.value = true
  try {
    const taskId = await startPublishTask('/match-hotspots')
    if (!taskId) return
    const result = await pollTaskStatus(`/match-hotspots/${taskId}/status`)
    if (result?.output) {
      const output = result.output as { matches: HotspotResult[] }
      hotspotResults.value = output.matches ?? []
    }
  } catch (err) {
    console.error('[match-hotspots] failed:', err)
  } finally {
    hotspotLoading.value = false
  }
}

// ─── 多平台适配 ───

async function handleAdapt() {
  adapting.value = true
  published.value = false
  try {
    // 优先使用 publish-records 的适配端点（如果有发布记录）
    const recordId = publishRecordIds.value[0]
    if (recordId) {
      const res = await api.post(`/publish-records/${recordId}/adapt-platforms`, {
        platforms: store.targetPlatforms,
      }) as any

      const taskId = res.task_id
      const taskResult = await pollTaskStatus(`/adapt-platforms/${taskId}/status`)

      if (taskResult?.output) {
        const adapted = (taskResult.output as any).adapted ?? []
        // 加载适配内容
        const contentsRes = await api.get(`/publish-records/${recordId}/adapted-contents`) as any
        const items = contentsRes?.items ?? adapted
        adaptedPlatforms.value = items.map((a: any) => ({
          platform: a.platform,
          title: a.adapted_title || a.title || '',
          content: a.adapted_content || a.content || '',
          tags: (a.adapted_tags || a.tags || []).join(' '),
          _new: true,
        }))
      }
    } else {
      // 兼容旧流程：直接调用 distribution API
      const res = await api.post('/distribution/batch-adapt', {
        source_title: store.fullText ? store.fullText.slice(0, 50) : '视频内容',
        source_content: store.fullText || '',
        source_tags: recordTags.value.join(' '),
        platforms: store.targetPlatforms,
      }) as any

      const taskId = res.task_id
      const result = await pollAdaptStatus(taskId)

      if (result?.output) {
        const output = result.output as Record<string, any>
        const adapted = output.adapted || output.results || []
        const newItems = store.targetPlatforms
          .filter(platform => !adaptedPlatforms.value.some(a => a.platform === platform))
          .map(platform => {
            const found = adapted.find((a: any) => a.platform === platform)
            return {
              platform,
              title: found?.adapted_title || found?.title || `【${getPlatformLabel(platform)}】${store.fullText?.slice(0, 20) ?? ''}...`,
              content: found?.adapted_content || found?.content || store.fullText || '',
              tags: (found?.adapted_tags || found?.tags || []).join?.(' ') || recordTags.value.join(' '),
              _new: true,
            }
          })
        adaptedPlatforms.value = [...adaptedPlatforms.value, ...newItems]
      }
    }
  } catch (err) {
    console.error('[handleAdapt] failed:', err)
    // fallback
    const fallback = store.targetPlatforms
      .filter(platform => !adaptedPlatforms.value.some(a => a.platform === platform))
      .map(platform => ({
        platform,
        title: `【${getPlatformLabel(platform)}】${store.fullText?.slice(0, 20) ?? ''}...`,
        content: store.fullText || '（视频内容）',
        tags: recordTags.value.join(' '),
        _new: true,
      }))
    adaptedPlatforms.value = [...adaptedPlatforms.value, ...fallback]
  } finally {
    adapting.value = false
  }
}

// ─── 发布 ───

async function handlePublish() {
  publishing.value = true
  try {
    // 同步标签到发布记录
    for (const recordId of publishRecordIds.value) {
      try {
        await api.put(`/publish-records/${recordId}/content`, {
          tags: recordTags.value,
        })
      } catch { /* ignore */ }
    }

    // 为每个平台创建/更新分发记录
    let successCount = 0
    let failCount = 0
    for (const item of adaptedPlatforms.value) {
      try {
        await api.post('/distribution/records', {
          source_content_id: publishRecordIds.value[0] || store.videoProductId || store.scriptId,
          source_type: publishRecordIds.value[0] ? 'publish_record' : (store.videoProductId ? 'video_product' : 'script'),
          platform: item.platform,
          adapted_title: item.title,
          adapted_content: item.content,
          adapted_tags: item.tags ? item.tags.split(/\s+/).filter(Boolean) : [],
        })
        successCount++
      } catch {
        failCount++
      }
    }

    // 全部失败时不标记为已发布
    if (successCount === 0 && failCount > 0) {
      alert('发布失败：所有平台均创建失败，请检查网络后重试')
      return
    }

    // 更新发布记录状态为 published
    for (const recordId of publishRecordIds.value) {
      try {
        await api.post(`/publish-records/${recordId}/publish`)
      } catch { /* 状态更新失败不阻塞流程 */ }
    }

    published.value = true

    // 更新流水线步骤状态
    const stepResult = await store.runStep(5, {
      platforms: store.targetPlatforms,
      publish_records: adaptedPlatforms.value.map(a => ({ platform: a.platform, title: a.title })),
    })

    // 获取流水线 Job ID（用于排期关联）
    pipelineJobId.value = store.jobId ?? ''

    // 初始化排期表单
    scheduleForm.value = {
      date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      title: `发布视频：${adaptedPlatforms.value[0]?.title?.slice(0, 30) ?? '精彩内容'}`,
      platformTimes: {},
    }
    for (const p of store.targetPlatforms) {
      scheduleForm.value.platformTimes[p] = '12:00'
    }

    // 加载已关联的日历事件
    await loadScheduledEvents()
  } finally {
    publishing.value = false
  }
}

// ─── 辅助函数 ───

/** 通过发布记录发起AI任务（需要先有 publishRecordId） */
async function startPublishTask(endpoint: string): Promise<string | null> {
  const recordId = publishRecordIds.value[0]
  if (recordId) {
    const res = await api.post(`/publish-records/${recordId}${endpoint}`) as any
    return res.task_id ?? null
  }
  // 无发布记录时，走 distribution 兼容流程
  return null
}

/** 轮询发布记录任务状态 */
async function pollTaskStatus(
  endpoint: string,
  maxAttempts = 20,
): Promise<{ output: unknown } | null> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2000))
    try {
      const recordId = publishRecordIds.value[0]
      const st = await api.get(`/publish-records/${recordId}${endpoint}`) as any
      if (st.status === 'success') return { output: st.output }
      if (st.status === 'failed') return null
    } catch {
      return null
    }
  }
  return null
}

/** 兼容旧 distribution API 的轮询 */
async function pollAdaptStatus(taskId: string, maxAttempts = 15): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2000))
    try {
      const st = await api.get(`/distribution/batch-adapt/${taskId}/status`) as any
      if (st.status === 'success') return st
      if (st.status === 'failed') return null
    } catch {
      return null
    }
  }
  return null
}

// ─── 排期功能 ───

async function loadScheduledEvents() {
  if (!pipelineJobId.value) return
  try {
    const res = await api.get(`/operation-calendar/events?ref_id=${pipelineJobId.value}`) as any
    scheduledEvents.value = (res.items ?? []).map((ev: any) => ({
      id: ev.id,
      event_date: ev.eventDate?.slice(0, 10) ?? ev.event_date?.slice(0, 10) ?? '',
      title: ev.title,
    }))
  } catch {
    scheduledEvents.value = []
  }
}

async function handleCreateSchedule() {
  if (!scheduleForm.value.date || !scheduleForm.value.title) return
  scheduleSaving.value = true
  try {
    // 为每个有发布时间的平台创建日历事件
    for (const platform of store.targetPlatforms) {
      const time = scheduleForm.value.platformTimes[platform]
      if (!time) continue

      await api.post('/operation-calendar/events', {
        event_date: scheduleForm.value.date,
        title: `${scheduleForm.value.title}（${getPlatformLabel(platform)} ${time}）`,
        event_type: 'content_plan',
        content: {
          platforms: [platform],
          publish_time: time,
        },
        ref_id: pipelineJobId.value || undefined,
        ref_type: pipelineJobId.value ? 'pipeline_job' : undefined,
      })
    }
    showScheduleForm.value = false
    await loadScheduledEvents()
  } catch (err) {
    console.error('[createSchedule] failed:', err)
  } finally {
    scheduleSaving.value = false
  }
}

async function deleteScheduleEvent(eventId: string) {
  try {
    await api.delete(`/operation-calendar/events/${eventId}`)
    scheduledEvents.value = scheduledEvents.value.filter(e => e.id !== eventId)
  } catch (err) {
    console.error('[deleteScheduleEvent] failed:', err)
  }
}
</script>

<style scoped>
.publish-panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 20px;
}

.panel-grid {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 20px;
}

.main-section { display: flex; flex-direction: column; gap: 16px; }

.optimize-section {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 14px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.section-header h4 { margin: 0; font-size: 14px; }

.empty-hint { font-size: 12px; color: var(--color-text-secondary); padding: 8px 0; }

/* 关键词 */
.keyword-list { display: flex; flex-wrap: wrap; gap: 6px; }
.keyword-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.keyword-tag:hover { border-color: var(--color-primary); background: rgba(59, 130, 246, 0.05); }
.keyword-tag.adopted {
  background: rgba(16, 185, 129, 0.1);
  border-color: #10b981;
  color: #10b981;
}
.kw-score {
  font-size: 10px;
  color: var(--color-text-secondary);
  background: rgba(0,0,0,0.05);
  padding: 1px 4px;
  border-radius: 4px;
}

/* 热点 */
.hotspot-list { display: flex; flex-direction: column; gap: 8px; }
.hotspot-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
}
.hotspot-info { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.hotspot-title { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hotspot-platform {
  font-size: 10px;
  color: var(--color-text-secondary);
  background: rgba(0,0,0,0.05);
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}
.hotspot-heat { font-size: 11px; flex-shrink: 0; }
.hotspot-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.hotspot-tag-suggest { font-size: 12px; color: #f59e0b; font-weight: 600; }

/* 标签展示 */
.tags-display {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-bottom: 12px;
  padding: 8px;
  background: var(--color-surface);
  border-radius: 6px;
}
.tags-label { font-size: 12px; color: var(--color-text-secondary); margin-right: 4px; }
.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: rgba(59, 130, 246, 0.1);
  color: var(--color-primary);
  border-radius: 10px;
  font-size: 12px;
}
.tag-remove {
  cursor: pointer;
  font-weight: bold;
  opacity: 0.5;
}
.tag-remove:hover { opacity: 1; }

.warn-banner {
  padding: 12px 16px;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid #f59e0b;
  border-radius: 8px;
  color: #f59e0b;
  font-size: 14px;
  margin-bottom: 16px;
}

.platform-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.platform-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--color-background);
  border: 2px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}
.platform-card:hover { border-color: var(--color-primary); }
.platform-card.selected {
  border-color: var(--color-primary);
  background: rgba(var(--color-primary-rgb, 59, 130, 246), 0.06);
}

.platform-icon { font-size: 20px; }
.platform-name { font-size: 13px; color: var(--color-text); }

.adapted-list { margin-top: 12px; }
.adapted-list h5 { margin: 0 0 12px; font-size: 14px; }

.adapted-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
}
.adapted-card:last-child { margin-bottom: 0; }

.adapted-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.adapted-badge {
  font-size: 11px;
  color: var(--color-primary);
  background: rgba(var(--color-primary-rgb, 59, 130, 246), 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: auto;
}

.adapted-body { display: flex; flex-direction: column; gap: 8px; }
.adapted-field label { display: block; font-size: 12px; color: var(--color-text-secondary); margin-bottom: 4px; }

.published-banner {
  margin-top: 16px;
  padding: 16px;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid #10b981;
  border-radius: 8px;
  text-align: center;
  font-size: 16px;
  color: #10b981;
}

/* 右侧操作面板 */
.config-section { display: flex; flex-direction: column; gap: 12px; }

.config-card {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 14px;
}
.config-card h4 { margin: 0 0 10px; font-size: 14px; font-weight: 600; }

.hint-text { font-size: 13px; color: var(--color-text-secondary); margin: 0 0 12px; }

.btn {
  padding: 8px 16px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  font-size: 14px;
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-sm { padding: 4px 10px; font-size: 12px; }
.btn-primary { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }
.btn-adopt { font-size: 11px; padding: 3px 8px; }
.btn-publish { background: #10b981; color: #fff; border-color: #10b981; font-weight: 600; }
.btn-publish:hover:not(:disabled) { opacity: 0.9; }
.btn-block { width: 100%; }

.success-card { text-align: center; }
.success-card h4 { color: #10b981; }
.success-card p { margin: 4px 0 0; font-size: 14px; color: var(--color-text-secondary); }
.success-icon { font-size: 28px; }

.loading-wrapper { text-align: center; padding: 16px; color: var(--color-text-secondary); font-size: 14px; }

.input {
  width: 100%; padding: 6px 10px;
  border: 1px solid var(--color-border); border-radius: 6px;
  background: var(--color-surface); color: var(--color-text);
  font-size: 14px; box-sizing: border-box;
}
.textarea { resize: vertical; min-height: 60px; font-family: inherit; }

/* 排期区 */
.schedule-section { margin-top: 0; }
.schedule-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
.schedule-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 13px;
}
.schedule-date { color: var(--color-primary); font-weight: 600; white-space: nowrap; }
.schedule-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.schedule-form {
  padding: 10px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  margin-bottom: 10px;
}
.schedule-form .form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
  margin-bottom: 10px;
}
.schedule-form .form-field label {
  display: block;
  font-size: 11px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}

.schedule-hint { margin-top: 8px; }
.schedule-hint a {
  font-size: 12px;
  color: var(--color-primary);
  text-decoration: none;
}
.schedule-hint a:hover { text-decoration: underline; }

.btn-danger { color: #ef4444; border-color: #ef4444; font-size: 11px; padding: 2px 6px; }
.btn-danger:hover { background: rgba(239, 68, 68, 0.1); }

@media (max-width: 768px) {
  .panel-grid { grid-template-columns: 1fr; }
  .platform-grid { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); }
  .schedule-form .form-grid { grid-template-columns: 1fr; }
}
</style>
