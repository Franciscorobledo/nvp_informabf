import io
import base64
import pandas as pd
import numpy as np
import seaborn as sns
import matplotlib.pyplot as plt
from datetime import datetime

from ai_module import generate_ai_insights

# ---------------------------------------------------------------------
# 🧩 CONFIGURACIÓN GLOBAL DE PLOTS (Render-safe)
# ---------------------------------------------------------------------
plt.switch_backend("Agg")  # Evita errores en entornos sin display
sns.set_palette("crest")
plt.style.use("seaborn-v0_8-whitegrid")


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
    """Clasifica columnas por tipo (numérico, categórico, fecha, texto)."""
    column_types = {}
    for col in df.columns:
        try:
            pd.to_datetime(df[col])
            column_types[col] = "date"
        except Exception:
            if np.issubdtype(df[col].dtype, np.number):
                column_types[col] = "numeric"
            elif df[col].nunique() < (len(df) * 0.3):
                column_types[col] = "categorical"
            else:
                column_types[col] = "text"
    return column_types


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


def generate_ai_summary(df, column_types, date_field=None, metric_field=None):
    """Genera un resumen textual basado en las métricas reales del dataset."""
    insights = []
    total_rows = len(df)

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
def analyze_file(df, date_field=None, metric_field=None, segment_by=None, file_types=None):
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
            if t == "numeric":
                desc = df[col].describe().to_dict()
                summary[col] = {k: json_safe(v) for k, v in desc.items()}
            elif t == "categorical":
                summary[col] = df[col].value_counts().head(5).to_dict()
            elif t == "date":
                summary[col] = {
                    "min": json_safe(df[col].min()),
                    "max": json_safe(df[col].max()),
                    "count": int(df[col].count()),
                }
            else:
                summary[col] = {"unique_values": int(df[col].nunique())}
        except Exception as e:
            summary[col] = {"error": f"No se pudo analizar: {e}"}

    # --------------------------------------------------------------
    # 2️⃣ GRÁFICOS AUTOMÁTICOS SEGÚN TIPO
    # --------------------------------------------------------------
    for col, t in column_types.items():
        try:
            if t == "numeric":
                # Histograma
                fig, ax = plt.subplots(figsize=(5, 3))
                sns.histplot(df[col], kde=True, color="#3B82F6", ax=ax)
                ax.set_title(f"Distribución de {col}", fontsize=11, weight="bold")
                graphs.append({"column": col, "image": fig_to_base64(fig)})

                # Boxplot
                fig, ax = plt.subplots(figsize=(5, 3))
                sns.boxplot(x=df[col], color="#60A5FA", ax=ax, fliersize=3, linewidth=1)
                ax.set_title(f"Boxplot de {col}", fontsize=11, weight="bold")
                graphs.append({"column": f"Boxplot {col}", "image": fig_to_base64(fig)})

            elif t == "categorical":
                counts = df[col].value_counts().head(6)
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
                counts = df.groupby(df[col].dt.to_period("M")).size()
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
    numeric_df = df.select_dtypes(include=[np.number])
    if not numeric_df.empty and numeric_df.shape[1] > 1:
        try:
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

    return {
        "summary": summary,
        "graphs": graphs,
        "ai_summary": ai_summary,
        "sample": sample_data,
    }
