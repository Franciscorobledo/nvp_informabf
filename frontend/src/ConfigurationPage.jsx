import React from "react";
import UserManagement from "./UserManagement";
import AdminOpenAIUsage from "./AdminOpenAIUsage";
import AppCard from "../components/ui/AppCard";
import SectionHeader from "../components/ui/SectionHeader";

const ConfigurationPage = ({ user, onUnauthorized }) => {
  const isAdmin = user?.role === "admin";

  return (
    <section className="space-y-6">
      <SectionHeader
        eyebrow={{ icon: "⚙️", label: "Centro de configuración" }}
        title="Panel de administración"
        description="Gestiona usuarios y monitorea el estado de la integración con OpenAI desde un solo lugar."
        actions={
          <span className="text-sm text-slate-400">
            Sesión: {user?.username || "desconocida"} ({user?.role || "usuario"})
          </span>
        }
      />

      {!isAdmin && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-100">
          <p className="font-semibold">Acceso restringido</p>
          <p className="text-sm">Solo los administradores pueden gestionar usuarios o actualizar el token de OpenAI.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        <AppCard title="Usuarios" subtitle="Altas, bajas y roles asignados para tu equipo">
          <UserManagement onUnauthorized={onUnauthorized} />
        </AppCard>

        <AppCard
          title="Uso de OpenAI"
          subtitle="Supervisa el consumo y actualiza la configuración de tu integración"
        >
          <AdminOpenAIUsage onUnauthorized={onUnauthorized} />
        </AppCard>
      </div>
    </section>
  );
};

export default ConfigurationPage;
