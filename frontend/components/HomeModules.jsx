import React, { useEffect, useMemo, useState } from "react";
import API_URL from "../src/api";

const SkeletonBlock = ({ className = "h-24" }) => (
  <div className={`animate-pulse rounded-2xl bg-slate-200/80 dark:bg-slate-800/70 ${className}`} />
);

const MetricCard = ({ label, value, format = "number", delta, highlight = "" }) => (
  <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/70 p-4 shadow-sm">
    <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wide">
      <span>{label}</span>
      {highlight && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-100 px-2 py-0.5 text-[10px] font-bold">
          {highlight}
        </span>
      )}
    </div>
    <div className="flex items-end gap-2">
      <p className="text-2xl font-bold text-slate-900 dark:text-white">
        {format === "currency" ? new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value || 0) : value ?? "—"}
      </p>
      {delta !== undefined && (
        <span className={`text-sm font-semibold ${delta >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
        </span>
      )}
    </div>
  </div>
);

const ChartCard = ({ title, chart }) => (
  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/70 p-4 shadow-sm">
    <div className="flex items-center justify-between mb-3">
      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h4>
      <span className="text-[11px] rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-1 text-slate-500 dark:text-slate-300">{chart?.type?.toUpperCase()}</span>
    </div>
    {chart ? (
      <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
        <p className="text-xs text-slate-500">Eje X: {Array.isArray(chart.x) ? chart.x.slice(0, 6).join(", ") : "—"}</p>
        {chart.series?.map((serie) => (
          <div key={serie.name} className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/80 px-3 py-2">
            <span className="font-semibold text-slate-800 dark:text-slate-200">{serie.name}</span>
            <span className="text-xs text-slate-500 dark:text-slate-300">{serie.data.slice(0, 5).join(", ")}...</span>
          </div>
        ))}
      </div>
    ) : (
      <SkeletonBlock className="h-24" />
    )}
  </div>
);

const TableCard = ({ title, data = [], columnTypes = {} }) => (
  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/70 shadow-sm">
    <div className="flex items-center justify-between px-4 py-3">
      <div>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h4>
        <p className="text-xs text-slate-500">{data.length} filas • tipos detectados</p>
      </div>
      <div className="flex flex-wrap gap-1 max-w-xs justify-end">
        {Object.entries(columnTypes).map(([key, type]) => (
          <span key={key} className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-300">
            {key}: {type}
          </span>
        ))}
      </div>
    </div>
    <div className="max-h-72 overflow-auto">
      <table className="min-w-full text-left text-xs text-slate-700 dark:text-slate-200">
        <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/80">
          <tr>
            {data[0] &&
              Object.keys(data[0]).map((key) => (
                <th key={key} className="px-3 py-2 font-semibold uppercase tracking-wide text-[11px]">{key}</th>
              ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx} className="border-t border-slate-100 dark:border-slate-800">
              {Object.values(row).map((value, cellIdx) => (
                <td key={cellIdx} className="px-3 py-2 whitespace-nowrap">{String(value ?? "—")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!data.length && <SkeletonBlock className="h-24 m-4" />}
    </div>
  </div>
);

const demoSales = [
  { date: "2024-05-02", product: "Zapatilla Run", category: "Calzado", quantity: 6, price: 52000, cost: 31000 },
  { date: "2024-05-05", product: "Buzo Urbano", category: "Indumentaria", quantity: 4, price: 42000, cost: 21000 },
  { date: "2024-06-01", product: "Zapatilla Run", category: "Calzado", quantity: 8, price: 54000, cost: 32000 },
  { date: "2024-06-04", product: "Campera Softshell", category: "Indumentaria", quantity: 3, price: 99000, cost: 55000 },
  { date: "2024-06-15", product: "Gorra Classic", category: "Accesorios", quantity: 12, price: 15000, cost: 6000 },
  { date: "2024-07-02", product: "Zapatilla Trail", category: "Calzado", quantity: 5, price: 73000, cost: 41000 },
  { date: "2024-07-08", product: "Buzo Urbano", category: "Indumentaria", quantity: 6, price: 43000, cost: 21000 },
  { date: "2024-07-12", product: "Campera Softshell", category: "Indumentaria", quantity: 2, price: 100000, cost: 57000 },
];

const demoInventory = [
  { product: "Zapatilla Run", category: "Calzado", stock: 120, quantity: 210 },
  { product: "Buzo Urbano", category: "Indumentaria", stock: 80, quantity: 160 },
  { product: "Campera Softshell", category: "Indumentaria", stock: 35, quantity: 40 },
  { product: "Gorra Classic", category: "Accesorios", stock: 300, quantity: 50 },
  { product: "Zapatilla Trail", category: "Calzado", stock: 45, quantity: 75 },
];

const HomeModules = ({ onUnauthorized }) => {
  const token = useMemo(() => localStorage.getItem("token"), []);
  const [sales, setSales] = useState(null);
  const [stock, setStock] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [customChart, setCustomChart] = useState(null);
  const [status, setStatus] = useState("");
  const [errors, setErrors] = useState("");
  const [loading, setLoading] = useState({ sales: false, stock: false, summary: false, custom: false });
  const [chartBuilder, setChartBuilder] = useState({ metric: "price", dimension: "product", chart_type: "bar" });

  const authorizedFetch = async (url, options = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: token ? `Bearer ${token}` : undefined,
        "Content-Type": options.body instanceof FormData ? undefined : "application/json",
      },
    });

    if (res.status === 401 || res.status === 403) {
      onUnauthorized?.("Tu sesión expiró. Vuelve a iniciar sesión.");
      throw new Error("unauthorized");
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Error en la petición");
    }

    return res.json();
  };

  const fetchSales = async () => {
    setLoading((prev) => ({ ...prev, sales: true }));
    setErrors("");
    try {
      const data = await authorizedFetch(`${API_URL}/metrics/sales`, {
        method: "POST",
        body: JSON.stringify({ data: demoSales }),
      });
      setSales(data);
      setStatus("Panel de ventas listo con datos de ejemplo. Sube tu CSV o conecta MercadoLibre para usar tu operación real.");
    } catch (err) {
      setErrors(err.message || "No se pudo obtener ventas");
    } finally {
      setLoading((prev) => ({ ...prev, sales: false }));
    }
  };

  const fetchStock = async () => {
    setLoading((prev) => ({ ...prev, stock: true }));
    setErrors("");
    try {
      const data = await authorizedFetch(`${API_URL}/metrics/stock`, {
        method: "POST",
        body: JSON.stringify({ data: demoInventory }),
      });
      setStock(data);
    } catch (err) {
      setErrors(err.message || "No se pudo obtener inventario");
    } finally {
      setLoading((prev) => ({ ...prev, stock: false }));
    }
  };

  const fetchSummary = async () => {
    setLoading((prev) => ({ ...prev, summary: true }));
    try {
      const data = await authorizedFetch(`${API_URL}/metrics/summary`, {
        method: "POST",
        body: JSON.stringify({ data: demoSales }),
      });
      setAiSummary(data);
    } catch (err) {
      setErrors(err.message || "No se pudo generar el resumen con IA");
    } finally {
      setLoading((prev) => ({ ...prev, summary: false }));
    }
  };

  const runCustomChart = async () => {
    setLoading((prev) => ({ ...prev, custom: true }));
    setErrors("");
    try {
      const payload = { ...chartBuilder, data: demoSales };
      const data = await authorizedFetch(`${API_URL}/metrics/custom`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setCustomChart(data.chart);
    } catch (err) {
      setErrors(err.message || "No se pudo construir el gráfico");
    } finally {
      setLoading((prev) => ({ ...prev, custom: false }));
    }
  };

  useEffect(() => {
    fetchSales();
    fetchStock();
    fetchSummary();
  }, []);

  const kpisFromSales = sales?.kpis || {};
  const kpisFromStock = stock?.kpis || {};
  const salesCharts = sales?.charts || [];
  const stockCharts = stock?.charts || [];
  const salesTable = sales?.table || [];
  const stockTable = stock?.table || [];
  const columnTypes = sales?.column_types || {};

  const monthlyComparison = useMemo(() => {
    const source = salesTable.length ? salesTable : demoSales;
    const map = new Map();
    source.forEach((row) => {
      const date = row.date || row.fecha;
      if (!date) return;
      const monthKey = new Date(date).toISOString().slice(0, 7);
      const revenue = (row.price || 0) * (row.quantity || 1);
      const margin = row.cost ? revenue - row.cost * (row.quantity || 1) : revenue * 0.35;
      const current = map.get(monthKey) || { revenue: 0, units: 0, margin: 0 };
      map.set(monthKey, {
        revenue: current.revenue + revenue,
        units: current.units + (row.quantity || 1),
        margin: current.margin + margin,
      });
    });
    const entries = Array.from(map.entries())
      .sort((a, b) => (a[0] > b[0] ? 1 : -1))
      .map(([month, values]) => ({ month, ...values }));
    return entries;
  }, [salesTable]);

  const riskColor = (value) => {
    if (value === null || value === undefined) return "bg-slate-200";
    if (value < 15) return "bg-rose-500";
    if (value < 45) return "bg-amber-400";
    return "bg-emerald-500";
  };

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-100 px-3 py-1 text-xs font-semibold">
            📊 Panel de ventas e inventario para PYMEs
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100 px-3 py-1 text-xs font-semibold">
            ⚡ IA activa
          </span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Tablero comercial</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">Ventas, inventario y reportes personalizados listos para tu front.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchSales}
              className="rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-semibold shadow hover:bg-blue-700"
            >
              Actualizar ventas
            </button>
            <button
              onClick={fetchStock}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold"
            >
              Actualizar stock
            </button>
          </div>
        </div>
        {status && <p className="text-sm text-emerald-700 dark:text-emerald-200">{status}</p>}
        {errors && <p className="text-sm text-rose-600">{errors}</p>}
      </header>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Panel de ventas</h3>
          <span className="text-xs text-slate-500">KPIs + gráficos + tabla</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {loading.sales ? (
            <>
              <SkeletonBlock />
              <SkeletonBlock />
              <SkeletonBlock />
              <SkeletonBlock />
            </>
          ) : (
            <>
              <MetricCard label="Ventas totales" value={kpisFromSales.total_sales?.value} format="currency" />
              <MetricCard label="Unidades" value={kpisFromSales.units_sold?.value} />
              <MetricCard label="Ticket promedio" value={kpisFromSales.avg_ticket?.value} format="currency" />
              <MetricCard label="Margen %" value={kpisFromSales.margin_pct?.value} format="number" />
            </>
          )}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {salesCharts.slice(0, 3).map((chart, idx) => (
            <ChartCard key={idx} title={chart.title} chart={chart} />
          ))}
          {!salesCharts.length && <SkeletonBlock className="lg:col-span-3 h-40" />}
        </div>
        <TableCard title="Ventas recientes" data={salesTable} columnTypes={columnTypes} />
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-indigo-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Resumen inteligente</p>
              <p className="text-xs text-slate-500">Generado con el endpoint /metrics/summary</p>
            </div>
            <button
              onClick={fetchSummary}
              className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800"
            >
              Regenerar con IA
            </button>
          </div>
          {loading.summary ? (
            <SkeletonBlock className="h-20 mt-3" />
          ) : (
            <div className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
              <p className="font-semibold">{aiSummary?.ai_summary || "Carga tus datos para ver el resumen"}</p>
              <ul className="list-disc list-inside text-slate-600 dark:text-slate-300">
                {(aiSummary?.insights || []).map((insight, idx) => (
                  <li key={idx}>{insight}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Inventario inteligente</h3>
          <span className="text-xs text-slate-500">Rotación • Stock muerto • Riesgo</span>
        </div>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {loading.stock ? (
            <>
              <SkeletonBlock />
              <SkeletonBlock />
              <SkeletonBlock />
              <SkeletonBlock />
              <SkeletonBlock />
            </>
          ) : (
            <>
              <MetricCard label="Rotación" value={kpisFromStock.rotation?.value} />
              <MetricCard label="Días de inventario" value={kpisFromStock.days_inventory?.value} />
              <MetricCard label="SKU con baja rotación" value={kpisFromStock.dead_stock_items?.value} highlight="Alertas" />
              <MetricCard label="Stock total" value={stock?.mapping ? Object.keys(stock.mapping).length : demoInventory.length} />
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/70 p-4">
                <p className="text-xs font-semibold text-slate-500">Semáforo de riesgo</p>
                <div className="mt-3 flex items-center gap-2">
                  {[kpisFromStock.days_inventory?.value ?? 0, 30, 60].map((value, idx) => (
                    <div key={idx} className="flex-1">
                      <div className={`h-3 rounded-full ${riskColor(value)}`} />
                      <p className="text-[11px] text-slate-500 mt-1">{idx === 0 ? "Actual" : `Objetivo ${idx}`}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {stockCharts.slice(0, 2).map((chart, idx) => (
            <ChartCard key={idx} title={chart.title} chart={chart} />
          ))}
          {!stockCharts.length && <SkeletonBlock className="lg:col-span-2 h-32" />}
        </div>
        <TableCard title="Tabla de stock" data={stockTable} columnTypes={stock?.column_types || {}} />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Comparador de períodos</h3>
          <span className="text-xs text-slate-500">Mes vs mes con ventas, margen y unidades</span>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/70 p-4 shadow-sm">
          <div className="grid md:grid-cols-3 gap-4 text-sm text-slate-700 dark:text-slate-200">
            {monthlyComparison.map((row) => (
              <div key={row.month} className="rounded-xl border border-slate-100 dark:border-slate-800 p-3">
                <p className="text-xs text-slate-500">{row.month}</p>
                <p className="text-lg font-semibold">{new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(row.revenue)}</p>
                <p className="text-xs text-slate-500">Unidades: {row.units}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-300">Margen: {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(row.margin)}</p>
              </div>
            ))}
            {!monthlyComparison.length && <SkeletonBlock className="h-24" />}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Constructor de reportes</h3>
          <span className="text-xs text-slate-500">Elige métrica, dimensión y tipo de gráfico</span>
        </div>
        <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/70 p-4 space-y-3">
            <label className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
              Métrica
              <select
                value={chartBuilder.metric}
                onChange={(e) => setChartBuilder((prev) => ({ ...prev, metric: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2"
              >
                <option value="price">Ingresos</option>
                <option value="quantity">Unidades</option>
                <option value="cost">Costo</option>
              </select>
            </label>
            <label className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
              Dimensión
              <select
                value={chartBuilder.dimension}
                onChange={(e) => setChartBuilder((prev) => ({ ...prev, dimension: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2"
              >
                <option value="product">Producto</option>
                <option value="category">Categoría</option>
                <option value="date">Fecha</option>
              </select>
            </label>
            <label className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
              Tipo de gráfico
              <select
                value={chartBuilder.chart_type}
                onChange={(e) => setChartBuilder((prev) => ({ ...prev, chart_type: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2"
              >
                <option value="bar">Barras</option>
                <option value="line">Líneas</option>
                <option value="area">Área</option>
              </select>
            </label>
            <button
              onClick={runCustomChart}
              disabled={loading.custom}
              className="w-full rounded-xl bg-blue-600 text-white py-2 text-sm font-semibold shadow hover:bg-blue-700 disabled:opacity-60"
            >
              {loading.custom ? "Generando..." : "Vista previa"}
            </button>
            <p className="text-xs text-slate-500">Usa el endpoint /metrics/custom con los campos seleccionados.</p>
          </div>
          <ChartCard title="Vista previa" chart={customChart} />
        </div>
      </section>
    </div>
  );
};

export default HomeModules;
