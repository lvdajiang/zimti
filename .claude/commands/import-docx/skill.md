---
name: import-docx
description: 导入Word行程文档(.docx)自动转化为产品模板（解析→构建→入库→验证）
origin: project
---

# 导入Word行程文档为模板 `/import-docx`

> **使用场景**：把旅行社提供的 Word 行程文档（.docx）自动转化为系统中的产品模板
> **核心能力**：解析文档表格 → 智能识别行程结构 → 构建标准化产品数据 → 入库 + 验证

## 用法

```
/import-docx                                    # 交互式：选择文件
/import-docx 开发文档/xxx/北疆16日游.docx        # 直接指定文件路径
```

## 前置条件

- 需要安装 `python-docx`：`pip install python-docx`
- 后端服务需要运行（用于验证）
- 数据库文件：`backend/zhipai.db`

---

## 执行步骤

### 步骤1：确认文件并解析

**目标**：读取 .docx 文件，提取所有表格内容。

执行命令：
```bash
python -c "
import sys
sys.stdout.reconfigure(encoding='utf-8')
from docx import Document
doc = Document('文件路径')
# 打印所有段落
for i, para in enumerate(doc.paragraphs):
    if para.text.strip():
        print(f'P{i}: {para.text}')
# 打印所有表格
for ti, table in enumerate(doc.tables):
    print(f'\n=== 表格{ti}: {len(table.rows)}行 x {len(table.columns)}列 ===')
    for ri, row in enumerate(table.rows):
        cells = [cell.text.strip().replace(chr(10), ' ') for cell in row.cells]
        print(f'  行{ri}: {cells}')
"
```

**解析规则**：
1. **行程简版表格**（通常是第一个表格）：列 = 天数 | 日期 | 抵离城市 | 行程内容 | 餐食 | 酒店
   - 提取每天的：day_num、路线（起点→终点）、景点概要、酒店
2. **行程详版表格**（后续表格）：列 = 日期 | 行程详版
   - 提取每天的：景点详细描述、温馨提示、餐食住宿信息

### 步骤2：确认产品信息

**必须向用户确认**：
1. **产品名称**：从文件名或内容提取，如 `【春染西域】北疆汽车环线16日游详版`
2. **产品定位**：从以下选项选择：跟团游 | 自由行 | 商务团 | 高端团 | 普通团 | 研学团 | 亲子团 | 定制团
3. **设计师**：从文件夹名或内容推断，需确认
4. **总天数**：从简版表格行数自动计算
5. **是否标记为模板**：默认是

**输出格式**：
```
📋 产品信息确认
- 产品名称：[名称]
- 产品定位：[定位]
- 设计师：[设计师]
- 总天数：[N]天
- 标记为模板：是

请确认以上信息是否正确？
```

### 步骤3：构建行程数据

**核心规则**：每天拆成多个动作行，每行有具体时间点。

**动作类型（下拉选项，必须使用以下之一）**：
```
接机 | 送机 | 接站 | 送站 | 出发 | 抵达 | 集合整队 | 乘车前往
游览 | 参观 | 导游讲解 | 景点拍照 | 自由活动 | 购物
早餐 | 午餐 | 晚餐 | 办理入住
```

**数据结构**：
```python
# 每天的动作列表
(day_num, [
    # 第1条：00:00 标题行，存储 day_title
    ("00:00", "", "起点", "终点", "DAYTITLE:一天的行程内容概要"),
    # 后续：具体时间点的动作
    ("07:00", "早餐", "", "", "酒店早餐"),
    ("08:00", "出发", "城市A", "", "前往XXX"),
    ("10:00", "参观", "", "", "景点描述"),
    ("12:00", "午餐", "", "", "自理"),
    ("18:00", "办理入住", "", "城市B", "入住XXX酒店"),
])
```

