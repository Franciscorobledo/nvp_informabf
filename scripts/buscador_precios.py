import argparse
import logging
from dataclasses import dataclass
from typing import Callable, Optional
from urllib.parse import quote_plus

import pandas as pd
import requests
from bs4 import BeautifulSoup


USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/123.0.0.0 Safari/537.36"
)
TIMEOUT_SECONDS = 15


@dataclass
class ProductResult:
    sku_original: str
    nombre_original: str
    nombre_encontrado: str
    precio: str
    url: str
    tienda: str


@dataclass
class StoreSearchResult:
    nombre_encontrado: Optional[str]
    precio: Optional[str]
    url: Optional[str]
    tienda: str


def get_soup(url: str, session: requests.Session) -> BeautifulSoup:
    headers = {"User-Agent": USER_AGENT, "Accept-Language": "es-CL,es;q=0.9"}
    response = session.get(url, headers=headers, timeout=TIMEOUT_SECONDS)
    response.raise_for_status()
    return BeautifulSoup(response.text, "html.parser")


def first_text(soup: BeautifulSoup, selectors: list[str]) -> Optional[str]:
    for selector in selectors:
        node = soup.select_one(selector)
        if node and node.get_text(strip=True):
            return node.get_text(strip=True)
    return None


def first_attr(soup: BeautifulSoup, selectors: list[tuple[str, str]]) -> Optional[str]:
    for selector, attr in selectors:
        node = soup.select_one(selector)
        if node and node.get(attr):
            return str(node[attr]).strip()
    return None


def buscar_sodimac(query: str, session: requests.Session) -> StoreSearchResult:
    search_url = f"https://www.sodimac.cl/sodimac-cl/search?Ntt={quote_plus(query)}"
    soup = get_soup(search_url, session)

    nombre = first_text(
        soup,
        [
            "a.pod-link .pod-title",
            "a[data-testid='product-link'] span",
            "div.pod-title",
        ],
    )
    precio = first_text(
        soup,
        [
            "span.pod-prices span",
            "div[data-testid='price-container'] span",
            "span.copy12.primary.medium",
        ],
    )
    url_rel = first_attr(
        soup,
        [
            ("a.pod-link", "href"),
            ("a[data-testid='product-link']", "href"),
        ],
    )
    if url_rel and url_rel.startswith("/"):
        url_rel = f"https://www.sodimac.cl{url_rel}"

    return StoreSearchResult(nombre, precio, url_rel, "Sodimac")


def buscar_easy(query: str, session: requests.Session) -> StoreSearchResult:
    search_url = f"https://www.easy.cl/tienda/search?Ntt={quote_plus(query)}"
    soup = get_soup(search_url, session)

    nombre = first_text(
        soup,
        [
            "a.vtex-product-summary-2-x-clearLink h2",
            "div.vtex-product-summary-2-x-productBrand",
            "h3",
        ],
    )
    precio = first_text(
        soup,
        [
            "span.ean13-price",
            "span.vtex-product-price-1-x-sellingPriceValue",
            "span.vtex-product-price-1-x-currencyContainer",
        ],
    )
    url_rel = first_attr(
        soup,
        [
            ("a.vtex-product-summary-2-x-clearLink", "href"),
            ("a[href*='/p']", "href"),
        ],
    )
    if url_rel and url_rel.startswith("/"):
        url_rel = f"https://www.easy.cl{url_rel}"

    return StoreSearchResult(nombre, precio, url_rel, "Easy")


def buscar_mercadolibre_requests(query: str, session: requests.Session) -> StoreSearchResult:
    search_url = f"https://listado.mercadolibre.cl/{quote_plus(query)}"
    soup = get_soup(search_url, session)

    nombre = first_text(
        soup,
        [
            "h3.poly-component__title-wrapper",
            "h2.ui-search-item__title",
        ],
    )
    precio = first_text(
        soup,
        [
            "div.poly-price__current span.andes-money-amount__fraction",
            "span.price-tag-fraction",
        ],
    )
    url = first_attr(
        soup,
        [
            ("a.poly-component__title", "href"),
            ("a.ui-search-item__group__element", "href"),
        ],
    )
    return StoreSearchResult(nombre, precio, url, "MercadoLibre")


def buscar_mercadolibre_playwright(query: str) -> StoreSearchResult:
    try:
        from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise RuntimeError(
            "Playwright no está instalado. Ejecuta: pip install playwright && playwright install"
        ) from exc

    search_url = f"https://listado.mercadolibre.cl/{quote_plus(query)}"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            page.goto(search_url, wait_until="domcontentloaded", timeout=20000)
            page.wait_for_timeout(1500)
            nombre = None
            precio = None
            url = None

            nombre_locator = page.locator(
                "h3.poly-component__title-wrapper, h2.ui-search-item__title"
            ).first
            if nombre_locator.count() > 0:
                nombre = nombre_locator.inner_text().strip()

            precio_locator = page.locator(
                "div.poly-price__current span.andes-money-amount__fraction, span.price-tag-fraction"
            ).first
            if precio_locator.count() > 0:
                precio = precio_locator.inner_text().strip()

            link_locator = page.locator(
                "a.poly-component__title, a.ui-search-item__group__element"
            ).first
            if link_locator.count() > 0:
                url = link_locator.get_attribute("href")

            return StoreSearchResult(nombre, precio, url, "MercadoLibre")
        except PlaywrightTimeoutError as exc:
            raise RuntimeError(f"Timeout en Playwright para MercadoLibre: {exc}") from exc
        finally:
            browser.close()


