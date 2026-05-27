# Docker / GHCR 部署说明

本项目已配置 Docker 镜像构建，并通过 GitHub Actions 自动推送到 GitHub Container Registry。

## 镜像地址

推送到 `main` 或 `master` 后，Action 会发布：

```text
ghcr.io/<你的 GitHub 用户名或组织名>/<仓库名>:latest
```

同时也会发布当前提交对应的短 SHA 标签：

```text
ghcr.io/<你的 GitHub 用户名或组织名>/<仓库名>:sha-xxxxxxx
```

如果推送 `v*` 标签，也会生成对应版本镜像，例如：

```text
ghcr.io/<你的 GitHub 用户名或组织名>/<仓库名>:v1.0.0
```

## 服务器部署

1. 准备环境变量文件：

```bash
mkdir -p backend
cat > backend/.env <<'EOF'
APP_NAME=xdl-homepage-api
DB_HOST=你的数据库地址
DB_PORT=3306
DB_NAME=xdl-homepage
DB_USER=你的数据库用户
DB_PASSWORD=你的数据库密码
EOF
```

2. 下载 `docker-compose.yml` 到服务器，并把镜像名替换为你的实际 GHCR 地址，或用 `IMAGE` 环境变量指定：

```bash
IMAGE=ghcr.io/<你的 GitHub 用户名或组织名>/<仓库名>:latest docker compose up -d
```

3. 后续更新时直接拉取并重启：

```bash
IMAGE=ghcr.io/<你的 GitHub 用户名或组织名>/<仓库名>:latest docker compose pull
IMAGE=ghcr.io/<你的 GitHub 用户名或组织名>/<仓库名>:latest docker compose up -d
```

服务默认监听：

```text
http://服务器IP:8100/
```

健康检查：

```text
http://服务器IP:8100/health
```

## 私有镜像拉取

如果仓库或 GHCR Package 是私有的，服务器需要先登录：

```bash
docker login ghcr.io -u <GitHub 用户名>
```

密码填写 GitHub Personal Access Token，需要有 `read:packages` 权限。
