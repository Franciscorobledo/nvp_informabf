# backend/ai_module.py
import os
import json
import logging
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
    column_examples = profile.get("column_examples") or {}
    row_count = profile.get("row_count")
    column_count = profile.get("column_count")

    dataset_context = f"""
Contexto del dataset:
• Tipos de archivo detectados: {", ".join(sorted(file_types))}
• Tamaño: {row_count} filas x {column_count} columnas
• Mezcla de columnas: {json.dumps(type_counts, ensure_ascii=False)}
• Columnas representativas por tipo: {json.dumps(column_examples, ensure_ascii=False)}
"""

    prompt = f"""
Actúa como analista de negocio senior y storyteller de datos. Redacta en español claro y conciso.

{dataset_context}

Resumen estadístico (JSON):
{json.dumps(summary, indent=2)}

Tipos de columna detectados:
{json.dumps(column_types, indent=2)}

Insights heurísticos previos detectados automáticamente (pueden estar incompletos):
{heuristics or "(sin heurísticas)"}

Estructura la respuesta en viñetas, máximo 8 líneas en total, diferenciando entre información útil y genérica:
• Accionables priorizados (3 viñetas): acciones específicas basadas en los datos. Si hay fechas, habla de estacionalidad o tendencia; si hay métricas numéricas, menciona cómo optimizarlas; si predominan categorías, sugiere segmentación o ranking. Evita lugares comunes.
• Señales rápidas (3 viñetas): hallazgos directos del dataset (calidad, correlaciones fuertes, cobertura temporal) que ayuden a decidir próximos análisis.
• Visualizaciones recomendadas (2 viñetas): gráficos concretos que expliquen los hallazgos para negocio.
No repitas texto del resumen heurístico; complementa con decisiones accionables y priorizadas. Evita relleno o frases vagas.
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
            max_tokens=320,  # 🔹 Permite contexto adicional sin respuestas extensas
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
        )
        logging.info("✅ Análisis IA generado correctamente.")
        return f"🤖 Análisis generado por IA\n{content}"

    except Exception as e:
        error_msg = str(e)
        if "max_tokens" in error_msg or "limit" in error_msg:
            logging.error("⚠️ El modelo alcanzó el límite de tokens.")
            return "⚠️ El modelo alcanzó el límite de tokens. Prueba con un dataset más pequeño o menor detalle."
        logging.error(f"⚠️ Error al generar resumen con IA: {error_msg}")
        return f"⚠️ Error al generar resumen con IA: {error_msg}"
