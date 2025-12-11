import importlib
import os
import sys
from datetime import timedelta
from pathlib import Path
import importlib
import os
import sys
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))


class DummyResponse:
    def __init__(self, status_code: int = 200, payload: dict | None = None):
        self.status_code = status_code
        self._payload = payload or {}
        self.text = str(self._payload)

    def json(self) -> Any:  # pragma: no cover - simple helper
        return self._payload


def reload_app(tmp_path, monkeypatch: pytest.MonkeyPatch):
    db_path = tmp_path / "test_subscriptions.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    os.environ["SECRET_KEY"] = "TEST_SECRET_KEY"
    os.environ["MP_ACCESS_TOKEN"] = "TEST_MP_TOKEN"

    for module_name in ["database", "models", "auth", "subscriptions", "main", "mercadolibre"]:
        if module_name in sys.modules:
            importlib.reload(sys.modules[module_name])

    import main
    import subscriptions

    monkeypatch.setattr(subscriptions.requests, "post", lambda *args, **kwargs: DummyResponse(201, {"id": "mp-123", "init_point": "https://pay"}))
    monkeypatch.setattr(subscriptions.requests, "get", lambda *args, **kwargs: DummyResponse(200, {"status": "authorized"}))

    return main


@pytest.fixture()
def client(tmp_path, monkeypatch):
    main = reload_app(tmp_path, monkeypatch)
    with TestClient(main.app) as test_client:
        yield test_client


def _login(client: TestClient, username: str, password: str) -> str:
    response = client.post(
        "/auth/login",
        data={"username": username, "password": password},
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    return payload["access_token"]


def test_plans_seeded(client: TestClient):
    response = client.get("/subscriptions/plans")
    assert response.status_code == 200
    plans = response.json()
    assert any(plan["alias"] == "starter" for plan in plans)


def test_subscription_flow_and_permissions(client: TestClient, monkeypatch):
    import subscriptions

    token = _login(client, "admin", "Francisco8")
    plans = client.get("/subscriptions/plans").json()
    plan_id = plans[0]["id"]

    create = client.post(
        "/subscriptions/create",
        json={"plan_id": plan_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create.status_code == 200, create.text

    webhook = client.post("/subscriptions/mercadopago/webhook", json={"id": "mp-123"})
    assert webhook.status_code == 200

    me = client.get("/subscriptions/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    body = me.json()
    assert body["subscription_status"] == "active"
    assert body["current_plan"]["alias"] == plans[0]["alias"]

    forbidden = client.get("/mercadolibre/apps", headers={"Authorization": f"Bearer {token}"})
    assert forbidden.status_code in {200, 404}  # router accessible after plan check


def test_subscription_me_refreshes_pending_status(client: TestClient):
    token = _login(client, "admin", "Francisco8")
    plans = client.get("/subscriptions/plans").json()
    plan_id = plans[0]["id"]

    create = client.post(
        "/subscriptions/create",
        json={"plan_id": plan_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create.status_code == 200, create.text

    me = client.get("/subscriptions/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    body = me.json()
    assert body["subscription_status"] == "active"
    assert body["current_plan"]["alias"] == plans[0]["alias"]
