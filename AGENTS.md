# AGENTS.md

## 项目概览

个人导航页 + 浏览器采集助手。FastAPI 后端 + 零构建前端 + Chrome 扩展，Docker 部署。

## 目录与入口

```
backend/app/main.py    # FastAPI 入口，所有路由、favicon 抓取、扩展打包都在此文件
backend/app/models.py  # SQLAlchemy 模型 (NavCategory, NavItem)
backend/app/schemas.py # Pydantic 入参/出参
backend/app/config.py  # 环境变量读取
backend/app/database.py# 数据库引擎与会话
frontend/index.html    # 前端单页，Vue 3 + Lucide 从 CDN 加载
frontend/index.js      # 前端逻辑 (~950 行)
extension/             # Chrome 扩展 (Manifest V3)，后端以静态文件托管
```

## 开发命令

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env   # 然后修改数据库连接和管理密码
uvicorn app.main:app --reload --host 0.0.0.0 --port 8100
```

访问 `http://127.0.0.1:8100/` 看前端，`/docs` 看 API 文档。

数据库初始化：在 MySQL 中依次执行 `backend/sql/schema.sql` 和 `backend/sql/seed.sql`。

## 关键架构约定

- **前端零构建**：`frontend/` 目录的 HTML/CSS/JS 直接由 FastAPI 以 `StaticFiles` 托管，没有 Node.js 或打包步骤。修改 `frontend/` 文件后刷新浏览器即可生效。
- **Vue 3 和 Lucide 从 CDN 加载**：`index.html` 通过 unpkg CDN 引入，离线环境无法使用前端。
- **管理密码**：所有非 GET/HEAD/OPTIONS 请求必须带 `X-Admin-Password` 请求头，密码通过环境变量 `ADMIN_PASSWORD` 配置。未配置时所有写操作返回 403。前端将密码持久化在 `localStorage`。
- **API 路由全部在 `main.py`**：没有拆分到多个 router 文件，所有端点、favicon 抓取逻辑、扩展 zip 打包都在同一个文件里。
- **数据库是 SQLite**：文件存储在 `backend/data/xdl-homepage.db`，路径通过环境变量 `DB_PATH` 配置。SQLAlchemy 自动建表，无需手动执行 SQL。引擎必须配置 `connect_args={"check_same_thread": False}`（FastAPI 多线程必需）。
- **favicon 缓存到磁盘**：`backend/storage/favicons/` 目录，首次访问 `/api/items/{id}/favicon` 时下载并缓存。修改 item url 或删除 item 时会清理缓存。使用标准库 `urllib`，没有用 `httpx`/`requests`。
- **模型间无 ORM relationship**：`NavCategory` 和 `NavItem` 之间没有定义 SQLAlchemy relationship，关联通过手动 JOIN 或 `category_id` 字段查询实现。
- **扩展动态打包**：`/downloads/extension.zip` 每次请求实时将 `extension/` 目录打包为 zip。

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `APP_NAME` | `xdl-homepage-api` | FastAPI title |
| `DB_PATH` | `./data/xdl-homepage.db` | SQLite 文件路径，相对路径以 `backend/` 为基准 |
| `ADMIN_PASSWORD` | 空 | 空值时禁止所有写操作 |

`.env` 文件位置：`backend/.env`（Docker 通过 compose 的 `env_file: ./backend/.env` 挂载）。

## Docker

```bash
IMAGE=ghcr.io/owner/repo:latest docker compose up -d
IMAGE=ghcr.io/owner/repo:latest docker compose pull   # 更新
```

容器监听 `127.0.0.1:8100:8100`，健康检查端点 `/health`。

## 注意事项

- 依赖版本已锁定（`requirements.txt` 使用 `==`），不要随意升级。
- 没有测试套件，没有 lint/formatter 配置。
- 前端使用 `lucide` 图标库（`data-lucide="icon-name"`），不要换成其他图标库。
- `backend/storage/` 目录在 `.gitignore` 中，favicon 缓存不会提交。
- Python 版本要求 3.12（Dockerfile 使用 `python:3.12-slim`）。
