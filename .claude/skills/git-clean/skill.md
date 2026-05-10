---
name: git-clean
description: Git 清理 - 分支+进程+stash 一键清理
origin: project
---

# Git 清理 `/git-clean`

> **使用场景**：分支堆积、端口被占、stash 太多、git 状态混乱时。
> **目标**：一键诊断并清理 Git 相关的各类垃圾状态。

当用户调用 `/git-clean` 时，按以下清单逐项检查和清理。

---

## 检查清单

### 1. 僵尸进程
```bash
# 检查端口占用
netstat -ano | grep -E ':8000|:3000|:3001|:3002|:3003'
# 检查 Python uvicorn 残留
ps aux | grep uvicorn | grep -v grep
# 检查 Node 残留
ps aux | grep -E 'vite|node' | grep -v grep
```
**操作**：列出占用的 PID，询问用户是否 kill。

### 2. 分支清理
```bash
# 查看所有分支及最后提交时间
git branch -v --sort=-committerdate
# 查看已合并到 main 的分支
git branch --merged main
```
**操作**：
- 标记已合并但仍存在的分支 → 询问是否删除
- 标记超过 7 天无提交的分支 → 询问是否删除
- **不删除**当前分支和 main 分支

### 3. Stash 清理
```bash
git stash list
```
**操作**：
- 列出所有 stash 及创建时间
- 超过 7 天的 stash 建议清理
- 询问用户哪些要保留、哪些丢弃

### 4. 未跟踪文件
```bash
git status --short | grep '^??'
```
**操作**：
- 列出未跟踪文件（排除 .env、node_modules、.db 等）
- 不自动删除，只列出供用户决策

### 5. 工作区状态
```bash
git status --short
git diff --stat
```
**操作**：
- 列出已修改未暂存的文件
- 列出已暂存未提交的文件
- 提醒用户是否有未完成的工作需要提交

---

## 输出格式

```
🧹 Git 清理报告

### 僵尸进程
- PID 12345 占用端口 8000（uvicorn）→ 建议 kill
- 端口 3001 空闲 ✅

### 分支（共 8 个）
- 已合并可删除：feature/old-thing, fix/xxx（2个）
- 超过7天无活动：work-0420-test（1个）
- 活跃分支：main, work-0424-admin-refactor（当前）

### Stash（共 3 个）
- stash@{0}: WIP on main (2天前) → 保留
- stash@{1}: WIP on feat-xxx (15天前) → 建议清理
- stash@{2}: WIP on old (30天前) → 建议清理

### 未跟踪文件
- backend/_tag_check.txt
- frontend/temp.vue

### 工作区
- 已修改未暂存：3 个文件
- 已暂存未提交：1 个文件

需要我执行哪些清理？
```

---

## 注意事项

- **不自动删除任何东西**，只列出并建议，等用户确认后执行
- 删除分支用 `git branch -d`（安全模式），不用 `-D`
- 删除 stash 用 `git stash drop`
- kill 进程前确认不是正在使用的服务
