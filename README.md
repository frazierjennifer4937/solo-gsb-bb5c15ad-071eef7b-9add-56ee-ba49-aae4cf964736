# Hamilton 最大余数席位分配悖论核查工具

帮助编辑核查**阿拉巴马悖论**（Alabama paradox）的 Web 应用：录入若干地区的正整数人口与席位总数起止值，系统用 Hamilton 法（最大余数法）逐个席位总数计算配额、整数席位与余数，并扫描「总席位增加一个后，某地区反而失去席位」的情形。

## 功能

- 逐个总席位数计算：精确配额（分数）、整数席位、余数（分数）、余数排名、余数席位归属、最终席位
- 自动扫描并**高亮每一次阿拉巴马悖论**，变化前后结果并列展示（精确分数、余数排序、席位归属）
- 决胜规则：余数较大者优先 → 人口较多者优先 → 录入顺序较早者优先
- 全部计算基于 `fractions.Fraction` 精确分数，**不使用浮点排序**（小数仅为展示用、由整数运算精确舍入）
- 扫描跨度限制：**终止值 − 起始值 ≤ 500**
- 内置可复现示例，一键载入

## 快速启动（Docker，一条命令）

```bash
docker compose up --build
```

启动后访问：**http://localhost:8000**

如需更换宿主机端口（例如 9000）：

```bash
HOST_PORT=9000 docker compose up --build
```

然后访问 http://localhost:9000 。

## 本地开发（不用 Docker）

```bash
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

访问 http://localhost:8000 。运行测试：`python -m pytest tests/`。

## 配置

| 配置项 | 方式 | 默认值 | 说明 |
| --- | --- | --- | --- |
| 宿主机访问端口 | 环境变量 `HOST_PORT` | `8000` | 仅 docker compose 启动时生效 |
| 扫描跨度上限 | `app/main.py` 中 `MAX_SPAN` | `500` | 终止值 − 起始值的最大值 |
| 地区数量上限 | `app/main.py` 中 `MAX_REGIONS` | `100` | 单次请求最多地区数 |

## 内置可复现示例

点击页面「载入可复现示例」或调用 `GET /api/example`：

| 地区 | 人口 |
| --- | --- |
| 甲区 | 44 |
| 乙区 | 43 |
| 丙区 | 7 |
| 丁区 | 6 |

扫描范围 8 ~ 14（总人口 100）。在总席位 **10 → 11** 时触发悖论：

- 总席位 10：配额 22/5、43/10、7/10、3/5 → 席位 **4、4、1、1**
- 总席位 11：配额 121/25、473/100、77/100、33/50 → 席位 **5、5、1、0**

丁区由 1 席降为 0 席——总席位增加，它反而失去一席，即阿拉巴马悖论。

## API

### `POST /api/scan`

请求体：

```json
{
  "regions": [{"name": "甲区", "population": 44}, {"name": "乙区", "population": 43}],
  "start": 8,
  "end": 14
}
```

返回每个总席位数的完整分配结果（配额/余数的精确分数与小数展示值、余数排名、席位归属）以及 `paradoxes` 列表（每次悖论的 `from_seats`、`to_seats` 与失去席位的地区）。

### `GET /api/example`

返回内置示例输入，可直接作为 `/api/scan` 的请求体。

### `GET /api/health`

健康检查，返回 `{"status": "ok"}`。

## 项目结构

```
app/
  main.py            FastAPI 入口与 API
  hamilton.py        Hamilton 法精确计算核心（纯分数运算）
  static/
    index.html       页面
    style.css        样式
    app.js           前端逻辑
tests/test_hamilton.py  核心逻辑单元测试
Dockerfile
docker-compose.yml
requirements.txt
```
