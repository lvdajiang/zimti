---
name: import-excel
description: Excel数据结构化导入 - 传统公司Excel→结构化数据的完整流程
type: project
category: 数据导入
priority: high
---

# Excel数据结构化导入 `/import-excel`

> **来源**: 2026-04-26 酒店协议总表清洗 + 2026-04-27 景区门票导入的实战经验
> **核心理念**: 传统公司数字化的最大障碍不是技术，而是混乱的人脑表格 → 结构化数据的鸿沟
> **成功率**: 酒店数据97.7%自动解析 + 门票数据99.2%自动解析

---

## 使用场景

当你需要将传统公司的Excel文件导入数据库时使用：
- 旅行社：酒店协议/门票价格/车辆资源
- 零售：商品清单/供应商报价
- 制造：BOM清单/物料价格
- 任何"Excel表格 → 结构化数据"的需求

## 核心原则

1. **先分析，不承诺** - 拿到Excel不要说"没问题"，先输出数据形状报告
2. **用户预清洗不可替代** - 程序能处理格式不统一，但无法处理语义混乱
3. **先统计后编码** - 用Counter分析覆盖率，识别变体，一次性设计规则链
4. **模型确定再写代码** - "一个X拆成几个Y"决定了整个数据架构
5. **接受不完美** - 97%自动+3%人工 = 100%覆盖，不要追求100%自动化

---

## 执行流程（6步）

### 步骤1：接收Excel，输出基础信息

**动作**：读取Excel，不承诺能解析，先输出基础信息

```python
import openpyxl

def analyze_excel_structure(path: str):
    wb = openpyxl.load_workbook(path, read_only=True)
    print(f"📄 文件: {path}")
    print(f"📊 Sheet数量: {len(wb.sheetnames)}")
    print(f"📋 Sheet名: {wb.sheetnames}")

    for name in wb.sheetnames:
        ws = wb[name]
        print(f"\n  Sheet: {name}")
        print(f"    行数: {ws.max_row}, 列数: {ws.max_column}")

        # 检测合并单元格
        if hasattr(ws, 'merged_cells'):
            merged = len(ws.merged_cells.ranges)
            print(f"    合并单元格: {merged}个 {'✓ 需要前向填充' if merged > 0 else '✓ 无合并'}")

    wb.close()
```

**向用户确认**：
- "这是全部数据吗？有没有其他关联文件？"
- "哪个Sheet是主数据？其他Sheet是什么含义？"
- "每一列分别代表什么？"（即使有表头，也要确认）

---

### 步骤2：数据形状分析（核心步骤）

**目标**：在写任何代码之前，先用统计手段理解数据分布

```python
from collections import Counter
import re

def analyze_data_distribution(rows: list[dict], column_names: list[str]):
    total = len(rows)
    print(f"\n📊 数据形状分析（共{total}行）")

    for col_idx, col_name in enumerate(column_names, 1):
        values = [row.get(col_name, '') for row in rows]
        non_empty = sum(1 for v in values if v and v != 'null')

        print(f"\n  列{col_idx}({col_name}):")
        print(f"    非空率: {non_empty}/{total} = {non_empty/total:.1%}")

        if non_empty == 0:
            continue

        # 离散值检测（<=30种则列举）
        unique = set([v for v in values if v])
        if len(unique) <= 30:
            print(f"    值域 ({len(unique)}种):")
            for val, cnt in Counter(values).most_common(10):
                print(f"      {val}: {cnt}")
        else:
            print(f"    值域过多 ({len(unique)}种)，分析格式分布...")

        # 根据列类型分析格式分布
        if '价' in col_name or 'price' in col_name.lower():
            analyze_price_column(values)
        elif '型' in col_name or 'spec' in col_name.lower():
            analyze_spec_column(values)
```

**分析完成后输出报告**：
```
📊 数据形状分析报告
- 总行数: 4842，有效数据行: ~1885
- 合并单元格: 有（B/C/A列需要前向填充）
- 主数据列(E-团队价)格式分布:
  - 房型+价格: 97.7% ✅ 可自动解析
  - 询价类: 0.1% → 标记跳过
  - 其他变体: 2.2% → 需要补充规则
- 库存列覆盖率: 13.2%（大部分为空，只取有值的行）
```

---

### 步骤3：用户预清洗指导

**判断标准**：如果一列中超过5%的行含义与其他行不同，就必须拆分

**向用户明确说明**：
```
我发现以下列存在"一列多义"问题，需要您先在Excel中拆分：
- H列("免房政策"): 同时包含免房政策、加床类型、司陪房信息
- M列("详情"): 同时包含早餐、酒店设施、温泉信息

建议拆分为：
- H列: 免房政策（保留）
- I列: 加床类型（从H/M中提取）
- J列: 司陪房（从H/K中提取）
- K列: 司陪价格
- L列: 酒店信息（清理非酒店内容）
- M列: 保留
- N列: 早餐状态
- O列: 早餐价格

另外：合并单元格需要解除，空值请统一填"null"。
```

