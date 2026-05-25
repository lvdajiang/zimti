<template>
  <div class="interview">
    <div class="toolbar">
      <h2 class="page-title">IP 定位 & 行业模板</h2>
      <div class="toolbar-actions">
        <div class="tabs">
          <button class="tab" :class="{ active: activeTab === 'interview' }" @click="activeTab = 'interview'">IP 访谈</button>
          <button class="tab" :class="{ active: activeTab === 'templates' }" @click="switchToTemplates">行业模板</button>
        </div>
      </div>
    </div>

    <!-- IP 访谈 -->
    <template v-if="activeTab === 'interview'">
      <!-- 未开始 -->
      <div v-if="!store.session" class="start-section">
        <div class="start-card">
          <h3>四层提问框架</h3>
          <p>通过 4 层深度提问（事件→行为→感受→信念），挖掘你的核心 IP 定位。</p>
          <div class="layers-preview">
            <div v-for="l in store.layers" :key="l.layer" class="layer-badge">
              <span class="layer-num">{{ l.layer }}</span>
              <span class="layer-label">{{ l.label }}</span>
            </div>
          </div>
          <div class="form-group" style="max-width: 400px; margin: 20px auto 0;">
            <label>你想做什么方向的自媒体？</label>
            <input v-model="topic" class="input" placeholder="如：新疆旅行、美食探店、健身教学..." />
            <button class="btn-primary" :disabled="!topic.trim()" @click="handleStart" style="margin-top: 12px; width: 100%;">
              开始访谈
            </button>
          </div>
        </div>
      </div>

      <!-- 访谈进行中 -->
      <div v-else class="interview-flow">
        <div class="progress-bar">
          <div v-for="i in 4" :key="i" class="progress-step" :class="{ active: i <= store.session!.currentLayer, done: i < store.session!.currentLayer }">
            <span class="step-num">{{ i }}</span>
            <span class="step-label">{{ layerLabel(i) }}</span>
          </div>
        </div>

        <div class="chat-area">
          <!-- 已回答 -->
          <div v-for="(a, idx) in store.session!.answers" :key="idx" class="chat-pair">
            <div class="chat-question">
              <span class="msg-badge">{{ layerLabel(a.layer) }}</span>
              {{ a.question || '(追问)' }}
            </div>
            <div class="chat-answer">{{ a.answer }}</div>
          </div>

          <!-- 当前问题 -->
          <div v-if="store.currentQuestion && !store.isComplete" class="chat-pair">
            <div class="chat-question">
              <span class="msg-badge">{{ layerLabel(store.session!.currentLayer) }}</span>
              {{ store.currentQuestion }}
            </div>
          </div>

          <!-- 完成 -->
          <div v-if="store.isComplete" class="chat-pair">
            <div class="chat-question success">访谈完成！你可以生成 IP 定位画布了。</div>
            <button class="btn-primary" :disabled="store.profileLoading" @click="store.doGenerateProfile()">
              {{ store.profileLoading ? '生成中...' : '生成 IP 定位画布' }}
            </button>
          </div>
        </div>

        <!-- 回答输入 -->
        <div v-if="store.currentQuestion && !store.isComplete" class="answer-bar">
          <textarea v-model="store.currentAnswer" class="input answer-input" rows="2" placeholder="输入你的回答..." @keyup.ctrl.enter="store.doNext()"></textarea>
          <button class="btn-primary" :disabled="!store.currentAnswer.trim() || store.loading" @click="store.doNext()">
            {{ store.loading ? '思考中...' : '继续' }}
          </button>
          <span class="hint">Ctrl + Enter 发送</span>
        </div>
      </div>

      <!-- IP 画布结果 -->
      <div v-if="store.profile" class="profile-result">
        <h3>IP 定位画布</h3>
        <div class="canvas-grid">
          <div class="canvas-section">
            <h4>个人定位</h4>
            <pre>{{ formatObj(store.profile.profile) }}</pre>
          </div>
          <div class="canvas-section">
            <h4>IP 画布</h4>
            <pre>{{ formatObj(store.profile.canvas) }}</pre>
          </div>
        </div>
      </div>
    </template>

    <!-- 行业模板 -->
    <template v-if="activeTab === 'templates'">
      <div class="filters">
        <button class="btn" @click="store.loadTemplates()">刷新</button>
        <button class="btn-warning" @click="handleInit">初始化预设模板</button>
      </div>
      <div v-if="store.templatesLoading" class="loading-wrapper">加载中...</div>
      <div v-else-if="store.templates.length === 0" class="empty-state">
        <div class="empty-text">暂无行业模板</div>
        <button class="btn-primary" @click="handleInit">初始化预设模板</button>
      </div>
      <div v-else class="template-grid">
        <div v-for="t in store.templates" :key="t.id" class="template-card">
          <div class="template-header">
            <span class="template-name">{{ t.name }}</span>
            <span class="badge badge-blue">{{ t.industry }}</span>
          </div>
          <p class="template-desc">{{ t.description }}</p>
          <div v-if="t.config" class="template-config">
            <template v-if="(t.config as Record<string, unknown>)?.content_types">
              <span class="tag-chip" v-for="ct in ((t.config as Record<string, unknown>).content_types as string[])" :key="ct">{{ ct }}</span>
            </template>
          </div>
          <div class="template-actions">
            <button class="btn-primary btn-sm" @click="handleApply(t.id)">应用模板</button>
          </div>
        </div>
      </div>

      <div v-if="store.appliedConfig" class="applied-section">
        <h3>已应用模板配置</h3>
        <div class="config-grid">
          <div v-if="store.appliedConfig.persona_default" class="config-item">
            <h4>默认人设</h4>
            <pre>{{ formatObj(store.appliedConfig.persona_default) }}</pre>
          </div>
          <div v-if="store.appliedConfig.content_types?.length" class="config-item">
            <h4>内容类型</h4>
            <div><span class="tag-chip" v-for="ct in store.appliedConfig.content_types" :key="ct">{{ ct }}</span></div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useInterviewStore } from '../stores/interview'

