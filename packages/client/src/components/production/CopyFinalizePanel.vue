<template>
  <div class="copy-finalize-panel">
    <!-- 版本标签页 -->
    <div class="version-tabs">
      <button
        v-for="v in displayVersions"
        :key="v.id"
        class="version-tab"
        :class="{ active: v.id === currentId }"
        @click="switchVersion(v.id)"
      >
        v{{ v.version }}
      </button>
    </div>

    <!-- 文案预览 -->
    <div class="content-preview">
      <div class="preview-header">
        <h3>{{ title }}</h3>
        <span class="char-count">{{ charCount }} 字</span>
      </div>
      <div class="preview-content">{{ content }}</div>
    </div>

    <!-- 操作栏 -->
    <div class="action-bar">
      <button class="btn btn-outline" :disabled="!hasCopy || loading" @click="handlePolish">
        AI 润色
      </button>

      <button
        v-if="!isFinalized"
        class="btn btn-primary"
        :disabled="!hasCopy || loading || hasProhibitedRisks"
        @click="handleFinalize"
      >
        {{ loading ? '处理中...' : '确认定稿' }}
      </button>

      <div v-else class="finalized-info">
        <span class="finalized-badge">✅ 已定稿</span>
        <button class="btn btn-primary" :disabled="loading" @click="handleToScript">
          转为脚本 →
        </button>
      </div>
    </div>

    <!-- 提示 -->
    <div v-if="hasProhibitedRisks" class="warning-bar">
      ⚠️ 仍有未处理的违禁词风险，建议先修复再定稿
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCopyWritingStore } from '@/stores/copyWriting'
import { useProductionStore } from '@/stores/production'

const emit = defineEmits<{
  (e: 'to-script', scriptId: number): void
}>()

const store = useCopyWritingStore()
const prodStore = useProductionStore()

const hasCopy = computed(() => !!store.currentCopy)
const loading = computed(() => store.loading)
const isFinalized = computed(() => store.isFinalized)
const hasProhibitedRisks = computed(() => store.hasProhibitedRisks)
const currentId = computed(() => store.currentCopy?.id ?? '')
const title = computed(() => store.currentCopy?.title ?? '未命名文案')
const content = computed(() => store.currentCopy?.content ?? '')
const charCount = computed(() => content.value.length)

const displayVersions = computed(() =>
  store.versions.length > 0 ? store.versions : (store.currentCopy ? [store.currentCopy] : []),
)

async function switchVersion(id: string) {
  await store.loadCopy(id)
}

async function handlePolish() {
  await store.rewrite('润色让文案更精炼自然')
}

async function handleFinalize() {
  await store.doFinalize()
  // 标记文案定稿步骤完成，确保流水线进度正确
  prodStore.markCopyFinalized()
}

async function handleToScript() {
  const script = await store.doToScript()
  if (script) {
    // 将定稿文案内容传递给脚本编辑器，打通 阶段2→阶段3 数据管道
    if (script.full_text) {
      prodStore.fullText = script.full_text
    }
    emit('to-script', script.id)
  }
}
</script>

<style scoped>
.copy-finalize-panel { padding: 12px 0; }
.version-tabs { display: flex; gap: 4px; margin-bottom: 16px; }
.version-tab {
  padding: 4px 12px; border: 1px solid var(--color-border); border-radius: 4px;
  font-size: 12px; cursor: pointer; background: white; color: var(--color-text-secondary);
}
.version-tab.active { background: var(--color-primary); color: white; border-color: var(--color-primary); }
.content-preview {
  border: 1px solid var(--color-border); border-radius: 8px; padding: 16px;
  min-height: 120px; margin-bottom: 16px;
}
.preview-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.preview-header h3 { margin: 0; font-size: 15px; }
.char-count { font-size: 12px; color: var(--color-text-secondary); }
.preview-content {
  font-size: 14px; line-height: 1.8; white-space: pre-wrap; color: var(--color-text);
}
.action-bar { display: flex; gap: 12px; align-items: center; }
.btn {
  padding: 8px 16px; border: 1px solid var(--color-border); border-radius: 6px;
  font-size: 13px; cursor: pointer; background: white;
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--color-primary); color: white; border-color: var(--color-primary); }
.btn-outline { background: transparent; color: var(--color-primary); border-color: var(--color-primary); }
.finalized-info { display: flex; align-items: center; gap: 12px; }
.finalized-badge { font-size: 13px; color: #2e7d32; }
.warning-bar {
  margin-top: 12px; padding: 8px 12px; border-radius: 6px; font-size: 13px;
  background: #fff3e0; color: #ef6c00;
}
</style>
