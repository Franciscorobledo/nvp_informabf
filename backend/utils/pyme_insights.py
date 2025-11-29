"""
Motor de insights para PYMEs - Enfocado en Ventas e Inventarios
Auto-detecta el tipo de dataset y genera KPIs e insights específicos
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional
import unicodedata


def _normalize(text: str) -> str:
    """Normaliza texto removiendo acentos y convirtiendo a minúsculas"""
    if not text:
        return ""
    safe_text = str(text)
    normalized = unicodedata.normalize("NFD", safe_text)
    without_accents = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    return without_accents.lower()


def detect_dataset_type(df: pd.DataFrame, column_types: Dict) -> str:
    """
    Detecta automáticamente si el dataset es de ventas o inventario.
    
    Returns:
        "sales", "inventory", o "generic"
    """
    # Palabras clave para ventas
    sales_keywords = [
        'venta', 'sale', 'revenue', 'ingreso', 'factura', 'invoice',
        'pedido', 'order', 'cliente', 'customer', 'transaccion', 'transaction',
        'compra', 'purchase', 'precio', 'price', 'total'
    ]
    
    # Palabras clave para inventario
    inventory_keywords = [
        'stock', 'inventario', 'existencia', 'almacen', 'bodega',
        'warehouse', 'producto', 'sku', 'cantidad', 'quantity',
        'disponible', 'available', 'unidades', 'units'
    ]
    
    # Analizar nombres de columnas
    normalized_columns = [_normalize(col) for col in df.columns]
    
    sales_score = sum(
        1 for col in normalized_columns
        for keyword in sales_keywords
        if keyword in col
    )
    
    inventory_score = sum(
        1 for col in normalized_columns
        for keyword in inventory_keywords
        if keyword in col
    )
    
    if sales_score > inventory_score:
        return "sales"
    elif inventory_score > sales_score:
        return "inventory"
    else:
        return "generic"


def generate_sales_insights(df: pd.DataFrame, schema: Dict) -> Dict:
    """
    Genera insights específicos para datasets de ventas.
    """
    insights = {
        "type": "sales",
        "kpis": {},
        "trends": {},
        "recommendations": []
    }
    
    try:
        column_types = schema.get("column_types", {})
        
        # Encontrar columnas clave
        numeric_cols = [c for c, t in column_types.items() if t == "numeric"]
        date_col = schema.get("date_column")
        
        # Buscar columna de ingresos/ventas
        revenue_col = None
        for col in numeric_cols:
            normalized = _normalize(col)
            if any(kw in normalized for kw in ['venta', 'sale', 'revenue', 'ingreso', 'total', 'monto']):
                revenue_col = col
                break
        
        if not revenue_col and numeric_cols:
            revenue_col = numeric_cols[0]
        
        # KPI: Ingresos totales
        if revenue_col:
            total_revenue = float(df[revenue_col].sum())
            insights["kpis"]["total_revenue"] = {
                "label": "Ingresos Totales",
                "value": total_revenue,
                "format": "currency"
            }
            
            # KPI: Ticket promedio
            avg_ticket = float(df[revenue_col].mean())
            insights["kpis"]["avg_ticket"] = {
                "label": "Ticket Promedio",
                "value": avg_ticket,
                "format": "currency"
            }
        
        # KPI: Número de transacciones
        total_transactions = len(df)
        insights["kpis"]["total_transactions"] = {
            "label": "Transacciones",
            "value": total_transactions,
            "format": "number"
        }
        
        # Tendencia temporal
        if date_col and date_col in df.columns and revenue_col:
            df_temp = df.copy()
            df_temp[date_col] = pd.to_datetime(df_temp[date_col], errors='coerce')
            df_temp = df_temp.dropna(subset=[date_col])
            
            if len(df_temp) >= 2:
                # Agrupar por fecha
                daily_sales = df_temp.groupby(df_temp[date_col].dt.date)[revenue_col].sum()
                
                if len(daily_sales) >= 2:
                    # Calcular crecimiento
                    first_half = daily_sales.iloc[:len(daily_sales)//2].mean()
                    second_half = daily_sales.iloc[len(daily_sales)//2:].mean()
                    
                    if first_half > 0:
                        growth_rate = ((second_half - first_half) / first_half) * 100
                        insights["trends"]["growth_rate"] = {
                            "value": float(growth_rate),
                            "direction": "up" if growth_rate > 0 else "down"
                        }
                        
                        # Recomendación basada en tendencia
                        if growth_rate > 10:
                            insights["recommendations"].append({
                                "icon": "📈",
                                "text": f"Ventas creciendo {abs(growth_rate):.1f}% - Considera aumentar inventario de productos top",
                                "priority": "high"
                            })
                        elif growth_rate < -10:
                            insights["recommendations"].append({
                                "icon": "⚠️",
                                "text": f"Ventas cayendo {abs(growth_rate):.1f}% - Revisa estrategia de precios y promociones",
                                "priority": "critical"
                            })
        
        # Producto más vendido (si hay columna de producto)
        categorical_cols = [c for c, t in column_types.items() if t == "categorical"]
        product_col = None
        for col in categorical_cols:
            normalized = _normalize(col)
            if any(kw in normalized for kw in ['producto', 'product', 'item', 'articulo']):
                product_col = col
                break
        
        if product_col and revenue_col:
            top_products = df.groupby(product_col)[revenue_col].sum().nlargest(1)
            if len(top_products) > 0:
                top_product = top_products.index[0]
                top_value = float(top_products.iloc[0])
                insights["kpis"]["top_product"] = {
                    "label": "Producto Top",
                    "value": str(top_product),
                    "extra": f"${top_value:,.0f}",
                    "format": "text"
                }
    
    except Exception as e:
        print(f"Error generating sales insights: {e}")
    
    return insights


def generate_inventory_insights(df: pd.DataFrame, schema: Dict) -> Dict:
    """
    Genera insights específicos para datasets de inventario.
    """
    insights = {
        "type": "inventory",
        "kpis": {},
        "alerts": [],
        "recommendations": []
    }
    
    try:
        column_types = schema.get("column_types", {})
        numeric_cols = [c for c, t in column_types.items() if t == "numeric"]
        
        # Buscar columna de stock
        stock_col = None
        for col in numeric_cols:
            normalized = _normalize(col)
            if any(kw in normalized for kw in ['stock', 'existencia', 'cantidad', 'unidades', 'disponible']):
                stock_col = col
                break
        
        if not stock_col and numeric_cols:
            stock_col = numeric_cols[0]
        
        # KPI: Total de SKUs
        total_skus = len(df)
        insights["kpis"]["total_skus"] = {
            "label": "Productos Únicos",
            "value": total_skus,
            "format": "number"
        }
        
        if stock_col:
            # KPI: Stock crítico (< 10 unidades)
            critical_stock = len(df[df[stock_col] < 10])
            insights["kpis"]["critical_stock"] = {
                "label": "Stock Crítico",
                "value": critical_stock,
                "format": "number",
                "alert": critical_stock > 0
            }
            
            # KPI: Stock total
            total_stock = float(df[stock_col].sum())
            insights["kpis"]["total_stock"] = {
                "label": "Unidades Totales",
                "value": total_stock,
                "format": "number"
            }
            
            # Alertas de stock crítico
            if critical_stock > 0:
                insights["alerts"].append({
                    "icon": "⚠️",
                    "text": f"{critical_stock} productos con stock bajo (< 10 unidades)",
                    "severity": "warning"
                })
                
                insights["recommendations"].append({
                    "icon": "📦",
                    "text": f"Reabastecer {critical_stock} productos con stock crítico",
                    "priority": "high"
                })
            
            # Productos sin stock
            out_of_stock = len(df[df[stock_col] <= 0])
            if out_of_stock > 0:
                insights["alerts"].append({
                    "icon": "🚨",
                    "text": f"{out_of_stock} productos agotados",
                    "severity": "critical"
                })
        
        # Buscar columna de valor
        value_col = None
        for col in numeric_cols:
            normalized = _normalize(col)
            if any(kw in normalized for kw in ['valor', 'value', 'precio', 'price', 'costo', 'cost']):
                value_col = col
                break
        
        if value_col and stock_col:
            # KPI: Valor total del inventario
            df_temp = df.copy()
            df_temp['total_value'] = df_temp[stock_col] * df_temp[value_col]
            total_value = float(df_temp['total_value'].sum())
            
            insights["kpis"]["total_value"] = {
                "label": "Valor Total Inventario",
                "value": total_value,
                "format": "currency"
            }
    
    except Exception as e:
        print(f"Error generating inventory insights: {e}")
    
    return insights


def generate_pyme_insights(df: pd.DataFrame, schema: Dict) -> Dict:
    """
    Función principal que detecta el tipo de dataset y genera insights apropiados.
    """
    dataset_type = detect_dataset_type(df, schema.get("column_types", {}))
    
    if dataset_type == "sales":
        return generate_sales_insights(df, schema)
    elif dataset_type == "inventory":
        return generate_inventory_insights(df, schema)
    else:
        # Genérico: retornar insights básicos
        return {
            "type": "generic",
            "kpis": {
                "total_rows": {
                    "label": "Total de Registros",
                    "value": len(df),
                    "format": "number"
                }
            },
            "recommendations": []
        }