const store = useInterviewStore()
const activeTab = ref('interview')
const topic = ref('')

onMounted(() => {
  store.loadLayers()
  store.loadTemplates()
})

function layerLabel(n: number): string {
  const map: Record<number, string> = { 1: '事件层', 2: '行为层', 3: '感受层', 4: '信念层' }
  return map[n] || ''
}

async function handleStart() {
  await store.doStart(topic.value.trim())
  topic.value = ''
}

function switchToTemplates() {
  activeTab.value = 'templates'
  store.loadTemplates()
}

async function handleApply(id: string) { await store.doApplyTemplate(id) }

async function handleInit() {
  const count = await store.doInitPresets()
  alert(`已创建 ${count} 个预设模板`)
}

function formatObj(obj: unknown): string {
  if (!obj) return ''
  return JSON.stringify(obj, null, 2)
}
</script>

<style scoped>
.interview { padding: 20px; }
.toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
.page-title { margin: 0; font-size: 20px; }
.toolbar-actions { display: flex; align-items: center; gap: 8px; }
.tabs { display: flex; gap: 4px; }
.tab { padding: 6px 14px; border: 1px solid #d9d9d9; border-radius: 6px; background: #fff; cursor: pointer; font-size: 13px; }
.tab.active { background: #1890ff; color: #fff; border-color: #1890ff; }
.filters { display: flex; gap: 8px; margin-bottom: 16px; align-items: center; }
.input { padding: 6px 10px; border: 1px solid #d9d9d9; border-radius: 6px; font-size: 13px; }
textarea.input { resize: vertical; font-family: inherit; }
.btn { padding: 6px 14px; border: 1px solid #d9d9d9; border-radius: 6px; background: #fff; cursor: pointer; font-size: 13px; }
.btn-primary { background: #1890ff; color: #fff; border-color: #1890ff; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-sm { padding: 3px 10px; font-size: 12px; }
.btn-warning { background: #fa8c16; color: #fff; border-color: #fa8c16; }
.start-section { max-width: 560px; margin: 40px auto; }
.start-card { text-align: center; padding: 32px; border: 1px solid #f0f0f0; border-radius: 12px; }
.start-card h3 { margin: 0 0 8px; font-size: 18px; }
.start-card p { color: #666; font-size: 14px; margin: 0 0 20px; }
.layers-preview { display: flex; justify-content: center; gap: 12px; }
.layer-badge { display: flex; align-items: center; gap: 6px; padding: 6px 12px; background: #f0f0f0; border-radius: 6px; }
.layer-num { width: 22px; height: 22px; border-radius: 50%; background: #1890ff; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; }
.layer-label { font-size: 13px; font-weight: 500; }
.form-group { margin-bottom: 12px; }
.form-group label { display: block; font-size: 13px; color: #666; margin-bottom: 4px; text-align: left; }
.progress-bar { display: flex; gap: 4px; margin-bottom: 20px; }
.progress-step { flex: 1; padding: 8px; border-radius: 6px; text-align: center; font-size: 12px; background: #f0f0f0; color: #999; }
.progress-step.active { background: #e6f7ff; color: #1890ff; }
.progress-step.done { background: #f6ffed; color: #52c41a; }
.step-num { font-weight: 600; }
.chat-area { background: #fafafa; border-radius: 8px; padding: 16px; margin-bottom: 12px; min-height: 200px; }
.chat-pair { margin-bottom: 14px; }
.chat-question { background: #fff; border: 1px solid #e8e8e8; border-radius: 8px; padding: 10px 14px; font-size: 14px; line-height: 1.6; }
.chat-question.success { background: #f6ffed; border-color: #b7eb8f; }
.msg-badge { display: inline-block; padding: 1px 6px; background: #e6f7ff; border-radius: 4px; font-size: 11px; color: #1890ff; margin-right: 6px; }
.chat-answer { background: #1890ff; color: #fff; border-radius: 8px; padding: 10px 14px; font-size: 14px; line-height: 1.6; margin-top: 6px; }
.answer-bar { display: flex; align-items: flex-end; gap: 8px; }
.answer-input { flex: 1; }
.hint { font-size: 11px; color: #999; }
.loading-wrapper { text-align: center; padding: 40px; color: #999; }
.empty-state { text-align: center; padding: 60px 20px; }
.empty-text { color: #999; margin-bottom: 12px; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; color: #fff; }
.badge-blue { background: #1890ff; }
.tag-chip { display: inline-block; padding: 1px 8px; background: #f0f0f0; border-radius: 4px; font-size: 12px; margin: 2px 4px 2px 0; }
.profile-result { margin-top: 20px; }
.profile-result h3 { margin: 0 0 12px; font-size: 15px; }
.canvas-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.canvas-section { background: #fafafa; border-radius: 8px; padding: 14px; }
.canvas-section h4 { margin: 0 0 8px; font-size: 13px; color: #1890ff; }
.canvas-section pre { margin: 0; font-size: 12px; white-space: pre-wrap; }
.template-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
.template-card { border: 1px solid #f0f0f0; border-radius: 8px; padding: 14px; }
.template-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.template-name { font-weight: 600; font-size: 14px; }
.template-desc { font-size: 13px; color: #666; margin: 0 0 8px; line-height: 1.5; }
.template-config { margin-bottom: 8px; }
.template-actions { text-align: right; }
.applied-section { margin-top: 20px; padding: 16px; background: #f6ffed; border: 1px solid #b7eb8f; border-radius: 8px; }
.applied-section h3 { margin: 0 0 12px; font-size: 15px; color: #389e0d; }
.config-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.config-item { background: #fff; border-radius: 6px; padding: 12px; }
.config-item h4 { margin: 0 0 6px; font-size: 12px; color: #666; }
.config-item pre { margin: 0; font-size: 12px; white-space: pre-wrap; }
</style>
