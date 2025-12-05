import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Asegura que el backend esté en el path
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from test_auth_security import _login, reload_app


FRONTEND_ORIGIN = "https://nvp-informabf-front-wxbb.onrender.com"


@pytest.fixture()
def client(tmp_path):
    main = reload_app(tmp_path)
    with TestClient(main.app) as test_client:
        yield test_client


def test_options_preflight_includes_cors_headers(client: TestClient):
    response = client.options(
        "/ingest/upload",
        headers={
            "Origin": FRONTEND_ORIGIN,
            "Access-Control-Request-Method": "POST",
        },
    )

    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == FRONTEND_ORIGIN
    assert "POST" in response.headers.get("access-control-allow-methods", "")


def test_post_upload_includes_cors_headers(client: TestClient):
    token = _login(client, "admin", "Francisco8")

    sales_csv = "sku,quantity,unit_price\nSKU1,2,100\n"

    response = client.post(
        "/ingest/upload",
        headers={
            "Origin": FRONTEND_ORIGIN,
            "Authorization": f"Bearer {token}",
        },
        files={
            "archivo_ventas": ("ventas.csv", sales_csv, "text/csv"),
        },
    )

    assert response.status_code == 200, response.text
    assert response.headers.get("access-control-allow-origin") == FRONTEND_ORIGIN
    payload = response.json()
    assert payload.get("sales_rows") == 1
    assert payload.get("stock_rows") == 0
