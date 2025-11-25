import importlib
import os
import sys
from datetime import timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))


def reload_app(tmp_path):
    db_path = tmp_path / "test_auth.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    os.environ["SECRET_KEY"] = "TEST_SECRET_KEY"

    for module_name in ["database", "models", "auth", "main"]:
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


def test_login_returns_token_and_role(client: TestClient):
    response = client.post(
        "/auth/login",
        data={"username": "admin", "password": "Francisco8"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["role"] == "admin"
    assert body["username"] == "admin"


def test_regular_user_cannot_access_admin_endpoints(client: TestClient):
    admin_token = _login(client, "admin", "Francisco8")

    create_user = client.post(
        "/auth/users",
        json={
            "username": "regular",
            "password": "userpass",
            "full_name": "Usuario Regular",
            "role": "user",
            "active": True,
            "expires_at": None,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert create_user.status_code == 200, create_user.text

    regular_token = _login(client, "regular", "userpass")

    forbidden_users = client.get(
        "/auth/users",
        headers={"Authorization": f"Bearer {regular_token}"},
    )
    assert forbidden_users.status_code == 403
    assert "privilegios" in forbidden_users.json().get("detail", "").lower()

    forbidden_token_update = client.get(
        "/admin/openai/status",
        headers={"Authorization": f"Bearer {regular_token}"},
    )
    assert forbidden_token_update.status_code == 403


def test_can_create_and_login_new_user_with_custom_password(client: TestClient):
    """Ensure a freshly created user can authenticate with their password."""

    admin_token = _login(client, "admin", "Francisco8")

    create_response = client.post(
        "/auth/users",
        json={
            "username": "benja",
            "password": "1234",
            "full_name": "Benja QA",
            "role": "user",
            "active": True,
            "expires_at": None,
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    assert create_response.status_code == 200, create_response.text

    login_response = client.post(
        "/auth/login",
        data={"username": "benja", "password": "1234"},
    )

    assert login_response.status_code == 200, login_response.text
    payload = login_response.json()
    assert payload["username"] == "benja"
    assert payload["role"] == "user"


def test_expired_token_is_rejected(client: TestClient):
    from auth import create_access_token

    expired_token = create_access_token(
        {"sub": "admin", "role": "admin"},
        expires_delta=timedelta(minutes=-5),
    )

    response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )

    assert response.status_code == 401
    assert response.json().get("detail") == "El token ha expirado"
