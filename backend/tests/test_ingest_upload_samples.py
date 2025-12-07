import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from test_auth_security import _login, reload_app


@pytest.fixture()
def client(tmp_path):
    main = reload_app(tmp_path)
    with TestClient(main.app) as test_client:
        yield test_client


def test_ingest_upload_accepts_sample_csvs(client: TestClient):
    token = _login(client, "admin", "Francisco8")

    sample_dir = Path(__file__).resolve().parents[1] / "sample_data"
    ventas_path = sample_dir / "ventas_pyme_ejemplo.csv"
    stock_path = sample_dir / "stock_pyme_ejemplo.csv"

    with ventas_path.open("rb") as ventas_file, stock_path.open("rb") as stock_file:
        response = client.post(
            "/ingest/upload",
            headers={"Authorization": f"Bearer {token}"},
            files={
                "sales_file": (ventas_path.name, ventas_file, "text/csv"),
                "stock_file": (stock_path.name, stock_file, "text/csv"),
            },
        )

    assert response.status_code == 200, response.text
    payload = response.json()

    assert payload["status"] == "ok"
    assert payload["sales_rows"] == 3
    assert payload["stock_rows"] == 3


def test_ingest_upload_concatenates_multiple_sales_files(client: TestClient):
    token = _login(client, "admin", "Francisco8")

    first_sales = "sku,quantity,unit_price\nSKU1,1,10\n"
    second_sales = "sku,quantity,unit_price\nSKU2,2,5\n"

    response = client.post(
        "/ingest/upload",
        headers={"Authorization": f"Bearer {token}"},
        files=[
            ("sales_file", ("ventas1.csv", first_sales, "text/csv")),
            ("sales_file", ("ventas2.csv", second_sales, "text/csv")),
        ],
    )

    assert response.status_code == 200, response.text
    payload = response.json()

    assert payload["sales_rows"] == 2
    assert payload["stock_rows"] == 0
    assert len(payload.get("datasets", [])) == 2
    assert {ds["type"] for ds in payload["datasets"]} == {"sales"}
