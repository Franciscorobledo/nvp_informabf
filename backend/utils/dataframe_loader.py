import csv
import inspect
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

    supports_nullable = "dtype_backend" in inspect.signature(pd.read_csv).parameters
    read_kwargs = {
        "on_bad_lines": "skip",
        "low_memory": False,
    }
    if supports_nullable:
        read_kwargs["dtype_backend"] = "numpy_nullable"
    if delimiter:
        read_kwargs["sep"] = delimiter

    try:
        return pd.read_csv(buffer, engine="pyarrow", **read_kwargs)
    except Exception as exc:
        fallback_kwargs = {k: v for k, v in read_kwargs.items() if k != "low_memory"}
        buffer.seek(0)
        if not supports_nullable:
            fallback_kwargs.pop("dtype_backend", None)
        try:
            return pd.read_csv(buffer, engine="python", **fallback_kwargs)
        except Exception as inner_exc:  # pragma: no cover - solo si fallan ambos parsers
            raise ValueError(f"No se pudo leer el CSV: {inner_exc}") from exc


def _read_excel(buffer, *, engine: str | None = "openpyxl"):
    try:
        return pd.read_excel(buffer, engine=engine)
    except Exception as exc:
        raise ValueError(f"No se pudo leer el Excel: {exc}") from exc


def read_dataframes(upload, content: bytes) -> list[pd.DataFrame]:
    """Lee un archivo subido (csv, xlsx, xls o zip) y devuelve una lista de DataFrames.

    Se prioriza un parsing rápido y con bajo consumo de memoria:
    - Para CSV se intenta primero el motor "pyarrow" (si está disponible) y se
      desactiva la inferencia agresiva de tipos para evitar múltiples pasadas.
    - Para Excel se usa openpyxl o xlrd, manteniendo compatibilidad.
    """

    ext = os.path.splitext(upload.filename)[1].lower()

    if ext in {".csv", ".xlsx", ".xls"}:
        buffer = io.BytesIO(content)
        if ext == ".csv":
            return [_read_csv(buffer)]
        engine = "xlrd" if ext == ".xls" else "openpyxl"
        return [_read_excel(buffer, engine=engine)]

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
                    elif lower_name.endswith((".xlsx", ".xls")):
                        with archive.open(name) as f:
                            engine = "xlrd" if lower_name.endswith(".xls") else "openpyxl"
                            dataframes.append(_read_excel(f, engine=engine))
            if dataframes:
                return dataframes
            raise ValueError("El ZIP no contiene archivos .csv, .xlsx o .xls legibles.")
        except zipfile.BadZipFile as exc:
            raise ValueError("El archivo ZIP está dañado o vacío.") from exc

    raise ValueError("Formato no soportado o archivo vacío.")
