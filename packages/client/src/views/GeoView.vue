<template>
  <div class="geo-page">
    <div class="toolbar">
      <h2 class="page-title">GEO 优化</h2>
      <span class="toolbar-hint">让 AI 搜索引擎优先引用你的内容</span>
    </div>

    <!-- 标签栏 -->
    <div class="tabs">
      <button class="tab" :class="{ active: activeTab === 'questions' }" @click="activeTab = 'questions'">意图题库</button>
      <button class="tab" :class="{ active: activeTab === 'content' }" @click="activeTab = 'content'; loadContentTab()">内容生成</button>
      <button class="tab" :class="{ active: activeTab === 'knowledge' }" @click="activeTab = 'knowledge'; loadKnowledgeTab()">知识库</button>
      <button class="tab" :class="{ active: activeTab === 'distill' }" @click="activeTab = 'distill'; loadDistillTab()">关键词蒸馏</button>
      <button class="tab" :class="{ active: activeTab === 'monitor' }" @click="activeTab = 'monitor'; loadMonitorTab()">效果监测</button>
    </div>

    <!-- ========== 意图题库 ========== -->
    <template v-if="activeTab === 'questions'">
      <!-- 筛选 -->
      <div class="filter-bar">
        <div class="category-pills">
          <button class="pill" :class="{ active: store.filterCategory === 'all' }" @click="store.filterCategory = 'all'; store.loadQuestions()">全部</button>
          <button v-for="(label, key) in categoryLabels" :key="key" class="pill" :class="{ active: store.filterCategory === key }" @click="store.filterCategory = key as string; store.loadQuestions()">{{ label }}</button>
        </div>
        <input v-model="store.searchKeyword" class="input search-input" placeholder="搜索问题..." @input="debouncedSearch" />
        <button class="btn btn-primary" :disabled="store.generatingQuestions" @click="handleGenerate">AI 批量生成</button>
        <button class="btn" @click="showAddForm = true">手动添加</button>
      </div>

      <!-- 添加表单 -->
      <div v-if="showAddForm" class="card form-card">
        <div class="form-group">
          <label>问题</label>
          <input v-model="newQuestion" class="input" placeholder="用户可能在 AI 搜索引擎中提问的问题" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>分类</label>
            <select v-model="newCategory" class="input">
              <option v-for="(label, key) in categoryLabels" :key="key" :value="key">{{ label }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>意图类型</label>
            <select v-model="newIntentType" class="input">
              <option v-for="(label, key) in intentLabels" :key="key" :value="key">{{ label }}</option>
            </select>
          </div>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" @click="handleAddQuestion">添加</button>
          <button class="btn" @click="showAddForm = false">取消</button>
        </div>
      </div>

      <!-- 问题列表 -->
      <div v-if="store.questionsLoading" class="loading-wrapper">加载中...</div>
      <div v-else-if="store.questions.length === 0" class="empty-state">
        <div class="empty-text">暂无问题，点击「AI 批量生成」或「手动添加」</div>
      </div>
      <div v-else class="question-list">
        <div v-for="q in store.questions" :key="q.id" class="card question-card">
          <div class="question-header">
            <span class="category-badge" :class="q.category">{{ categoryLabels[q.category as keyof typeof categoryLabels] || q.category }}</span>
            <span class="intent-badge">{{ intentLabels[q.intent_type as keyof typeof intentLabels] || q.intent_type }}</span>
            <span v-if="q.ai_generated" class="ai-badge">AI</span>
            <span class="content-count">{{ q.content_count }} 条内容</span>
          </div>
          <div class="question-text">{{ q.question }}</div>
          <div v-if="q.tags?.length" class="question-tags">
            <span v-for="tag in q.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
          <div class="question-actions">
            <button class="btn btn-sm btn-primary" @click="handleGenerateContent(q.id)" :disabled="store.generatingContent">生成内容</button>
            <button class="btn btn-sm btn-danger" @click="store.removeQuestion(q.id)">删除</button>
          </div>
        </div>
      </div>
    </template>

    <!-- ========== 内容生成 ========== -->
    <template v-if="activeTab === 'content'">
      <div class="filter-bar">
        <select v-model="contentFilter" class="input" @change="store.loadContents({ status: contentFilter })">
          <option value="all">全部状态</option>
          <option value="draft">草稿</option>
          <option value="published">已发布</option>
          <option value="archived">已归档</option>
        </select>
      </div>

      <div v-if="store.contentsLoading" class="loading-wrapper">加载中...</div>
      <div v-else-if="store.contents.length === 0" class="empty-state">
        <div class="empty-text">暂无内容，先到「意图题库」为问题生成内容</div>
      </div>
      <div v-else class="content-list">
        <div v-for="c in store.contents" :key="c.id" class="card content-card">
          <div class="content-header">
            <span class="status-badge" :class="c.status">{{ contentStatusLabels[c.status as keyof typeof contentStatusLabels] || c.status }}</span>
            <span v-if="c.eeat_score" class="eeat-score">EEAT {{ c.eeat_score }}分</span>
          </div>
          <div class="content-title">{{ c.title }}</div>
          <div v-if="c.question_text" class="content-question">问题：{{ c.question_text }}</div>
          <div class="content-body">{{ c.content.slice(0, 200) }}{{ c.content.length > 200 ? '...' : '' }}</div>
          <div v-if="c.keywords?.length" class="content-keywords">
            <span v-for="kw in c.keywords" :key="kw" class="tag">{{ kw }}</span>
          </div>
          <div class="content-actions">
            <button v-if="c.status === 'draft'" class="btn btn-sm btn-primary" @click="store.editContent(c.id, { status: 'published' })">发布</button>
            <button class="btn btn-sm" @click="viewSchema(c.id)">查看 Schema</button>
            <button class="btn btn-sm btn-danger" @click="store.removeContent(c.id)">删除</button>
          </div>
        </div>
      </div>
    </template>

    <!-- ========== 效果监测 ========== -->
    <template v-if="activeTab === 'monitor'">
      <div v-if="store.dashboard" class="card dashboard-card">
        <h3 class="section-title">总览</h3>
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-value">{{ store.dashboard.overview.total_questions }}</div>
            <div class="stat-label">问题总数</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ store.dashboard.overview.total_contents }}</div>
            <div class="stat-label">内容总数</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ store.dashboard.overview.published_contents }}</div>
            <div class="stat-label">已发布</div>
          </div>
        </div>

        <h3 class="section-title" style="margin-top: 24px">各引擎提及情况</h3>
        <div class="mention-grid">
          <div v-for="m in store.dashboard.mention_by_engine" :key="m.engine" class="mention-item">
            <div class="mention-engine">{{ engineLabel(m.engine) }}</div>
            <div class="mention-bar">
              <div class="mention-fill" :style="{ width: mentionRate(m) + '%' }"></div>
            </div>
            <div class="mention-rate">{{ m.total_checks > 0 ? Math.round(m.mentioned_count / m.total_checks * 100) : 0 }}%</div>
          </div>
        </div>

        <h3 class="section-title" style="margin-top: 24px">Top 内容</h3>
        <div v-for="tc in store.dashboard.top_contents" :key="tc.id" class="top-content-item">
          <span class="top-title">{{ tc.title }}</span>
          <span class="top-meta">EEAT {{ tc.eeat_score ?? '-' }} / {{ tc.mention_count }} 次提及</span>
        </div>
      </div>
      <div v-else class="empty-state"><div class="empty-text">加载中...</div></div>
    </template>

    <!-- ========== 知识库 ========== -->
    <template v-if="activeTab === 'knowledge'">
      <div class="filter-bar">
        <div class="category-pills">
          <button class="pill" :class="{ active: store.knowledgeFilterCategory === 'all' }" @click="store.knowledgeFilterCategory = 'all'; store.loadKnowledge()">全部</button>
          <button v-for="(label, key) in knowledgeCategoryLabels" :key="key" class="pill" :class="{ active: store.knowledgeFilterCategory === key }" @click="store.knowledgeFilterCategory = key as string; store.loadKnowledge()">{{ label }}</button>
        </div>
        <button class="btn btn-primary" :disabled="store.generatingKnowledge" @click="handleGenerateKnowledge">AI 生成</button>
        <button class="btn" :disabled="store.searchAndBuilding" @click="showSearchPanel = true">🔍 全网搜索</button>
        <button class="btn" @click="showKnowledgeForm = true">手动添加</button>
        <button class="btn" @click="router.push('/geo/build')">🔧 构建引擎</button>
        <button class="btn" @click="router.push('/geo/fact-extract')">📋 事实提取</button>
      </div>

      <!-- 全网搜索建库面板 -->
      <div v-if="showSearchPanel" class="card form-card search-panel">
        <div class="form-group">
          <label>🌐 搜索主题</label>
          <input v-model="searchTopic" class="input" placeholder="输入主题，如：新疆旅游攻略、亲子游注意事项..." @keyup.enter="handleSearchAndBuild" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>分类（可选）</label>
            <select v-model="searchCategory" class="input">
              <option value="">自动分类</option>
              <option v-for="(label, key) in knowledgeCategoryLabels" :key="key" :value="key">{{ label }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>生成数量</label>
            <input v-model.number="searchCount" type="number" class="input" min="1" max="10" />
          </div>
          <div class="form-group" style="display:flex;align-items:flex-end">
            <button class="btn btn-primary" :disabled="store.searchAndBuilding || !searchTopic.trim()" @click="handleSearchAndBuild">
              {{ store.searchAndBuilding ? '搜索提取中...' : '⚡ 搜索并建库' }}
            </button>
          </div>
        </div>

        <!-- 搜索进度/结果 -->
        <div v-if="store.searchAndBuilding" class="search-progress">
          <div class="progress-bar"><div class="progress-fill animating"></div></div>
          <div class="progress-text">正在全网搜索「{{ searchTopic }}」并提取知识...</div>
        </div>
        <div v-else-if="store.searchBuildResult" class="search-result">
          <div class="search-result-summary">
            🎉 搜索完成！找到 {{ store.searchBuildResult.search_results_count }} 条网页结果，
            成功写入 <strong>{{ store.searchBuildResult.created_count }}</strong> 条知识。
          </div>
          <div v-for="item in store.searchBuildResult.knowledge_items" :key="item.title" class="search-result-item">
            <div class="search-result-item-header">
              <span class="knowledge-badge" :class="item.category">{{ knowledgeCategoryLabels[item.category as keyof typeof knowledgeCategoryLabels] || item.category }}</span>
              <span class="confidence-badge">{{ Math.round(item.confidence * 100) }}% 置信</span>
            </div>
            <div class="search-result-item-title">{{ item.title }}</div>
            <div class="search-result-item-url" v-if="item.source_url">
              📎 <a :href="item.source_url" target="_blank" rel="noopener">{{ item.source_url }}</a>
            </div>
          </div>
          <button class="btn" @click="showSearchPanel = false; store.searchBuildResult = null">关闭</button>
        </div>
      </div>

      <!-- 添加知识表单 -->
      <div v-if="showKnowledgeForm" class="card form-card">
        <div class="form-group">
          <label>标题</label>
          <input v-model="newKnowledge.title" class="input" placeholder="知识标题，如：新疆独家路线推荐" />
        </div>
        <div class="form-group">
          <label>正文</label>
          <textarea v-model="newKnowledge.content" class="input" rows="5" placeholder="知识内容，200-500字..." />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>分类</label>
            <select v-model="newKnowledge.category" class="input">
              <option v-for="(label, key) in knowledgeCategoryLabels" :key="key" :value="key">{{ label }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>标签（逗号分隔）</label>
            <input v-model="newKnowledge.tagsStr" class="input" placeholder="标签1,标签2" />
          </div>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" @click="handleAddKnowledge">添加</button>
          <button class="btn" @click="showKnowledgeForm = false">取消</button>
        </div>
      </div>

      <!-- 知识列表 -->
      <div v-if="store.knowledgeLoading" class="loading-wrapper">加载中...</div>
      <div v-else-if="store.knowledgeItems.length === 0" class="empty-state">
        <div class="empty-text">暂无知识条目。添加品牌知识后，AI 生成 GEO 内容时会自动注入。</div>
      </div>
      <div v-else class="knowledge-list">
        <div v-for="item in store.knowledgeItems" :key="item.id" class="card knowledge-card" :class="{ inactive: !item.is_active }">
          <div class="knowledge-header">
            <span class="knowledge-badge" :class="item.category">{{ knowledgeCategoryLabels[item.category as keyof typeof knowledgeCategoryLabels] || item.category }}</span>
            <span class="knowledge-source">{{ item.source === 'ai_generated' ? 'AI生成' : '手动' }}</span>
            <label class="toggle-label">
              <input type="checkbox" :checked="item.is_active" @change="store.editKnowledge(item.id, { is_active: !item.is_active })" />
              <span class="toggle-text">{{ item.is_active ? '启用' : '停用' }}</span>
            </label>
          </div>
          <div class="knowledge-title">{{ item.title }}</div>
          <div class="knowledge-content">{{ item.content.slice(0, 200) }}{{ item.content.length > 200 ? '...' : '' }}</div>
          <div v-if="item.tags?.length" class="knowledge-tags">
            <span v-for="tag in item.tags" :key="tag" class="tag">{{ tag }}</span>
          </div>
          <div class="knowledge-actions">
            <button class="btn btn-sm btn-danger" @click="store.removeKnowledge(item.id)">删除</button>
          </div>
        </div>
      </div>
    </template>

    <!-- ========== 关键词蒸馏 ========== -->
    <template v-if="activeTab === 'distill'">
      <!-- 输入区 -->
      <div class="card distill-input-card">
        <div class="form-group">
          <label>输入关键词（一行一个）</label>
          <textarea v-model="distillInput" class="input" rows="5" placeholder="新疆旅游攻略&#10;伊犁薰衣草什么时候开&#10;新疆自驾游路线推荐&#10;喀纳斯旅游费用..." />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>领域</label>
            <input v-model="distillDomain" class="input" placeholder="如：新疆旅游" />
          </div>
          <div class="form-group" style="display:flex;align-items:flex-end">
            <button class="btn btn-primary" :disabled="store.distilling || !distillInput.trim()" @click="handleStartDistill">
              {{ store.distilling ? '蒸馏中...' : '⚡ 开始蒸馏' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 批次选择 + 结果 -->
      <div v-if="store.distillBatches.length > 0" class="distill-results">
        <div class="filter-bar">
          <select v-model="store.currentBatchId" class="input" @change="store.loadDistillResults()">
            <option v-for="b in store.distillBatches" :key="b.batch_id" :value="b.batch_id">
              {{ b.domain || '未指定' }} — {{ b.created_at.slice(0, 10) }} ({{ Object.values(b.counts).reduce((a, b) => a + b, 0) }}词)
            </option>
          </select>
          <button class="btn btn-sm" @click="handleDeleteBatch" :disabled="!store.currentBatchId">删除此批次</button>
        </div>

        <!-- 批量操作 -->
        <div v-if="selectedDistillIds.length > 0" class="batch-actions">
          <span>已选 {{ selectedDistillIds.length }} 个</span>
          <button class="btn btn-sm btn-primary" @click="handleImportSelected">导入选中到问题库</button>
          <button class="btn btn-sm" @click="handleDiscardSelected">丢弃选中</button>
        </div>

        <!-- 结果表格 -->
        <div v-if="store.distillLoading" class="loading-wrapper">加载中...</div>
        <div v-else-if="store.distillResults.length === 0" class="empty-state">
          <div class="empty-text">选择批次查看结果</div>
        </div>
        <div v-else class="distill-table-wrap">
          <table class="distill-table">
            <thead>
              <tr>
                <th><input type="checkbox" @change="toggleAllDistill" :checked="allDistillSelected" /></th>
                <th>关键词</th>
                <th>意图</th>
                <th>竞争度</th>
                <th>相关性</th>
                <th>机会</th>
                <th>总分</th>
                <th>推荐理由</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="d in store.distillResults" :key="d.id" :class="{ imported: d.status === 'imported', discarded: d.status === 'discarded' }">
                <td><input type="checkbox" :value="d.id" v-model="selectedDistillIds" :disabled="d.status !== 'pending'" /></td>
                <td class="kw-cell">{{ d.keyword }}</td>
                <td><span class="intent-badge">{{ intentLabels[d.intent_type as keyof typeof intentLabels] || d.intent_type }}</span></td>
                <td><span class="comp-badge" :class="d.competition">{{ compLabels[d.competition as keyof typeof compLabels] || d.competition }}</span></td>
                <td>{{ d.brand_relevance }}</td>
                <td>{{ d.content_opportunity }}</td>
                <td><span class="score-badge" :class="scoreClass(d.total_score)">{{ d.total_score }}</span></td>
                <td class="rec-cell">{{ d.recommendation }}</td>
                <td>
                  <button v-if="d.status === 'pending'" class="btn btn-sm btn-primary" @click="store.importSelectedToQuestions([d.id])">导入</button>
                  <span v-else-if="d.status === 'imported'" class="status-text imported">已导入</span>
                  <span v-else class="status-text discarded">已丢弃</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGeoStore } from '@/stores/geo'
import {
  GEO_QUESTION_CATEGORY_LABELS, GEO_INTENT_TYPE_LABELS,
  GEO_CONTENT_STATUS_LABELS, BRAND_KNOWLEDGE_CATEGORY_LABELS,
  KEYWORD_COMPETITION_LABELS,
} from '@zimti/shared'
import { getGenerateQuestionsStatus, getGenerateKnowledgeStatus, getDistillStatus, getSearchAndBuildStatus } from '@/api/geo'
import type { GeoQuestionCategory, GeoIntentType, BrandKnowledgeCategory } from '@zimti/shared'

const store = useGeoStore()
const router = useRouter()
const activeTab = ref('questions')
const categoryLabels = GEO_QUESTION_CATEGORY_LABELS
const intentLabels = GEO_INTENT_TYPE_LABELS
const contentStatusLabels = GEO_CONTENT_STATUS_LABELS
const knowledgeCategoryLabels = BRAND_KNOWLEDGE_CATEGORY_LABELS
const compLabels = KEYWORD_COMPETITION_LABELS

const showAddForm = ref(false)
const newQuestion = ref('')
const newCategory = ref<GeoQuestionCategory>('general')
const newIntentType = ref<GeoIntentType>('informational')
const contentFilter = ref('all')

// --- 知识库 ---
const showKnowledgeForm = ref(false)
const newKnowledge = ref({ title: '', content: '', category: 'brand_intro' as BrandKnowledgeCategory, tagsStr: '' })

// --- 全网搜索建库 ---
const showSearchPanel = ref(false)
const searchTopic = ref('')
const searchCategory = ref<BrandKnowledgeCategory | ''>('')
const searchCount = ref(5)

// --- 蒸馏 ---
const distillInput = ref('')
const distillDomain = ref('新疆旅游')
const selectedDistillIds = ref<string[]>([])
const allDistillSelected = computed(() =>
  store.distillResults.length > 0 &&
  store.distillResults.filter(d => d.status === 'pending').every(d => selectedDistillIds.value.includes(d.id)),
)

let searchTimer: ReturnType<typeof setTimeout> | null = null
function debouncedSearch(): void {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => store.loadQuestions(), 400)
}

/**
 * 轮询 AI 任务状态，完成后刷新数据并提示用户
 */
async function pollTask(
  taskId: string,
  onSuccess: () => Promise<void> | void,
  successMsg: string,
  failMsg: string,
  getStatusFn: (id: string) => Promise<{ status: string; output: unknown; error?: string | null }> = getGenerateQuestionsStatus,
  maxAttempts = 60,
  interval = 3000,
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, interval))
    try {
      const res = await getStatusFn(taskId)
      if (res.status === 'success') {
        await onSuccess()
        alert(successMsg)
        return
      }
      if (res.status === 'failed') {
        alert(`${failMsg}\n${res.error ? '原因：' + res.error : ''}`)
        return
      }
    } catch {
      // 轮询错误继续重试
    }
  }
  alert('任务超时，请稍后刷新查看')
}