**等待用户完成预清洗后再继续**

---

### 步骤4：业务模型确认

**在写导入脚本之前，必须确认以下问题**：

```
📋 业务模型确认清单

1. 实体定义
   - Excel中一行代表什么？（一个酒店？一个产品？一个订单？）
   - 多行同实体如何识别？（酒店名列相同？编号列相同？）
   - 实体的唯一标识是什么？（名称？编号？名称+区域组合？）

2. 资源拆解
   - 一个实体拆成几个资源？拆解维度是什么？
   - 哪些维度影响价格？（季节？客源？规格？）
   - 没有价格的维度怎么处理？（跳过？标记？创建但价格为0？）
   - 哪些信息是标签（不影响成本），哪些是资源属性（参与运算）？

3. 特殊值处理
   - "询价"/"面议"/"同价"分别怎么处理？
   - 加价公式（团队价+20）怎么计算？
   - 折扣公式（8.5折）需要基准价吗？基准价从哪来？
   - 倍数定价（1.5倍标间价格）需要跨行引用吗？

4. 附加信息
   - 附加服务（早餐/加床/司陪等）作为独立资源还是挂在主资源上？
   - 销售规则（免房/成团数）存哪里？JSON字段还是独立表？
   - 标签信息从哪些列提取？
```

**标签准入四原则**（判断某字段是标签还是资源/属性）：
1. 布尔值（有/无）→ 标签
2. 唯一分类值（星级/钻级）→ 标签
3. 不参与运算 → 标签
4. 不影响成本 → 标签

反例：
- 库存数量 → 资源属性（参与运算）
- 价格 → 资源核心字段
- 免房政策（买N送M）→ 销售规则（不是标签也不是资源）

---

### 步骤5：生成导入脚本

**标准6模块结构**：

```
scripts/import_{业务名}/
├── config.py        # 列映射 + 正则 + 常量 + 业务规则（换Excel只改这里）
├── excel_reader.py  # 读取 + 前向填充 + yield结构化行
├── {业务}_parser.py # 文本→结构化（正则+规则链+fallback）
├── db_writer.py     # 去重 + 写入 + 统计查询
├── tag_importer.py  # 标签提取 + 关联写入
├── main.py          # 编排: 读取→解析→去重→写入→报告
└── __init__.py
```

**config.py 模板**：
```python
"""配置文件 - 换Excel只改这里"""

# ==================== 列映射 ====================
COL_MAPPING = {
    1: 'entity_name',      # 酒店名/景区名
    2: 'star_level',       # 星级
    3: 'region',           # 区域
    4: 'season',           # 季节
    5: 'team_price',       # 团队价
    6: 'stock',            # 库存
    # ...
}

# ==================== 需要前向填充的列 ====================
FORWARD_FILL_COLS = {1, 2, 3}  # 列号集合

# ==================== 正则表达式 ====================
RE_PRICE = r'([一-鿿/·\s]+)(\d+(?:\.\d+)?)'
RE_NUMBER = r'\d+(?:\.\d+)?'

# ==================== 关键词列表 ====================
INQUIRY_KEYWORDS = ['现询价', '面议', '询价', '同价', '单团单议']
SKIP_KEYWORDS = ['暂无', '无', 'null', '-']

# ==================== 分类映射 ====================
SPEC_MAPPING = {
    '标': '标间', '双标': '标间', '双床': '标间',
    '单': '单间', '大床': '单间', '豪单': '单间',
    '三': '三人间', '亲': '亲子间', '套': '套房',
}

# ==================== 业务常量 ====================
PARTNER_ID = 'PARTNER_001'  # 合作方ID
DEFAULT_REGION = '新疆'
```

**excel_reader.py 模板**：
```python
"""Excel读取 + 前向填充"""
import openpyxl
from dataclasses import dataclass
from typing import Iterator

@dataclass
class RawRow:
    sheet: str
    row_num: int
    data: dict

def read_excel(path: str) -> Iterator[RawRow]:
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    prev = {}

    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=False), start=2):
            vals = {c.column: c.value for c in row if c.value is not None}

            # 前向填充
            for col in FORWARD_FILL_COLS:
                if col in vals:
                    prev[col] = vals[col]
                else:
                    vals[col] = prev.get(col, '')

            yield RawRow(sheet=sheet_name, row_num=row_idx, data=vals)

    wb.close()
```

**规则链解析模板**：
```python
"""通用解析模式：预处理→主正则→扩展→fallback→兜底"""
import re
from typing import list, tuple

def parse_field(text: str) -> list[tuple]:
    if not text or text in SKIP_KEYWORDS:
        return []

    # 1. 预处理
    text = preprocess(text)

    # 2. 主正则匹配
    results = RE_PRICE.findall(text)
    if results:
        return expand_results(results)

    # 3. fallback
    results = fallback_parse(text)
    if results:
        return results

    # 4. 兜底
    return []

def preprocess(text: str) -> str:
    """去括号注释、去单位后缀、合并空格"""
    text = re.sub(r'【.*?】', '', text)  # 去括号
    text = re.sub(r'元/间|元/位|元/床', '', text)  # 去单位
    text = re.sub(r'\s+', ' ', text).strip()  # 合并空格
    return text
```