def buscar_en_tienda(
    nombre_tienda: str,
    buscar_fn: Callable[[str, requests.Session], StoreSearchResult],
    sku: str,
    nombre: str,
    session: requests.Session,
) -> Optional[StoreSearchResult]:
    for intento, query in enumerate([sku, nombre], start=1):
        if not query:
            continue

        logging.info("[%s] Intento %s buscando: %s", nombre_tienda, intento, query)
        try:
            resultado = buscar_fn(query, session)
            if resultado.nombre_encontrado and resultado.url:
                logging.info("[%s] Encontrado: %s", nombre_tienda, resultado.nombre_encontrado)
                return resultado
            logging.info("[%s] Sin resultados útiles para: %s", nombre_tienda, query)
        except Exception as exc:
            logging.warning("[%s] Error buscando '%s': %s", nombre_tienda, query, exc)

    return None


def buscar_mercadolibre(sku: str, nombre: str, session: requests.Session) -> Optional[StoreSearchResult]:
    for intento, query in enumerate([sku, nombre], start=1):
        if not query:
            continue

        logging.info("[MercadoLibre] Intento %s con requests: %s", intento, query)
        try:
            resultado = buscar_mercadolibre_requests(query, session)
            if resultado.nombre_encontrado and resultado.url:
                logging.info("[MercadoLibre] Encontrado con requests: %s", resultado.nombre_encontrado)
                return resultado
        except Exception as exc:
            logging.warning("[MercadoLibre] Falló requests para '%s': %s", query, exc)

        logging.info("[MercadoLibre] Reintentando con Playwright: %s", query)
        try:
            resultado = buscar_mercadolibre_playwright(query)
            if resultado.nombre_encontrado and resultado.url:
                logging.info(
                    "[MercadoLibre] Encontrado con Playwright: %s", resultado.nombre_encontrado
                )
                return resultado
        except Exception as exc:
            logging.warning("[MercadoLibre] Falló Playwright para '%s': %s", query, exc)

    return None


def procesar_productos(input_excel: str, output_excel: str) -> None:
    logging.info("Leyendo archivo de entrada: %s", input_excel)
    df = pd.read_excel(input_excel)

    required_columns = {"SKU", "Nombre"}
    if not required_columns.issubset(df.columns):
        raise ValueError(
            f"El Excel debe incluir las columnas {required_columns}. Columnas encontradas: {list(df.columns)}"
        )

    resultados: list[ProductResult] = []
    session = requests.Session()

    for idx, row in df.iterrows():
        sku = str(row.get("SKU", "")).strip()
        nombre = str(row.get("Nombre", "")).strip()

        if sku.lower() == "nan":
            sku = ""
        if nombre.lower() == "nan":
            nombre = ""

        logging.info("Procesando fila %s | SKU=%s | Nombre=%s", idx + 1, sku, nombre)

        buscadores = [
            ("Sodimac", buscar_sodimac),
            ("MercadoLibre", None),
            ("Easy", buscar_easy),
        ]

        for tienda, fn in buscadores:
            resultado_tienda: Optional[StoreSearchResult]

            if tienda == "MercadoLibre":
                resultado_tienda = buscar_mercadolibre(sku, nombre, session)
            else:
                assert fn is not None
                resultado_tienda = buscar_en_tienda(tienda, fn, sku, nombre, session)

            if resultado_tienda:
                resultados.append(
                    ProductResult(
                        sku_original=sku,
                        nombre_original=nombre,
                        nombre_encontrado=resultado_tienda.nombre_encontrado or "",
                        precio=resultado_tienda.precio or "",
                        url=resultado_tienda.url or "",
                        tienda=resultado_tienda.tienda,
                    )
                )
            else:
                resultados.append(
                    ProductResult(
                        sku_original=sku,
                        nombre_original=nombre,
                        nombre_encontrado="",
                        precio="",
                        url="",
                        tienda=tienda,
                    )
                )

    out_df = pd.DataFrame(
        [
            {
                "SKU original": r.sku_original,
                "Nombre original": r.nombre_original,
                "Nombre encontrado": r.nombre_encontrado,
                "Precio": r.precio,
                "URL": r.url,
                "Tienda": r.tienda,
            }
            for r in resultados
        ]
    )

    out_df.to_excel(output_excel, index=False)
    logging.info("Archivo de salida generado: %s", output_excel)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Scraper de precios Chile (Sodimac, MercadoLibre, Easy)")
    parser.add_argument(
        "--input",
        default="productos.xlsx",
        help="Ruta del Excel de entrada (default: productos.xlsx)",
    )
    parser.add_argument(
        "--output",
        default="resultados.xlsx",
        help="Ruta del Excel de salida (default: resultados.xlsx)",
    )
    return parser


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(message)s",
    )
    args = build_parser().parse_args()
    procesar_productos(args.input, args.output)


if __name__ == "__main__":
    main()
