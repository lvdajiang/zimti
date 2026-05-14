---
name: git-branches
description: 远程仓库 URL、分支列表、未提交变更
metadata: 
  node_type: memory
  type: reference
  originSessionId: 2ccade32-d359-46e2-8919-72ae80ae6593
---

# Git 分支状态

## 远程仓库
- **origin**: https://github.com/lvdajiang/zimti.git (fetch + push)
- 连接状态: 正常

## 本地分支
| 分支 | 说明 |
|------|------|
| **main** (当前) | 主分支，与 origin/main 同步 |
| work-0512-review-optimize | 审查优化工作分支 |

## 远程分支
- remotes/origin/main
- remotes/origin/work-0512-review-optimize
- remotes/origin/HEAD → origin/main

## 当前未提交变更
- .claude/skills/everything-claude-code (untracked content, submodule)

## 最近提交 (2026-05)
1. e587b90 feat(client): 全站添加使用指引帮助提示（14个页面）
2. a38fc9c fix(client): 选题工作台编辑脚本时先创建脚本再跳转
3. d5e94ab fix(shared): API 常量去掉 /api/v1 前缀
4. 53fcfe5 fix(client): 视频预览路由 scriptId 改为可选参数
5. 1f4cd91 fix(client): 视频预览侧边栏去掉硬编码 scriptId
6. 4e4ea61 fix(server): 视频预览端点支持 scriptId 整数查询
7. 2064b69 feat(client): 侧边栏添加视频预览快捷入口
8. ba6bb71 feat(client): 视频预览播放器+渲染进度+时间轴交互
9. 43cfa75 fix(client): 接通内容资产素材复用和脚本复用功能
10. 34cf45a feat: 新增创作者知识库全栈功能
