import pandas as pd

from analysis import generate_data_movie_payload


def test_data_movie_handles_numeric_column_names(monkeypatch):
    """Generar la película no debe fallar aunque las columnas sean numéricas."""

    # Evita llamadas a OpenAI en entornos sin conectividad.
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    df = pd.DataFrame({0: [1, 2, 3], 1: [4, 5, 6]})

    payload = generate_data_movie_payload(df)

    assert payload["basic_summary"]["rows"] == 3
    assert payload["ai_schema"]["dataset_purpose"] == "generico"
    assert payload["data_movie"] is not None
