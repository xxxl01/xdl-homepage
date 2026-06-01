from io import BytesIO
from hmac import compare_digest
from html.parser import HTMLParser
from html import escape
from pathlib import Path
from urllib.error import URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request as UrlRequest, urlopen
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import NavCategory, NavItem
from app.schemas import (
    BookmarkImportRequest,
    BookmarkImportResult,
    NavItemBatchDeleteRequest,
    NavItemBatchMoveRequest,
    NavItemBatchResult,
    NavCategoryCreate,
    NavCategoryOut,
    NavCategoryUpdate,
    NavItemCreate,
    NavItemOut,
    NavItemUpdate,
    NavigationCategoryOut,
)


settings = get_settings()
PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_DIR = PROJECT_ROOT / "frontend"
EXTENSION_DIR = PROJECT_ROOT / "extension"
FAVICON_DIR = PROJECT_ROOT / "backend" / "storage" / "favicons"
FAVICON_MAX_BYTES = 256 * 1024
HTML_MAX_BYTES = 512 * 1024
FAVICON_CACHE_CONTROL = "public, max-age=31536000, immutable"

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def protect_write_requests(request: Request, call_next):
    """非查询请求必须携带管理密码，未配置密码时禁止修改。"""

    if request.method in {"GET", "HEAD", "OPTIONS"}:
        return await call_next(request)

    if not settings.admin_password:
        return JSONResponse(status_code=403, content={"detail": "服务端未配置管理密码，禁止修改"})

    password = request.headers.get("X-Admin-Password", "")
    if not compare_digest(password, settings.admin_password):
        return JSONResponse(status_code=401, content={"detail": "管理密码不正确，禁止修改"})

    return await call_next(request)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/navigation", response_model=list[NavigationCategoryOut])
def get_navigation(db: Session = Depends(get_db)) -> list[dict]:
    """按分类返回导航页数据。"""

    categories = db.scalars(
        select(NavCategory).order_by(NavCategory.sort_order.asc(), NavCategory.id.asc())
    ).all()
    items = db.scalars(
        select(NavItem).order_by(NavItem.sort_order.asc(), NavItem.id.asc())
    ).all()

    items_by_category: dict[int, list[NavItem]] = {}
    for item in items:
        items_by_category.setdefault(item.category_id, []).append(item)

    return [
        {
            "id": category.id,
            "name": category.name,
            "description": category.description,
            "sort_order": category.sort_order,
            "items": items_by_category.get(category.id, []),
        }
        for category in categories
    ]


@app.get("/api/categories", response_model=list[NavCategoryOut])
def list_categories(db: Session = Depends(get_db)) -> list[NavCategory]:
    return list(db.scalars(
        select(NavCategory).order_by(NavCategory.sort_order.asc(), NavCategory.id.asc())
    ).all())


