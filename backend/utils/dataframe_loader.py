import csv
import io
import os
import zipfile

import pandas as pd


def _sniff_delimiter(sample: bytes):
    """Detecta el delimitador más probable para CSV a partir de una muestra."""
    try:
        decoded = sample.decode("utf-8", errors="ignore")
        dialect = csv.Sniffer().sniff(decoded)
        return dialect.delimiter
    except Exception:
        return None


def _read_csv(buffer):
    """Lee CSV priorizando parsers rápidos y detección de delimitador."""
    sample = buffer.read(2048)
    buffer.seek(0)
    delimiter = _sniff_delimiter(sample)

    read_kwargs = {
        "dtype_backend": "numpy_nullable",
        "on_bad_lines": "skip",
        "low_memory": False,
    }
    if delimiter:
        read_kwargs["sep"] = delimiter

    try:
        return pd.read_csv(buffer, engine="pyarrow", **read_kwargs)
    except Exception:
        fallback_kwargs = {k: v for k, v in read_kwargs.items() if k != "low_memory"}
        return pd.read_csv(buffer, engine="python", **fallback_kwargs)


def _read_excel(buffer):
    return pd.read_excel(buffer, engine="openpyxl")


def read_dataframes(upload, content: bytes) -> list[pd.DataFrame]:
    """Lee un archivo subido (csv, xlsx o zip) y devuelve una lista de DataFrames.

    Se prioriza un parsing rápido y con bajo consumo de memoria:
    - Para CSV se intenta primero el motor "pyarrow" (si está disponible) y se
      desactiva la inferencia agresiva de tipos para evitar múltiples pasadas.
    - Para Excel se usa openpyxl, manteniendo compatibilidad.
    """

    ext = os.path.splitext(upload.filename)[1].lower()

    if ext in {".csv", ".xlsx"}:
        buffer = io.BytesIO(content)
        reader = _read_excel if ext == ".xlsx" else _read_csv
        return [reader(buffer)]

    if ext == ".zip":
        try:
            dataframes = []
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                for name in archive.namelist():
                    lower_name = name.lower()
                    if lower_name.endswith("/"):
                        continue
                    if lower_name.endswith(".csv"):
                        with archive.open(name) as f:
                            dataframes.append(_read_csv(f))
                    elif lower_name.endswith(".xlsx"):
                        with archive.open(name) as f:
                            dataframes.append(_read_excel(f))
            if dataframes:
                return dataframes
        except zipfile.BadZipFile:
            pass

    return []
