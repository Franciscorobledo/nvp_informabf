# backend/ai_module.py
import os
import json
import logging
from openai import OpenAI
from dotenv import load_dotenv

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

# Inicializar cliente OpenAI
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise ValueError(
        "❌ No se encontró la variable OPENAI_API_KEY. Verifica tu archivo .env en backend/"
    )

logging.info("🔐 OPENAI_API_KEY configurada: %s", "sí" if api_key else "no")

client = OpenAI(api_key=api_key)


def check_openai_status():
    """Realiza una comprobación liviana del API de OpenAI para admins."""
    try:
        client.models.list()
        logging.info("✅ Conexión con OpenAI verificada correctamente")
        return {
            "status": "ok",
            "message": "API de OpenAI operativa",
            "usage": get_usage_snapshot(),
            "billing": get_billing_usage(),
        }
    except Exception as exc:
        logging.error("⚠️ No fue posible validar OpenAI: %s", exc)
        return {
            "status": "error",
            "message": str(exc),
            "usage": get_usage_snapshot(),
            "billing": get_billing_usage(),
        }

def generate_ai_insights(summary: dict, column_types: dict, heuristics: str | None = None):
    """Genera un análisis corto y accionable usando OpenAI."""
    prompt = f"""
Actúa como analista de negocio senior y storyteller de datos. Redacta en español claro y conciso.

Resumen estadístico (JSON):
{json.dumps(summary, indent=2)}

Tipos de columna detectados:
{json.dumps(column_types, indent=2)}

Insights heurísticos previos detectados automáticamente (pueden estar incompletos):
{heuristics or "(sin heurísticas)"}

Estructura la respuesta en viñetas, máximo 8 líneas en total:
• Panorama general: volumen de datos y campos clave.
• Hallazgos clave: patrones o correlaciones numéricas concretas.
• Riesgos/Calidad: nulos, outliers o sesgos.
• Recomendaciones accionables: 2-3 acciones priorizadas.
• Ideas de visualización: 2 gráficos específicos que ayudarían a explicar la historia.
Evita texto introductorio o conclusiones largas. Prioriza cifras concretas cuando existan en el resumen.
"""

    try:
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
