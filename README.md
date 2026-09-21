# 最大余数席位分配悖论核查工具

一个帮助编辑核查 **Hamilton / 最大余数法（Largest Remainder Method）** 中 **阿拉巴马悖论（Alabama Paradox）** 的 Web 应用。

用户录入各地区正整数人口和席位起止值后，系统逐个总席位计算：

- 精确配额 `地区人口 × 总席位 ÷ 总人口`；
- 配额的整数席位；
- 精确余数及余数排序；
- 哪些地区获得剩余席位；
- 总席位增加 1 个后，是否有地区反而失去席位。

后端使用 Python `fractions.Fraction` 保存和比较所有比例，**不使用浮点数排序**。前端只渲染后端返回的精确分数。

## 一条命令启动

要求安装 Docker 与 Docker Compose 插件。

```bash
docker compose up --build
```

启动后访问：

- 地址：<http://localhost:8000>
- 健康检查：<http://localhost:8000/api/health>
- OpenAPI 文档：<http://localhost:8000/docs>

后台运行：

```bash
docker compose up --build -d
```

查看日志：

```bash
docker compose logs -f
```

停止：

```bash
docker compose down
```

## 配置

默认容器监听 `8000`，宿主机也映射到 `8000`。

如果宿主机 `8000` 端口已被占用，可在启动时改端口：

```bash
HOST_PORT=8080 docker compose up --build
```

然后访问 <http://localhost:8080>。

也可以创建 `.env` 文件：

```env
HOST_PORT=8080
```

## 可复现示例

点击页面上的 **“载入可复现示例”**，将填入：

| 录入顺序 | 地区 | 人口 |
|---:|---|---:|
| 1 | 甲地区 | 5 |
| 2 | 乙地区 | 3 |
| 3 | 丙地区 | 1 |

席位起始值：`3`；结束值：`5`。

关键结果为：

| 总席位 | 甲地区 | 乙地区 | 丙地区 | 说明 |
|---:|---:|---:|---:|---|
| 3 | 2 | 1 | 0 | 甲的余数 2/3 最大，获得唯一剩余席位 |
| 4 | 2 | 1 | 1 | 丙的余数 4/9 最大，获得唯一剩余席位 |
| 5 | 3 | 2 | 0 | 甲、乙的余数分列前两位，丙失去唯一席位 |

总席位从 **4 增至 5** 时，丙地区从 **1 席变为 0 席**，系统会高亮这一次阿拉巴马悖论，并并列显示变化前后的：

- 精确配额分数；
- 整数席位；
- 精确余数；
- 余数排序；
- 剩余席位归属；
- 每个地区的席位变化。

## 决胜规则与精确性

Hamilton 法先给每个地区分配配额的整数部分，再把剩余席位按余数从大到小发放。

余数相同的时候，按以下顺序决胜：

1. 人口较大的地区优先；
2. 人口也相同时，录入顺序较早的地区优先。

后端的排序键为：

```text
(-余数, -人口, 录入序号)
```

其中余数是 `Fraction`。Python 对分数进行精确比较，内部采用交叉相乘，不把配额或余数转换成二进制浮点数。接口中的大整数以字符串返回，前端也不进行余数排序。

## 输入限制

- 至少 2 个地区，最多 100 个地区；
- 人口必须为正整数，单个人口最大为 `10^18`；
- 席位起止值必须为正整数；
- 结束席位不能小于起始席位；
- 扫描跨度 `结束席位 - 起始席位` 最大为 `500`；
- 席位总数最大为 `1,000,000`。

例如从 1 扫到 501 的跨度为 500，可以计算；从 1 扫到 502 的跨度为 501，会被拒绝。

## API

### `POST /api/calculate`

请求：

```json
{
  "regions": [
    {"name": "甲地区", "population": "5"},
    {"name": "乙地区", "population": "3"},
    {"name": "丙地区", "population": "1"}
  ],
  "houseStart": "3",
  "houseEnd": "5"
}
```

返回内容包括：

- `allocations`：每个总席位的完整 Hamilton 结果；
- `paradoxes`：检测到的悖论，内嵌变化前和变化后的两份完整结果；
- `quota`：形如 `{"numerator": "5", "denominator": "3"}` 的精确分数；
- `remainder`：精确余数；
- `awardOrder`：按后端精确排序得到的余数顺序；
- `remainderTied`：该余数是否与其他地区相同；
- `changes`：悖论前后各地区席位变化量。

### `GET /api/health`

返回：

```json
{"status": "ok"}
```

## 本地开发（不使用 Docker）

需要 Python 3.11+。

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

访问 <http://localhost:8000>。

运行不依赖第三方包的核心算法测试：

```bash
python3 -m unittest discover -s tests -v
```

## 项目结构

```text
.
├── app/
│   ├── __init__.py
│   ├── apportionment.py      # Fraction 精确 Hamilton 算法和悖论扫描
│   ├── main.py               # FastAPI 路由与输入校验
│   └── static/
│       ├── index.html        # 页面结构
│       ├── styles.css        # 原生 CSS
│       └── app.js            # 原生 JavaScript
├── tests/
│   └── test_apportionment.py
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── README.md
```
