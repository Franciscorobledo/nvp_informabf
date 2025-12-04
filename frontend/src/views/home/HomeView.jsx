import React, { useEffect, useMemo, useState } from "react";
import API_URL from "../../api";
import MetricCard from "../../components/cards/MetricCard";
import SkeletonBlock from "../../components/cards/SkeletonBlock";
import SectionHeader from "../../components/cards/SectionHeader";
import ModuleCard from "../../components/cards/ModuleCard";
import ChartCard from "../../components/charts/ChartCard";
import TableCard from "../../components/tables/TableCard";

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

const SalesSection = ({ loading, kpis, charts, table, columnTypes, onRefresh, onSummary, summaryLoading, aiSummary }) => (
  <section className="space-y-4">
    <SectionHeader title="Ventas" subtitle="KPIs, charts y tabla consolidada" badge="Panel comercial" />
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {loading ? (
        <>
          <SkeletonBlock />
          <SkeletonBlock />
          <SkeletonBlock />
          <SkeletonBlock />
        </>
      ) : (
        <>
          <MetricCard label="Ventas totales" value={kpis.total_sales?.value} format="currency" />
          <MetricCard label="Unidades" value={kpis.units_sold?.value} />
          <MetricCard label="Ticket promedio" value={kpis.avg_ticket?.value} format="currency" />
          <MetricCard label="Margen %" value={kpis.margin_pct?.value} format="number" />
        </>
      )}
    </div>
    <div className="flex flex-wrap gap-3">
      <button
        onClick={onRefresh}
        className="rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-semibold shadow hover:bg-blue-700"
      >
        Actualizar ventas
      </button>
      <button
        onClick={onSummary}
        className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold"
      >
        {summaryLoading ? "Generando resumen..." : "Resumen con IA"}
      </button>
    </div>
    <div className="grid gap-4 lg:grid-cols-3">
      {charts.slice(0, 3).map((chart, idx) => (
        <ChartCard key={idx} title={chart.title} chart={chart} />
      ))}
      {!charts.length && <SkeletonBlock className="lg:col-span-3 h-40" />}
    </div>
    <TableCard title="Ventas recientes" data={table} columnTypes={columnTypes} />
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-indigo-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Resumen inteligente</p>
          <p className="text-xs text-slate-500">Generado con el endpoint /metrics/summary</p>
        </div>
        <button
          onClick={onSummary}
          className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800"
        >
          {summaryLoading ? "Procesando..." : "Regenerar"}
        </button>
      </div>
      {summaryLoading ? (
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
);

const InventorySection = ({ loading, kpis, charts, table, columnTypes, stockSize, onRefresh }) => {
  const riskColor = (value) => {
    if (value === null || value === undefined) return "bg-slate-200";
    if (value < 15) return "bg-rose-500";
    if (value < 45) return "bg-amber-400";
    return "bg-emerald-500";
  };

  return (
    <section className="space-y-4">
      <SectionHeader title="Stock" subtitle="Rotación, riesgo y saldos" badge="Inventario" />
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        {loading ? (
          <>
            <SkeletonBlock />
            <SkeletonBlock />
            <SkeletonBlock />
            <SkeletonBlock />
            <SkeletonBlock />
          </>
        ) : (
          <>
            <MetricCard label="Rotación" value={kpis.rotation?.value} />
            <MetricCard label="Días de inventario" value={kpis.days_inventory?.value} />
            <MetricCard label="SKU con baja rotación" value={kpis.dead_stock_items?.value} highlight="Alertas" />
            <MetricCard label="Stock total" value={stockSize} />
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/70 p-4">
              <p className="text-xs font-semibold text-slate-500">Semáforo de riesgo</p>
              <div className="mt-3 flex items-center gap-2">
                {[kpis.days_inventory?.value ?? 0, 30, 60].map((value, idx) => (
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
      <button
        onClick={onRefresh}
        className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800"
      >
        Actualizar stock
      </button>
      <div className="grid gap-4 lg:grid-cols-2">
        {charts.slice(0, 2).map((chart, idx) => (
          <ChartCard key={idx} title={chart.title} chart={chart} />
        ))}
        {!charts.length && <SkeletonBlock className="lg:col-span-2 h-32" />}
      </div>
      <TableCard title="Tabla de stock" data={table} columnTypes={columnTypes} />
    </section>
  );
};

const ComparisonSection = ({ rows }) => (
  <section className="space-y-4">
    <SectionHeader title="Comparativas" subtitle="Mes vs mes con ventas, margen y unidades" />
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/70 p-4 shadow-sm">
      <div className="grid md:grid-cols-3 gap-4 text-sm text-slate-700 dark:text-slate-200">
        {rows.map((row) => (
          <div key={row.month} className="rounded-xl border border-slate-100 dark:border-slate-800 p-3">
            <p className="text-xs text-slate-500">{row.month}</p>
            <p className="text-lg font-semibold">
              {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(row.revenue)}
            </p>
            <p className="text-xs text-slate-500">Unidades: {row.units}</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-300">
              Margen: {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(row.margin)}
            </p>
          </div>
        ))}
        {!rows.length && <SkeletonBlock className="h-24" />}
      </div>
    </div>
  </section>
);

const ReportBuilderSection = ({ config, onChange, onGenerate, loading, preview }) => (
  <section className="space-y-4">
    <SectionHeader title="Reportes" subtitle="Elige métrica, dimensión y tipo de gráfico" />
    <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/70 p-4 space-y-3">
        <label className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
          Métrica
          <select
            value={config.metric}
            onChange={(e) => onChange({ ...config, metric: e.target.value })}
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
            value={config.dimension}
            onChange={(e) => onChange({ ...config, dimension: e.target.value })}
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
            value={config.chart_type}
            onChange={(e) => onChange({ ...config, chart_type: e.target.value })}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2"
          >
            <option value="bar">Barras</option>
            <option value="line">Líneas</option>
            <option value="area">Área</option>
          </select>
        </label>
        <button
          onClick={onGenerate}
          disabled={loading}
          className="w-full rounded-xl bg-blue-600 text-white py-2 text-sm font-semibold shadow hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "Generando..." : "Vista previa"}
        </button>
        <p className="text-xs text-slate-500">Usa el endpoint /metrics/custom con los campos seleccionados.</p>
      </div>
      <ChartCard title="Vista previa" chart={preview} />
    </div>
  </section>
);

const IntegrationsSection = ({ onNavigate }) => (
  <section className="space-y-4">
    <SectionHeader title="Integraciones" subtitle="MercadoLibre y conectores próximos" />
    <div className="grid gap-4 md:grid-cols-2">
      <ModuleCard
        title="MercadoLibre"
        description="Sincroniza publicaciones, ventas y stock en tiempo real"
        badge="Activa"
        onAction={() => onNavigate("integrations")}
        actionLabel="Abrir integraciones"
      />
      <ModuleCard
        title="API CSV"
        description="Sube archivos para generar insights con IA"
        badge="Beta"
        actionLabel="Ir a carga"
        onAction={() => onNavigate("home", "analyze")}
      />
      <ModuleCard
        title="Reportes programados"
        description="Agenda envíos de dashboards y alertas"
        badge="Próximo"
      />
      <ModuleCard
        title="CRM / ERP"
        description="Conexiones a sistemas externos"
        badge="Próximo"
      />
    </div>
  </section>
);

const HomeView = ({ onUnauthorized, onNavigate }) => {
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
      setCustomChart(data);
    } catch (err) {
      setErrors(err.message || "No se pudo generar el gráfico");
    } finally {
      setLoading((prev) => ({ ...prev, custom: false }));
    }
  };

  useEffect(() => {
    fetchSales();
    fetchStock();
    fetchSummary();
  }, []);

  const salesTable = sales?.table || [];
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
              onClick={() => onNavigate?.("integrations")}
              className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800"
            >
              Integraciones
            </button>
            <button
              onClick={() => onNavigate?.("home", "analyze")}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold"
            >
              Explorar módulos
            </button>
          </div>
        </div>
        {status && <p className="text-sm text-emerald-700 dark:text-emerald-200">{status}</p>}
        {errors && <p className="text-sm text-rose-600">{errors}</p>}
      </header>

      <SalesSection
        loading={loading.sales}
        kpis={sales?.kpis || {}}
        charts={sales?.charts || []}
        table={salesTable}
        columnTypes={sales?.column_types || {}}
        onRefresh={fetchSales}
        onSummary={fetchSummary}
        summaryLoading={loading.summary}
        aiSummary={aiSummary}
      />

      <InventorySection
        loading={loading.stock}
        kpis={stock?.kpis || {}}
        charts={stock?.charts || []}
        table={stock?.table || []}
        columnTypes={stock?.column_types || {}}
        stockSize={stock?.mapping ? Object.keys(stock.mapping).length : demoInventory.length}
        onRefresh={fetchStock}
      />

      <ComparisonSection rows={monthlyComparison} />

      <ReportBuilderSection
        config={chartBuilder}
        onChange={setChartBuilder}
        onGenerate={runCustomChart}
        loading={loading.custom}
        preview={customChart}
      />

      <IntegrationsSection onNavigate={(page, module) => onNavigate?.(page, module)} />
    </div>
  );
};

export default HomeView;