async function handleGenerate(): Promise<void> {
  const countStr = prompt('生成多少条问题？（建议 5-20）', '10')
  if (!countStr) return
  const count = parseInt(countStr) || 10
  const taskId = await store.startGenerateQuestions({ count })
  await pollTask(taskId, () => store.loadQuestions(), '问题生成完成', '问题生成失败', getGenerateQuestionsStatus)
}

async function handleAddQuestion(): Promise<void> {
  if (!newQuestion.value.trim()) return
  await store.addQuestion({
    question: newQuestion.value.trim(),
    category: newCategory.value,
    intent_type: newIntentType.value,
  })
  newQuestion.value = ''
  showAddForm.value = false
}

async function handleGenerateContent(questionId: string): Promise<void> {
  await store.startGenerateContent(questionId)
  alert('AI 正在生成内容，稍后在「内容生成」标签页查看')
}

function loadContentTab(): void {
  store.loadContents({ status: contentFilter.value !== 'all' ? contentFilter.value : undefined })
}

function loadMonitorTab(): void {
  store.loadDashboard()
}

function viewSchema(id: string): void {
  store.loadSchemaPreview(id).then(schema => {
    alert(JSON.stringify(schema, null, 2))
  })
}

// --- 知识库 ---

function loadKnowledgeTab(): void {
  store.loadKnowledge()
}

