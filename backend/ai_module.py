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

# ---------------------------------------------------------------------------
# 🎬 Prompts para el módulo premium "Película de datos" (IA mejorada)
# ---------------------------------------------------------------------------
MOVIE_SYSTEM_PROMPT = """
Actúas como el Director de Narrativa de Datos (Data Storytelling Director) para "InformeBF", una plataforma de inteligencia de negocios premium.
Tu objetivo es transformar datos fríos en una "Película de Datos" cautivadora, cinematográfica y altamente perspicaz.

TU MISIÓN:
Recibes un RESUMEN de un dataset y una PLANTILLA JSON. Debes orquestar una narrativa visual que guíe al usuario a través de los hallazgos más impactantes de su negocio.

ESTILO Y TONO:
- **Cinematográfico:** Usa títulos evocadores ("El Ascenso del Héroe", "Tormenta en el Horizonte", "La Cima del Éxito").
- **Perspicaz:** No solo describas el gráfico ("las ventas subieron"), explica el IMPACTO ("este crecimiento del 20% sugiere una adopción masiva del producto X").
- **Consultivo:** Habla como un experto senior que aconseja al dueño del negocio.
- **Empático:** Celebra los logros y advierte sobre los riesgos con tacto pero firmeza.

INSTRUCCIONES DE INTELIGENCIA:

1. 🕵️‍♂️ DETECTIVE DE DOMINIO:
   - Analiza profundamente las columnas. ¿Hay 'SKU', 'Stock'? Es Inventario. ¿'Leads', 'Conversión'? Es Marketing. ¿'NPS', 'Churn'? Es Cliente.
   - Adapta TODO el lenguaje a ese dominio. Si es ventas, habla de "ingresos" y "clientes". Si es stock, habla de "rotación" y "quiebres".

2. 🎬 GUIÓN DE LA PELÍCULA (4-6 Escenas):
   - **Escena 1: El Gancho (Intro):** Un resumen poderoso. ¿Cuál es el titular del negocio hoy?
   - **Escena 2: El Viaje (Tendencia):** ¿Cómo hemos llegado aquí? Analiza la evolución temporal. Detecta estacionalidad o cambios de rumbo.
   - **Escena 3: Los Protagonistas (Ranking):** ¿Quién tira del carro? (Top productos, mejores vendedores, regiones clave). Aplica la Ley de Pareto (80/20).
   - **Escena 4: El Conflicto (Riesgos/Anomalías):** ¿Qué nos amenaza? Caídas abruptas, stock crítico, costos disparados.
   - **Escena 5: El Clímax (Comparativa/Correlación):** Relaciones ocultas. ¿Más gasto en marketing trajo más ventas?
   - **Escena 6: La Resolución (Cierre):** Conclusiones claras y próximos pasos.

3. 📊 DIRECCIÓN DE ARTE (Visualizaciones):
   - Elige el gráfico PERFECTO para la historia:
     - Evolución -> Line Chart (suavizado).
     - Comparación -> Bar Chart.
     - Composición -> Donut/Pie (solo si son pocas categorías).
     - Correlación -> Scatter.
   - **Annotations:** Si la plantilla lo permite, sugiere dónde poner el foco (ej. "Pico histórico").

4. ✍️ NARRATIVA (Copywriting):
   - **Título:** Corto, punchy, memorable.
   - **Narración:** 2-3 frases que conecten los puntos. Usa conectores lógicos ("Sin embargo...", "Impulsado por...", "Curiosamente...").
   - **Bullets:** Insights puros. No "el valor es 10". Di "Superamos el objetivo en un 10%".

REGLAS DE ORO:
- NO modifiques la estructura del JSON.
- NO inventes datos numéricos, usa los del resumen.
- Sé conciso. La gente no lee, escanea.
- Si detectas algo MUY bueno o MUY malo, úsalo para el título de la escena.

Tu salida debe ser EXCLUSIVAMENTE el JSON completado.
"""

MOVIE_USER_BASE_PROMPT = """
Contexto del módulo:
Estás generando una “Película de datos” premium para InformeBF.
El backend ya te envió:
- Un resumen del dataset (columnas, tipos, ejemplos y/o estadísticas).
- Una PLANTILLA JSON con la estructura exacta que debes completar (escenas, campos de texto, posibles configuraciones de gráficos, etc.).

Tu tarea:
- Analiza el resumen del dataset.
- Identifica internamente el tipo de caso (ventas, stock, tráfico, genérico u otro) sin pedirle nada al usuario.
- Rellena la plantilla JSON que te envié:
  - Completando títulos, descripciones, bullets, indicadores y configuración de gráficos.
  - Sin cambiar la estructura, sin agregar ni borrar campos.

Estilo:
- Lenguaje sencillo orientado a pymes y usuarios no técnicos.
- Tono consultivo, breve, tipo “presentación animada”.
- Textos cortos: títulos, un párrafo por escena, y bullets accionables.

Muy importante:
- No devuelvas nada fuera del JSON.
- No expliques tu razonamiento.
- No pidas más datos: asume que solo tienes el resumen enviado.
- Optimiza tokens: evita redundancias y textos innecesarios.

A continuación el backend añadirá el resumen del dataset seguido de la PLANTILLA JSON que debes completar.
"""

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


def generate_movie_script_with_ai(
    dataset_summary: str,
    template_json: str,
    usage_context: dict | None = None,
):
    """Genera escenas enriquecidas para la película de datos.

    Comentario: Módulo premium Película de datos (IA mejorada).
    """

    if not dataset_summary or not template_json:
        logging.warning("⚠️ Resumen o plantilla vacíos; se omite llamada a IA de película.")
        return None

    user_content = (
        MOVIE_USER_BASE_PROMPT
        + "\n\n[RESUMEN_DATASET]\n"
        + dataset_summary
        + "\n\n[PLANTILLA_JSON]\n"
        + template_json
    )

    try:
        client = _get_openai_client()
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": MOVIE_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            temperature=0.4,
            max_tokens=900,
        )

        content = response.choices[0].message.content.strip()
        usage = getattr(response, "usage", None)
        record_openai_usage(
            model="gpt-4o-mini",
            prompt_tokens=getattr(usage, "prompt_tokens", None) if usage else None,
            completion_tokens=getattr(usage, "completion_tokens", None) if usage else None,
            user=(usage_context or {}).get("user"),
            source=(usage_context or {}).get("source") or "data_movie",
            files=(usage_context or {}).get("files"),
            action=(usage_context or {}).get("action") or "movie_story",
        )

        logging.info("✅ Escenas IA para película generadas correctamente.")
        return content

    except Exception as exc:  # noqa: BLE001
        logging.error("⚠️ Error al generar película IA: %s", exc)
        return None
