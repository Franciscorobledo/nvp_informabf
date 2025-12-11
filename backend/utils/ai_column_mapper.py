"""Utility to infer sales column mappings using an LLM."""

import json
import logging
import os
from typing import Dict, List

from openai import OpenAI

from utils.openai_keys import get_openai_api_key

logger = logging.getLogger(__name__)

# Minimal logging configuration in case the host app does not configure it.
if not logger.handlers:
    logging.basicConfig(level=logging.INFO)


def _get_openai_client() -> OpenAI:
    api_key = get_openai_api_key()
    if not api_key:
        raise ValueError("OPENAI_API_KEY no está configurada.")

    return OpenAI(api_key=api_key)


def infer_sales_column_mapping(headers: List[str], sample_rows: List[Dict]) -> Dict[str, str]:
    """Infer a mapping from raw headers to a standard sales schema using an LLM."""

    try:
        client = _get_openai_client()
        model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

        system_prompt = (
            "Eres un asistente experto en datos de ventas. "
            "Analiza encabezados y filas de ejemplo para mapear columnas al esquema estándar. "
            "Responde solo con un JSON válido y nada más."
        )

        user_prompt = (
            "Debes mapear las columnas de ventas a roles estándar. Si no encuentras una buena candidata, usa null.\n"
            "Esquema esperado (roles clave, pero puedes detectar otros si sirven): date, product_name, category, "
            "quantity_sold, revenue, cost, order_id y cualquier otro rol útil.\n"
            "Devuelve únicamente un JSON con esta forma exacta:\n"
            "{\n"
            "  \"date\": \"nombre_columna_o_null\",\n"
            "  \"product_name\": \"nombre_columna_o_null\",\n"
            "  \"category\": \"nombre_columna_o_null\",\n"
            "  \"quantity_sold\": \"nombre_columna_o_null\",\n"
            "  \"revenue\": \"nombre_columna_o_null\",\n"
            "  \"cost\": \"nombre_columna_o_null\"\n"
            "}\n"
            "Encabezados disponibles: {headers}\n"
            "Filas de ejemplo (JSON): {samples}\n"
        ).format(headers=headers, samples=json.dumps(sample_rows, ensure_ascii=False, indent=2))

        response = client.chat.completions.create(
            model=model,
            temperature=0,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )

        content = response.choices[0].message.content if response.choices else ""
        if not content:
            logger.error("La respuesta del modelo está vacía.")
            return {}

        return json.loads(content)
    except Exception as exc:  # pragma: no cover - defensive error handling
        logger.error("Error al inferir el mapeo de columnas: %s", exc)
        return {}