async function handleAddKnowledge(): Promise<void> {
  const { title, content, category, tagsStr } = newKnowledge.value
  if (!title.trim() || !content.trim()) return
  const tags = tagsStr.split(',').map(t => t.trim()).filter(Boolean)
  await store.addKnowledge({ title: title.trim(), content: content.trim(), category, tags })
  newKnowledge.value = { title: '', content: '', category: 'brand_intro', tagsStr: '' }
  showKnowledgeForm.value = false
}

async function handleGenerateKnowledge(): Promise<void> {
  const taskId = await store.startGenerateKnowledge({ domain: distillDomain.value || undefined, count: 5 })
  await pollTask(taskId, () => store.loadKnowledge(), '知识生成完成', '知识生成失败', getGenerateKnowledgeStatus)
}

async function handleSearchAndBuild(): Promise<void> {
  if (!searchTopic.value.trim()) return
  const taskId = await store.startSearchAndBuild({
    topic: searchTopic.value.trim(),
    category: searchCategory.value || undefined,
    count: searchCount.value,
  })
  await pollTask(
    taskId,
    () => { store.loadKnowledge() },
    `搜索建库完成！写入 ${store.searchBuildResult?.created_count ?? 0} 条知识`,
    '搜索建库失败',
    getSearchAndBuildStatus,
  )
}

