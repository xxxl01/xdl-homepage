import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv


# 始终从 backend/.env 加载，不受工作目录影响
load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")


class Settings:
    """服务配置，从环境变量读取。"""

    app_name: str = os.getenv("APP_NAME", "xdl-homepage-api")
    admin_password: str = os.getenv("ADMIN_PASSWORD", "")
    _db_path: str | None = os.getenv("DB_PATH", None)

    @property
    def database_url(self) -> str:
        project_root = Path(__file__).resolve().parents[2]
        if self._db_path:
            path = Path(self._db_path)
            if not path.is_absolute():
                # 相对路径以 backend/ 目录为基准
                path = project_root / "backend" / path
        else:
            path = project_root / "backend" / "data" / "xdl-homepage.db"
        path.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{path}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
