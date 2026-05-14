---
name: recovery-guide
description: C 盘重装后的系统恢复步骤（Junction + 记忆重建）
metadata:
  type: reference
---

# 系统恢复指南

## C 盘重装后必做（3 分钟）

### 1. 克隆仓库
```bash
git clone https://github.com/lvdajiang/zimti.git D:\zimti
```

### 2. 重建记忆链接（关键）
```powershell
powershell -Command "New-Item -ItemType Junction -Path 'C:\Users\ladajiang\.claude\projects\d--zimti\memory' -Target 'D:\zimti\.claude\memory'"
```

### 3. 验证
```bash
ls C:/Users/ladajiang/.claude/projects/d--zimti/memory/MEMORY.md
```

## 原理
- 记忆文件实际存储在 `D:\zimti\.claude\memory\`（仓库内）
- `C:\Users\...\memory\` 是一个 Windows Junction 链接，指向仓库
- 记忆随 git commit 持久化到 GitHub
- 重装系统后只需重建 Junction 链接，记忆自动恢复

## 注意
- 创建 Junction 前，目标路径 `C:\Users\...\memory\` 必须不存在
- 如果已存在（Claude 自动创建了空目录），先 `rm -rf` 删除再创建链接
- .env 文件不纳入版本控制，重装后需手动配置
