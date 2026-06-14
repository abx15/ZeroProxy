# pyrefly: ignore [missing-import]
from sqlalchemy import create_engine, text
# pyrefly: ignore [missing-import]
from sqlalchemy.ext.declarative import declarative_base
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import sessionmaker
from app.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,       # auto reconnect
    pool_size=10,
    max_overflow=20,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency — use in routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Test connection
def test_connection():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("[INFO] PostgreSQL connected (AI Service)")
        return True
    except Exception as e:
        print(f"[ERROR] PostgreSQL connection failed: {e}")
        return False
