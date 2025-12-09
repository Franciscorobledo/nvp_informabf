import sys
from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from data_router import _normalize_sales, _normalize_stock


def test_normalize_sales_uses_original_column_names():
    df = pd.DataFrame(
        {
            "FECHA": ["2024-01-01"],
            "CODIGO": ["SKU-001"],
            "CANTIDAD": [3],
            "PRECIO_UNITARIO": [120.5],
        }
    )

    mapping = {
        "date": "FECHA",
        "sku": "CODIGO",
        "quantity": "CANTIDAD",
        "unit_price": "PRECIO_UNITARIO",
    }

    normalized = _normalize_sales(df, mapping, "files")

    assert normalized.loc[0, "sku"] == "SKU-001"
    assert normalized.loc[0, "quantity"] == 3
    assert normalized.loc[0, "unit_price"] == 120.5
    assert normalized.loc[0, "date"].strftime("%Y-%m-%d") == "2024-01-01"


def test_normalize_stock_uses_original_column_names():
    df = pd.DataFrame(
        {
            "CODIGO": ["ABC"],
            "NOMBRE_PRODUCTO": ["Zapatilla"],
            "STOCK_ACTUAL": [15],
        }
    )

    mapping = {
        "sku": "CODIGO",
        "product_name": "NOMBRE_PRODUCTO",
        "current_stock": "STOCK_ACTUAL",
    }

    normalized = _normalize_stock(df, mapping, "files")

    assert normalized.loc[0, "sku"] == "ABC"
    assert normalized.loc[0, "product_name"] == "Zapatilla"
    assert normalized.loc[0, "current_stock"] == 15
