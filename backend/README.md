# xdl-homepage 后端服务

这是一个轻量 FastAPI 服务，用于维护并输出导航页数据。

## 目录

```text
backend/
  app/
    main.py        # FastAPI 入口
    config.py      # 环境变量配置
    database.py    # SQLAlchemy 数据库连接
    models.py      # 数据表模型
    schemas.py     # 接口入参与出参
  sql/
    schema.sql     # 建库建表脚本
    seed.sql       # 示例数据
```

## 初始化

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

然后把 `.env` 中的数据库连接信息改成实际值。

## 建表

在 MySQL 中执行：

```sql
source backend/sql/schema.sql;
source backend/sql/seed.sql;
```

如果是在 Windows 客户端里执行，也可以直接复制 SQL 文件内容执行。

## 启动

```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8100
```

接口文档：

```text
http://127.0.0.1:8100/docs
```

导航数据接口：

```text
GET /api/navigation
```

## 前端导航页

已提供一个零构建的极简前端页面：

```text
frontend/index.html
```

后端启动后会托管前端，直接访问：

```text
http://127.0.0.1:8100/
```

页面使用同源接口请求 `/api/navigation`、`/api/categories` 和 `/api/items`。

## 扩展下载

扩展目录位于项目根目录：

```text
extension/
```

后端会托管扩展静态文件：

```text
http://127.0.0.1:8100/extension/manifest.json
```

也提供动态打包下载：

```text
http://127.0.0.1:8100/downloads/extension.zip
```
