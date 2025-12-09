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
# Mejora: se añade estructura clara, tono coherente y reglas explícitas de formato JSON
# ---------------------------------------------------------------------------
MOVIE_SYSTEM_PROMPT = """
🧠 Rol
Eres el Director de Narrativa de Datos (Data Storytelling Director) para InformeBF, plataforma premium de inteligencia de negocios.

🎯 Objetivo
Transformar el resumen de un dataset en una "Película de Datos" cinematográfica y consultiva, rellenando una plantilla JSON sin alterar su estructura.

🎭 Estilo y tono
- Cinematográfico: títulos evocadores ("El Ascenso del Héroe", "Tormenta en el Horizonte").
- Perspicaz: explica el impacto, no solo la variación numérica.
- Consultivo y empático: guía al dueño del negocio con firmeza y tacto.

⚙️ Instrucciones
1) Detección de dominio: adapta vocabulario al campo detectado (ventas, inventario, marketing, clientes, etc.).
2) Guion (4-6 escenas):
   - Escena 1: Gancho/Intro (titular actual del negocio).
   - Escena 2: Viaje/Tendencia (evolución y estacionalidad).
   - Escena 3: Protagonistas/Ranking (top contribuyentes; aplica 80/20).
   - Escena 4: Conflicto/Riesgos (caídas, quiebres de stock, costos altos).
   - Escena 5: Clímax/Comparativa o Correlación (relaciones clave).
   - Escena 6: Resolución/Cierre (conclusiones y próximos pasos).
3) Dirección de arte (visualizaciones):
   - Evolución → Línea; Comparación → Barras; Composición → Donut/Pie (pocas categorías); Correlación → Dispersión.
   - Solo sugiere anotaciones si la plantilla lo permite (ej. "Pico histórico").
4) Narrativa:
   - Título: breve y memorable.
   - Narración: 2-3 frases con conectores lógicos.
   - Bullets: insights accionables, evitando repetir valores literales.

📊 Formato esperado
- Devuelve únicamente el JSON completado según la plantilla recibida.
- No cambies, borres ni agregues campos.
- No inventes datos; usa solo el resumen entregado.
- Sé conciso y prioriza hallazgos muy positivos o negativos en los títulos.
"""

MOVIE_USER_BASE_PROMPT = """
🧠 Rol
Eres el asistente creativo que completa la "Película de datos" premium para InformeBF.

🎯 Objetivo
Analizar el resumen del dataset y rellenar la PLANTILLA JSON exacta proporcionada.

⚙️ Instrucciones
- Identifica internamente el dominio (ventas, stock, tráfico, genérico u otro) sin pedir más datos.
- Completa títulos, descripciones, bullets, indicadores y configuraciones de gráfico respetando la estructura original.
- No elimines ni agregues campos; no modifiques claves del JSON.
- Usa lenguaje sencillo para pymes, tono consultivo y dinámico.
- Mantén textos breves: títulos, un párrafo por escena y bullets accionables.

📊 Formato esperado
- Devuelve únicamente el JSON final, sin explicaciones ni razonamiento.
- No solicites datos adicionales; asume que solo tienes el resumen entregado.
- Optimiza tokens evitando redundancias.

A continuación recibirás el resumen del dataset y la PLANTILLA JSON a completar.
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

    # Mejora: rol claro, estructura en secciones y límites explícitos para cada bloque
    prompt = f"""
🧠 Rol
Eres analista de datos para pymes. Usa únicamente la información provista; no inventes campos ni métricas.

🎯 Objetivo
Redactar hallazgos breves y accionables sin gráficos ni estadística avanzada.

📌 Contexto
- {dataset_context}
- Heurísticas rápidas: {heuristics or '(sin heurísticas)'}

📂 Datos disponibles
- Resumen JSON:
{json.dumps(summary, indent=2)}
- Tipos detectados:
{json.dumps(column_types, indent=2)}

📊 Formato esperado (en español)
1) 📝 Resumen ejecutivo: 2-3 líneas en párrafo.
2) ⚠️ Alertas críticas: máximo 3 viñetas.
3) 🚀 Oportunidades de mejora: máximo 3 viñetas.
4) ✔️ Acciones recomendadas: máximo 5 viñetas.

🚦 Reglas
- Sé directo, evita relleno y repeticiones.
- Prioriza tendencias simples (↑/↓), variaciones relevantes, estacionalidad básica y productos/categorías/clientes destacados.
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

    # Mejora: instrucciones enumeradas y límite de viñetas explícito
    prompt = f"""
🧠 Rol
Eres arquitecto de datos. Con una muestra pequeña, deduce esquema y utilidad de columnas.

🎯 Objetivo
Proponer rápidamente campos clave y alertas de calidad.

📌 Contexto de negocio: {focus or 'sin foco declarado'}
📂 Muestra (JSON):
{json.dumps(preview_rows, ensure_ascii=False, indent=2, default=str)}
📊 Perfil de columnas:
{json.dumps(column_hints, ensure_ascii=False, indent=2)}

⚙️ Instrucciones de respuesta (en español)
- Indica columnas sugeridas para fechas, métricas y dimensiones.
- Señala problemas rápidos de calidad (nulos, formatos inconsistentes, diccionarios).
- Expón suposiciones sobre la semántica del dataset.
- Máximo 8 viñetas en total.
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


def generate_dataset_chat_reply(dataset_context: dict, user_message: str) -> str:
    """Genera una respuesta contextualizada para el chat de datasets."""

    if not user_message or not user_message.strip():
        raise ValueError("El mensaje de usuario no puede estar vacío.")

    dataset_name = dataset_context.get("dataset_name") or "Dataset sin nombre"
    ai_summary = dataset_context.get("ai_summary") or "Sin resumen automático disponible."
    refined_insights = dataset_context.get("refined_insights") or []
    data_health = dataset_context.get("data_health") or {}
    sample_rows = dataset_context.get("sample") or []
    column_types = dataset_context.get("column_types") or {}
    dataset_profile = dataset_context.get("dataset_profile") or {}
    metadata = dataset_context.get("metadata") or {}

    health_notes = []
    quality_score = data_health.get("score")
    if quality_score is not None:
        health_notes.append(f"Puntaje de calidad: {quality_score}/100")
    if data_health.get("warnings"):
        health_notes.extend(data_health.get("warnings", []))

    profile_summary = (
        f"Filas: {dataset_profile.get('row_count', 'desconocido')} | "
        f"Columnas: {dataset_profile.get('column_count', 'desconocido')} | "
        f"Tipos: {dataset_profile.get('type_counts', {})}"
    )

    sample_excerpt = sample_rows[:5]
    # Mejora: formato ordenado, tono y límites claros para las recomendaciones
    prompt = f"""
