import io
import json
import os
import base64
import unicodedata
import pandas as pd
import numpy as np
import seaborn as sns
import matplotlib.pyplot as plt
from datetime import datetime
from pandas.api.types import is_datetime64_any_dtype, is_numeric_dtype

from ai_module import generate_ai_insights

# ---------------------------------------------------------------------
# 🧩 CONFIGURACIÓN GLOBAL DE PLOTS (Render-safe)
# ---------------------------------------------------------------------
plt.switch_backend("Agg")  # Evita errores en entornos sin display
sns.set_palette("crest")
plt.style.use("seaborn-v0_8-whitegrid")

# Limita el tamaño de los samples usados en gráficas pesadas para
# controlar consumo de memoria/CPU en Render sin perder tendencias globales.
MAX_PLOT_ROWS = 5000
MAX_CORR_COLUMNS = 12
LEARNING_BASE_PATH = "/tmp/learning_profiles"


# ---------------------------------------------------------------------
# 🔧 FUNCIONES AUXILIARES
# ---------------------------------------------------------------------
def fig_to_base64(fig):
    """Convierte una figura Matplotlib a imagen base64."""
    buffer = io.BytesIO()
    fig.savefig(buffer, format="png", bbox_inches="tight", dpi=150)
    plt.close(fig)
    buffer.seek(0)
    return "data:image/png;base64," + base64.b64encode(buffer.read()).decode("utf-8")


def detect_column_types(df):
    """Clasifica columnas por tipo (numérico, categórico, fecha, texto).

    Se trabaja sobre un sample pequeño para evitar conversiones costosas en
    datasets grandes y se usan heurísticas rápidas del dtype de pandas.
    """

    column_types = {}
    sample = df.head(500)
    for col in df.columns:
        series = sample[col]

        if is_datetime64_any_dtype(series):
            column_types[col] = "date"
            continue

        if is_numeric_dtype(series):
            column_types[col] = "numeric"
            continue

        parsed_dates = pd.to_datetime(series, errors="coerce", infer_datetime_format=True)
        date_ratio = parsed_dates.notna().mean()
        if date_ratio > 0.8:
            column_types[col] = "date"
        elif series.nunique(dropna=True) < (len(series) * 0.3):
            column_types[col] = "categorical"
        else:
            column_types[col] = "text"

    return column_types


def compute_health_score(df: pd.DataFrame, column_types: dict) -> dict:
    """Calcula un KPI de salud (0-100) en función de la calidad y riesgos del dataset."""

    total_cells = max(len(df) * max(len(df.columns), 1), 1)
    missing_ratio = df.isna().sum().sum() / total_cells

    # Errores de formato numérico y de fecha
    invalid_numeric = 0
    numeric_points = 0
    invalid_dates = 0
    date_points = 0

    for col, detected_type in column_types.items():
        series = df[col]
        if detected_type == "numeric":
            numeric_points += series.notna().sum()
            coerced = pd.to_numeric(series, errors="coerce")
            invalid_numeric += (series.notna() & coerced.isna()).sum()
        elif detected_type == "date":
            parsed = pd.to_datetime(series, errors="coerce", infer_datetime_format=True)
            date_points += series.notna().sum()
            invalid_dates += (series.notna() & parsed.isna()).sum()

    format_error_ratio = (invalid_numeric + invalid_dates) / max(numeric_points + date_points, 1)
    invalid_date_ratio = invalid_dates / max(date_points, 1)

    # Duplicados y outliers
    duplicate_ratio = df.duplicated().mean() if len(df) else 0
    outlier_counts = 0
    numeric_total = 0

    for col, detected_type in column_types.items():
        if detected_type != "numeric":
            continue
        series = pd.to_numeric(df[col], errors="coerce").dropna()
        if len(series) < 5:
            continue
        q1, q3 = series.quantile([0.25, 0.75])
        iqr = q3 - q1
        lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
        outliers = ((series < lower) | (series > upper)).sum()
        outlier_counts += outliers
        numeric_total += len(series)

    outlier_ratio = outlier_counts / max(numeric_total, 1)

    # Riesgo de quiebre de stock
    stock_col = _find_best_column(df, [["stock"], ["inventario"], ["existencia"], ["bodega"], ["almacen"]])
    stockout_ratio = 0
    if stock_col:
        stock_series = pd.to_numeric(df[stock_col], errors="coerce")
        if stock_series.notna().any():
            stockout_ratio = (stock_series.fillna(0) <= 0).mean()

    # Puntuación (100 perfecto, 0 crítico)
    score = 100
    score -= min(30, missing_ratio * 100 * 0.6)
    score -= min(15, format_error_ratio * 100 * 0.5)
    score -= min(10, invalid_date_ratio * 100 * 0.7)
    score -= min(10, duplicate_ratio * 100)
    score -= min(15, stockout_ratio * 100)
    score -= min(10, outlier_ratio * 100 * 0.5)

    health_score = max(0, min(100, round(score, 1)))

    if health_score >= 85:
        status = "healthy"
    elif health_score >= 60:
        status = "watch"
    else:
        status = "critical"

    drivers = []
    if missing_ratio > 0.02:
        drivers.append(f"{missing_ratio:.1%} de los datos están vacíos o nulos")
    if format_error_ratio > 0.02:
        drivers.append(f"{format_error_ratio:.1%} de los campos numéricos/fecha tienen formato inválido")
    if invalid_date_ratio > 0.01:
        drivers.append(f"{invalid_date_ratio:.1%} de las fechas no pudieron parsearse")
    if duplicate_ratio > 0.01:
        drivers.append(f"{duplicate_ratio:.1%} de las filas son duplicadas")
    if stockout_ratio > 0:
        drivers.append(f"{stockout_ratio:.1%} de los registros muestran stock en cero o negativo")
    if outlier_ratio > 0.05:
        drivers.append(f"{outlier_ratio:.1%} de los valores numéricos son outliers (IQR)")

    recommendations = [
        "Completa o depura las columnas con mayor porcentaje de nulos para estabilizar los KPIs.",
        "Estandariza formatos numéricos y de fecha antes de cargar la información.",
        "Elimina duplicados y valida reglas de unicidad (ID, combinación clave).",
        "Configura alertas de stock mínimo para evitar quiebres en los SKU críticos.",
        "Revisa valores extremos: confirma si son errores de captura o casos de negocio válidos.",
    ]

    return {
        "health_score": health_score,
        "health_status": status,
        "drivers": drivers,
        "recommendations": recommendations,
    }


