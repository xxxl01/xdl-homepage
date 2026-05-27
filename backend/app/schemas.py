from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class NavCategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=255)
    sort_order: int = 0


class NavCategoryCreate(NavCategoryBase):
    pass


class NavCategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=255)
    sort_order: int | None = None


class NavCategoryOut(NavCategoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class NavItemBase(BaseModel):
    category_id: int
    title: str = Field(..., min_length=1, max_length=100)
    url: str = Field(..., min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=255)
    icon: str | None = Field(default=None, max_length=255)
    sort_order: int = 0


class NavItemCreate(NavItemBase):
    pass


class NavItemUpdate(BaseModel):
    category_id: int | None = None
    title: str | None = Field(default=None, min_length=1, max_length=100)
    url: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=255)
    icon: str | None = Field(default=None, max_length=255)
    sort_order: int | None = None


class NavItemOut(NavItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class NavigationCategoryOut(BaseModel):
    id: int
    name: str
    description: str | None
    sort_order: int
    items: list[NavItemOut]
