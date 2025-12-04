import importlib
import os
import sys
from datetime import datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
  sys.path.insert(0, str(BASE_DIR))


def reload_app(tmp_path):
  db_path = tmp_path / "test_meli.db"
  os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
  os.environ["SECRET_KEY"] = "TEST_SECRET_KEY"
  os.environ["USE_MELI_STUB"] = "true"

  for module_name in ["database", "models", "auth", "mercadolibre", "main"]:
    if module_name in sys.modules:
      importlib.reload(sys.modules[module_name])

  import main

  return main


@pytest.fixture()
def client(tmp_path):
  main = reload_app(tmp_path)
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


def test_full_oauth_flow_and_sync(client: TestClient):
  admin_token = _login(client, "admin", "Francisco8")

  user_create = client.post(
    "/auth/users",
    json={
      "username": "test_user",
      "password": "userpass",
      "full_name": "Usuario Mercado Libre",
      "role": "user",
      "active": True,
      "expires_at": None,
    },
    headers={"Authorization": f"Bearer {admin_token}"},
  )
  assert user_create.status_code == 200, user_create.text

  user_token = _login(client, "test_user", "userpass")

  app_payload = {
    "alias": "tienda-prueba",
    "site_id": "MLA",
    "client_id": "CLIENT123",
    "client_secret": "SECRET123",
    "redirect_uri": "https://example.com/meli/callback",
    "webhook_url": "https://example.com/webhook",
  }
  create_app = client.post(
    "/admin/ml/apps",
    json=app_payload,
    headers={"Authorization": f"Bearer {admin_token}"},
  )
  assert create_app.status_code == 200, create_app.text

  start_auth = client.get(
    "/meli/auth",
    params={"app_alias": app_payload["alias"]},
    headers={"Authorization": f"Bearer {user_token}"},
  )
  assert start_auth.status_code == 200, start_auth.text
  state = start_auth.json()["state"]

  callback = client.get("/meli/callback", params={"code": "test-code", "state": state})
  assert callback.status_code == 200, callback.text

  status = client.get(
    "/meli/status",
    params={"app_alias": app_payload["alias"]},
    headers={"Authorization": f"Bearer {user_token}"},
  )
  assert status.status_code == 200, status.text
  connection = status.json()
  assert connection
  assert connection["seller_id"] == "TEST_SELLER_ID"
  assert connection["expires_at"]
  assert datetime.fromisoformat(connection["expires_at"]) > datetime.utcnow()

  refresh = client.post(
    "/meli/refresh",
    json={"app_alias": app_payload["alias"]},
    headers={"Authorization": f"Bearer {user_token}"},
  )
  assert refresh.status_code == 200, refresh.text
  assert "access_token" in refresh.json()

  sync = client.get(
    "/meli/sync",
    params={"app_alias": app_payload["alias"]},
    headers={"Authorization": f"Bearer {user_token}"},
  )
  assert sync.status_code == 200, sync.text
  body = sync.json()
  assert body.get("orders")
  assert body.get("inventory")
