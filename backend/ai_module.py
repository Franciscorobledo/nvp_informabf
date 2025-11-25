# backend/ai_module.py
import os
import json
import logging
from datetime import datetime
from openai import OpenAI
from dotenv import load_dotenv

from utils.openai_keys import get_openai_api_key
from utils.openai_monitor import (
    record_openai_usage,
    get_usage_snapshot,
    get_billing_usage,
)

# Cargar variables del entorno desde el archivo local del backend
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DOTENV_PATH = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path=DOTENV_PATH, override=False)

# Configurar logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logging.info("📄 Variables de entorno cargadas desde: %s", DOTENV_PATH)


def _get_openai_client() -> OpenAI:
    api_key = get_openai_api_key()
    if not api_key:
        raise ValueError(
            "❌ No se encontró el token de OpenAI. Configura uno válido para continuar."
        )

    logging.info("🔐 OPENAI_API_KEY configurada: %s", "sí" if api_key else "no")
    return OpenAI(api_key=api_key)


def check_openai_status():
    """Realiza una comprobación liviana del API de OpenAI para admins."""
    try:
        client = _get_openai_client()
        client.models.list()
        logging.info("✅ Conexión con OpenAI verificada correctamente")
        return {
            "status": "ok",
            "message": "API de OpenAI operativa",
            "usage": get_usage_snapshot(),
            "billing": get_billing_usage(api_key=client.api_key),
        }
    except Exception as exc:
        logging.error("⚠️ No fue posible validar OpenAI: %s", exc)
        return {
            "status": "error",
            "message": str(exc),
            "usage": get_usage_snapshot(),
            "billing": get_billing_usage(),
        }

def generate_ai_insights(
    summary: dict,
    column_types: dict,
    heuristics: str | None = None,
    dataset_profile: dict | None = None,
    usage_context: dict | None = None,
):
    """Genera un análisis corto y accionable usando OpenAI."""
    profile = dataset_profile or {}
    file_types = profile.get("file_types") or ["desconocido"]
    type_counts = profile.get("type_counts") or {}
    row_count = profile.get("row_count")
    column_count = profile.get("column_count")

    dataset_context = (
        f"Archivo(s): {', '.join(sorted(file_types))} | "
        f"Filas: {row_count} | Columnas: {column_count} | "
        f"Tipos: {json.dumps(type_counts, ensure_ascii=False)}"
    )

    prompt = f"""
Eres analista de datos para PYMES. Usa solo la información provista, sin inventar campos.
Texto breve, concreto y accionable. Prohibido: gráficos, estadística avanzada o descripciones columna por columna.

Contexto:
- {dataset_context}
- Heurísticas rápidas: {heuristics or '(sin heurísticas)'}

Datos en JSON:
{json.dumps(summary, indent=2)}
Tipos detectados:
{json.dumps(column_types, indent=2)}

Genera exactamente estos 4 bloques en español:
1) 📝 Resumen ejecutivo: 2-3 líneas en párrafo.
2) ⚠️ Alertas críticas: máximo 3 viñetas.
3) 🚀 Oportunidades de mejora: máximo 3 viñetas.
4) ✔️ Acciones recomendadas: máximo 5 viñetas.

Prioriza tendencias simples (↑/↓), variaciones relevantes, estacionalidad básica y productos/categorías/clientes destacados. Sé directo y evita relleno.
"""

    try:
        client = _get_openai_client()
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Eres un experto en análisis de datos financieros y estadísticos. "
                        "Entrega respuestas concisas, accionables y orientadas a negocio."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.35,
            max_tokens=220,
        )

        content = response.choices[0].message.content.strip()
        usage = getattr(response, "usage", None)
        record_openai_usage(
            model="gpt-4o-mini",
            prompt_tokens=getattr(usage, "prompt_tokens", None) if usage else None,
            completion_tokens=getattr(usage, "completion_tokens", None) if usage else None,
            user=(usage_context or {}).get("user"),
            source=(usage_context or {}).get("source"),
            files=(usage_context or {}).get("files"),
            action=(usage_context or {}).get("action") or "analysis",
        )
        logging.info("✅ Análisis IA generado correctamente.")
        return content

    except Exception as e:
        error_msg = str(e)
        if "max_tokens" in error_msg or "limit" in error_msg:
            logging.error("⚠️ El modelo alcanzó el límite de tokens.")
            return "⚠️ El modelo alcanzó el límite de tokens. Prueba con un dataset más pequeño o menor detalle."
        logging.error(f"⚠️ Error al generar resumen con IA: {error_msg}")
        return f"⚠️ Error al generar resumen con IA: {error_msg}"


def infer_dataset_schema_with_ai(sample_df, focus: str | None = None):
    """Infieren campos clave del dataset usando un sample liviano."""

    try:
        import pandas as pd
    except Exception:
        pd = None

    if sample_df is None or getattr(sample_df, "empty", True):
        return "No se pudo generar el pre-análisis porque la muestra está vacía."

    preview_rows = sample_df.head(10).applymap(
        lambda value: value.isoformat()
        if isinstance(value, datetime)
        else value
    ).to_dict(orient="records")
    column_hints = {}

    if pd is not None:
        for col in sample_df.columns:
            series = sample_df[col]
            column_hints[col] = {
                "dtype": str(series.dtype),
                "null_ratio": float(series.isna().mean()),
                "unique_values": int(series.nunique(dropna=True)),
            }

    prompt = f"""
Actúa como arquitecto de datos. Con una muestra pequeña, identifica esquema y columnas útiles.

Contexto de negocio: {focus or 'sin foco declarado'}.
Muestra de registros (JSON):
{json.dumps(preview_rows, ensure_ascii=False, indent=2, default=str)}

Perfil de columnas:
{json.dumps(column_hints, ensure_ascii=False, indent=2)}

Entrega en español:
- Columnas clave sugeridas para fechas, métricas y dimensiones.
- Problemas rápidos de calidad (nulos, formatos inconsistentes, diccionario).
- Suposiciones sobre la semántica del dataset.
Responde en máximo 8 viñetas.
"""

    try:
        client = _get_openai_client()
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "Eres experto en arquitectura de datos y detección de esquemas.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            max_tokens=280,
        )
        content = response.choices[0].message.content.strip()
        usage = getattr(response, "usage", None)
        record_openai_usage(
            model="gpt-4o-mini",
            prompt_tokens=getattr(usage, "prompt_tokens", None) if usage else None,
            completion_tokens=getattr(usage, "completion_tokens", None) if usage else None,
            source="schema_inference",
            action="schema_inference",
        )
        return content
    except Exception as exc:
        logging.error("⚠️ Error en inferencia de esquema IA: %s", exc)
        return "⚠️ No se pudo generar el esquema con IA (revisa la clave de OpenAI o intenta más tarde)."
