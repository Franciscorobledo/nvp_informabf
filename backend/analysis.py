import io
import base64
import pandas as pd
import numpy as np
import seaborn as sns
import matplotlib.pyplot as plt
from datetime import datetime

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


# ---------------------------------------------------------------------
# 🧠 FUNCIÓN PRINCIPAL DE ANÁLISIS
# ---------------------------------------------------------------------
def analyze_file(df, date_field=None, metric_field=None, segment_by=None):
    """Analiza el dataset y genera estadísticas, gráficos e insights."""
    df = df.copy()
    df = df.replace(["", "NA", "NaN", "None"], np.nan).dropna(how="all")

    graphs = []
    summary = {}
    column_types = detect_column_types(df)

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

    # --------------------------------------------------------------
    # 3️⃣ MATRIZ DE CORRELACIÓN
    # --------------------------------------------------------------
    numeric_df = df.select_dtypes(include=[np.number])
    if not numeric_df.empty and numeric_df.shape[1] > 1:
        try:
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
        except Exception as e:
            print(f"⚠️ Error generando matriz de correlación: {e}")

    # --------------------------------------------------------------
    # 4️⃣ INSIGHTS AUTOMÁTICOS (placeholder)
    # --------------------------------------------------------------
    ai_summary = (
        "🤖 *Análisis automático generado por IA:*\n\n"
        "📊 Se identificaron patrones relevantes en los datos cargados.\n"
        "📈 Los gráficos se adaptaron automáticamente al tipo de variables detectadas.\n"
        "💡 Usa esta información para identificar outliers, correlaciones y tendencias temporales."
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
