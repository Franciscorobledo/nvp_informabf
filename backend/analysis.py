from datetime import datetime
from typing import Dict, List

import numpy as np
import pandas as pd


# ---------------------------------------------------------------------
# 🔧 UTILIDADES PARA LIMPIEZA Y SERIALIZACIÓN
# ---------------------------------------------------------------------
ID_LIKE_KEYWORDS = {"id", "document", "doc", "folio", "numero", "number"}


def json_safe(value):
    """Convierte cualquier valor a formato serializable para JSON."""

    if isinstance(value, (pd.Timestamp, datetime)):
        return value.isoformat()
    if isinstance(value, (np.int64, np.int32)):
        return int(value)
    if isinstance(value, (np.float64, np.float32)):
        return float(value)
    if isinstance(value, (np.bool_)):
        return bool(value)
    if pd.isna(value):
        return None
    return value


def _is_id_like(column: str) -> bool:
    col_lower = column.lower()
    return any(keyword in col_lower for keyword in ID_LIKE_KEYWORDS)


def _series_is_valid(series: pd.Series, max_missing: float = 0.5) -> bool:
    non_null = series.dropna()
    if len(non_null) < 2:
        return False
    if non_null.nunique() < 2:
        return False
    missing_ratio = 1 - (len(non_null) / max(len(series), 1))
    return missing_ratio <= max_missing


def _coerce_dates(series: pd.Series) -> pd.Series:
    return pd.to_datetime(series, errors="coerce", infer_datetime_format=True)


# ---------------------------------------------------------------------
# 🔍 DETECCIÓN DE TIPOS DE COLUMNA
# ---------------------------------------------------------------------
def detect_column_types(df: pd.DataFrame) -> Dict[str, str]:
    """Clasifica columnas por tipo (numérico, categórico, fecha, texto)."""

    types: Dict[str, str] = {}
    for col in df.columns:
        series = df[col]
        non_null = series.dropna()

        # Columnas vacías o constantes
        if non_null.nunique() <= 1:
            types[col] = "constant"
            continue

        # Intentar fecha
        parsed_dates = _coerce_dates(non_null)
        date_ratio = parsed_dates.notna().mean() if len(parsed_dates) else 0
        if date_ratio >= 0.7 and parsed_dates.nunique() >= 2:
            types[col] = "date"
            continue

        # Numérico
        numeric_values = pd.to_numeric(non_null, errors="coerce")
        numeric_ratio = numeric_values.notna().mean() if len(numeric_values) else 0
        if numeric_ratio >= 0.7 and numeric_values.nunique() >= 2:
            types[col] = "numeric"
            continue

        # Categórico
        unique_count = non_null.nunique()
        if unique_count <= min(30, len(non_null) * 0.3):
            types[col] = "categorical"
        else:
            types[col] = "text"

    return types


def cast_dataframe(df: pd.DataFrame, column_types: Dict[str, str]) -> pd.DataFrame:
    """Convierte las columnas a tipos útiles para el análisis."""

    df_casted = df.copy()
    for col, col_type in column_types.items():
        if col_type == "date":
            df_casted[col] = _coerce_dates(df_casted[col])
        elif col_type == "numeric":
            df_casted[col] = pd.to_numeric(df_casted[col], errors="coerce")
    return df_casted


