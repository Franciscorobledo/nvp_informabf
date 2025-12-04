import React, { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import KPICard from "./KPICard";
import API_URL from "../src/api";
import AppButton from "./AppButton";

const defaultSales = {
  kpis: {
    total_sales: 1820000,
    units: 420,
    avg_ticket: 43330,
    margin: 32,
  },
  trend: [
    { label: "Lun", sales: 180000 },
    { label: "Mar", sales: 210000 },
    { label: "Mié", sales: 250000 },
    { label: "Jue", sales: 230000 },
    { label: "Vie", sales: 320000 },
    { label: "Sáb", sales: 240000 },
    { label: "Dom", sales: 150000 },
  ],
  top_products: [
    { name: "Zapatilla Run", sales: 520000, units: 110, margin: 37 },
    { name: "Campera Softshell", sales: 390000, units: 70, margin: 31 },
    { name: "Buzo Urbano", sales: 280000, units: 95, margin: 28 },
    { name: "Gorra Classic", sales: 150000, units: 130, margin: 48 },
  ],
  by_category: [
    { category: "Calzado", sales: 910000 },
    { category: "Indumentaria", sales: 720000 },
    { category: "Accesorios", sales: 190000 },
  ],
  table: [
    {
      product: "Zapatilla Run",
      sales: 520000,
      units: 110,
      margin: "37%",
      category: "Calzado",
    },
    {
      product: "Campera Softshell",
      sales: 390000,
      units: 70,
      margin: "31%",
      category: "Indumentaria",
    },
    {
      product: "Gorra Classic",
      sales: 150000,
      units: 130,
      margin: "48%",
      category: "Accesorios",
    },
  ],
};

const defaultStock = {
  kpis: {
    total: 1385,
    critical: 12,
    dead: 6,
    days: 38,
  },
  rotation: [
    { product: "Zapatilla Run", rotation: 6.4 },
    { product: "Campera Softshell", rotation: 4.9 },
    { product: "Buzo Urbano", rotation: 3.5 },
    { product: "Gorra Classic", rotation: 1.2 },
  ],
  dead_stock: [
    { product: "Gorra Classic", units: 210 },
    { product: "Bolso Sport", units: 120 },
  ],
  traffic_light: [
    { label: "Verde", count: 58, color: "#22c55e" },
    { label: "Amarillo", count: 24, color: "#f59e0b" },
    { label: "Rojo", count: 12, color: "#ef4444" },
  ],
  table: [
    {
      product: "Zapatilla Run",
      stock: 120,
      sales30d: 340,
      rotation: 6.4,
      days: 19,
    },
    {
      product: "Buzo Urbano",
      stock: 80,
      sales30d: 200,
      rotation: 3.5,
      days: 28,
    },
    {
      product: "Gorra Classic",
      stock: 300,
      sales30d: 25,
      rotation: 0.8,
      days: 120,
    },
  ],
};

const defaultComparatives = {
  month_vs_month: [
    { month: "Abr", current: 920000, previous: 860000 },
    { month: "May", current: 980000, previous: 910000 },
    { month: "Jun", current: 1120000, previous: 980000 },
  ],
  category_vs_category: [
    { category: "Calzado", current: 910000, previous: 820000 },
    { category: "Indumentaria", current: 720000, previous: 690000 },
    { category: "Accesorios", current: 190000, previous: 170000 },
  ],
  heatmap: [
    { label: "Q1", calzado: 72, indumentaria: 65, accesorios: 35 },
    { label: "Q2", calzado: 88, indumentaria: 74, accesorios: 42 },
    { label: "Q3", calzado: 79, indumentaria: 70, accesorios: 39 },
  ],
};

const metricsOptions = [
  { value: "ventas", label: "Ventas" },
  { value: "unidades", label: "Unidades" },
  { value: "margen", label: "Margen" },
  { value: "stock", label: "Stock" },
  { value: "rotacion", label: "Rotación" },
];

const dimensionOptions = [
  { value: "producto", label: "Producto" },
  { value: "categoria", label: "Categoría" },
  { value: "fecha", label: "Fecha" },
];

const visualizationOptions = [
  { value: "bar", label: "Barra" },
  { value: "line", label: "Línea" },
  { value: "table", label: "Tabla" },
];

const BusinessDashboards = ({ onUnauthorized }) => {
  const token = useMemo(() => localStorage.getItem("token"), []);
  const [activeTab, setActiveTab] = useState("ventas");
  const [salesData, setSalesData] = useState(defaultSales);
  const [stockData, setStockData] = useState(defaultStock);
  const [comparativeData, setComparativeData] = useState(defaultComparatives);
  const [summary, setSummary] = useState("Generando resumen con IA...");
  const [reportConfig, setReportConfig] = useState({
    metric: "ventas",
    dimension: "producto",
    visualization: "bar",
  });
  const [reportPreview, setReportPreview] = useState(null);
  const [loading, setLoading] = useState({
    sales: false,
    stock: false,
    comparative: false,
    summary: false,
    report: false,
    save: false,
  });
  const [errors, setErrors] = useState("");
  const [saveStatus, setSaveStatus] = useState("");

  const authorizedFetch = async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: token ? `Bearer ${token}` : undefined,
        "Content-Type": options.body instanceof FormData ? undefined : "application/json",
      },
    });

    if ([401, 403].includes(response.status)) {
      onUnauthorized?.("Tu sesión expiró. Vuelve a iniciar sesión.");
      throw new Error("unauthorized");
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "No se pudo recuperar los datos");
    }

    return response.json();
  };

  const handleFetchSales = async () => {
    setLoading((prev) => ({ ...prev, sales: true }));
    setErrors("");
    try {
      const data = await authorizedFetch(`${API_URL}/metrics/sales`, {
        method: "GET",
      });
      setSalesData({
        kpis: data.kpis || defaultSales.kpis,
        trend: data.trend || data.daily || defaultSales.trend,
        top_products: data.top_products || data.products || defaultSales.top_products,
        by_category: data.by_category || data.categories || defaultSales.by_category,
        table: data.table || data.products || defaultSales.table,
      });
    } catch (error) {
      setErrors(error.message);
      setSalesData(defaultSales);
    } finally {
      setLoading((prev) => ({ ...prev, sales: false }));
    }
  };

  const handleFetchStock = async () => {
    setLoading((prev) => ({ ...prev, stock: true }));
    setErrors("");
    try {
      const data = await authorizedFetch(`${API_URL}/metrics/stock`, {
        method: "GET",
      });
      setStockData({
        kpis: data.kpis || defaultStock.kpis,
        rotation: data.rotation || data.turnover || defaultStock.rotation,
        dead_stock: data.dead_stock || data.no_rotation || defaultStock.dead_stock,
        traffic_light: data.traffic_light || data.health || defaultStock.traffic_light,
        table: data.table || data.items || defaultStock.table,
      });
    } catch (error) {
      setErrors(error.message);
      setStockData(defaultStock);
    } finally {
      setLoading((prev) => ({ ...prev, stock: false }));
    }
  };

  const handleFetchComparative = async () => {
    setLoading((prev) => ({ ...prev, comparative: true }));
    setErrors("");
    try {
      const data = await authorizedFetch(`${API_URL}/metrics/comparative`, {
        method: "GET",
      });
      setComparativeData({
        month_vs_month: data.month_vs_month || data.months || defaultComparatives.month_vs_month,
        category_vs_category: data.category_vs_category || data.categories || defaultComparatives.category_vs_category,
        heatmap: data.heatmap || data.periods || defaultComparatives.heatmap,
      });
    } catch (error) {
      setErrors(error.message);
      setComparativeData(defaultComparatives);
    } finally {
      setLoading((prev) => ({ ...prev, comparative: false }));
    }
  };

  const handleFetchSummary = async () => {
    setLoading((prev) => ({ ...prev, summary: true }));
    setErrors("");
    try {
      const data = await authorizedFetch(`${API_URL}/metrics/summary`, {
        method: "GET",
      });
      setSummary(data.summary || data.text || "Resumen generado con IA disponible.");
    } catch (error) {
      setErrors(error.message);
      setSummary("No pudimos obtener el resumen automático, mostrando demo.");
    } finally {
      setLoading((prev) => ({ ...prev, summary: false }));
    }
  };

  const handleGenerateReport = async () => {
    setLoading((prev) => ({ ...prev, report: true }));
    setErrors("");
    setSaveStatus("");
    try {
      const data = await authorizedFetch(`${API_URL}/metrics/custom`, {
        method: "POST",
        body: JSON.stringify(reportConfig),
      });
      setReportPreview(data);
    } catch (error) {
      setErrors(error.message);
      setReportPreview(null);
    } finally {
      setLoading((prev) => ({ ...prev, report: false }));
    }
  };

  const handleSaveReport = async () => {
    setLoading((prev) => ({ ...prev, save: true }));
    setErrors("");
    setSaveStatus("");
    try {
      const data = await authorizedFetch(`${API_URL}/metrics/custom`, {
        method: "POST",
        body: JSON.stringify({ ...reportConfig, save: true }),
      });
      setSaveStatus(data.message || "Reporte guardado correctamente.");
    } catch (error) {
      setErrors(error.message);
      setSaveStatus("");
    } finally {
      setLoading((prev) => ({ ...prev, save: false }));
    }
  };

  useEffect(() => {
    handleFetchSales();
    handleFetchStock();
    handleFetchComparative();
    handleFetchSummary();
  }, []);

  const formatCurrency = (value) =>
    value?.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }) || "—";

  const formatNumber = (value) => (value || value === 0 ? value.toLocaleString("es-AR") : "—");

  const renderSalesPanel = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard
          icon="💰"
          label="Ventas totales"
          value={salesData.kpis?.total_sales}
          format="currency"
          trend={{ direction: "up", value: 8.2 }}
        />
        <KPICard
          icon="📦"
          label="Unidades vendidas"
          value={salesData.kpis?.units}
          format="number"
          trend={{ direction: "up", value: 4.5 }}
        />
        <KPICard
          icon="🎟️"
          label="Ticket promedio"
          value={salesData.kpis?.avg_ticket}
          format="currency"
          trend={{ direction: "up", value: 3.1 }}
        />
        <KPICard
          icon="📈"
          label="Margen estimado"
          value={salesData.kpis?.margin}
          format="percent"
          trend={{ direction: "up", value: 1.8 }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Ventas por día/semana</h4>
            <span className="text-[11px] text-slate-500">Línea</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={salesData.trend} margin={{ left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" tickFormatter={formatCurrency} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <ReferenceLine y={salesData.kpis?.avg_ticket} stroke="#6366f1" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="sales" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Ventas por categoría</h4>
            <span className="text-[11px] text-slate-500">Pastel</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={salesData.by_category}
                  dataKey="sales"
                  nameKey="category"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  label
                >
                  {salesData.by_category?.map((item, index) => (
                    <Cell
                      key={item.category}
                      fill={["#6366f1", "#22c55e", "#f59e0b", "#06b6d4"][index % 4]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Top productos</h4>
            <span className="text-[11px] text-slate-500">Barra</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={salesData.top_products} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" tickFormatter={formatCurrency} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="sales" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Detalle de ventas</h4>
            <span className="text-[11px] text-slate-500">Tabla</span>
          </div>
          <div className="overflow-auto max-h-72">
            <table className="min-w-full text-sm text-slate-700 dark:text-slate-200">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr>
                  <th className="px-3 py-2 text-left">Producto</th>
                  <th className="px-3 py-2 text-left">Ventas</th>
                  <th className="px-3 py-2 text-left">Unidades</th>
                  <th className="px-3 py-2 text-left">Margen</th>
                  <th className="px-3 py-2 text-left">Categoría</th>
                </tr>
              </thead>
              <tbody>
                {salesData.table?.map((row) => (
                  <tr key={row.product} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-2">{row.product}</td>
                    <td className="px-3 py-2">{formatCurrency(row.sales)}</td>
                    <td className="px-3 py-2">{formatNumber(row.units)}</td>
                    <td className="px-3 py-2">{row.margin}</td>
                    <td className="px-3 py-2">{row.category}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/70 dark:bg-indigo-900/30 p-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xl">🤖</div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-50">Resumen IA</p>
            <p className="text-sm text-indigo-950/80 dark:text-indigo-100/90">
              {loading.summary ? "Analizando ventas..." : summary}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStockPanel = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard
          icon="📦"
          label="Stock total"
          value={stockData.kpis?.total}
          format="number"
          trend={{ direction: "up", value: 2.3 }}
        />
        <KPICard
          icon="🚨"
          label="Productos críticos"
          value={stockData.kpis?.critical}
          format="number"
          alert
          trend={{ direction: "down", value: 1.2 }}
        />
        <KPICard
          icon="🧊"
          label="Sin rotación"
          value={stockData.kpis?.dead}
          format="number"
          alert
          trend={{ direction: "down", value: 0.5 }}
        />
        <KPICard
          icon="⏳"
          label="Días inventario"
          value={stockData.kpis?.days}
          format="number"
          trend={{ direction: "up", value: 0.8 }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Rotación 30d</h4>
            <span className="text-[11px] text-slate-500">Barra</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={stockData.rotation} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="product" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip formatter={(value) => `${value} rot.`} />
                <Bar dataKey="rotation" fill="#22c55e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Stock muerto</h4>
            <span className="text-[11px] text-slate-500">Lista</span>
          </div>
          <div className="space-y-3">
            {stockData.dead_stock?.map((item) => (
              <div
                key={item.product}
                className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800/70 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-semibold">{item.product}</p>
                  <p className="text-xs text-slate-500">Sin ventas 60d</p>
                </div>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-50">{item.units} u</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Semáforo</h4>
            <span className="text-[11px] text-slate-500">Estado</span>
          </div>
          <div className="flex gap-3">
            {stockData.traffic_light?.map((item) => (
              <div key={item.label} className="flex-1 rounded-xl p-3 text-center" style={{ background: `${item.color}15` }}>
                <p className="text-xs text-slate-500">{item.label}</p>
                <p className="text-2xl font-bold" style={{ color: item.color }}>
                  {item.count}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Inventario</h4>
            <span className="text-[11px] text-slate-500">Tabla</span>
          </div>
          <div className="overflow-auto max-h-64">
            <table className="min-w-full text-sm text-slate-700 dark:text-slate-200">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr>
                  <th className="px-3 py-2 text-left">Producto</th>
                  <th className="px-3 py-2 text-left">Stock</th>
                  <th className="px-3 py-2 text-left">Ventas 30d</th>
                  <th className="px-3 py-2 text-left">Rotación</th>
                  <th className="px-3 py-2 text-left">Días inv.</th>
                </tr>
              </thead>
              <tbody>
                {stockData.table?.map((row) => (
                  <tr key={row.product} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-2">{row.product}</td>
                    <td className="px-3 py-2">{formatNumber(row.stock)}</td>
                    <td className="px-3 py-2">{formatNumber(row.sales30d)}</td>
                    <td className="px-3 py-2">{row.rotation}</td>
                    <td className="px-3 py-2">{row.days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  const renderComparativesPanel = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Mes vs Mes</h4>
            <span className="text-[11px] text-slate-500">Líneas</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={comparativeData.month_vs_month} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" tickFormatter={formatCurrency} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Line type="monotone" dataKey="current" name="Actual" stroke="#0ea5e9" strokeWidth={3} />
                <Line type="monotone" dataKey="previous" name="Anterior" stroke="#6366f1" strokeWidth={2} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Categoría vs Categoría</h4>
            <span className="text-[11px] text-slate-500">Barras apiladas</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={comparativeData.category_vs_category} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="category" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" tickFormatter={formatCurrency} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="current" name="Actual" stackId="a" fill="#22c55e" radius={[6, 6, 0, 0]} />
                <Bar dataKey="previous" name="Anterior" stackId="a" fill="#a5b4fc" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Heatmap simple</h4>
          <span className="text-[11px] text-slate-500">Intensidad por período</span>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div className="text-xs text-slate-500">Periodo</div>
          <div className="text-xs text-slate-500">Calzado</div>
          <div className="text-xs text-slate-500">Indumentaria</div>
          <div className="text-xs text-slate-500">Accesorios</div>
          {comparativeData.heatmap?.map((row) => (
            <React.Fragment key={row.label}>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{row.label}</div>
              {[row.calzado, row.indumentaria, row.accesorios].map((value, idx) => (
                <div
                  key={`${row.label}-${idx}`}
                  className="rounded-lg px-2 py-3 text-center text-sm font-semibold"
                  style={{
                    backgroundColor: `rgba(99, 102, 241, ${Math.min(1, (value || 0) / 100)})`,
                    color: (value || 0) > 60 ? "#fff" : "#0f172a",
                  }}
                >
                  {value ?? "-"}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );

  const renderReportBuilder = () => (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 p-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 md:items-end">
          <div className="flex-1">
            <label className="text-xs text-slate-500">Métrica</label>
            <select
              value={reportConfig.metric}
              onChange={(e) => setReportConfig((prev) => ({ ...prev, metric: e.target.value }))}
              className="w-full mt-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            >
              {metricsOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs text-slate-500">Dimensión</label>
            <select
              value={reportConfig.dimension}
              onChange={(e) => setReportConfig((prev) => ({ ...prev, dimension: e.target.value }))}
              className="w-full mt-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            >
              {dimensionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs text-slate-500">Visualización</label>
            <select
              value={reportConfig.visualization}
              onChange={(e) => setReportConfig((prev) => ({ ...prev, visualization: e.target.value }))}
              className="w-full mt-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            >
              {visualizationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <AppButton variant="primary" onClick={handleGenerateReport} disabled={loading.report}>
              {loading.report ? "Generando..." : "Vista previa"}
            </AppButton>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Vista previa</h4>
          <span className="text-[11px] text-slate-500">{reportConfig.visualization}</span>
        </div>

        {!reportPreview && (
          <p className="text-sm text-slate-500">Lanza una vista previa para ver tu reporte personalizado.</p>
        )}

        {reportPreview && reportConfig.visualization === "table" && (
          <div className="overflow-auto max-h-64">
            <table className="min-w-full text-sm text-slate-700 dark:text-slate-200">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr>
                  {reportPreview.columns?.map((column) => (
                    <th key={column} className="px-3 py-2 text-left">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reportPreview.rows?.map((row, idx) => (
                  <tr key={`${row[0]}-${idx}`} className="border-t border-slate-100 dark:border-slate-800">
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx} className="px-3 py-2">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {reportPreview && reportConfig.visualization === "bar" && (
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={reportPreview.data || []} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey={reportPreview.dimension || "label"} stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey={reportPreview.metric || "value"} fill="#0ea5e9" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {reportPreview && reportConfig.visualization === "line" && (
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={reportPreview.data || []} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey={reportPreview.dimension || "label"} stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Line type="monotone" dataKey={reportPreview.metric || "value"} stroke="#6366f1" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <div className="flex flex-col items-end gap-2">
            <AppButton
              variant="secondary"
              onClick={handleSaveReport}
              disabled={loading.save || loading.report}
            >
              {loading.save ? "Guardando..." : "Guardar reporte"}
            </AppButton>
            {saveStatus && (
              <span className="text-xs text-emerald-600 dark:text-emerald-300">{saveStatus}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Suite de negocio</p>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboards profesionales</h2>
        </div>
        <AppButton onClick={() => handleFetchSummary()} variant="secondary">
          Actualizar IA
        </AppButton>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { id: "ventas", label: "Panel de ventas" },
          { id: "stock", label: "Panel de stock" },
          { id: "comparativas", label: "Comparativas" },
          { id: "reportes", label: "Report Builder" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === tab.id
                ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {errors && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 text-amber-800 px-4 py-3 text-sm">
          {errors}
        </div>
      )}

      {loading.sales && activeTab === "ventas" && (
        <p className="text-sm text-slate-500">Cargando métricas de ventas...</p>
      )}
      {loading.stock && activeTab === "stock" && (
        <p className="text-sm text-slate-500">Cargando métricas de stock...</p>
      )}
      {loading.comparative && activeTab === "comparativas" && (
        <p className="text-sm text-slate-500">Cargando comparativas...</p>
      )}
      {loading.report && activeTab === "reportes" && (
        <p className="text-sm text-slate-500">Generando reporte...</p>
      )}

      {activeTab === "ventas" && renderSalesPanel()}
      {activeTab === "stock" && renderStockPanel()}
      {activeTab === "comparativas" && renderComparativesPanel()}
      {activeTab === "reportes" && renderReportBuilder()}
    </div>
  );
};

export default BusinessDashboards;