def json_safe(value):
    """Convierte cualquier valor a formato serializable para JSON."""
    if isinstance(value, (pd.Timestamp, datetime)):
        return value.isoformat()
    elif isinstance(value, (np.int64, np.int32)):
        return int(value)
    elif isinstance(value, (np.float64, np.float32)):
        return float(value)
    elif isinstance(value, (np.bool_)):
        return bool(value)
    elif pd.isna(value):
        return None
    return value


def _infer_dataset_purpose(df: pd.DataFrame) -> str:
    """Determina un propósito aproximado del dataset según sus columnas."""

    purpose_keywords = {
        "ventas": ["venta", "sales", "revenue", "facturacion", "ticket"],
        "stock": ["stock", "inventario", "existencia", "almacen", "bodega"],
        "reservas": ["reserva", "booking", "agenda", "turno"],
        "marketing": ["campana", "campaign", "utm", "clic", "ctr"],
        "financiero": ["gasto", "costo", "ingreso", "presupuesto", "margen"],
    }

    lower_columns = " ".join(df.columns.str.lower())
    for purpose, keywords in purpose_keywords.items():
        if any(keyword in lower_columns for keyword in keywords):
            return purpose
    return "generico"


def _infer_ai_schema(df: pd.DataFrame, column_types: dict, date_field: str | None = None) -> dict:
    """Genera un esquema ligero usando heurísticas cuando no proviene de la IA."""

    date_candidates = [
        date_field,
        *_find_best_column(
            df,
            [["fecha"], ["date"], ["created"], ["dia"], ["mes"], ["semana"]],
            return_all=True,
        ),
    ]
    date_candidates = [col for col in date_candidates if col and col in df.columns and column_types.get(col) == "date"]

    numeric_columns = [c for c, t in column_types.items() if t == "numeric"]
    categorical_columns = [c for c, t in column_types.items() if t == "categorical"]

    detected_date = date_candidates[0] if date_candidates else None

    timeline_granularity = None
    if detected_date:
        timeline_granularity = "month"
        try:
            parsed = pd.to_datetime(df[detected_date], errors="coerce")
            duration_days = (parsed.max() - parsed.min()).days if parsed.notna().any() else 0
            if duration_days <= 40:
                timeline_granularity = "day"
            elif duration_days <= 150:
                timeline_granularity = "week"
        except Exception:
            timeline_granularity = "month"

    suggested_kpis: list[str] = []
    purpose = _infer_dataset_purpose(df)
    if purpose == "ventas":
        suggested_kpis = ["ingresos_totales", "ticket_promedio", "ventas_por_periodo"]
    elif purpose == "stock":
        suggested_kpis = ["rotacion_stock", "dias_inventory", "quiebres"]
    elif purpose == "marketing":
        suggested_kpis = ["clics", "conversiones", "costo_por_lead"]
    else:
        suggested_kpis = ["tendencia_principal", "valor_promedio", "variacion"]

    return {
        "dataset_purpose": purpose,
        "date_column": detected_date,
        "main_numeric_metrics": numeric_columns[:3],
        "main_entity_columns": categorical_columns[:3],
        "suggested_kpis": suggested_kpis,
        "timeline_granularity": timeline_granularity,
    }


def _format_time_label(timestamp, granularity: str | None) -> str:
    if pd.isna(timestamp):
        return "Bloque"

    if granularity == "week":
        iso = timestamp.isocalendar()
        return f"Semana {iso.week} {iso.year}"
    if granularity == "month":
        return timestamp.strftime("%Y-%m")
    if granularity == "day":
        return timestamp.strftime("%Y-%m-%d")
    return str(timestamp)