// --- 蒸馏 ---

function loadDistillTab(): void {
  store.loadDistillBatches()
}

async function handleStartDistill(): Promise<void> {
  const keywords = distillInput.value.split('\n').map(k => k.trim()).filter(Boolean)
  if (keywords.length === 0) return
  const taskId = await store.startKeywordDistill(keywords, distillDomain.value || undefined)
  await pollTask(taskId, () => { store.loadDistillBatches(); store.loadDistillResults() }, '关键词蒸馏完成', '关键词蒸馏失败', getDistillStatus)
}

function toggleAllDistill(e: Event): void {
  const checked = (e.target as HTMLInputElement).checked
  const pendingIds = store.distillResults.filter(d => d.status === 'pending').map(d => d.id)
  selectedDistillIds.value = checked ? pendingIds : []
}

async function handleImportSelected(): Promise<void> {
  if (selectedDistillIds.value.length === 0) return
  const count = await store.importSelectedToQuestions(selectedDistillIds.value)
  alert(`已导入 ${count} 个关键词到问题库`)
  selectedDistillIds.value = []
}

async function handleDiscardSelected(): Promise<void> {
  for (const id of selectedDistillIds.value) {
    await store.updateDistillStatus(id, 'discarded')
  }
  selectedDistillIds.value = []
}