🧠 Rol
Asesor de negocio senior que responde en español con tono consultivo y accionable.

🎯 Objetivo
Responder la consulta usando solo la información disponible, sin inventar métricas.

📌 Contexto del dataset
- Nombre: {dataset_name}
- Perfil: {profile_summary}
- Columnas detectadas: {json.dumps(column_types, ensure_ascii=False)}
- Resumen IA: {ai_summary}
- Insights clave: {json.dumps(refined_insights[:6], ensure_ascii=False)}
- Calidad de datos: {json.dumps(health_notes, ensure_ascii=False)}
- Muestra de filas (máx 5): {json.dumps(sample_excerpt, ensure_ascii=False, default=str)}
- Metadatos: {json.dumps(metadata, ensure_ascii=False)}

⚙️ Instrucciones de respuesta
- Ofrece 2-4 recomendaciones accionables o indicadores según la pregunta.
- Si no se puede responder, explica la limitación y sugiere el dato faltante.
- Usa viñetas para acciones y cierra con el siguiente mejor paso.
"""

    try:
        client = _get_openai_client()
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "Eres un asesor de analítica para pymes que responde de forma concreta y accionable.",
                },
                {"role": "user", "content": prompt},
                {
                    "role": "user",
                    "content": user_message.strip(),
                },
            ],
            temperature=0.35,
            max_tokens=420,
        )

        content = response.choices[0].message.content.strip()
        usage = getattr(response, "usage", None)
        record_openai_usage(
            model="gpt-4o-mini",
            prompt_tokens=getattr(usage, "prompt_tokens", None) if usage else None,
            completion_tokens=getattr(usage, "completion_tokens", None) if usage else None,
            source="dataset_chat",
            action="dataset_chat",
        )
        return content
    except Exception as exc:  # noqa: BLE001
        logging.error("⚠️ Error en chat de dataset: %s", exc)
        raise


def classify_tabular_dataset(
    columns: list[str],
    sample_rows: list[dict],
    schema_definition: str,
    model_name: str = "gpt-3.5-turbo",
) -> dict:
    """Mapea un archivo tabular a un esquema estándar usando OpenAI."""

    system_prompt = (
        "Eres un asistente experto en datos de negocio."
        " Usa nombres de columnas tal como llegan para mapear ventas o stock al esquema estándar."
        " Prioriza devolver un mapeo exacto si reconoces el patrón; si no hay suficiente señal, responde 'unknown'."
        " Evita inventar campos y responde SOLO con JSON."
    )

    user_prompt = f"""
Eres un asistente experto en datos de negocio. Recibes un listado de columnas y algunas filas de ejemplo.
Debes:
1) determinar si el archivo representa datos de VENTAS ('sales'), de STOCK ('stock') o 'unknown';
2) mapear las columnas originales a un esquema estándar (usa el nombre original exacto);
3) indicar si faltan columnas requeridas. Si las columnas encajan con ventas o stock conocidas, devuelve el mapeo directo sin pedir más contexto.

Esquema estándar disponible:
{schema_definition}

Columnas detectadas: {columns}
Filas de ejemplo:
{json.dumps(sample_rows, ensure_ascii=False)}

Responde únicamente con JSON válido.
"""

    try:
        client = _get_openai_client()
        primary_model = model_name or "gpt-3.5-turbo"
        response = client.chat.completions.create(
            model=primary_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0,
            max_tokens=300,
        )
        content = response.choices[0].message.content.strip()
        parsed = json.loads(content)

        if parsed.get("type") == "unknown" and primary_model != "gpt-4o":
            logging.info("🔁 Reintentando clasificación con GPT-4 por baja confianza del modelo económico")
            try:
                fallback_response = client.chat.completions.create(
                    model="gpt-4o",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    temperature=0,
                    max_tokens=300,
                )
                fallback_content = fallback_response.choices[0].message.content.strip()
                parsed = json.loads(fallback_content)
            except Exception as retry_exc:  # noqa: BLE001
                logging.warning("⚠️ Reintento con GPT-4 fallido: %s", retry_exc)

        return parsed
    except Exception as exc:  # pragma: no cover - llamada externa
        logging.error("⚠️ No se pudo clasificar dataset con IA: %s", exc)
        return {"type": "unknown", "reason": str(exc)}
