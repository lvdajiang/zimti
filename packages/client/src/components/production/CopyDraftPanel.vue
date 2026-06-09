<template>
  <div class="copy-draft-panel">
    <div class="panel-grid">
      <!-- 左侧：文案编辑 -->
      <div class="editor-section">
        <div class="section-header">
          <h3>文案编辑</h3>
          <div class="char-count">{{ charCount }} 字</div>
        </div>
        <textarea
          ref="textareaRef"
          v-model="localContent"
          class="script-textarea"
          placeholder="AI 将根据选题生成文案初稿，你也可以直接编写...&#10;&#10;提示：口语化表达效果更好，开头 3 秒决定观众是否停留。"
          @input="handleInput"
          @mouseup="handleSelection"
          @keyup="handleSelection"
        />
      </div>

      <!-- 右侧：操作 -->
      <div class="config-section">
        <div class="config-card">
          <h4>AI 生成</h4>
          <button
            class="btn btn-primary btn-block"
            :disabled="loading"
            @click="handleGenerate"
          >
            {{ loading ? '生成中...' : 'AI 生成文案' }}
          </button>
        </div>

        <div class="config-card">
          <h4>AI 改写</h4>
          <p v-if="selectedText" class="hint-text">
            已选中 {{ selectedText.length }} 字
          </p>
          <p v-else class="hint-text">选中文字可只改写该段落</p>
          <div class="btn-group-vertical">
            <button class="btn btn-outline" :disabled="!hasContent || loading" @click="handleRewrite('润色让文案更自然')">
              润色
            </button>
            <button class="btn btn-outline" :disabled="!hasContent || loading" @click="handleRewrite('改写得更口语化')">
              更口语化
            </button>
            <button class="btn btn-outline" :disabled="!hasContent || loading" @click="handleRewrite('让开头更有吸引力')">
              优化开头
            </button>
          </div>
        </div>

        <div class="config-card">
          <h4>状态</h4>
          <div class="status-info">
            <span class="status-badge" :class="statusClass">{{ statusLabel }}</span>
            <span v-if="version > 1" class="version-tag">v{{ version }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useCopyWritingStore } from '@/stores/copyWriting'

const store = useCopyWritingStore()
const textareaRef = ref<HTMLTextAreaElement>()
const localContent = ref('')
const selectedText = ref('')
let saveTimer: ReturnType<typeof setTimeout> | null = null

const loading = computed(() => store.loading)
const charCount = computed(() => localContent.value.length)
const hasContent = computed(() => localContent.value.trim().length > 0)
const version = computed(() => store.currentCopy?.version ?? 1)
const statusLabel = computed(() => {
  const s = store.currentCopy?.status
  if (s === 'draft') return '草稿'
  if (s === 'checking') return '检测中'
  if (s === 'finalized') return '已定稿'
  return '未创建'
})
const statusClass = computed(() => store.currentCopy?.status ?? '')

// 同步 store → local
watch(() => store.currentCopy?.content, (val) => {
  if (val !== undefined && val !== localContent.value) {
    localContent.value = val
  }
}, { immediate: true })

function handleInput() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    store.saveContent(localContent.value)
  }, 1000)
}

function handleSelection() {
  const el = textareaRef.value
  if (!el) return
  selectedText.value = el.value.substring(el.selectionStart, el.selectionEnd)
}

async function handleGenerate() {
  await store.generateDraft({})
  if (store.currentCopy?.content) {
    localContent.value = store.currentCopy.content
  }
}

async function handleRewrite(instruction: string) {
  const sel = selectedText.value || undefined
  await store.rewrite(instruction, sel)
  if (store.currentCopy?.content) {
    localContent.value = store.currentCopy.content
  }
}
</script>

<style scoped>
.copy-draft-panel { height: 100%; }
.panel-grid { display: grid; grid-template-columns: 1fr 280px; gap: 16px; height: 100%; }
.editor-section { display: flex; flex-direction: column; min-height: 0; }
.section-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; }
.section-header h3 { margin: 0; font-size: 15px; }
.char-count { font-size: 12px; color: var(--color-text-secondary); }
.script-textarea {
  flex: 1; padding: 12px; border: 1px solid var(--color-border); border-radius: 8px;
  font-size: 14px; line-height: 1.8; resize: none; font-family: inherit; outline: none;
}
.script-textarea:focus { border-color: var(--color-primary); }
.config-section { display: flex; flex-direction: column; gap: 12px; }
.config-card { background: var(--color-bg-secondary); border-radius: 8px; padding: 12px; }
.config-card h4 { margin: 0 0 8px; font-size: 13px; color: var(--color-text-secondary); }
.hint-text { font-size: 12px; color: var(--color-text-tertiary); margin: 0 0 8px; }
.btn {
  display: block; width: 100%; padding: 8px 12px; border: 1px solid var(--color-border);
  border-radius: 6px; font-size: 13px; cursor: pointer; background: white; text-align: center;
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--color-primary); color: white; border-color: var(--color-primary); }
.btn-outline { background: transparent; color: var(--color-primary); border-color: var(--color-primary); }
.btn-block { width: 100%; }
.btn-group-vertical { display: flex; flex-direction: column; gap: 6px; }
.status-info { display: flex; align-items: center; gap: 8px; }
.status-badge {
  display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px;
  background: var(--color-bg-tertiary, #f0f0f0);
}
.status-badge.draft { background: #e8f5e9; color: #2e7d32; }
.status-badge.checking { background: #fff3e0; color: #ef6c00; }
.status-badge.finalized { background: #e3f2fd; color: #1565c0; }
.version-tag { font-size: 11px; color: var(--color-text-tertiary); }
</style>