async function handleDeleteBatch(): Promise<void> {
  if (!store.currentBatchId) return
  if (!confirm('确定删除此批次？')) return
  await store.removeDistillBatch(store.currentBatchId)
}

function scoreClass(score: number): string {
  if (score >= 80) return 'high'
  if (score >= 50) return 'medium'
  return 'low'
}

function engineLabel(engine: string): string {
  const map: Record<string, string> = { doubao: '豆包', deepseek: 'DeepSeek', kimi: 'Kimi', chatgpt: 'ChatGPT' }
  return map[engine] ?? engine
}

function mentionRate(m: { total_checks: number; mentioned_count: number }): number {
  if (m.total_checks === 0) return 0
  return Math.round(m.mentioned_count / m.total_checks * 100)
}

onMounted(() => {
  store.loadQuestions()
})
</script>

<style scoped>
.geo-page { padding: var(--page-padding, 20px); }
.toolbar { display: flex; align-items: baseline; gap: 12px; margin-bottom: 16px; }
.toolbar-hint { color: var(--color-text-secondary); font-size: 14px; }
.tabs { display: flex; gap: 8px; margin-bottom: 20px; }
.tab { padding: 8px 16px; border: 1px solid var(--color-border); border-radius: 6px; background: transparent; cursor: pointer; color: var(--color-text-secondary); }
.tab.active { background: var(--color-primary); color: white; border-color: var(--color-primary); }

