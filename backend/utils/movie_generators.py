"""
Generadores de escenas genéricas para Data Movie.
Cada función crea una escena adaptada al contenido del dataset.
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional
from utils.movie_detectors import (
    detect_trend,
    detect_concentration,
    detect_anomalies,
    detect_correlation
)


def generate_comparison_scene(df: pd.DataFrame, schema: Dict) -> Optional[Dict]:
    """
    Genera escena de comparación entre períodos o categorías.
    
    Args:
        df: DataFrame
        schema: Esquema del dataset
    
    Returns:
        Dict con estructura de escena o None
    """
    try:
        date_col = schema.get("date_column")
        column_types = schema.get("column_types", {})
        numeric_cols = [c for c, t in column_types.items() if t == "numeric"]
        
        if not numeric_cols:
            return None
        
        metric_col = numeric_cols[0]  # Primera métrica numérica
        
        # Comparar por fecha si existe
        if date_col and date_col in df.columns:
            df_sorted = df.sort_values(date_col)
            mid_point = len(df_sorted) // 2
            
            period_a = df_sorted.iloc[:mid_point]
            period_b = df_sorted.iloc[mid_point:]
            
            value_a = period_a[metric_col].sum()
            value_b = period_b[metric_col].sum()
            
            label_a = f"Primera mitad"
            label_b = f"Segunda mitad"
        else:
            # Comparar por categoría
            categorical_cols = [c for c, t in column_types.items() if t == "categorical"]
            if not categorical_cols:
                return None
            
            cat_col = categorical_cols[0]
            top_categories = df[cat_col].value_counts().head(2)
            
            if len(top_categories) < 2:
                return None
            
            cat_a, cat_b = top_categories.index[:2]
            value_a = df[df[cat_col] == cat_a][metric_col].sum()
            value_b = df[df[cat_col] == cat_b][metric_col].sum()
            
            label_a = str(cat_a)
            label_b = str(cat_b)
        
        # Calcular cambio
        change_abs = value_b - value_a
        change_pct = (change_abs / value_a * 100) if value_a != 0 else 0
        trend = "up" if change_abs > 0 else "down" if change_abs < 0 else "stable"
        
        return {
            "type": "comparison",
            "title": f"Comparativa: {label_a} vs {label_b}",
            "narration": f"Comparando {label_a} con {label_b}, se observa un cambio de {change_pct:.1f}%.",
            "data": {
                "entity_a": {"label": label_a, "value": float(value_a)},
                "entity_b": {"label": label_b, "value": float(value_b)},
                "change_pct": float(change_pct),
                "change_abs": float(change_abs),
                "trend": trend,
                "metric_label": metric_col.replace("_", " ").title()
            },
            "duration_sec": 7
        }
    except Exception as e:
        print(f"Error generating comparison scene: {e}")
        return None


def generate_distribution_scene(df: pd.DataFrame, schema: Dict) -> Optional[Dict]:
    """
    Genera escena de distribución de valores.
    
    Args:
        df: DataFrame
        schema: Esquema del dataset
    
    Returns:
        Dict con estructura de escena o None
    """
    try:
        column_types = schema.get("column_types", {})
        numeric_cols = [c for c, t in column_types.items() if t == "numeric"]
        
        if not numeric_cols:
            return None
        
        # Seleccionar columna con mayor variabilidad
        best_col = None
        max_cv = 0  # Coeficiente de variación
        
        for col in numeric_cols:
            if col in df.columns:
                series = pd.to_numeric(df[col], errors='coerce').dropna()
                if len(series) > 0:
                    mean = series.mean()
                    std = series.std()
                    cv = std / mean if mean != 0 else 0
                    if cv > max_cv:
                        max_cv = cv
                        best_col = col
        
        if not best_col:
            return None
        
        series = pd.to_numeric(df[best_col], errors='coerce').dropna()
        
        # Crear histograma (10 bins)
        hist, bin_edges = np.histogram(series, bins=10)
        
        chart_data = []
        for i in range(len(hist)):
            chart_data.append({
                "range": f"{bin_edges[i]:.0f}-{bin_edges[i+1]:.0f}",
                "count": int(hist[i]),
                "x": float((bin_edges[i] + bin_edges[i+1]) / 2)
            })
        
        return {
            "type": "distribution",
            "title": f"Distribución de {best_col.replace('_', ' ').title()}",
            "narration": f"La distribución muestra cómo se dispersan los valores de {best_col}. Media: {series.mean():.1f}, Desviación: {series.std():.1f}.",
            "chart_data": chart_data,
            "chart_config": {
                "type": "bar",
                "xField": "range",
                "yField": "count"
            },
            "stats": {
                "mean": float(series.mean()),
                "median": float(series.median()),
                "std": float(series.std()),
                "min": float(series.min()),
                "max": float(series.max())
            },
            "duration_sec": 7
        }
    except Exception as e:
        print(f"Error generating distribution scene: {e}")
        return None


def generate_correlation_scene(df: pd.DataFrame, schema: Dict) -> Optional[Dict]:
    """
    Genera escena de correlación entre variables.
    
    Args:
        df: DataFrame
        schema: Esquema del dataset
    
    Returns:
        Dict con estructura de escena o None
    """
    try:
        column_types = schema.get("column_types", {})
        numeric_cols = [c for c, t in column_types.items() if t == "numeric" and c in df.columns]
        
        correlation_info = detect_correlation(df, numeric_cols, threshold=0.5)
        
        if not correlation_info or not correlation_info.get("pairs"):
            return None
        
        # Usar el par con mayor correlación
        top_pair = correlation_info["pairs"][0]
        col_a = top_pair["col_a"]
        col_b = top_pair["col_b"]
        corr_value = top_pair["correlation"]
        strength = top_pair["strength"]
        direction = top_pair["direction"]
        
        # Crear scatter plot data
        chart_data = []
        for idx, row in df[[col_a, col_b]].dropna().iterrows():
            chart_data.append({
                "x": float(row[col_a]),
                "y": float(row[col_b])
            })
        
        # Limitar a 200 puntos para performance
        if len(chart_data) > 200:
            chart_data = chart_data[::len(chart_data)//200]
        
        strength_text = "fuerte" if strength == "strong" else "moderada"
        direction_text = "positiva" if direction == "positive" else "negativa"
        
        return {
            "type": "correlation",
            "title": f"Correlación: {col_a.replace('_', ' ').title()} vs {col_b.replace('_', ' ').title()}",
            "narration": f"Se detectó una correlación {strength_text} {direction_text} (r={corr_value:.2f}) entre {col_a} y {col_b}.",
            "chart_data": chart_data,
            "chart_config": {
                "type": "scatter",
                "xField": "x",
                "yField": "y",
                "xLabel": col_a.replace("_", " ").title(),
                "yLabel": col_b.replace("_", " ").title()
            },
            "correlation_coef": float(corr_value),
            "strength": strength,
            "direction": direction,
            "duration_sec": 8
        }
    except Exception as e:
        print(f"Error generating correlation scene: {e}")
        return None


def generate_anomalies_scene(df: pd.DataFrame, schema: Dict) -> Optional[Dict]:
    """
    Genera escena de anomalías detectadas.
    
    Args:
        df: DataFrame
        schema: Esquema del dataset
    
    Returns:
        Dict con estructura de escena o None
    """
    try:
        column_types = schema.get("column_types", {})
        numeric_cols = [c for c, t in column_types.items() if t == "numeric"]
        
        anomalies_found = []
        
        for col in numeric_cols:
            if col in df.columns:
                anomaly_info = detect_anomalies(df, col)
                if anomaly_info:
                    anomalies_found.append({
                        "column": col,
                        **anomaly_info
                    })
        
        if not anomalies_found:
            return None
        
        # Usar la columna con más anomalías
        top_anomaly = max(anomalies_found, key=lambda x: x["count"])
        
        alerts = [
            f"Se detectaron {top_anomaly['count']} valores atípicos en {top_anomaly['column']} ({top_anomaly['percentage']*100:.1f}% del total)",
            f"Rango de outliers: {top_anomaly['min_outlier']:.1f} a {top_anomaly['max_outlier']:.1f}"
        ]
        
        return {
            "type": "anomalies",
            "title": "Valores Atípicos Detectados",
            "narration": f"El análisis identificó {top_anomaly['count']} valores anómalos en {top_anomaly['column']}, que representan el {top_anomaly['percentage']*100:.1f}% de los datos.",
            "alerts": alerts,
            "anomalies": anomalies_found,
            "duration_sec": 6
        }
    except Exception as e:
        print(f"Error generating anomalies scene: {e}")
        return None


def generate_trend_scene(df: pd.DataFrame, schema: Dict) -> Optional[Dict]:
    """
    Genera escena de tendencia temporal.
    
    Args:
        df: DataFrame
        schema: Esquema del dataset
    
    Returns:
        Dict con estructura de escena o None
    """
    try:
        date_col = schema.get("date_column")
        if not date_col or date_col not in df.columns:
            return None
        
        column_types = schema.get("column_types", {})
        numeric_cols = [c for c, t in column_types.items() if t == "numeric"]
        
        if not numeric_cols:
            return None
        
        metric_col = numeric_cols[0]
        
        # Agrupar por fecha
        df_sorted = df.sort_values(date_col)
        time_series = df_sorted.groupby(date_col)[metric_col].sum()
        
        trend_info = detect_trend(time_series)
        
        if not trend_info:
            return None
        
        direction = trend_info["direction"]
        strength = trend_info["strength"]
        
        direction_text = "ascendente" if direction == "upward" else "descendente"
        strength_text = "fuerte" if strength == "strong" else "moderada"
        
        return {
            "type": "trend",
            "title": f"Tendencia {direction_text.title()}",
            "narration": f"Los datos muestran una tendencia {direction_text} {strength_text} a lo largo del tiempo (r²={trend_info['r_value']**2:.2f}).",
            "trend_info": trend_info,
            "metric_label": metric_col.replace("_", " ").title(),
            "duration_sec": 7
        }
    except Exception as e:
        print(f"Error generating trend scene: {e}")
        return None


def generate_concentration_scene(df: pd.DataFrame, schema: Dict) -> Optional[Dict]:
    """
    Genera escena de concentración de valor.
    
    Args:
        df: DataFrame
        schema: Esquema del dataset
    
    Returns:
        Dict con estructura de escena o None
    """
    try:
        column_types = schema.get("column_types", {})
        categorical_cols = [c for c, t in column_types.items() if t == "categorical"]
        numeric_cols = [c for c, t in column_types.items() if t == "numeric"]
        
        if not categorical_cols or not numeric_cols:
            return None
        
        entity_col = categorical_cols[0]
        metric_col = numeric_cols[0]
        
        concentration_info = detect_concentration(df, entity_col, metric_col)
        
        if not concentration_info:
            return None
        
        top_n = concentration_info["top_n"]
        share = concentration_info["top_n_share"]
        
        entity_label = entity_col.replace("_", " ").title()
        
        return {
            "type": "concentration",
            "title": f"Concentración en Top {top_n}",
            "narration": f"El {share*100:.0f}% del total está concentrado en solo {top_n} {entity_label}. Esto indica una distribución desigual.",
            "concentration_info": concentration_info,
            "entity_label": entity_label,
            "metric_label": metric_col.replace("_", " ").title(),
            "duration_sec": 6
        }
    except Exception as e:
        print(f"Error generating concentration scene: {e}")
        return None
