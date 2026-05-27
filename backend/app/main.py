from io import BytesIO
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import NavCategory, NavItem
from app.schemas import (
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

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    db.refresh(item)
    return item


@app.delete("/api/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(item_id: int, db: Session = Depends(get_db)) -> None:
    item = db.get(NavItem, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="导航项不存在")

    db.delete(item)
    db.commit()


def ensure_category_exists(db: Session, category_id: int) -> None:
    if db.get(NavCategory, category_id) is None:
        raise HTTPException(status_code=400, detail="所属分类不存在")


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
