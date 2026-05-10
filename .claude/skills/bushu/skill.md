---
name: bushu
description: 智派系统一键部署 - 执行部署脚本将代码推送到服务器
origin: project
---

# bushu - 智派系统一键部署

## 说明

执行智派系统的一键部署脚本，将当前代码推送到生产服务器并重启服务。

## 部署流程

1. **分支合并**（如果不在 main 分支）
2. **推送代码**到 GitHub（失败则使用 SCP 直传）
3. **同步代码**到服务器
4. **构建前端**
5. **重启后端服务**
6. **健康检查**

## 使用方法

```
/bushu
```

或带参数：

```
/bushu --skip-frontend   # 跳过前端构建
/bushu --backend-only    # 仅部署后端
```

## 数据库同步（强制步骤）

**每次部署必须同步数据库时**，SCP 前必须先执行 WAL checkpoint，否则服务器数据不一致。

原因：SQLite WAL 模式下，新写入存在 `.db-wal` 文件中，主 `.db` 文件不包含最新数据。SCP 只传 `.db` 会丢数据。

```bash
# 步骤1: checkpoint（合并WAL到主文件）
python -c "import sqlite3; conn=sqlite3.connect('backend/zhipai.db'); conn.execute('PRAGMA wal_checkpoint(TRUNCATE)'); conn.close()"

# 步骤2: 验证WAL已清空（应为0字节）
ls -la backend/zhipai.db-wal

# 步骤3: SCP上传（此时.db文件包含全部数据）
scp backend/zhipai.db root@39.97.59.179:/var/www/zhipai/backend/zhipai.db

# 步骤4: 重启后端（释放旧连接缓存）
ssh root@39.97.59.179 "pkill -f 'uvicorn main:app'; sleep 2; cd /var/www/zhipai/backend && nohup ./venv/bin/python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 > /tmp/zhipai.log 2>&1 &"
```

## 部署脚本位置

- 主脚本: `deploy/deploy.sh`
- 快速脚本: `deploy_now.sh`

## 服务器信息

- 服务器: root@39.97.59.179
- 项目目录: /var/www/zhipai
- 后端端口: 8000

## 部署完成后访问

- 客户端: http://39.97.59.179
- 旅行社: http://39.97.59.179/agency
- 管理后台: http://39.97.59.179/admin

## 日志

部署日志保存在: `~/.zhipai/deploy-logs/deploy-YYYYMMDD_HHMMSS.log`