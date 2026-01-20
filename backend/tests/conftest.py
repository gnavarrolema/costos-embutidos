import os
import sys
import pytest

# IMPORTANT: set env vars BEFORE importing backend/app.py
os.environ.setdefault('COSTOS_EMBUTIDOS_SKIP_INIT_DB', '1')
os.environ.setdefault('COSTOS_EMBUTIDOS_DATABASE_URI', 'sqlite:///:memory:')

# Ensure backend/ is importable as a top-level module
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app import app as flask_app, db  # noqa: E402


@pytest.fixture()
def app():
    flask_app.config.update(
        TESTING=True,
    )

    with flask_app.app_context():
        db.create_all()
        yield flask_app
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()