def _select_frame_indices(values: list[float], min_frames: int = 6, max_frames: int = 12) -> list[int]:
    total = len(values)
    if total == 0:
        return []

    indices: set[int] = {0, total - 1}

    if total > 2:
        peak = int(np.nanargmax(values))
        trough = int(np.nanargmin(values))
        indices.update({peak, trough})

    if total > 3:
        indices.add(total // 2)
    if total > 4:
        indices.update({total // 3, (2 * total) // 3})

    sorted_indices = sorted(indices)
    all_indices = list(range(total))

    if len(sorted_indices) < min_frames:
        remaining = [idx for idx in all_indices if idx not in sorted_indices]
        needed = min(min_frames, total) - len(sorted_indices)
        if remaining and needed > 0:
            picks = np.linspace(0, len(remaining) - 1, num=needed, dtype=int)
            sorted_indices.extend(remaining[pos] for pos in picks)

    if len(sorted_indices) > max_frames:
        picks = np.linspace(0, len(sorted_indices) - 1, num=max_frames, dtype=int)
        sorted_indices = sorted({sorted_indices[pos] for pos in picks})

    return sorted(set(sorted_indices))


def _build_frame_title(idx: int, total: int, primary_label: str, is_peak: bool, is_trough: bool) -> str:
    if idx == 0:
        return "Inicio del periodo analizado"
    if idx == total - 1:
        return "Fin del periodo analizado"
    if is_peak:
        return f"Pico máximo de {primary_label}"
    if is_trough:
        return f"Momento de menor {primary_label}"
    return "Evolución intermedia"


def build_data_movie(df: pd.DataFrame, ai_schema: dict | None) -> dict | None:
    """Construye la estructura de película de datos a partir del esquema AI.

    Retorna ``None`` cuando no hay suficientes datos para generar frames.
    """

    if ai_schema is None or df is None or df.empty:
        return None

    schema = ai_schema or {}
    date_col = schema.get("date_column")
    granularity = schema.get("timeline_granularity") or "none"
    dataset_purpose = schema.get("dataset_purpose") or "generico"

    column_types = detect_column_types(df)
    numeric_candidates = [
        col for col in (schema.get("main_numeric_metrics") or []) if col in df.columns
    ]
    if not numeric_candidates:
        numeric_candidates = [c for c, t in column_types.items() if t == "numeric"]

    has_timeline = False
    frames_data: list[dict] = []

    if date_col and date_col in df.columns:
        working = df.copy()
        working[date_col] = pd.to_datetime(working[date_col], errors="coerce")
        working = working.dropna(subset=[date_col])
        if working.empty:
            return None

        freq_map = {"day": "D", "week": "W", "month": "M"}
        freq = freq_map.get(granularity or "", "M")

        grouped = working.groupby(pd.Grouper(key=date_col, freq=freq))
        for ts, group in grouped:
            if pd.isna(ts) or group.empty:
                continue
            metrics: dict[str, float] = {}
            for metric in numeric_candidates:
                if metric not in group.columns:
                    continue
                numeric_series = pd.to_numeric(group[metric], errors="coerce")
                if numeric_series.notna().any():
                    metrics[metric] = float(numeric_series.sum())
            metrics["count_registros"] = int(len(group))

            frames_data.append(
                {
                    "time_label": _format_time_label(ts, granularity or "month"),
                    "metrics": metrics,
                }
            )
        has_timeline = True
    else:
        total_rows = len(df)
        chunk_count = min(12, max(6, int(np.sqrt(total_rows)) or 1))
        chunk_size = max(1, int(np.ceil(total_rows / chunk_count)))

        for idx in range(0, total_rows, chunk_size):
            block = df.iloc[idx : idx + chunk_size]
            metrics: dict[str, float] = {}
            for metric in numeric_candidates:
                if metric not in block.columns:
                    continue
                numeric_series = pd.to_numeric(block[metric], errors="coerce")
                if numeric_series.notna().any():
                    metrics[metric] = float(numeric_series.mean())
            metrics["count_registros"] = int(len(block))
            frames_data.append(
                {
                    "time_label": f"Bloque {len(frames_data) + 1}",
                    "metrics": metrics,
                }
            )

    if len(frames_data) < 2:
        return None

    primary_metric = (numeric_candidates or ["count_registros"])[0]
    primary_label = primary_metric.replace("_", " ")

    primary_values = [frame["metrics"].get(primary_metric, 0) for frame in frames_data]
    selected_indices = _select_frame_indices(primary_values)
    if not selected_indices:
        return None

    peak_idx = int(np.nanargmax(primary_values)) if primary_values else 0
    trough_idx = int(np.nanargmin(primary_values)) if primary_values else 0

    frames: list[dict] = []
    for order, idx in enumerate(selected_indices):
        frame_data = frames_data[idx]
        time_label = frame_data["time_label"]
        metrics = {k: json_safe(v) for k, v in frame_data["metrics"].items()}

        is_peak = idx == peak_idx
        is_trough = idx == trough_idx

        frame_title = _build_frame_title(idx, len(frames_data), primary_label, is_peak, is_trough)
        subtitle_value = metrics.get(primary_metric, metrics.get("count_registros"))
        subtitle = (
            f"{primary_label.title()}: {subtitle_value:,.2f}" if isinstance(subtitle_value, (int, float)) else "Momento destacado"
        )

        frames.append(
            {
                "id": f"frame_{order + 1}",
                "order": order,
                "time_label": time_label,
                "title": frame_title,
                "subtitle": subtitle,
                "metrics": metrics,
                "context": {
                    "dataset_purpose": dataset_purpose,
                    "granularity": granularity or "none",
                },
            }
        )

    friendly_purpose = {
        "ventas": "ventas",
        "stock": "inventarios",
        "reservas": "reservas",
        "marketing": "campañas",
        "financiero": "finanzas",
    }.get(dataset_purpose, "tus datos")

    return {
        "frames": frames,
        "has_timeline": has_timeline,
        "movie_title": f"Película de datos: {friendly_purpose}",
        "movie_subtitle": "Resumen visual de la evolución de tus datos",
    }


def _get_numeric_series(df, *candidates):
    for name in candidates:
        if name and name in df.columns:
            return pd.to_numeric(df[name], errors="coerce")
    return None


def _normalize(text: str) -> str:
    normalized = unicodedata.normalize("NFD", text)
    without_accents = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    return without_accents.lower()


def _find_best_column(df, keyword_groups, return_all: bool = False):
    """Encuentra columnas que coinciden con grupos de palabras clave.

    Cuando ``return_all`` es ``True`` devuelve todas las columnas ordenadas
    por puntaje; de lo contrario devuelve solo la mejor coincidencia.
    """

    ranked: list[tuple[str, int]] = []
    normalized_cols = {col: _normalize(col) for col in df.columns}
    for col, normalized in normalized_cols.items():
        for keywords in keyword_groups:
            if all(k in normalized for k in keywords):
                ranked.append((col, len(keywords)))

    if not ranked:
        return [] if return_all else None

    ranked.sort(key=lambda item: item[1], reverse=True)
    if return_all:
        return [col for col, _ in ranked]

    return ranked[0][0]


def _learning_profile_path(user_id: str) -> str:
    user_dir = os.path.join(LEARNING_BASE_PATH, user_id)
    os.makedirs(user_dir, exist_ok=True)
    return os.path.join(user_dir, "learning_profile.json")


def _load_learning_profile(user_id: str) -> dict | None:
    if not user_id:
        return None
    path = _learning_profile_path(user_id)
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return None


def _persist_learning_profile(user_id: str, profile: dict) -> None:
    if not user_id:
        return
    path = _learning_profile_path(user_id)
    try:
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(profile, fh, ensure_ascii=False, indent=2)
    except Exception as exc:
        print(f"⚠️ No se pudo guardar el learning_profile: {exc}")


def _compute_current_learning_stats(df: pd.DataFrame, column_types: dict) -> dict:
    stats = {
        "columns": {},
        "anomalies": [],
        "stock_levels": None,
    }

    stock_col = _find_best_column(
        df,
        [["stock"], ["inventario"], ["existencia"], ["bodega"], ["almacen"], ["inventory"]],
    )
    if stock_col:
        stock_series = pd.to_numeric(df[stock_col], errors="coerce")
        if stock_series.notna().any():
            stats["stock_levels"] = {
                "column": stock_col,
                "typical_level": float(stock_series.mean()),
            }

    for col, detected_type in column_types.items():
        series = df[col]
        null_ratio = series.isna().mean()
        entry = {
            "type": detected_type,
            "null_ratio": float(null_ratio),
        }

        if detected_type == "numeric":
            numeric_series = pd.to_numeric(series, errors="coerce")
            if numeric_series.notna().any():
                desc = numeric_series.describe()
                q1, q3 = numeric_series.quantile([0.25, 0.75])
                iqr = q3 - q1
                lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
                outlier_ratio = ((numeric_series < lower) | (numeric_series > upper)).mean()

                entry.update(
                    {
                        "mean": float(desc.get("mean", 0)),
                        "min": float(desc.get("min", 0)),
                        "max": float(desc.get("max", 0)),
                        "std": float(desc.get("std", 0) if not np.isnan(desc.get("std", 0)) else 0),
                        "range": {"p25": float(q1), "p75": float(q3)},
                        "outlier_ratio": float(outlier_ratio),
                    }
                )

                if outlier_ratio > 0.1:
                    stats["anomalies"].append(f"{col}: {outlier_ratio:.0%} de outliers")
        else:
            entry.update({"mean": None, "min": None, "max": None, "std": None, "range": None})

        stats["columns"][col] = entry

    stats["generated_at"] = datetime.utcnow().isoformat()
    return stats


def _compare_with_history(current: dict, historical: dict | None) -> tuple[float, list[str]]:
    if not historical or not historical.get("columns"):
        return 0.0, ["Sin historial previo: se inicializa el perfil de aprendizaje."]

    deviations: list[float] = []
    insights: list[str] = []
    hist_columns = historical.get("columns", {})

    for col, stat in current.get("columns", {}).items():
        hist = hist_columns.get(col)
        if not hist:
            continue

        if stat.get("mean") is not None and hist.get("mean") not in (None, 0):
            mean_dev = abs(stat["mean"] - hist["mean"]) / max(abs(hist["mean"]), 1e-6)
            deviations.append(mean_dev)
            if mean_dev > 0.25:
                insights.append(f"Variación fuerte en {col}: promedio actual {stat['mean']:.2f} vs histórico {hist['mean']:.2f}")

        if stat.get("null_ratio") is not None and hist.get("null_ratio") is not None:
            null_dev = abs(stat["null_ratio"] - hist["null_ratio"])
            deviations.append(null_dev)
            if null_dev > 0.05:
                insights.append(f"Cambio en nulos de {col}: ahora {stat['null_ratio']:.1%} (antes {hist['null_ratio']:.1%})")

        if stat.get("std") is not None and hist.get("std") not in (None, 0):
            std_dev = abs(stat["std"] - hist["std"]) / max(abs(hist["std"]), 1e-6)
            deviations.append(std_dev)
            if std_dev > 0.3:
                insights.append(f"Patrón de variabilidad distinto en {col}: σ {stat['std']:.2f} vs {hist['std']:.2f}")

    if current.get("stock_levels") and historical.get("stock_levels"):
        curr_stock = current["stock_levels"]
        hist_stock = historical["stock_levels"]
        if curr_stock.get("column") == hist_stock.get("column") and hist_stock.get("typical_level"):
            stock_dev = abs(curr_stock["typical_level"] - hist_stock["typical_level"]) / max(
                abs(hist_stock["typical_level"]), 1e-6
            )
            deviations.append(stock_dev)
            if stock_dev > 0.3:
                insights.append(
                    f"Nivel de stock inusual en {curr_stock['column']}: {curr_stock['typical_level']:.2f} vs histórico {hist_stock['typical_level']:.2f}"
                )

    overall = float(round(np.mean(deviations), 3)) if deviations else 0.0
    return overall, insights


def _merge_learning_profile(historical: dict | None, current: dict) -> dict:
    merged = historical.copy() if historical else {"columns": {}, "anomalies": [], "meta": {"files_seen": 0}}
    files_seen = merged.get("meta", {}).get("files_seen", 0)
    new_files_seen = files_seen + 1

    merged["anomalies"] = list(set((historical or {}).get("anomalies", []) + current.get("anomalies", [])))

    for col, stat in current.get("columns", {}).items():
        existing = merged["columns"].get(col, {})
        merged["columns"][col] = {
            "type": stat.get("type") or existing.get("type"),
            "null_ratio": float(
                (
                    existing.get("null_ratio", 0) * files_seen
                    + (stat.get("null_ratio") or 0)
                )
                / new_files_seen
            ),
            "mean": None,
            "min": None,
            "max": None,
            "std": None,
            "range": stat.get("range") or existing.get("range"),
            "outlier_ratio": stat.get("outlier_ratio", existing.get("outlier_ratio")),
        }

        if stat.get("mean") is not None:
            merged["columns"][col]["mean"] = float(
                (
                    (existing.get("mean", 0) or 0) * files_seen
                    + stat["mean"]
                )
                / new_files_seen
            )
            merged["columns"][col]["min"] = (
                stat.get("min")
                if existing.get("min") is None
                else min(existing.get("min"), stat.get("min"))
            )
            merged["columns"][col]["max"] = (
                stat.get("max")
                if existing.get("max") is None
                else max(existing.get("max"), stat.get("max"))
            )
            merged["columns"][col]["std"] = float(
                (
                    (existing.get("std", 0) or 0) * files_seen
                    + (stat.get("std") or 0)
                )
                / new_files_seen
            )

    if current.get("stock_levels"):
        hist_stock = (historical or {}).get("stock_levels")
        curr_stock = current.get("stock_levels")
        if hist_stock and hist_stock.get("column") == curr_stock.get("column"):
            merged["stock_levels"] = {
                "column": curr_stock.get("column"),
                "typical_level": float(
                    (
                        (hist_stock.get("typical_level", 0) or 0) * files_seen
                        + curr_stock.get("typical_level", 0)
                    )
                    / new_files_seen
                ),
            }
        else:
            merged["stock_levels"] = curr_stock

    merged["meta"] = {"files_seen": new_files_seen, "last_updated": datetime.utcnow().isoformat()}
    return merged


def generate_sales_insights(df):
    """Detecta métricas de ventas habituales para entregar hallazgos accionables."""

    product_col = _find_best_column(
        df,
        [
            ["producto"],
            ["articul"],
            ["item"],
            ["sku"],
            ["titulo"],
            ["nombre", "producto"],
            ["descripcion"],
        ],
    )

    units_col = _find_best_column(
        df,
        [
            ["cantidad"],
            ["unid"],
            ["uds"],
            ["qty"],
            ["articul", "vend"],
            ["units", "sold"],
            ["cantidad", "net"],
        ],
    )

    gross_col = _find_best_column(
        df,
        [
            ["venta", "bruta"],
            ["ventas", "brutas"],
            ["gross", "sales"],
            ["ventas", "totales"],
            ["total", "venta"],
            ["monto", "venta"],
            ["importe", "total"],
            ["subtotal"],
        ],
    )

    net_col = _find_best_column(
        df,
        [
            ["venta", "neta"],
            ["ventas", "netas"],
            ["net", "sales"],
            ["ingreso"],
            ["revenue"],
            ["total", "neto"],
        ],
    )

    discount_col = _find_best_column(
        df,
        [
            ["descuento"],
            ["descuent"],
            ["promo"],
            ["rebaj"],
            ["discount"],
            ["cupon"],
        ],
    )

    return_col = _find_best_column(
        df,
        [
            ["devolu"],
            ["refund"],
            ["retorno"],
            ["return"],
        ],
    )

    net_series = _get_numeric_series(df, net_col, gross_col)
    gross_series = _get_numeric_series(df, gross_col)
    discount_series = _get_numeric_series(df, discount_col)
    return_series = _get_numeric_series(df, return_col)
    units_series = _get_numeric_series(df, units_col)

    # Permite deducir ventas netas cuando solo hay ventas brutas y descuentos o devoluciones
    if net_series is None and gross_series is not None:
        net_series = gross_series
        if discount_series is not None:
            net_series = net_series - discount_series.fillna(0)
        if return_series is not None:
            net_series = net_series - return_series.fillna(0)

    insights = []
    if net_series is not None and not net_series.dropna().empty:
        total_net = net_series.sum()
        insights.append(f"Ventas netas totales: {total_net:,.0f}")

    if gross_series is not None and not gross_series.dropna().empty and net_series is not None:
        margin = (net_series.sum() / gross_series.sum()) if gross_series.sum() else None
        if margin:
            insights.append(f"Margen sobre ventas brutas: {margin:.1%}")

    if discount_series is not None and not discount_series.dropna().empty and gross_series is not None:
        disc_rate = discount_series.sum() / gross_series.sum() if gross_series.sum() else None
        if disc_rate is not None:
            insights.append(f"Descuentos vs ventas brutas: {disc_rate:.1%}")

    if return_series is not None and not return_series.dropna().empty and net_series is not None:
        returns_rate = return_series.sum() / net_series.sum() if net_series.sum() else None
        if returns_rate is not None:
            insights.append(f"Impacto de devoluciones: {returns_rate:.1%} del neto")

    if units_series is not None and not units_series.dropna().empty and net_series is not None:
        total_units = units_series.sum()
        if total_units:
            avg_ticket = net_series.sum() / total_units
            insights.append(f"Ticket promedio por unidad: {avg_ticket:,.0f}")

    if product_col and net_series is not None:
        candidate = pd.DataFrame({"producto": df[product_col], "neto": net_series}).dropna()
        top_products = (
            candidate.groupby("producto")["neto"].sum().sort_values(ascending=False).head(3)
        )
        if not top_products.empty:
            formatted = ", ".join([f"{name} ({value:,.0f})" for name, value in top_products.items()])
            insights.append(f"Top productos por ventas netas: {formatted}")

    return insights


def generate_ai_summary(df, column_types, date_field=None, metric_field=None):
    """Genera un resumen textual basado en las métricas reales del dataset."""
    insights = []
    total_rows = len(df)

    sales_insights = generate_sales_insights(df)
    insights.extend(sales_insights)

    # Calidad de datos
    null_ratio = (df.isna().sum() / total_rows).sort_values(ascending=False)
    high_nulls = [
        f"⚠️ {col}: {ratio:.0%} de datos faltantes"
        for col, ratio in null_ratio.items()
        if ratio > 0.15
    ]
    if high_nulls:
        insights.append("Calidad de datos: " + ", ".join(high_nulls))

    # Variables numéricas: variabilidad y outliers
    numeric_cols = [c for c, t in column_types.items() if t == "numeric"]
    if numeric_cols:
        stds = df[numeric_cols].std().sort_values(ascending=False)
        top_variability = [f"{col} (σ={std:.2f})" for col, std in stds.head(3).items() if std > 0]
        if top_variability:
            insights.append(
                "Mayor variabilidad: " + ", ".join(top_variability)
            )

        outlier_msgs = []
        for col in numeric_cols:
            series = df[col].dropna()
            if series.empty:
                continue
            q1, q3 = series.quantile([0.25, 0.75])
            iqr = q3 - q1
            if iqr == 0:
                continue
            lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
            outliers = ((series < lower) | (series > upper)).sum()
            if outliers:
                outlier_msgs.append(
                    f"{col}: {outliers} outliers (≈{outliers / len(series):.0%})"
                )
        if outlier_msgs:
            insights.append("Outliers detectados en " + ", ".join(outlier_msgs))

    # Correlaciones fuertes
    numeric_df = df.select_dtypes(include=[np.number])
    if not numeric_df.empty:
        corr = numeric_df.corr().abs()
        strong_pairs = [
            f"{a}–{b} (ρ={corr.loc[a, b]:.2f})"
            for i, a in enumerate(corr.columns)
            for b in corr.columns[i + 1 :]
            if corr.loc[a, b] >= 0.6
        ]
        if strong_pairs:
            insights.append("Correlaciones fuertes: " + ", ".join(strong_pairs))

    # Fechas y tendencia de negocio
    date_cols = [c for c, t in column_types.items() if t == "date"]
    if date_cols:
        for col in date_cols:
            dates = pd.to_datetime(df[col], errors="coerce").dropna()
            if dates.empty:
                continue
            insights.append(
                f"Ventana temporal en {col}: {dates.min().date()} → {dates.max().date()}"
            )

        if metric_field and metric_field in df.columns:
            metric_series = pd.to_numeric(df[metric_field], errors="coerce")
            if not metric_series.dropna().empty and date_field and date_field in df.columns:
                temp = pd.DataFrame({
                    "date": pd.to_datetime(df[date_field], errors="coerce"),
                    "metric": metric_series,
                }).dropna()
                if not temp.empty:
                    monthly = temp.groupby(temp["date"].dt.to_period("M"))[
                        "metric"
                    ].mean()
                    if len(monthly) >= 2:
                        trend = monthly.iloc[-1] - monthly.iloc[0]
                        direction = "alza" if trend > 0 else "baja"
                        insights.append(
                            f"Tendencia del/la {metric_field}: {direction} de {monthly.iloc[0]:.2f} a {monthly.iloc[-1]:.2f}"
                        )

    # Categóricas dominantes
    categorical_cols = [c for c, t in column_types.items() if t == "categorical"]
    for col in categorical_cols:
        counts = df[col].value_counts(normalize=True).head(3)
        if not counts.empty:
            top = ", ".join([f"{idx} ({val:.0%})" for idx, val in counts.items()])
            insights.append(f"Top categorías en {col}: {top}")

    # Heurísticas de negocio
    business_keywords = {
        "venta": "Analiza ticket promedio y estacionalidad de ventas para detectar picos de demanda.",
        "precio": "Revisa la dispersión de precios y su relación con el volumen para ajustar márgenes.",
        "cliente": "Segmenta clientes por frecuencia o monto para priorizar retención.",
        "producto": "Identifica productos más vendidos y los que generan mayor variabilidad en ingresos.",
    }
    detected = [msg for key, msg in business_keywords.items() if any(key in c.lower() for c in df.columns)]
    if detected:
        insights.append("Pistas de negocio: " + " ".join(detected))

    if not insights:
        insights.append(
            "No se encontraron patrones destacados; revisa la calidad de datos o sube campos de negocio (ventas, clientes, fechas)."
        )

    header = "🤖 Análisis automático basado en tus datos:\n"
    bullets = "\n".join([f"• {text}" for text in insights])
    return f"{header}{bullets}"


# ---------------------------------------------------------------------
# 🧠 FUNCIÓN PRINCIPAL DE ANÁLISIS
# ---------------------------------------------------------------------
def analyze_file(
    df,
    date_field=None,
    metric_field=None,
    segment_by=None,
    file_types=None,
    usage_context: dict | None = None,
    user_id: str | None = None,
):
    """Analiza el dataset y genera estadísticas, gráficos e insights."""
    df = df.copy()
    df = df.replace(["", "NA", "NaN", "None"], np.nan).dropna(how="all")

    graphs = []
    summary = {}
    column_types = detect_column_types(df)

    ai_schema = _infer_ai_schema(df, column_types, date_field=date_field)

    type_counts = {}
    for detected_type in column_types.values():
        type_counts[detected_type] = type_counts.get(detected_type, 0) + 1

    dataset_profile = {
        "row_count": len(df),
        "column_count": len(df.columns),
        "type_counts": type_counts,
        "file_types": sorted(file_types) if file_types else None,
        "column_examples": {
            t: [c for c, detected in column_types.items() if detected == t][:3]
            for t in set(column_types.values())
        },
    }

    # --------------------------------------------------------------
    # 1️⃣ ESTADÍSTICAS DESCRIPTIVAS
    # --------------------------------------------------------------
    for col, t in column_types.items():
        try:
            column_data = df[col]
            if t == "numeric":
                desc = column_data.describe().to_dict()
                summary[col] = {k: json_safe(v) for k, v in desc.items()}
            elif t == "categorical":
                # value_counts puede ser costoso; limitar a top 5 evita pasadas adicionales
                summary[col] = column_data.value_counts().head(5).to_dict()
            elif t == "date":
                summary[col] = {
                    "min": json_safe(column_data.min()),
                    "max": json_safe(column_data.max()),
                    "count": int(column_data.count()),
                }
            else:
                summary[col] = {"unique_values": int(column_data.nunique())}
        except Exception as e:
            summary[col] = {"error": f"No se pudo analizar: {e}"}

    # --------------------------------------------------------------
    # 2️⃣ GRÁFICOS AUTOMÁTICOS SEGÚN TIPO
    # --------------------------------------------------------------
    plot_df = df
    if len(df) > MAX_PLOT_ROWS:
        plot_df = df.sample(n=MAX_PLOT_ROWS, random_state=42)

    for col, t in column_types.items():
        try:
            if t == "numeric":
                # Histograma
                fig, ax = plt.subplots(figsize=(5, 3))
                sns.histplot(plot_df[col], kde=True, color="#3B82F6", ax=ax)
                ax.set_title(f"Distribución de {col}", fontsize=11, weight="bold")
                graphs.append({"column": col, "image": fig_to_base64(fig)})

                # Boxplot
                fig, ax = plt.subplots(figsize=(5, 3))
                sns.boxplot(x=plot_df[col], color="#60A5FA", ax=ax, fliersize=3, linewidth=1)
                ax.set_title(f"Boxplot de {col}", fontsize=11, weight="bold")
                graphs.append({"column": f"Boxplot {col}", "image": fig_to_base64(fig)})

            elif t == "categorical":
                counts = plot_df[col].value_counts().head(6)
                fig, ax = plt.subplots(figsize=(5, 3))
                if len(counts) <= 5:
                    ax.pie(
                        counts.values,
                        labels=counts.index,
                        autopct="%1.1f%%",
                        startangle=90,
                        colors=sns.color_palette("Blues", len(counts)),
                    )
                    ax.set_title(f"Distribución de {col}", fontsize=11, weight="bold")
                else:
                    sns.barplot(x=counts.values, y=counts.index, ax=ax, color="#3B82F6")
                    ax.set_title(f"Frecuencia de {col}", fontsize=11, weight="bold")
                    ax.set_xlabel("Cantidad")
                graphs.append({"column": col, "image": fig_to_base64(fig)})

            elif t == "date":
                df[col] = pd.to_datetime(df[col], errors="coerce")
                counts = plot_df.groupby(plot_df[col].dt.to_period("M")).size()
                if not counts.empty:
                    fig, ax = plt.subplots(figsize=(6, 3))
                    counts.plot(ax=ax, color="#2563EB", linewidth=2)
                    ax.set_title(f"Tendencia temporal ({col})", fontsize=11, weight="bold")
                    graphs.append({"column": f"Tendencia {col}", "image": fig_to_base64(fig)})

        except Exception as e:
            print(f"⚠️ Error generando gráfico para {col}: {e}")

    # Gráfico específico de tendencia de negocio cuando se proporcionan fecha y métrica
    if date_field and metric_field:
        try:
            if date_field in df.columns and metric_field in df.columns:
                temp_df = pd.DataFrame({
                    "fecha": pd.to_datetime(df[date_field], errors="coerce"),
                    "valor": pd.to_numeric(df[metric_field], errors="coerce"),
                }).dropna()
                if not temp_df.empty:
                    monthly = temp_df.groupby(temp_df["fecha"].dt.to_period("M"))["valor"].sum()
                    if not monthly.empty:
                        fig, ax = plt.subplots(figsize=(6, 3))
                        monthly.index = monthly.index.to_timestamp()
                        ax.plot(monthly.index, monthly.values, marker="o", color="#0EA5E9")
                        ax.set_title(
                            f"{metric_field} mensual (agrupado por {date_field})",
                            fontsize=11,
                            weight="bold",
                        )
                        ax.tick_params(axis="x", rotation=35)
                        graphs.append({"column": f"Tendencia {metric_field}", "image": fig_to_base64(fig)})
        except Exception as exc:
            print(f"⚠️ No se pudo generar la tendencia de negocio: {exc}")

    # Gráfico de ranking por segmento si se especifica
    if segment_by and metric_field and segment_by in df.columns and metric_field in df.columns:
        try:
            segment_df = pd.DataFrame({
                "segmento": df[segment_by],
                "valor": pd.to_numeric(df[metric_field], errors="coerce"),
            }).dropna()
            top_segments = (
                segment_df.groupby("segmento")["valor"].mean().sort_values(ascending=False).head(8)
            )
            if not top_segments.empty:
                fig, ax = plt.subplots(figsize=(6, 3.5))
                sns.barplot(x=top_segments.values, y=top_segments.index, ax=ax, palette="crest")
                ax.set_title(
                    f"Top {len(top_segments)} segmentos por {metric_field}",
                    fontsize=11,
                    weight="bold",
                )
                ax.set_xlabel(metric_field)
                graphs.append({"column": f"Ranking de {segment_by}", "image": fig_to_base64(fig)})
        except Exception as exc:
            print(f"⚠️ No se pudo generar el ranking por segmento: {exc}")

    # --------------------------------------------------------------
    # 3️⃣ MATRIZ DE CORRELACIÓN
    # --------------------------------------------------------------
    numeric_df = plot_df.select_dtypes(include=[np.number])
    if not numeric_df.empty and numeric_df.shape[1] > 1:
        try:
            if numeric_df.shape[1] > MAX_CORR_COLUMNS:
                # Selecciona columnas con mayor varianza para acelerar la correlación
                top_variance_cols = numeric_df.var().sort_values(ascending=False).head(MAX_CORR_COLUMNS).index
                numeric_df = numeric_df[top_variance_cols]

            corr_matrix = numeric_df.corr()
            fig, ax = plt.subplots(figsize=(5, 4))
            sns.heatmap(
                corr_matrix,
                annot=True,
                fmt=".2f",
                cmap="crest",
                square=True,
                cbar_kws={"shrink": 0.8},
                ax=ax,
            )
            ax.set_title("Matriz de correlación", fontsize=12, weight="bold")
            graphs.append({"column": "Matriz de correlación", "image": fig_to_base64(fig)})

            # Scatter de la pareja más correlacionada para visualizar la relación
            upper = corr_matrix.where(np.triu(np.ones(corr_matrix.shape), k=1).astype(bool))
            strongest_pair = (
                upper.unstack()
                .dropna()
                .reindex(upper.unstack().dropna().abs().sort_values(ascending=False).index)
            )
            if not strongest_pair.empty:
                best_a, best_b = strongest_pair.index[0]
                if abs(strongest_pair.iloc[0]) >= 0.4:
                    fig, ax = plt.subplots(figsize=(5.5, 3.5))
                    sns.scatterplot(x=numeric_df[best_a], y=numeric_df[best_b], ax=ax, color="#1E3A8A")
                    ax.set_title(
                        f"Relación {best_a} vs {best_b} (ρ={strongest_pair.iloc[0]:.2f})",
                        fontsize=11,
                        weight="bold",
                    )
                    graphs.append({"column": f"Relación {best_a} vs {best_b}", "image": fig_to_base64(fig)})
        except Exception as e:
            print(f"⚠️ Error generando matriz de correlación: {e}")

    # --------------------------------------------------------------
    # 4️⃣ INSIGHTS AUTOMÁTICOS BASADOS EN LOS DATOS
    # --------------------------------------------------------------
    heuristic_summary = generate_ai_summary(
        df=df,
        column_types=column_types,
        date_field=date_field,
        metric_field=metric_field,
    )

    ai_summary = "\n\n".join(
        [
            heuristic_summary,
            generate_ai_insights(
                summary=summary,
                column_types=column_types,
                heuristics=heuristic_summary,
                dataset_profile=dataset_profile,
                usage_context=usage_context,
            ),
        ]
    )

    # --------------------------------------------------------------
    # 5️⃣ MUESTRA DE DATOS LIMPIA PARA JSON
    # --------------------------------------------------------------
    try:
        sample_data = df.head(100).applymap(json_safe).to_dict(orient="records")
    except Exception:
        sample_data = []

    data_health = compute_health_score(df, column_types)

    refined_insights: list[str] = []
    historical_deviation: dict | None = None
    learning_updated = False

    if user_id:
        current_stats = _compute_current_learning_stats(df, column_types)
        historical_profile = _load_learning_profile(user_id)
        deviation_score, insights = _compare_with_history(current_stats, historical_profile)
        refined_insights.extend(insights)
        historical_deviation = {"score": deviation_score, "notes": insights}

        updated_profile = _merge_learning_profile(historical_profile, current_stats)
        _persist_learning_profile(user_id, updated_profile)
        learning_updated = True
    else:
        refined_insights.append("Perfil de aprendizaje no disponible: falta identificador de usuario.")

    data_movie = build_data_movie(df, ai_schema)

    return {
        "summary": summary,
        "graphs": graphs,
        "ai_summary": ai_summary,
        "sample": sample_data,
        "data_health": data_health,
        "refined_insights": refined_insights,
        "historical_deviation": historical_deviation,
        "learning_updated": learning_updated,
        "ai_schema": ai_schema,
        "data_movie": data_movie,
    }
