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
      <div className="grid gap-4 md:grid-cols-3">
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
