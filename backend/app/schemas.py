from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class NavCategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=255)


class NavCategoryCreate(NavCategoryBase):
    pass


class NavCategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=255)


class NavCategoryOut(NavCategoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sort_order: int
    created_at: datetime
    updated_at: datetime


class NavItemBase(BaseModel):
    category_id: int
    title: str = Field(..., min_length=1, max_length=100)
    url: str = Field(..., min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=255)
    icon: str | None = Field(default=None, max_length=255)


class NavItemCreate(NavItemBase):
    pass


class NavItemUpdate(BaseModel):
    category_id: int | None = None
    title: str | None = Field(default=None, min_length=1, max_length=100)
    url: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=255)
    icon: str | None = Field(default=None, max_length=255)


class NavItemOut(NavItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sort_order: int
    created_at: datetime
    updated_at: datetime


class NavigationCategoryOut(BaseModel):
    id: int
    name: str
    description: str | None
    sort_order: int
    items: list[NavItemOut]


class BookmarkImportItem(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    url: str = Field(..., min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=255)
    icon: str | None = Field(default=None, max_length=255)


class BookmarkImportCategory(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    items: list[BookmarkImportItem]


class BookmarkImportRequest(BaseModel):
    categories: list[BookmarkImportCategory]


class BookmarkImportResult(BaseModel):
    created_categories: int
    reused_categories: int
    created_items: int


class NavItemBatchDeleteRequest(BaseModel):
    item_ids: list[int] = Field(..., min_length=1)


class NavItemBatchMoveRequest(BaseModel):
    item_ids: list[int] = Field(..., min_length=1)
    category_id: int


class NavItemBatchResult(BaseModel):
    affected_items: int


class TransferTextCreate(BaseModel):
    """新增文字记录。"""

    title: str | None = Field(default=None, max_length=200)
    content: str = Field(..., min_length=1)


class TransferTextUpdate(BaseModel):
    """编辑文字记录。"""

    title: str | None = Field(default=None, max_length=200)
    content: str | None = Field(default=None, min_length=1)


class TransferOut(BaseModel):
    """传输记录输出，列表与详情共用；content 仅在详情接口返回。"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: str
    title: str | None
    content: str | None
    filename: str | None
    filesize: int | None
    mime_type: str | None
    created_at: datetime
    updated_at: datetime


class TransferListItemOut(BaseModel):
    """传输记录列表项，不返回文字全文，保证列表轻量。"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: str
    title: str | None
    filename: str | None
    filesize: int | None
    created_at: datetime
    updated_at: datetime
