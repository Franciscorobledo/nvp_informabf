import io
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


def _get_numeric_series(df, *candidates):
    for name in candidates:
        if name and name in df.columns:
            return pd.to_numeric(df[name], errors="coerce")
    return None


def _normalize(text: str) -> str:
    normalized = unicodedata.normalize("NFD", text)
    without_accents = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    return without_accents.lower()


def _find_best_column(df, keyword_groups):
    """Encuentra la columna que mejor coincide con grupos de palabras clave.

    En lugar de depender de un único nombre, se otorga un puntaje a cada
    columna según cuántos términos del grupo estén presentes. Esto permite
    soportar formatos variados (p. ej. "Gross Sales Amount", "Ventas brutas",
    "Monto de venta total").
    """

    best_col = None
    best_score = 0

    normalized_cols = {col: _normalize(col) for col in df.columns}
    for col, normalized in normalized_cols.items():
        for keywords in keyword_groups:
            if all(k in normalized for k in keywords):
                score = len(keywords)
                if score > best_score:
                    best_score = score
                    best_col = col

    return best_col


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
):
    """Analiza el dataset y genera estadísticas, gráficos e insights."""
    df = df.copy()
    df = df.replace(["", "NA", "NaN", "None"], np.nan).dropna(how="all")

    graphs = []
    summary = {}
    column_types = detect_column_types(df)

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

    return {
        "summary": summary,
        "graphs": graphs,
        "ai_summary": ai_summary,
        "sample": sample_data,
        "data_health": data_health,
    }
