# backend/ai_module.py
import os
import json
import logging
from openai import OpenAI
from dotenv import load_dotenv

# Cargar variables del entorno
load_dotenv()

# Configurar logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

# Inicializar cliente OpenAI
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise ValueError("❌ No se encontró la variable OPENAI_API_KEY. Verifica tu archivo .env")

client = OpenAI(api_key=api_key)

def generate_ai_insights(summary: dict, column_types: dict):
    """
    Genera un análisis corto y profesional usando OpenAI.
    Limita tokens y controla errores por falta de tokens.
    """
    prompt = f"""
Eres un analista de datos experto.
Aquí tienes un resumen estadístico (formato JSON):
{json.dumps(summary, indent=2)}

Y los tipos de columnas detectadas:
{json.dumps(column_types, indent=2)}

Responde con un resumen breve y claro (máx. 5 líneas), en formato:
📈 Tendencias principales:
⚠️ Anomalías:
💡 Recomendaciones:
No incluyas texto adicional ni introducción.
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Eres un experto en análisis de datos financieros y estadísticos."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=250,  # 🔹 límite bajo para evitar respuestas largas
        )

        content = response.choices[0].message.content.strip()
        logging.info("✅ Análisis IA generado correctamente.")
        return f"🤖 Análisis generado por IA\n{content}"

    except Exception as e:
        error_msg = str(e)
        if "max_tokens" in error_msg or "limit" in error_msg:
            logging.error("⚠️ El modelo alcanzó el límite de tokens.")
            return "⚠️ El modelo alcanzó el límite de tokens. Prueba con un dataset más pequeño o menor detalle."
        logging.error(f"⚠️ Error al generar resumen con IA: {error_msg}")
        return f"⚠️ Error al generar resumen con IA: {error_msg}"