**时间分配规则**：
- `07:00` — 早餐（如有）
- `08:00` — 出发/乘车前往
- `09:00-17:00` — 参观/游览/景点拍照（根据景点数量均匀分配）
- `12:00` — 午餐（如有）
- `18:00-20:00` — 办理入住
- 特殊：接机/送机根据航班时间

**day_title（行程内容）规则**：
- 从简版表格的"行程内容"列提取
- 格式示例：`参观天山天池，途观S21沙漠公路、古尔班通古特沙漠`
- 不要太长，概括当天主要活动即可

**description（说明）规则**：
- 从详版表格提取景点描述，存到对应"参观"/"游览"动作的 description 字段
- 用 `【景点名】` 格式开头
- 温馨提示可追加到当天最后一个动作的 description 或单独一条

### 步骤4：写入数据库

执行命令模板：
```python
import sqlite3
from datetime import datetime
import uuid

conn = sqlite3.connect('backend/zhipai.db')
cursor = conn.cursor()

# 生成产品编号
date_str = datetime.now().strftime("%Y%m%d%H%M%S")
unique_suffix = uuid.uuid4().hex[:6].upper()
product_id = f"PRD{date_str}{unique_suffix}"

# 插入产品
cursor.execute("""
    INSERT INTO products (product_id, product_name, positioning, designer, total_days, discount_factor, is_template, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1.0, ?, datetime('now'), datetime('now'))
""", (product_id, product_name, positioning, designer, total_days, is_template))

# 插入行程
for day_num, actions in days_data:
    for time, action, start_point, end_point, description in actions:
        cursor.execute("""
            INSERT INTO product_itineraries (product_id, day, time, start_point, end_point, action, resource_ids, description, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, '', ?, datetime('now'), datetime('now'))
        """, (product_id, day_num, time, start_point, end_point, action, description))

conn.commit()
conn.close()
```

### 步骤5：验证

1. **数据库验证**：
```sql
SELECT day, time, action, start_point, end_point
FROM product_itineraries WHERE product_id=?
ORDER BY day, time
```

2. **API验证**（需要后端运行）：
```bash
# 登录获取token，然后查询
curl -s http://localhost:8000/api/v1/products/batch/details
```

3. **前端验证**：打开 `http://localhost:3002/client/template` 确认展示效果

### 步骤6：输出报告

```
✅ 模板导入完成

产品信息：
- 编号：PRD...
- 名称：【XXX】...
- 定位：跟团游
- 天数：16天
- 行程条数：112条

行程概要：
  D1  出发地→乌鲁木齐    | 接机,入住酒店,自由活动
  D2  乌鲁木齐→北屯      | 天山天池,S21沙漠公路
  D3  北屯→布尔津        | 五彩滩,网红桥
  ...

查看效果：http://localhost:3002/client/template
```

---

## 特殊情况处理

### 文档格式不标准时

| 情况 | 处理方式 |
|:-----|:---------|
| 没有简版表格 | 从详版表格的路线信息推断 |
| 没有详版表格 | 仅使用简版数据，description留空 |
| 天数不连续 | 按实际行数编号 |
| 费用包含/不含信息 | 追加到最后一天的 description 中 |
| 酒店参考信息 | 追加到最后一天或单独存储 |
| 门票信息 | 追加到最后一天的 description 中 |

### 同名产品检查

写入前检查是否已有同名产品：
```sql
SELECT product_id FROM products WHERE product_name = ?
```
如有，提示用户是否覆盖（删除旧的，创建新的）。

---

## 注意事项

1. **动作类型必须使用预定义列表**中的值，不能随意填写
2. **day_title 必须使用 `DAYTITLE:` 前缀**，前端依赖此格式解析
3. **description 长度限制为 5000 字符**（schema已放宽）
4. **每天第一条记录固定为 `00:00` 标题行**，action留空
5. **路线信息（start_point/end_point）**只在"出发"/"乘车前往"/"接机"/"送机"等移动类动作填写，其他动作留空
