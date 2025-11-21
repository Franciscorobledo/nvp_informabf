import sys
from pathlib import Path
from types import SimpleNamespace
import unittest

import pandas as pd

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from analysis import detect_column_types, generate_sales_insights
from utils.dataframe_loader import read_dataframes


class TestSalesCSV(unittest.TestCase):
    def test_sales_csv_is_parsed_and_classified(self):
        sample_csv = (
            "Factura;FechaRegistro;Cliente;Producto;Cantidad;PrecioUnitario;Total\n"
            "F001;2024-05-01 10:00:00;ACME;Laptop;2;750000;1500000\n"
            "F002;2024-05-02 12:30:00;ACME;Mouse;5;15000;75000\n"
            "F003;2024-05-03 09:15:00;Retail;Monitor;1;450000;450000\n"
        )

        upload = SimpleNamespace(filename="ventas.csv")

        dataframes = read_dataframes(upload, sample_csv.encode("utf-8"))

        self.assertEqual(len(dataframes), 1, "Se espera un único DataFrame para el CSV")
        df = dataframes[0]

        self.assertEqual(df.shape, (3, 7))
        self.assertSetEqual(
            set(df.columns),
            {"Factura", "FechaRegistro", "Cliente", "Producto", "Cantidad", "PrecioUnitario", "Total"},
        )

        self.assertAlmostEqual(df["Total"].sum(), 2025000)

        column_types = detect_column_types(df)
        self.assertEqual(column_types.get("FechaRegistro"), "date")
        self.assertEqual(column_types.get("Cantidad"), "numeric")
        self.assertEqual(column_types.get("Total"), "numeric")

    def test_sales_insights_highlights_business_metrics(self):
        df = pd.DataFrame(
            {
                "Nombre del producto": ["A", "B", "C"],
                "Articulos netos vend.": [10, 5, 3],
                "Ventas brutas": [1000_000, 500_000, 300_000],
                "Descuentos": [50_000, 0, 10_000],
                "Devoluciones": [0, 25_000, 0],
                "Ventas netas": [950_000, 475_000, 290_000],
                "Ventas totales": [950_000, 475_000, 290_000],
            }
        )

        insights = generate_sales_insights(df)

        self.assertTrue(any("Ventas netas totales" in text for text in insights))
        self.assertTrue(any("Descuentos" in text for text in insights))
        self.assertTrue(any("Ticket promedio" in text for text in insights))
        self.assertTrue(any("Top productos" in text for text in insights))

    def test_sales_insights_handles_diverse_column_names(self):
        df = pd.DataFrame(
            {
                "SKU": ["A", "B"],
                "Units Sold": [3, 2],
                "Gross Sales Amount": [300_000, 200_000],
                "Net Revenue": [250_000, 180_000],
                "Discount applied": [50_000, 20_000],
                "Refunds": [0, 0],
            }
        )

        insights = generate_sales_insights(df)

        self.assertTrue(any("Ventas netas totales" in text for text in insights))
        self.assertTrue(any("Descuentos" in text for text in insights))
        self.assertTrue(any("Ticket promedio" in text for text in insights))
        self.assertTrue(any("Top productos" in text for text in insights))


if __name__ == "__main__":
    unittest.main()