**去重模式**（必须内存去重）：
```python
seen: set[tuple] = set()
for item in items:
    key = (item.entity_id, item.spec, item.season, item.customer_type)
    if key in seen:
        stats['dedup'] += 1
        continue
    seen.add(key)
    writer.insert(item)
```

---

### 步骤6：验证与报告

**导入后必须执行的验证**：

```python
def print_report(stats: dict, cursor):
    print("\n" + "=" * 60)
    print("  📊 导入报告")
    print("=" * 60)
    print(f"  处理行数: {stats['total_rows']}")
    print(f"  创建实体: {stats['entities']}")
    print(f"  创建资源: {stats['resources']}")
    print(f"  去重跳过: {stats['dedup']}")
    print(f"  解析失败: {stats['fail']} {'⚠️' if stats['fail'] > 0 else '✓'}")

    if stats['fail'] > 0:
        print(f"\n  ⚠️ 解析失败清单（需人工复核）:")
        for row_info in stats['fail_rows'][:10]:
            print(f"    {row_info}")

    print(f"\n  抽样验证:")
    samples = cursor.execute("SELECT * FROM resources LIMIT 15").fetchall()
    for s in samples:
        print(f"    {s}")
    print("=" * 60)
```

**验证通过标准**：
- 解析失败率 < 5%（超过5%说明规则链不够完善）
- 去重率 < 30%（超过30%说明分组逻辑有问题）
- 抽样20条全部格式正确

---

## 常见混乱模式（9类）

| 模式 | 特征 | 处理策略 | 案例 |
|------|------|---------|------|
| **合并单元格** | 首行有值，后续行为空 | 前向填充 | 酒店名/星级/区域 |
| **一列多义** | 同一列不同行含义不同 | 用户预清洗拆列 | H列(免房+加床+司陪) |
| **格式碎片化** | 同一语义有多种格式变体 | 正则+规则链+fallback | 团队价20+种变体 |
| **数字混文本** | 价格/数量/月份混在一起 | 提取后上下文过滤 | 司陪价格中的房量数字 |
| **缩写/简称** | 行业术语，外人看不懂 | 建立映射表 | 商单=商务大床房 |
| **空值不统一** | 有的空，有的"无"，有的"null" | 统一为空字符串或"null" | 全部填"null" |
| **Sheet内多段结构** | 一个Sheet内有多套列布局 | 检测分隔行+分段解析 | 加点Sheet内4段不同结构 |
| **多Sheet异构** | 每个Sheet列布局不同 | 每Sheet独立列映射+解析函数 | 门票8个Sheet每个不同 |
| **旧数据命名冲突** | 历史脚本用了不同的类型名 | 清理时包含所有历史别名 | '门票' vs '票' 导致重复计数 |

---

## 反模式清单（绝对不要做的事）

| 反模式 | 为什么错 | 正确做法 |
|--------|---------|---------|
| 拿到Excel就写正则 | 必然返工 | 先统计后编码 |
| 用户说"能解析就解析"就开始写 | 用户不知道数据有多乱 | 先输出数据形状报告 |
| 用 pandas read_excel | 会丢失合并单元格信息 | 用 openpyxl load_workbook(read_only=True) |
| 追求100%自动化 | 最后2%的代码量超过前98% | 97%自动+3%标记人工 |
| 用数据库UNIQUE做去重 | 逐条检查约束，极慢 | 内存set去重 |
| 不写统计报告 | 导入完不知道对不对 | 必须输出完整统计+抽样+失败清单 |
| 一列多义时不拆 | 程序无法判断"这行写的是什么" | 要求用户预清洗，每列一个维度 |
| 硬编码散客价=团队价 | 用户说"这不合逻辑" | 没有散客价就不创建散客资源 |
| 一个文件塞所有逻辑 | 难以维护和复用 | 6模块分离 |
| 前向填充不验证 | 数字被当成景区名等脏数据 | 填充后加业务约束验证 |

---

## 快速参考：命令清单

```bash
# 1. 分析Excel结构
python scripts/import_xxx/analyze.py 2026协议.xlsx

# 2. 执行导入
python scripts/import_xxx/main.py 2026协议_清洗后.xlsx

# 3. 验证结果
python scripts/import_xxx/verify.py
```

---

## 参考案例

- **酒店导入**：`backend/scripts/import_hotel_v3/` - 1687酒店/69998资源
- **门票导入**：`backend/scripts/import_ticket_v3/` - 330资源/99.2%自动解析
- **详细经验文档**：`开发文档/Excel数据结构化经验教训总结.md`
