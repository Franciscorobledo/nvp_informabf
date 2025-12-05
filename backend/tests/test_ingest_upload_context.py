import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Asegura que el backend esté en el path
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from test_auth_security import _login, reload_app


@pytest.fixture()
def client(tmp_path):
    main = reload_app(tmp_path)
    with TestClient(main.app) as test_client:
        yield test_client


def _admin_id() -> str:
    from database import SessionLocal
    from models import User

    with SessionLocal() as db:
        admin_user = db.query(User).filter(User.username == "admin").first()
        return str(admin_user.id)


def test_ingest_upload_updates_active_context(client: TestClient):
    token = _login(client, "admin", "Francisco8")

    sales_csv = "sku,quantity,unit_price\nSKU1,2,100\nSKU2,1,50\n"
    stock_csv = "sku,current_stock\nSKU1,5\nSKU2,3\n"

    response = client.post(
        "/ingest/upload",
        files={
            "archivo_ventas": ("ventas.csv", sales_csv, "text/csv"),
            "archivo_stock": ("stock.csv", stock_csv, "text/csv"),
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["sales_rows"] == 2
    assert payload["stock_rows"] == 2

    # Verifica que el contexto activo se reemplace y deje de usar el demo
    from data_router import _DATA_CONTEXT

    stored = _DATA_CONTEXT.get(_admin_id())

    assert stored is not None
    assert stored.get("source") == "files"
    assert len(stored.get("sales", [])) == 2
    assert len(stored.get("stock", [])) == 2
    assert set(stored.get("sales").get("product_id").astype(str)) == {"SKU1", "SKU2"}
    assert set(stored.get("stock").get("product_id").astype(str)) == {"SKU1", "SKU2"}
