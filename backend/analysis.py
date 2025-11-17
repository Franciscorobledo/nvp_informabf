import io
import base64
import pandas as pd
import numpy as np
import seaborn as sns
import matplotlib.pyplot as plt
from datetime import datetime

plt.switch_backend("Agg")
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


# ---------------------------------------------------------------------
# 🧠 FUNCIÓN PRINCIPAL DE ANÁLISIS
# ---------------------------------------------------------------------

def analyze_file(df, date_field=None, metric_field=None, segment_by=None):
    """Analiza el dataset y genera estadísticas, gráficos e insights."""
    df = df.copy()
    graphs = []
    summary = {}
    df = df.replace(["", "NA", "NaN", "None"], np.nan).dropna(how="all")

    column_types = detect_column_types(df)

    # --------------------------------------------------------------
    # 1️⃣ ESTADÍSTICAS DESCRIPTIVAS
    # --------------------------------------------------------------
    for col, t in column_types.items():
        if t == "numeric":
            desc = df[col].describe().to_dict()
            summary[col] = {k: round(v, 2) for k, v in desc.items()}
        elif t == "categorical":
            summary[col] = df[col].value_counts().head(5).to_dict()
        elif t == "date":
            summary[col] = {
                "min": str(df[col].min()),
                "max": str(df[col].max()),
                "count": int(df[col].count())
            }
        else:
            summary[col] = {"unique_values": int(df[col].nunique())}

    # --------------------------------------------------------------
    # 2️⃣ GRÁFICOS AUTOMÁTICOS SEGÚN TIPO DE DATO
    # --------------------------------------------------------------
    for col, t in column_types.items():
        if t == "numeric":
            # Histograma con densidad
            fig, ax = plt.subplots(figsize=(5, 3))
            sns.histplot(df[col], kde=True, color="#3B82F6", ax=ax)
            ax.set_title(f"Distribución de {col}", fontsize=11, weight="bold")
            ax.set_xlabel(col)
            ax.set_ylabel("Frecuencia")
            graphs.append({"column": col, "image": fig_to_base64(fig)})

            # Boxplot
            fig, ax = plt.subplots(figsize=(5, 3))
            sns.boxplot(x=df[col], color="#60A5FA", ax=ax, fliersize=3, linewidth=1)
            ax.set_title(f"Boxplot de {col}", fontsize=11, weight="bold")
            graphs.append({"column": f"Boxplot {col}", "image": fig_to_base64(fig)})

        elif t == "categorical":
            counts = df[col].value_counts().head(6)
            if len(counts) <= 5:
                fig, ax = plt.subplots(figsize=(4, 3))
                ax.pie(
                    counts.values,
                    labels=counts.index,
                    autopct="%1.1f%%",
                    startangle=90,
                    colors=sns.color_palette("Blues", len(counts))
                )
                ax.set_title(f"Distribución de {col}", fontsize=11, weight="bold")
                graphs.append({"column": f"Pie {col}", "image": fig_to_base64(fig)})
            else:
                fig, ax = plt.subplots(figsize=(5, 3))
                sns.barplot(x=counts.values, y=counts.index, ax=ax, color="#3B82F6")
                ax.set_title(f"Frecuencia de {col}", fontsize=11, weight="bold")
                ax.set_xlabel("Cantidad")
                graphs.append({"column": f"Barras {col}", "image": fig_to_base64(fig)})

        elif t == "date":
            try:
                df[col] = pd.to_datetime(df[col])
                counts = df.groupby(df[col].dt.to_period("M")).size()
                fig, ax = plt.subplots(figsize=(6, 3))
                counts.plot(ax=ax, color="#2563EB", linewidth=2)
                ax.set_title(f"Tendencia temporal ({col})", fontsize=11, weight="bold")
                ax.set_xlabel("Fecha")
                ax.set_ylabel("Cantidad")
                graphs.append({"column": f"Tendencia {col}", "image": fig_to_base64(fig)})
            except Exception:
                continue

    # --------------------------------------------------------------
    # 3️⃣ MATRIZ DE CORRELACIÓN
    # --------------------------------------------------------------
    numeric_df = df.select_dtypes(include=[np.number])
    if not numeric_df.empty and numeric_df.shape[1] > 1:
        fig, ax = plt.subplots(figsize=(5, 4))
        sns.heatmap(
            numeric_df.corr(),
            annot=True,
            fmt=".2f",
            cmap="crest",
            square=True,
            cbar_kws={"shrink": 0.8},
            ax=ax,
        )
        ax.set_title("Matriz de correlación", fontsize=12, weight="bold")
        graphs.append({"column": "Matriz de correlación", "image": fig_to_base64(fig)})

    # --------------------------------------------------------------
    # 4️⃣ INSIGHTS GENERADOS POR IA (placeholder)
    # --------------------------------------------------------------
    ai_summary = (
        "🤖 Análisis automático generado por IA\n\n"
        "📊 El sistema detectó patrones relevantes en las variables cargadas.\n"
        "📈 Los gráficos se adaptaron automáticamente al tipo de datos: "
        "numéricos, categóricos o temporales.\n"
        "💡 Usa estos resultados para detectar outliers, relaciones y tendencias temporales."
    )

    # --------------------------------------------------------------
    # 5️⃣ MUESTRA DE DATOS (para visualizaciones interactivas)
    # --------------------------------------------------------------
    try:
        sample_data = df.head(100).to_dict(orient="records")
    except Exception:
        sample_data = []

    # --------------------------------------------------------------
    # 6️⃣ LIMPIEZA DE TIPOS PARA JSON (Evita errores NumPy)
    # --------------------------------------------------------------
    def clean_for_json(obj):
        if isinstance(obj, dict):
            return {k: clean_for_json(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [clean_for_json(v) for v in obj]
        elif isinstance(obj, (np.int64, np.int32)):
            return int(obj)
        elif isinstance(obj, (np.float64, np.float32)):
            return float(obj)
        elif isinstance(obj, (np.bool_)):
            return bool(obj)
        elif pd.isna(obj):
            return None
        return obj

    cleaned_summary = clean_for_json(summary)
    cleaned_sample = clean_for_json(sample_data)

    # --------------------------------------------------------------
    # 7️⃣ RETORNO FINAL
    # --------------------------------------------------------------
    return {
        "summary": cleaned_summary,
        "graphs": graphs,
        "ai_summary": ai_summary,
        "sample": cleaned_sample,
    }

