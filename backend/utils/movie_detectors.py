"""
Detectores de patrones para generación automática de escenas en Data Movie.
Funciones genéricas que identifican características en cualquier dataset.
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Optional


def detect_trend(series: pd.Series, threshold: float = 0.7) -> Optional[Dict]:
    """
    Detecta tendencia en una serie temporal.
    
    Args:
        series: Serie de valores numéricos
        threshold: Umbral de correlación para considerar tendencia fuerte
    
    Returns:
        Dict con información de tendencia o None si no hay tendencia clara
    """
    if len(series) < 3:
        return None
    
    try:
        from scipy.stats import linregress
        
        # Eliminar NaN
        clean_series = series.dropna()
        if len(clean_series) < 3:
            return None
        
        x = np.arange(len(clean_series))
        y = clean_series.values
        
        slope, intercept, r_value, p_value, std_err = linregress(x, y)
        
        if abs(r_value) >= threshold:
            direction = "upward" if slope > 0 else "downward"
            strength = "strong" if abs(r_value) > 0.85 else "moderate"
            
            return {
                "has_trend": True,
                "direction": direction,
                "strength": strength,
                "slope": float(slope),
                "r_value": float(r_value),
                "p_value": float(p_value)
            }
    except Exception:
        pass
    
    return None


def detect_concentration(df: pd.DataFrame, entity_col: str, metric_col: str, threshold: float = 0.7) -> Optional[Dict]:
    """
    Detecta concentración de valor en pocas entidades (Principio de Pareto).
    
    Args:
        df: DataFrame
        entity_col: Columna de entidades
        metric_col: Columna de métrica numérica
        threshold: Umbral de concentración (default 70%)
    
    Returns:
        Dict con información de concentración o None
    """
    try:
        if entity_col not in df.columns or metric_col not in df.columns:
            return None
        
        # Agrupar y sumar
        grouped = df.groupby(entity_col)[metric_col].sum().sort_values(ascending=False)
        
        if len(grouped) < 3:
            return None
        
        total = grouped.sum()
        if total == 0:
            return None
        
        # Calcular share del top 3
        top_3_value = grouped.head(3).sum()
        top_3_share = top_3_value / total
        
        if top_3_share >= threshold:
            return {
                "is_concentrated": True,
                "top_n": 3,
                "top_n_share": float(top_3_share),
                "top_entities": grouped.head(3).index.tolist(),
                "top_values": grouped.head(3).values.tolist()
            }
    except Exception:
        pass
    
    return None


def detect_anomalies(df: pd.DataFrame, col: str, method: str = "iqr") -> Optional[Dict]:
    """
    Detecta valores atípicos en una columna numérica.
    
    Args:
        df: DataFrame
        col: Nombre de la columna
        method: Método de detección ('iqr' o 'zscore')
    
    Returns:
        Dict con información de anomalías o None
    """
    try:
        if col not in df.columns:
            return None
        
        series = pd.to_numeric(df[col], errors='coerce').dropna()
        
        if len(series) < 10:
            return None
        
        if method == "iqr":
            Q1 = series.quantile(0.25)
            Q3 = series.quantile(0.75)
            IQR = Q3 - Q1
            
            lower_bound = Q1 - 1.5 * IQR
            upper_bound = Q3 + 1.5 * IQR
            
            outliers = series[(series < lower_bound) | (series > upper_bound)]
        else:  # zscore
            mean = series.mean()
            std = series.std()
            outliers = series[abs(series - mean) > 3 * std]
        
        if len(outliers) > 0:
            outlier_pct = len(outliers) / len(series)
            
            return {
                "has_anomalies": True,
                "count": int(len(outliers)),
                "percentage": float(outlier_pct),
                "min_outlier": float(outliers.min()),
                "max_outlier": float(outliers.max()),
                "method": method
            }
    except Exception:
        pass
    
    return None


def detect_correlation(df: pd.DataFrame, numeric_cols: List[str], threshold: float = 0.6) -> Optional[Dict]:
    """
    Detecta correlaciones significativas entre columnas numéricas.
    
    Args:
        df: DataFrame
        numeric_cols: Lista de columnas numéricas
        threshold: Umbral de correlación absoluta
    
    Returns:
        Dict con pares correlacionados o None
    """
    try:
        if len(numeric_cols) < 2:
            return None
        
        # Calcular matriz de correlación
        corr_matrix = df[numeric_cols].corr()
        
        # Encontrar pares con correlación alta
        correlations = []
        for i in range(len(numeric_cols)):
            for j in range(i + 1, len(numeric_cols)):
                corr_value = corr_matrix.iloc[i, j]
                if abs(corr_value) >= threshold:
                    correlations.append({
                        "col_a": numeric_cols[i],
                        "col_b": numeric_cols[j],
                        "correlation": float(corr_value),
                        "strength": "strong" if abs(corr_value) > 0.8 else "moderate",
                        "direction": "positive" if corr_value > 0 else "negative"
                    })
        
        if correlations:
            # Ordenar por correlación absoluta
            correlations.sort(key=lambda x: abs(x["correlation"]), reverse=True)
            return {
                "has_correlations": True,
                "pairs": correlations[:3]  # Top 3
            }
    except Exception:
        pass
    
    return None


def should_generate_comparison(df: pd.DataFrame, schema: Dict) -> bool:
    """
    Determina si se debe generar una escena de comparación.
    
    Args:
        df: DataFrame
        schema: Esquema del dataset
    
    Returns:
        True si se puede generar comparación
    """
    # Si hay columna de fecha, comparar períodos
    date_col = schema.get("date_column")
    if date_col and date_col in df.columns:
        unique_dates = df[date_col].nunique()
        return unique_dates >= 2
    
    # Si hay columna categórica con 2-5 valores, comparar categorías
    column_types = schema.get("column_types", {})
    for col, col_type in column_types.items():
        if col_type == "categorical" and col in df.columns:
            unique_values = df[col].nunique()
            if 2 <= unique_values <= 5:
                return True
    
    return False


def should_generate_distribution(df: pd.DataFrame, schema: Dict) -> bool:
    """
    Determina si se debe generar una escena de distribución.
    
    Args:
        df: DataFrame
        schema: Esquema del dataset
    
    Returns:
        True si hay columnas numéricas con variabilidad
    """
    column_types = schema.get("column_types", {})
    numeric_cols = [c for c, t in column_types.items() if t == "numeric"]
    
    for col in numeric_cols:
        if col in df.columns:
            series = pd.to_numeric(df[col], errors='coerce').dropna()
            if len(series) > 0 and series.std() > 0:
                return True
    
    return False


def has_temporal_data(df: pd.DataFrame, schema: Dict) -> bool:
    """Verifica si hay datos temporales."""
    date_col = schema.get("date_column")
    return date_col is not None and date_col in df.columns


def has_categorical_data(df: pd.DataFrame, schema: Dict) -> bool:
    """Verifica si hay datos categóricos."""
    column_types = schema.get("column_types", {})
    categorical_cols = [c for c, t in column_types.items() if t == "categorical"]
    return len(categorical_cols) > 0


def has_multiple_numeric_cols(df: pd.DataFrame, schema: Dict) -> bool:
    """Verifica si hay 2+ columnas numéricas."""
    column_types = schema.get("column_types", {})
    numeric_cols = [c for c, t in column_types.items() if t == "numeric"]
    return len(numeric_cols) >= 2
