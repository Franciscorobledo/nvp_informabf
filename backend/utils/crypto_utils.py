"""Utilidades simples de cifrado simétrico para datos sensibles.

Los secretos de vendedores no deben almacenarse en texto plano. Este
módulo centraliza la generación de llaves y el cifrado/descifrado usando
Fernet.
"""

from __future__ import annotations

import base64
import hashlib
import os
import logging
from functools import lru_cache
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken


def _build_key(raw_secret: str) -> bytes:
    digest = hashlib.sha256(raw_secret.encode()).digest()
    return base64.urlsafe_b64encode(digest)


@lru_cache()
def get_cipher() -> Fernet:
    secret = os.getenv("FERNET_SECRET") or os.getenv("SECRET_KEY", "DEV_SECRET_KEY")
    try:
        return Fernet(_build_key(secret))
    except Exception as exc:  # noqa: BLE001
        logging.error("No se pudo inicializar el cifrador: %s", exc)
        raise


def encrypt_value(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cipher = get_cipher()
    return cipher.encrypt(value.encode()).decode()


def decrypt_value(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    cipher = get_cipher()
    try:
        return cipher.decrypt(value.encode()).decode()
    except InvalidToken:
        logging.error("No se pudo descifrar un valor. Revisa la SECRET_KEY/FERNET_SECRET actual.")
        return None

