from __future__ import annotations

import base64
import hashlib
import os

from cryptography.fernet import Fernet


def _build_key(secret: str) -> bytes:
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


MASTER_KEY = os.getenv("SHORTS_MASTER_KEY", "dev-shorts-master-key-change-me")
fernet = Fernet(_build_key(MASTER_KEY))


def encrypt_value(value: str | None) -> str | None:
    if not value:
        return None
    return fernet.encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_value(value: str | None) -> str | None:
    if not value:
        return None
    return fernet.decrypt(value.encode("utf-8")).decode("utf-8")