# ---------------------------------------------------------------------
# 📈 GENERACIÓN DE CONFIGURACIONES DE GRÁFICOS
# ---------------------------------------------------------------------
def generate_chart_configs(df: pd.DataFrame, column_types: Dict[str, str]) -> List[Dict]:
    """Crea configuraciones de gráficos relevantes evitando ruido."""

    charts: List[Dict] = []
    numeric_cols = [c for c, t in column_types.items() if t == "numeric"]
    categorical_cols = [c for c, t in column_types.items() if t == "categorical" and not _is_id_like(c)]
    date_cols = [c for c, t in column_types.items() if t == "date"]

    # Series temporales (numéricos agrupados por fecha)
    for date_col in date_cols:
        date_series = df[date_col]
        if not _series_is_valid(date_series):
            continue
        for num_col in numeric_cols:
            series = df[num_col]
            if not _series_is_valid(series):
                continue

            valid_mask = date_series.notna() & series.notna()
            grouped = (
                df.loc[valid_mask]
                .assign(__date=date_series[valid_mask].dt.to_period("D").dt.to_timestamp())
                .groupby("__date")[num_col]
                .sum()
                .reset_index()
            )

            if len(grouped) < 2:
                continue

            charts.append(
                {
                    "chart_type": "line",
                    "category": "time_series",
                    "x_column": date_col,
                    "y_columns": [f"{num_col}_sum"],
                    "description": f"Evolución diaria de {num_col} agrupada por {date_col}",
                    "data": grouped.rename(columns={"__date": date_col, num_col: f"{num_col}_sum"})
                    .sort_values(date_col)
                    .to_dict(orient="records"),
                }
            )

        # Conteo por fecha si no hay métricas numéricas
        if not numeric_cols:
            grouped_counts = (
                date_series.dropna()
                .dt.to_period("D")
                .dt.to_timestamp()
                .value_counts()
                .sort_index()
                .reset_index()
            )
            grouped_counts.columns = [date_col, "count"]
            if len(grouped_counts) >= 2:
                charts.append(
                    {
                        "chart_type": "line",
                        "category": "time_series",
                        "x_column": date_col,
                        "y_columns": ["count"],
                        "description": f"Conteo de registros por {date_col}",
                        "data": grouped_counts.to_dict(orient="records"),
                    }
                )

    # Barras por categoría para métricas numéricas
    for cat_col in categorical_cols:
        cat_series = df[cat_col]
        if not _series_is_valid(cat_series):
            continue
        for num_col in numeric_cols:
            num_series = df[num_col]
            if not _series_is_valid(num_series):
                continue

            grouped = (
                df[[cat_col, num_col]]
                .dropna()
                .groupby(cat_col)[num_col]
                .mean()
                .reset_index()
                .sort_values(num_col, ascending=False)
                .head(12)
            )
            if len(grouped) < 2:
                continue

            charts.append(
                {
                    "chart_type": "bar",
                    "category": "categorical",
                    "x_column": cat_col,
                    "y_columns": [num_col],
                    "description": f"Promedio de {num_col} por {cat_col}",
                    "data": grouped.to_dict(orient="records"),
                }
            )

    # Distribuciones para métricos clave
    for num_col in numeric_cols:
        series = df[num_col]
        if not _series_is_valid(series):
            continue
        histogram, bin_edges = np.histogram(series.dropna(), bins=10)
        if histogram.sum() == 0:
            continue
        bin_labels = [f"{bin_edges[i]:.2f} - {bin_edges[i+1]:.2f}" for i in range(len(bin_edges) - 1)]
        charts.append(
            {
                "chart_type": "histogram",
                "category": "distribution",
                "x_column": num_col,
                "y_columns": ["count"],
                "description": f"Distribución de {num_col}",
                "data": [
                    {"bin": label, "count": int(count)}
                    for label, count in zip(bin_labels, histogram)
                    if count > 0
                ],
            }
        )

    return charts


# ---------------------------------------------------------------------
# 🧠 FUNCIÓN PRINCIPAL DE ANÁLISIS
# ---------------------------------------------------------------------
def analyze_file(df: pd.DataFrame, date_field=None, metric_field=None, segment_by=None):
    """Analiza el dataset y genera estadísticas, gráficos e insights."""

    df = df.replace(["", "NA", "NaN", "None", "null"], np.nan)
    df = df.dropna(how="all")

    column_types = detect_column_types(df)
    df_casted = cast_dataframe(df, column_types)

    summary: Dict[str, Dict] = {}
    for col, col_type in column_types.items():
        series = df_casted[col]
        try:
            if col_type == "numeric":
                desc = series.describe().to_dict()
                summary[col] = {k: json_safe(v) for k, v in desc.items()}
            elif col_type == "categorical":
                summary[col] = series.value_counts().head(5).to_dict()
            elif col_type == "date":
                summary[col] = {
                    "min": json_safe(series.min()),
                    "max": json_safe(series.max()),
                    "count": int(series.count()),
                }
            elif col_type == "constant":
                summary[col] = {"note": "Columna constante, omitida de los gráficos"}
            else:
                summary[col] = {"unique_values": int(series.nunique())}
        except Exception as exc:
            summary[col] = {"error": f"No se pudo analizar: {exc}"}

    charts = generate_chart_configs(df_casted, column_types)

    ai_summary = (
        "🤖 *Análisis automático generado por IA:*\n\n"
        "📊 Se identificaron patrones relevantes en los datos cargados.\n"
        "📈 Los gráficos se adaptaron automáticamente al tipo de variables detectadas.\n"
        "💡 Usa esta información para identificar outliers, correlaciones y tendencias temporales."
    )

    try:
        sample_data = df_casted.head(100).applymap(json_safe).to_dict(orient="records")
    except Exception:
        sample_data = []

    return {
        "summary": summary,
        "charts": charts,
        "ai_summary": ai_summary,
        "sample": sample_data,
    }
