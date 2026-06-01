# XDL Homepage

<p align="center">
  <img src="./assets/xdl-homepage-icon.webp" alt="XDL Homepage Icon" width="128" height="128" />
</p>

<p align="center">
  <strong>轻量、可自托管的个人导航页与浏览器采集助手</strong>
</p>

一个轻量、可自托管的个人导航页项目。项目内置 FastAPI 后端、零构建前端页面和浏览器扩展静态资源托管，支持通过 GitHub Actions 自动构建 Docker 镜像并推送到 GHCR，服务器部署时直接拉取镜像即可运行。

![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi&logoColor=white)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0-D71F00?logo=sqlalchemy&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8.x-4479A1?logo=mysql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)
![GHCR](https://img.shields.io/badge/GHCR-enabled-181717?logo=github&logoColor=white)

## 特性

- **个人导航页**：按分类展示常用站点，适合作为浏览器首页或内网入口。
- **完整 API**：提供分类、导航项的增删改查接口。
- **管理密码保护**：未输入管理密码时只能查看导航，无法新增、编辑、删除或导入。
- **零构建前端**：前端为原生 HTML/CSS/JS，无需 Node.js 构建流程。
- **扩展托管**：后端可直接托管 `extension/` 目录，并支持动态下载扩展 zip。
- **Docker 部署**：内置 `Dockerfile` 和 `docker-compose.yml`。
- **自动发布镜像**：推送代码后通过 GitHub Actions 自动打包并发布到 `ghcr.io`。

## 技术栈

| 模块 | 技术 |
| --- | --- |
| 后端 | FastAPI、Uvicorn、SQLAlchemy、PyMySQL |
| 数据库 | MySQL / MariaDB |
| 前端 | HTML、CSS、原生 JavaScript |
| 浏览器扩展 | Manifest V3 |
| 容器化 | Docker、Docker Compose |
| CI/CD | GitHub Actions、GitHub Container Registry |

## 项目结构

```text
xdl-homepage/
  backend/                 # FastAPI 后端服务
    app/
    sql/                   # 建表脚本和示例数据
    requirements.txt
    .env.example
  frontend/                # 零构建前端页面
    assets/                # 前端图标资源
    index.html
  extension/               # 浏览器扩展资源
    icons/                 # 插件图标资源
  assets/                  # README 展示图标资源
  .github/workflows/       # GitHub Actions 工作流
  Dockerfile               # Docker 镜像构建配置
  docker-compose.yml       # 服务器部署配置
  DEPLOY.md                # Docker / GHCR 部署说明
```

## 本地运行

### 1. 安装依赖

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

然后修改 `backend/.env` 中的数据库连接信息。

### 2. 初始化数据库

在 MySQL 中执行：

```sql
source backend/sql/schema.sql;
source backend/sql/seed.sql;
```

### 3. 启动服务

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8100
```

访问：

```text
http://127.0.0.1:8100/
```

API 文档：

```text
http://127.0.0.1:8100/docs
```

## Docker 部署

项目已配置 GHCR 自动构建。推送到 `main` 或 `master` 后会发布镜像：

```text
ghcr.io/<你的 GitHub 用户名或组织名>/<仓库名>:latest
```

服务器上准备 `backend/.env` 后运行：

```bash
IMAGE=ghcr.io/<你的 GitHub 用户名或组织名>/<仓库名>:latest docker compose up -d
```

更新时：

```bash
IMAGE=ghcr.io/<你的 GitHub 用户名或组织名>/<仓库名>:latest docker compose pull
IMAGE=ghcr.io/<你的 GitHub 用户名或组织名>/<仓库名>:latest docker compose up -d
```

更完整的部署说明见：[DEPLOY.md](./DEPLOY.md)。

## 常用接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/health` | 健康检查 |
| `GET` | `/api/navigation` | 获取导航页完整数据 |
| `GET` | `/api/categories` | 获取分类列表 |
| `POST` | `/api/categories` | 新增分类 |
| `PATCH` | `/api/categories/{category_id}` | 修改分类 |
| `DELETE` | `/api/categories/{category_id}` | 删除分类 |
| `GET` | `/api/items` | 获取导航项列表 |
| `POST` | `/api/items` | 新增导航项 |
| `PATCH` | `/api/items/{item_id}` | 修改导航项 |
| `DELETE` | `/api/items/{item_id}` | 删除导航项 |
| `GET` | `/downloads/extension.zip` | 下载浏览器扩展 zip |

## 环境变量

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `APP_NAME` | FastAPI 应用名称 | `xdl-homepage-api` |
| `DB_HOST` | 数据库地址 | `127.0.0.1` |
| `DB_PORT` | 数据库端口 | `3306` |
| `DB_NAME` | 数据库名称 | `xdl-homepage` |
| `DB_USER` | 数据库用户 | `root` |
| `DB_PASSWORD` | 数据库密码 | 空 |
| `ADMIN_PASSWORD` | 管理密码，非查询接口必须通过 `X-Admin-Password` 请求头携带该密码 | 空，未配置时禁止修改 |

## 管理密码

后端会对 `POST`、`PATCH`、`DELETE` 等非查询请求校验 `ADMIN_PASSWORD`。前端首页右上角和浏览器扩展设置区都提供“管理密码”输入框，并会持久化保存在本机浏览器；未输入或输入错误时，只能查看，不能修改数据。

## 许可证

当前未指定许可证。如需开源分发，建议补充 `LICENSE` 文件。
