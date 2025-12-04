import React from "react";
import ModuleCard from "../../components/cards/ModuleCard";
import SectionHeader from "../../components/cards/SectionHeader";

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
          actionLabel="Abrir módulo"
          onAction={() => onNavigate?.("sales")}
        />
        <ModuleCard
          title="Stock"
          description="Rotación, riesgo y días de inventario"
          badge="Inventario"
          actionLabel="Abrir módulo"
          onAction={() => onNavigate?.("stock")}
        />
        <ModuleCard
          title="Comparativas"
          description="Mes vs mes, categoría y períodos"
          badge="Analítica"
          actionLabel="Abrir módulo"
          onAction={() => onNavigate?.("comparatives")}
        />
        <ModuleCard
          title="Report Builder"
          description="Métrica + dimensión + visualización"
          badge="Personalizado"
          actionLabel="Abrir módulo"
          onAction={() => onNavigate?.("reports")}
        />
        <ModuleCard
          title="Datos / Integraciones"
          description="Mercado Libre + archivos unificados"
          badge="Fuentes"
          actionLabel="Configurar"
          onAction={() => onNavigate?.("data")}
        />
      </div>
    </div>
  );
};

export default HomeView;
