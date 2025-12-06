import React from "react";
import ModuleCard from "../../components/cards/ModuleCard";
import SectionHeader from "../../components/cards/SectionHeader";

const SalesIcon = ({ className = "" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M4.5 17.5h15M6 15l4.5-4.5 3 3L18 9"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M18 12V8.5H14.5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const StockIcon = ({ className = "" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M5.5 7.5 12 4l6.5 3.5v8L12 19.5 5.5 15.5v-8Z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M5.5 7.5 12 11l6.5-3.5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ComparativesIcon = ({ className = "" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M7 17.5v-7M12 17.5V9m5 8.5v-5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path
      d="M6 11h12M6 14h12"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeDasharray="2.4 2.4"
      opacity="0.9"
    />
  </svg>
);

const ReportBuilderIcon = ({ className = "" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="4.5"
      y="6"
      width="15"
      height="12"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    <path
      d="M9 10.5h6M9 13.5h2.75M13.25 13.5H15"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <path
      d="M8.5 6V4.75a.75.75 0 0 1 .75-.75h5.5a.75.75 0 0 1 .75.75V6"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const DataIntegrationsIcon = ({ className = "" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="12" cy="7" r="2.25" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="7" cy="17" r="2.25" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="17" cy="17" r="2.25" stroke="currentColor" strokeWidth="1.8" />
    <path
      d="M10.5 8.75 8.2 14.4M13.5 8.75l2.3 5.65M9.25 17h5.5"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const HomeView = ({ onNavigate }) => {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Inicio"
        subtitle="Selecciona el módulo que necesitas: ventas, stock o integraciones"
        badge="Inicio"
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <ModuleCard
          title="Ventas"
          description="KPIs automáticos y vistas manuales"
          badge="Nuevo"
          icon={<SalesIcon className="h-5 w-5" />}
          actionLabel="Abrir módulo"
          onAction={() => onNavigate?.("sales")}
        />
        <ModuleCard
          title="Stock"
          description="Rotación, riesgo y días de inventario"
          badge="Inventario"
          icon={<StockIcon className="h-5 w-5" />}
          actionLabel="Abrir módulo"
          onAction={() => onNavigate?.("stock")}
        />
        <ModuleCard
          title="Comparativas"
          description="Mes vs mes, categoría y períodos"
          badge="Analítica"
          icon={<ComparativesIcon className="h-5 w-5" />}
          actionLabel="Abrir módulo"
          onAction={() => onNavigate?.("comparatives")}
        />
        <ModuleCard
          title="Report Builder"
          description="Métrica + dimensión + visualización"
          badge="Personalizado"
          icon={<ReportBuilderIcon className="h-5 w-5" />}
          actionLabel="Abrir módulo"
          onAction={() => onNavigate?.("reports")}
        />
        <ModuleCard
          title="Datos / Integraciones"
          description="Mercado Libre + archivos unificados"
          badge="Fuentes"
          icon={<DataIntegrationsIcon className="h-5 w-5" />}
          actionLabel="Configurar"
          onAction={() => onNavigate?.("data")}
        />
      </div>
    </div>
  );
};

export default HomeView;
