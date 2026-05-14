#!/bin/bash
# ============================================================
# setup-dev.sh — Windows 重装后一键恢复开发环境
#
# 使用方法：
#   1. 先装好 Windows + 基础驱动
#   2. 打开 PowerShell（管理员），运行：
#      Set-ExecutionPolicy Bypass -Scope Process -Force
#      irm https://winget.azureedge.net/ps/Get-Winget.ps1 | iex
#   3. 打开 Git Bash，运行：
#      git clone https://github.com/lvdajiang/zimti.git D:\zimti
#      cd D:\zimti
#      bash scripts/setup-dev.sh
#
# 更新日期: 2026-05-14
# ============================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ============================================================
# 阶段 1: 核心工具
# ============================================================

echo ""
echo "============================================"
echo "  阶段 1/5: 安装核心工具"
echo "============================================"

# Node.js LTS
if command -v node &>/dev/null; then
  log "Node.js $(node --version) 已安装"
else
  warn "winget install OpenJS.NodeJS.LTS"
  winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
  log "Node.js 安装完成（需要重新打开终端生效）"
fi

# pnpm
if command -v pnpm &>/dev/null; then
  log "pnpm $(pnpm --version) 已安装"
else
  warn "winget install pnpm.pnpm"
  winget install --id pnpm.pnpm -e --accept-package-agreements --accept-source-agreements
  log "pnpm 安装完成"
fi

# Git
if command -v git &>/dev/null; then
  log "Git $(git --version | awk '{print $3}') 已安装"
else
  warn "winget install Git.Git"
  winget install --id Git.Git -e --accept-package-agreements --accept-source-agreements
  log "Git 安装完成"
fi

# Docker Desktop
if command -v docker &>/dev/null; then
  log "Docker $(docker --version | awk '{print $3}' | tr -d ',') 已安装"
else
  warn "winget install Docker.DockerDesktop"
  winget install --id Docker.DockerDesktop -e --accept-package-agreements --accept-source-agreements
  log "Docker Desktop 安装完成（需要重启电脑）"
fi

# Git LFS
if git lfs version &>/dev/null; then
  log "Git LFS $(git lfs version | awk '{print $1}' | tr -d ',') 已安装"
else
  warn "winget install GitHub.GitLFS"
  winget install --id GitHub.GitLFS -e --accept-package-agreements --accept-source-agreements
  log "Git LFS 安装完成"
fi

# ============================================================
# 阶段 2: VS Code + 扩展
# ============================================================

echo ""
echo "============================================"
echo "  阶段 2/5: VS Code + 扩展"
echo "============================================"

CODE="/d/anz/Microsoft VS Code/bin/code"

if [ -f "$CODE" ]; then
  log "VS Code 已安装"

  # 扩展列表
  extensions=(
    "anthropic.claude-code"
    "vue.volar"
    "ms-python.python"
    "ms-python.debugpy"
    "ms-python.vscode-python-envs"
    "mhutchie.git-graph"
    "eamodio.gitlens"
    "donjayamanne.githistory"
    "ms-ceintl.vscode-language-pack-zh-hans"
    "github.vscode-pull-request-github"
    "github.vscode-github-actions"
    "jackiotyu.git-worktree-manager"
    "philstainer.git-worktree"
    "ghmeier.wt-color"
    "highagency.pencildev"
    "0x0bke.pencil-zh-patch"
    "Prisma.prisma"
    "usernamehw.errorlens"
    "yoavbls.pretty-ts-errors"
    "dbaeumer.vscode-eslint"
    "esbenp.prettier-vscode"
    "EditorConfig.EditorConfig"
  )

  for ext in "${extensions[@]}"; do
    "$CODE" --install-extension "$ext" --force 2>/dev/null && log "扩展: $ext" || warn "扩展安装失败: $ext"
  done

  log "VS Code 扩展安装完成（共 ${#extensions[@]} 个）"
