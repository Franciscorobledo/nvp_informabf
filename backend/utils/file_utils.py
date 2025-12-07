# backend/utils/file_utils.py
import os
from typing import Union

from fastapi import HTTPException, UploadFile


def validate_file(file: Union[UploadFile, str], max_size_bytes: int = 5 * 1024 * 1024) -> bool:
    """Valida si el archivo es CSV, Excel o ZIP con datos y su tamaño.

    Levanta HTTP 413 si excede ``max_size_bytes`` y HTTP 400 si la extensión
    no está permitida.
    """

    filename = file.filename if isinstance(file, UploadFile) else str(file)
    ext = os.path.splitext(filename)[1].lower()

    if isinstance(file, UploadFile) and hasattr(file, "file"):
        current_pos = file.file.tell()
        file.file.seek(0, os.SEEK_END)
        size_bytes = file.file.tell()
        file.file.seek(current_pos, os.SEEK_SET)
    else:
        try:
            size_bytes = os.path.getsize(filename)
        except OSError:
            size_bytes = 0

    if size_bytes > max_size_bytes:
        raise HTTPException(
            status_code=413,
            detail="El archivo excede el tamaño máximo permitido",
        )

    if ext not in [".csv", ".xlsx", ".zip", ".xls"]:
        raise HTTPException(status_code=400, detail="Formato de archivo no soportado. Usa CSV o Excel.")

    return True
