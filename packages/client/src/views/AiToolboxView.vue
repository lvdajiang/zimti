<template>
  <div class="ai-toolbox">
    <div class="back-nav">
      <RouterLink to="/ai-studio" class="back-link">← 返回</RouterLink>
    </div>
    <h2 class="page-title">AI 工具箱</h2>
    <p class="page-desc">常用 AI 创作工具，点击卡片在新标签页中打开</p>

    <div class="category" v-for="cat in categories" :key="cat.name">
      <h3 class="category-title">{{ cat.name }}</h3>
      <div class="tool-grid">
        <a
          v-for="tool in cat.tools"
          :key="tool.name"
          :href="tool.url"
          target="_blank"
          rel="noopener noreferrer"
          class="tool-card"
        >
          <div class="tool-icon">{{ tool.icon }}</div>
          <div class="tool-info">
            <div class="tool-name">{{ tool.name }}</div>
            <div class="tool-desc">{{ tool.desc }}</div>
          </div>
          <span class="tool-arrow">↗</span>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const categories = [
  {
    name: 'AI 对话与推理',
    tools: [
      { name: 'DeepSeek', url: 'https://chat.deepseek.com', icon: '🧠', desc: '深度推理、长文本分析' },
      { name: 'Kimi', url: 'https://kimi.moonshot.cn', icon: '🌙', desc: '长文本处理、文档解读' },
      { name: '智谱清言', url: 'https://chatglm.cn', icon: '💬', desc: '智谱AI助手' },
      { name: '通义千问', url: 'https://tongyi.aliyun.com', icon: '✨', desc: '阿里AI助手' },
    ],
  },
  {
    name: 'AI 助手',
    tools: [
      { name: '豆包', url: 'https://www.doubao.com', icon: '🤖', desc: '字节跳动AI助手' },
      { name: 'ChatGPT', url: 'https://chat.openai.com', icon: '🟢', desc: 'OpenAI对话模型' },
      { name: 'Claude', url: 'https://claude.ai', icon: '🟠', desc: 'Anthropic AI助手' },
    ],
  },
  {
    name: '图片与视频生成',
    tools: [
      { name: '即梦 AI', url: 'https://jimeng.jianying.com', icon: '🎨', desc: 'AI图片/视频生成' },
      { name: 'Midjourney', url: 'https://www.midjourney.com', icon: '🖼️', desc: 'AI绘画工具' },
    ],
  },
  {
    name: '视频剪辑',
    tools: [
      { name: '剪映', url: 'https://www.capcut.cn', icon: '🎬', desc: '字节跳动视频剪辑' },
      { name: 'Canva', url: 'https://www.canva.com', icon: '📐', desc: '在线设计工具' },
    ],
  },
]
</script>

<style scoped>
.back-nav { margin-bottom: var(--space-3); }
.back-link { font-size: var(--font-size-sm); color: var(--color-text-secondary); text-decoration: none; }
.back-link:hover { color: var(--color-primary); }
.ai-toolbox {
  max-width: 960px;
}
.page-title {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 var(--space-1);
}
.page-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
  margin: 0 0 var(--space-6);
}
.category {
  margin-bottom: var(--space-6);
}
.category-title {
  font-size: var(--font-size-base);
  font-weight: 500;
  color: var(--color-text-secondary);
  margin: 0 0 var(--space-3);
}
.tool-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--space-3);
}
.tool-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-bg);
  border-radius: var(--radius);
  text-decoration: none;
  color: inherit;
  border: 1px solid var(--color-border-light);
  transition: box-shadow var(--transition), border-color var(--transition);
}
.tool-card:hover {
  border-color: #4fc3f7;
  box-shadow: 0 2px 8px rgba(79, 195, 247, 0.15);
}
.tool-icon {
  font-size: 28px;
  flex-shrink: 0;
}
.tool-info {
  flex: 1;
  min-width: 0;
}
.tool-name {
  font-size: var(--font-size-base);
  font-weight: 500;
  color: var(--color-text);
}
.tool-desc {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  margin-top: 2px;
}
.tool-arrow {
  color: var(--color-text-disabled);
  font-size: var(--font-size-lg);
  flex-shrink: 0;
}
.tool-card:hover .tool-arrow {
  color: #4fc3f7;
}
</style>