else
  warn "VS Code 未安装，请从 https://code.visualstudio.com/ 手动安装到 D:\\anz\\"
  warn "安装后重新运行此脚本以安装扩展"
fi

# ============================================================
# 阶段 3: Git 配置
# ============================================================

echo ""
echo "============================================"
echo "  阶段 3/5: Git 配置"
echo "============================================"

git config --global user.name "lvdajiang"
git config --global user.email "143974833+lvdajiang@users.noreply.github.com"
git config --global safe.directory "*"
log "Git 用户配置完成"

if git lfs version &>/dev/null; then
  git config --global filter.lfs.process "git-lfs filter-process"
  git config --global filter.lfs.required true
  git config --global filter.lfs.clean "git-lfs clean -- %f"
  git config --global filter.lfs.smudge "git-lfs smudge -- %f"
  log "Git LFS 配置完成"
fi

# ============================================================
# 阶段 4: Claude Code + 记忆链接
# ============================================================

echo ""
echo "============================================"
echo "  阶段 4/5: Claude Code + 记忆链接"
echo "============================================"

# Claude Code (npm 全局)
if command -v claude &>/dev/null; then
  log "Claude Code 已安装"
else
  warn "npm install -g @anthropic-ai/claude-code"
  npm install -g @anthropic-ai/claude-code
  log "Claude Code 安装完成"
fi

# 记忆链接 — Claude 期望的路径
MEMORY_LINK="C:/Users/ladajiang/.claude/projects/d--zimti/memory"
MEMORY_TARGET="D:/zimti/.claude/memory"

if [ -L "$MEMORY_LINK" ]; then
  log "记忆链接已存在"
elif [ -d "$MEMORY_LINK" ]; then
  warn "记忆目录已存在（非链接），删除并重建..."
  rm -rf "$MEMORY_LINK"
  powershell -Command "New-Item -ItemType Junction -Path 'C:\Users\ladajiang\.claude\projects\d--zimti\memory' -Target 'D:\zimti\.claude\memory'" 2>/dev/null
  log "记忆 Junction 链接创建成功"
elif [ -f "$MEMORY_TARGET/MEMORY.md" ]; then
  mkdir -p "$(dirname "$MEMORY_LINK")"
  powershell -Command "New-Item -ItemType Junction -Path 'C:\Users\ladajiang\.claude\projects\d--zimti\memory' -Target 'D:\zimti\.claude\memory'" 2>/dev/null
  log "记忆 Junction 链接创建成功"
else
  warn "记忆文件不存在（$MEMORY_TARGET），跳过链接创建"
fi

# ============================================================
# 阶段 5: 项目依赖
# ============================================================

echo ""
echo "============================================"
echo "  阶段 5/5: 项目依赖"
echo "============================================"

if [ -d "D:/zimti/node_modules" ]; then
  log "node_modules 已存在，跳过安装"
else
  warn "pnpm install（可能需要几分钟）..."
  cd D:/zimti && pnpm install
  log "项目依赖安装完成"
fi

# ============================================================
# 完成
# ============================================================

echo ""
echo "============================================"
echo -e "  ${GREEN}开发环境恢复完成！${NC}"
echo "============================================"
echo ""
echo "还需要手动完成："
echo "  1. 生成 SSH Key:  ssh-keygen -t ed25519 -C '143974833+lvdajiang@users.noreply.github.com'"
echo "     然后添加到 GitHub: https://github.com/settings/keys"
echo ""
echo "  2. 配置 .env 文件:"
echo "     cp packages/server/.env.example packages/server/.env"
echo "     cp packages/client/.env.example packages/client/.env"
echo "     然后填入 API Key（GLM/Pexels/即梦/OpenAI）"
echo ""
echo "  3. 确认 PostgreSQL 已安装并运行，创建数据库:"
echo "     createdb zimti"
echo ""
echo "  4. 运行数据库迁移:"
echo "     cd D:/zimti && npx prisma db push"
echo ""
echo "  5. VS Code 登录 GitHub 账号（Settings Sync 会自动恢复设置）"
echo ""
