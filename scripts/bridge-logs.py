"""
桥接日志聚合脚本 — 按 correlation_id 合并 Zimti 和智派两端日志

用法：
    python scripts/bridge-logs.py [--zimti LOGFILE] [--zhipai LOGFILE] [--last N]

默认读取：
    - Zimti: d:/zimti/logs/server.log
    - 智派: d:/project-lvyou/backend/logs/app.log

输出：按时间排序的合并日志链路
"""

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path


def parse_log_line(line: str) -> dict | None:
    """尝试解析 JSON 日志行"""
    line = line.strip()
    if not line:
        return None
    try:
        return json.loads(line)
    except json.JSONDecodeError:
        return None


def main():
    parser = argparse.ArgumentParser(description="桥接日志聚合")
    parser.add_argument("--zimti", default=r"d:\zimti\logs\server.log", help="Zimti 日志文件路径")
    parser.add_argument("--zhipai", default=r"d:\project-lvyou\backend\logs\app.log", help="智派日志文件路径")
    parser.add_argument("--last", type=int, default=20, help="只显示最近 N 条 correlation ID")
    parser.add_argument("--filter", type=str, default="", help="只显示包含此文本的 correlation ID")
    args = parser.parse_args()

    # 收集所有 correlation_id 相关的日志
    entries_by_cid = defaultdict(list)

    for log_path, service in [(args.zimti, "zimti"), (args.zhipai, "zhipai")]:
        path = Path(log_path)
        if not path.exists():
            print(f"[跳过] {service} 日志文件不存在: {log_path}")
            continue

        with open(path, encoding="utf-8") as f:
            for line in f:
                entry = parse_log_line(line)
                if not entry:
                    continue
                cid = entry.get("correlation_id", "")
                if cid:
                    entry["_service"] = service
                    entries_by_cid[cid].append(entry)

    if not entries_by_cid:
        print("没有找到包含 correlation_id 的日志条目")
        return

    # 按最后一个条目的时间排序，取最近的 N 条
    sorted_cids = sorted(
        entries_by_cid.keys(),
        key=lambda cid: entries_by_cid[cid][-1].get("timestamp", ""),
        reverse=True,
    )[: args.last]

    # 输出
    for cid in sorted_cids:
        if args.filter and args.filter not in cid:
            continue

        entries = sorted(
            entries_by_cid[cid],
            key=lambda e: e.get("timestamp", ""),
        )

        services = set(e.get("_service", "?") for e in entries)
        print(f"\n{'='*80}")
        print(f"Correlation ID: {cid}")
        print(f"服务: {', '.join(services)} | 条目数: {len(entries)}")
        print(f"{'='*80}")

        for e in entries:
            ts = e.get("timestamp", "?")[:19]
            svc = e.get("_service", "?")
            level = e.get("level", "?")
            msg = e.get("message", "")
            print(f"  {ts} [{svc}/{level}] {msg}")

    print(f"\n共 {len(sorted_cids)} 个 correlation ID")


if __name__ == "__main__":
    main()
