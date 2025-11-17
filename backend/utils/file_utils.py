
# backend/utils/file_utils.py
import os

def validate_file(filename: str) -> bool:
    """Valida si el archivo es CSV o Excel."""
    ext = os.path.splitext(filename)[1].lower()
    return ext in [".csv", ".xlsx"]