@app.post("/api/categories", response_model=NavCategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(payload: NavCategoryCreate, db: Session = Depends(get_db)) -> NavCategory:
    category = NavCategory(**payload.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@app.patch("/api/categories/{category_id}", response_model=NavCategoryOut)
def update_category(
    category_id: int,
    payload: NavCategoryUpdate,
    db: Session = Depends(get_db),
) -> NavCategory:
    category = db.get(NavCategory, category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="分类不存在")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, key, value)
    db.commit()
    db.refresh(category)
    return category


@app.delete("/api/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: int, db: Session = Depends(get_db)) -> None:
    category = db.get(NavCategory, category_id)
    if category is None:
        raise HTTPException(status_code=404, detail="分类不存在")

    db.query(NavItem).filter(NavItem.category_id == category_id).delete()
    db.delete(category)
    db.commit()


@app.get("/api/items", response_model=list[NavItemOut])
def list_items(category_id: int | None = None, db: Session = Depends(get_db)) -> list[NavItem]:
    stmt = select(NavItem)
    if category_id is not None:
        stmt = stmt.where(NavItem.category_id == category_id)
    stmt = stmt.order_by(NavItem.sort_order.asc(), NavItem.id.asc())
    return list(db.scalars(stmt).all())


@app.post("/api/items", response_model=NavItemOut, status_code=status.HTTP_201_CREATED)
def create_item(payload: NavItemCreate, db: Session = Depends(get_db)) -> NavItem:
    ensure_category_exists(db, payload.category_id)
    item = NavItem(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@app.patch("/api/items/{item_id}", response_model=NavItemOut)
def update_item(
    item_id: int,
    payload: NavItemUpdate,
    db: Session = Depends(get_db),
) -> NavItem:
    item = db.get(NavItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="导航项不存在")

    data = payload.model_dump(exclude_unset=True)
    if "category_id" in data:
        ensure_category_exists(db, data["category_id"])

    for key, value in data.items():
        setattr(item, key, value)
    db.commit()
    if "url" in data:
        delete_favicon_cache(item_id)
    db.refresh(item)
    return item


@app.delete("/api/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(item_id: int, db: Session = Depends(get_db)) -> None:
    item = db.get(NavItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="导航项不存在")

    db.delete(item)
    db.commit()
    delete_favicon_cache(item_id)


@app.post("/api/items/batch-delete", response_model=NavItemBatchResult)
def batch_delete_items(payload: NavItemBatchDeleteRequest, db: Session = Depends(get_db)) -> dict[str, int]:
    """批量删除导航项。"""

    affected = db.query(NavItem).filter(NavItem.id.in_(payload.item_ids)).delete(synchronize_session=False)
    db.commit()
    for item_id in payload.item_ids:
        delete_favicon_cache(item_id)
    return {"affected_items": affected}


@app.get("/api/items/{item_id}/favicon")
def get_item_favicon(item_id: int, db: Session = Depends(get_db)) -> Response:
    """返回导航项图标，首次访问时下载并缓存到本地磁盘。"""

    item = db.get(NavItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="导航项不存在")

    cache_path = get_favicon_cache_path(item_id)
    if cache_path.exists():
        cache_data = cache_path.read_bytes()
        return Response(
            content=cache_data,
            media_type=guess_image_media_type(cache_data),
            headers={"Cache-Control": FAVICON_CACHE_CONTROL},
        )

    favicon = download_favicon(item.url)
    if favicon:
        FAVICON_DIR.mkdir(parents=True, exist_ok=True)
        cache_path.write_bytes(favicon)
        return Response(
            content=favicon,
            media_type=guess_image_media_type(favicon),
            headers={"Cache-Control": FAVICON_CACHE_CONTROL},
        )

    return Response(
        content=build_fallback_svg(item),
        media_type="image/svg+xml",
        headers={"Cache-Control": "no-store"},
    )


@app.post("/api/items/batch-move", response_model=NavItemBatchResult)
def batch_move_items(payload: NavItemBatchMoveRequest, db: Session = Depends(get_db)) -> dict[str, int]:
    """批量移动导航项到指定分类。"""

    ensure_category_exists(db, payload.category_id)
    affected = db.query(NavItem).filter(NavItem.id.in_(payload.item_ids)).update(
        {NavItem.category_id: payload.category_id},
        synchronize_session=False,
    )
    db.commit()
    return {"affected_items": affected}


@app.post("/api/bookmarks/import", response_model=BookmarkImportResult)
def import_bookmarks(payload: BookmarkImportRequest, db: Session = Depends(get_db)) -> dict[str, int]:
    """批量导入浏览器书签，按文件夹名称匹配或创建分类。"""

    existing_categories = db.scalars(select(NavCategory)).all()
    categories_by_name = {
        category.name.strip().lower(): category
        for category in existing_categories
    }
    max_sort_order = max((category.sort_order for category in existing_categories), default=0)
    created_categories = 0
    reused_categories = 0
    created_items = 0

    for import_category in payload.categories:
        category_name = import_category.name.strip()
        if not category_name or not import_category.items:
            continue

        category_key = category_name.lower()
        category = categories_by_name.get(category_key)
        if category is None:
            max_sort_order += 10
            category = NavCategory(
                name=category_name,
                description="从浏览器书签导入",
                sort_order=max_sort_order,
            )
            db.add(category)
            db.flush()
            categories_by_name[category_key] = category
            created_categories += 1
        else:
            reused_categories += 1

        for index, item in enumerate(import_category.items):
            title = item.title.strip()
            url = item.url.strip()
            if not title or not url:
                continue

            db.add(NavItem(
                category_id=category.id,
                title=title,
                url=url,
                description=item.description,
                icon=item.icon,
                sort_order=index,
            ))
            created_items += 1

    db.commit()
    return {
        "created_categories": created_categories,
        "reused_categories": reused_categories,
        "created_items": created_items,
    }


def ensure_category_exists(db: Session, category_id: int) -> None:
    if db.get(NavCategory, category_id) is None:
        raise HTTPException(status_code=400, detail="所属分类不存在")


def get_favicon_cache_path(item_id: int) -> Path:
    return FAVICON_DIR / f"item-{item_id}.ico"


def delete_favicon_cache(item_id: int) -> None:
    cache_path = get_favicon_cache_path(item_id)
    if cache_path.exists():
        cache_path.unlink()


class FaviconLinkParser(HTMLParser):
    """从网页 head 中提取 favicon 相关 link 地址。"""

    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "link":
            return

        data = {key.lower(): value or "" for key, value in attrs}
        rel = data.get("rel", "").lower()
        href = data.get("href", "").strip()
        if href and "icon" in rel:
            self.links.append(href)


def download_favicon(url: str) -> bytes | None:
    """按多个候选地址下载 favicon，失败时返回 None。"""

    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None

    for favicon_url in build_favicon_candidates(parsed):
        data = download_image(favicon_url)
        if data:
            return data

    return None


def build_favicon_candidates(parsed) -> list[str]:
    origin = f"{parsed.scheme}://{parsed.netloc}"
    candidates = [
        f"{origin}/favicon.ico",
        *fetch_icon_links(origin),
        f"{origin}/favicon.png",
        f"{origin}/apple-touch-icon.png",
        f"{origin}/apple-touch-icon-precomposed.png",
        f"https://icons.duckduckgo.com/ip3/{parsed.netloc}.ico",
    ]

    result = []
    seen = set()
    for candidate in candidates:
        parsed_candidate = urlparse(candidate)
        if parsed_candidate.scheme not in {"http", "https"} or not parsed_candidate.netloc:
            continue
        if candidate not in seen:
            seen.add(candidate)
            result.append(candidate)
    return result


def fetch_icon_links(origin: str) -> list[str]:
    html = download_text(origin)
    if not html:
        return []

    parser = FaviconLinkParser()
    try:
        parser.feed(html)
    except Exception:
        return []
    return [urljoin(origin, href) for href in parser.links]


def download_text(url: str) -> str | None:
    request = UrlRequest(
        url,
        headers={"User-Agent": "xdl-homepage favicon cache/1.0"},
    )

    try:
        with urlopen(request, timeout=5) as response:
            content_type = response.headers.get("Content-Type", "").lower()
            if "text/html" not in content_type:
                return None
            data = response.read(HTML_MAX_BYTES + 1)
    except (OSError, URLError, ValueError):
        return None

    if len(data) > HTML_MAX_BYTES:
        return None
    return data.decode("utf-8", errors="ignore")


def download_image(url: str) -> bytes | None:
    request = UrlRequest(
        url,
        headers={
            "Accept": "image/avif,image/webp,image/png,image/svg+xml,image/*,*/*;q=0.8",
            "User-Agent": "xdl-homepage favicon cache/1.0",
        },
    )

    try:
        with urlopen(request, timeout=5) as response:
            content_type = response.headers.get("Content-Type", "").lower()
            data = response.read(FAVICON_MAX_BYTES + 1)
    except (OSError, URLError, ValueError):
        return None

    if len(data) > FAVICON_MAX_BYTES or not data:
        return None
    if not content_type.startswith("image/") and not looks_like_icon(data):
        return None
    return data


def looks_like_icon(data: bytes) -> bool:
    return (
        data.startswith(b"\x00\x00\x01\x00")
        or data.startswith(b"\x89PNG\r\n\x1a\n")
        or data.startswith(b"GIF87a")
        or data.startswith(b"GIF89a")
        or data.startswith(b"\xff\xd8\xff")
        or data.lstrip().startswith(b"<svg")
    )


def guess_image_media_type(data: bytes) -> str:
    stripped = data.lstrip()
    if data.startswith(b"\x00\x00\x01\x00"):
        return "image/x-icon"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"GIF87a") or data.startswith(b"GIF89a"):
        return "image/gif"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if stripped.startswith(b"<svg"):
        return "image/svg+xml"
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return "image/webp"
    return "image/x-icon"


def build_fallback_svg(item: NavItem) -> str:
    label = (item.icon or item.title or "?").strip()[:1].upper() or "?"
    safe_label = escape(label)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="16" fill="#111111"/>
  <text x="32" y="39" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#ffffff">{safe_label}</text>
</svg>'''


@app.get("/downloads/extension.zip")
def download_extension() -> Response:
    """把根目录 extension 文件夹动态打包为 zip 下载。"""

    if not EXTENSION_DIR.exists():
        raise HTTPException(status_code=404, detail="扩展目录不存在")

    buffer = BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as zip_file:
        for file_path in EXTENSION_DIR.rglob("*"):
            if file_path.is_file():
                zip_file.write(file_path, file_path.relative_to(EXTENSION_DIR))

    return Response(
        content=buffer.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="xdl-homepage-extension.zip"'},
    )


if EXTENSION_DIR.exists():
    app.mount("/extension", StaticFiles(directory=EXTENSION_DIR), name="extension")

if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
