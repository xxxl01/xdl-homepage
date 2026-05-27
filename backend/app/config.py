import os
from functools import lru_cache
from urllib.parse import quote_plus

from dotenv import load_dotenv


load_dotenv()


class Settings:
    """服务配置，从环境变量读取，避免把数据库密码写进代码。"""

    app_name: str = os.getenv("APP_NAME", "xdl-homepage-api")
    db_host: str = os.getenv("DB_HOST", "127.0.0.1")
    db_port: int = int(os.getenv("DB_PORT", "3306"))
    db_name: str = os.getenv("DB_NAME", "xdl-homepage")
    db_user: str = os.getenv("DB_USER", "root")
    db_password: str = os.getenv("DB_PASSWORD", "")

    @property
    def database_url(self) -> str:
        user = quote_plus(self.db_user)
        password = quote_plus(self.db_password)
        host = self.db_host
        port = self.db_port
        database = quote_plus(self.db_name)
        return f"mysql+pymysql://{user}:{password}@{host}:{port}/{database}?charset=utf8mb4"


@lru_cache
def get_settings() -> Settings:
    return Settings()