.filter-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.search-input { width: 200px; }
.input { padding: 8px 12px; border: 1px solid var(--color-border); border-radius: 6px; font-size: 14px; }

.category-pills { display: flex; gap: 6px; flex-wrap: wrap; }
.pill { padding: 4px 12px; border: 1px solid var(--color-border); border-radius: 16px; background: transparent; cursor: pointer; font-size: 13px; }
.pill.active { background: var(--color-primary); color: white; border-color: var(--color-primary); }

.form-card { margin-bottom: 16px; }
.form-row { display: flex; gap: 12px; }
.form-row .form-group { flex: 1; }
.form-group { margin-bottom: 12px; }
.form-group label { display: block; font-size: 13px; color: var(--color-text-secondary); margin-bottom: 4px; }
.form-group .input { width: 100%; box-sizing: border-box; }
.form-actions { display: flex; gap: 8px; }

.question-list, .content-list { display: flex; flex-direction: column; gap: 10px; }
.question-card, .content-card { padding: 14px; }
.question-header, .content-header { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.question-text { font-size: 15px; font-weight: 500; margin-bottom: 6px; line-height: 1.5; }
.question-tags { margin-bottom: 8px; }
.question-actions { display: flex; gap: 8px; }

.category-badge { padding: 2px 10px; border-radius: 12px; font-size: 12px; }
.category-badge.route { background: #e3f2fd; color: #1565c0; }
.category-badge.food { background: #fff3e0; color: #e65100; }
.category-badge.season { background: #e8f5e9; color: #2e7d32; }
.category-badge.budget { background: #fce4ec; color: #c62828; }
.category-badge.tips { background: #f3e5f5; color: #7b1fa2; }
.category-badge.general { background: #f5f5f5; color: #757575; }

.intent-badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; background: var(--color-bg-secondary); color: var(--color-text-secondary); }
.ai-badge { padding: 2px 6px; border-radius: 4px; font-size: 11px; background: #ede7f6; color: #5e35b1; font-weight: 600; }
.content-count { font-size: 12px; color: var(--color-text-secondary); }

.tag { padding: 2px 8px; background: var(--color-bg-tertiary, #f0f0f0); border-radius: 4px; font-size: 12px; margin-right: 4px; }
.status-badge { padding: 2px 8px; border-radius: 4px; font-size: 12px; }
.status-badge.draft { background: #f5f5f5; color: #757575; }
.status-badge.published { background: #e8f5e9; color: #2e7d32; }
.status-badge.archived { background: #e0e0e0; color: #616161; }

.content-title { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
.content-question { font-size: 13px; color: var(--color-text-secondary); margin-bottom: 6px; }
.content-body { font-size: 14px; line-height: 1.5; color: var(--color-text-secondary); margin-bottom: 8px; }
.content-keywords { margin-bottom: 8px; }
.content-actions { display: flex; gap: 8px; }
.eeat-score { font-size: 12px; color: #5e35b1; font-weight: 600; }

.stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 12px; }
.stat-item { text-align: center; padding: 16px; background: var(--color-bg-secondary); border-radius: 8px; }
.stat-value { font-size: 28px; font-weight: 700; color: var(--color-primary); }
.stat-label { font-size: 12px; color: var(--color-text-secondary); margin-top: 4px; }

.mention-grid { display: flex; flex-direction: column; gap: 10px; }
.mention-item { display: flex; align-items: center; gap: 12px; }
.mention-engine { min-width: 80px; font-size: 14px; font-weight: 500; }
.mention-bar { flex: 1; height: 8px; background: var(--color-bg-secondary); border-radius: 4px; overflow: hidden; }
.mention-fill { height: 100%; background: var(--color-primary); border-radius: 4px; transition: width 0.3s; }
.mention-rate { min-width: 40px; text-align: right; font-size: 14px; font-weight: 600; }

.top-content-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--color-border); }
.top-title { font-size: 14px; }
.top-meta { font-size: 12px; color: var(--color-text-secondary); }

.btn { padding: 6px 14px; border: 1px solid var(--color-border); border-radius: 6px; cursor: pointer; font-size: 13px; background: transparent; }
.btn-sm { padding: 4px 10px; font-size: 12px; }
.btn-primary { background: var(--color-primary); color: white; border-color: var(--color-primary); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-danger { color: #e53935; border-color: #e53935; }
.card { background: var(--color-card, white); border: 1px solid var(--color-border); border-radius: 8px; }
.section-title { font-size: 16px; font-weight: 600; margin-bottom: 12px; }

.empty-state { text-align: center; padding: 40px; color: var(--color-text-secondary); }
.loading-wrapper { text-align: center; padding: 40px; color: var(--color-text-secondary); }

/* --- 知识库 --- */
.knowledge-list { display: flex; flex-direction: column; gap: 10px; }
.knowledge-card { padding: 14px; transition: opacity 0.2s; }
.knowledge-card.inactive { opacity: 0.5; }
.knowledge-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.knowledge-badge { padding: 2px 10px; border-radius: 12px; font-size: 12px; }
.knowledge-badge.brand_intro { background: #e3f2fd; color: #1565c0; }
.knowledge-badge.route { background: #fff3e0; color: #e65100; }
.knowledge-badge.service { background: #e8f5e9; color: #2e7d32; }
.knowledge-badge.case { background: #fce4ec; color: #c62828; }
.knowledge-badge.faq { background: #f3e5f5; color: #7b1fa2; }
.knowledge-badge.industry { background: #e0f2f1; color: #00695c; }
.knowledge-source { font-size: 11px; color: var(--color-text-secondary); }
.knowledge-title { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
.knowledge-content { font-size: 14px; line-height: 1.5; color: var(--color-text-secondary); margin-bottom: 8px; }
.knowledge-tags { margin-bottom: 8px; }
.knowledge-actions { display: flex; gap: 8px; }
.toggle-label { display: flex; align-items: center; gap: 4px; margin-left: auto; cursor: pointer; font-size: 12px; color: var(--color-text-secondary); }
.toggle-text { font-size: 12px; }

/* --- 全网搜索建库 --- */
.search-panel { margin-bottom: 16px; border: 1px solid var(--color-border); }
.search-progress { margin-top: 12px; }
.progress-bar { height: 4px; background: var(--color-bg-secondary); border-radius: 2px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--color-primary); border-radius: 2px; width: 30%; }
.progress-fill.animating { animation: progress-slide 1.5s ease-in-out infinite; }
@keyframes progress-slide {
  0% { width: 5%; }
  50% { width: 60%; }
  100% { width: 95%; }
}
.progress-text { font-size: 13px; color: var(--color-text-secondary); margin-top: 8px; }
.search-result { margin-top: 12px; }
.search-result-summary { padding: 10px 14px; background: #e8f5e9; border-radius: 6px; font-size: 14px; margin-bottom: 12px; }
.search-result-item { padding: 10px 14px; background: var(--color-bg-secondary); border-radius: 6px; margin-bottom: 8px; }
.search-result-item-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.confidence-badge { font-size: 11px; color: var(--color-text-secondary); background: var(--color-bg); padding: 2px 8px; border-radius: 10px; }
.search-result-item-title { font-size: 14px; font-weight: 600; }
.search-result-item-url { font-size: 12px; color: var(--color-text-secondary); margin-top: 2px; }
.search-result-item-url a { color: var(--color-primary); text-decoration: none; }
.search-result-item-url a:hover { text-decoration: underline; }

/* --- 关键词蒸馏 --- */
.distill-input-card { padding: 16px; margin-bottom: 16px; }
.distill-results { margin-top: 16px; }
.batch-actions { display: flex; align-items: center; gap: 12px; padding: 8px 12px; background: var(--color-bg-secondary); border-radius: 6px; margin-bottom: 12px; font-size: 13px; }
.distill-table-wrap { overflow-x: auto; }
.distill-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.distill-table th { text-align: left; padding: 8px 10px; border-bottom: 2px solid var(--color-border); color: var(--color-text-secondary); font-weight: 600; white-space: nowrap; }
.distill-table td { padding: 8px 10px; border-bottom: 1px solid var(--color-border); }
.distill-table tr.imported { opacity: 0.5; }
.distill-table tr.discarded { opacity: 0.4; text-decoration: line-through; }
.kw-cell { font-weight: 500; min-width: 150px; }
.rec-cell { max-width: 200px; color: var(--color-text-secondary); font-size: 12px; }
.comp-badge { padding: 1px 8px; border-radius: 4px; font-size: 11px; }
.comp-badge.low { background: #e8f5e9; color: #2e7d32; }
.comp-badge.medium { background: #fff3e0; color: #e65100; }
.comp-badge.high { background: #fce4ec; color: #c62828; }
.score-badge { display: inline-block; width: 36px; text-align: center; padding: 2px 0; border-radius: 4px; font-weight: 700; font-size: 13px; }
.score-badge.high { background: #e8f5e9; color: #2e7d32; }
.score-badge.medium { background: #fff3e0; color: #e65100; }
.score-badge.low { background: #fce4ec; color: #c62828; }
.status-text { font-size: 12px; }
.status-text.imported { color: #2e7d32; }
.status-text.discarded { color: #9e9e9e; }

@media (max-width: 768px) {
  .filter-bar { flex-direction: column; align-items: stretch; }
  .search-input { width: 100%; }
  .form-row { flex-direction: column; }
  .tabs { flex-wrap: wrap; }
  .tab { font-size: 12px; padding: 6px 10px; }
  .distill-table { font-size: 11px; }
  .distill-table th, .distill-table td { padding: 6px 4px; }
  .kw-cell { min-width: 100px; }
  .rec-cell { max-width: 120px; }
}
</style>
