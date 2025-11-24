import React, { useState } from "react";
import {
  PrimaryButton,
  SecondaryButton,
  GhostButton,
} from "../components/ui/Button";

const AppLayout = ({
  user,
  theme,
  onToggleTheme,
  onLogout,
  activePage,
  onNavigate,
  children,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const navigation = [
    { id: "home", label: "Inicio" },
    { id: "config", label: "Configuración" },
  ];

  const renderNavButtons = (variant = "desktop") => (
    <div
      className={
        variant === "desktop"
          ? "hidden items-center gap-2 md:flex"
          : "grid gap-2"
      }
    >
      {navigation.map((item) => (
        <SecondaryButton
          key={item.id}
          onClick={() => {
            onNavigate?.(item.id);
            setMenuOpen(false);
          }}
          className={`px-4 py-2 text-sm ${
            activePage === item.id
              ? "border-indigo-400 text-indigo-100 bg-slate-900/80"
              : ""
          }`}
        >
          {item.label}
        </SecondaryButton>
      ))}
      <SecondaryButton
        onClick={() => {
          onToggleTheme?.();
          if (variant === "mobile") setMenuOpen(false);
        }}
        className="px-4 py-2 text-sm"
      >
        <span className="text-lg" aria-hidden="true">
          {theme === "dark" ? "🌙" : "☀️"}
        </span>
        {theme === "dark" ? "Modo oscuro" : "Modo claro"}
      </SecondaryButton>
      <PrimaryButton
        onClick={() => {
          onLogout?.();
          if (variant === "mobile") setMenuOpen(false);
        }}
        className="px-4 py-2 text-sm"
      >
        Cerrar sesión
      </PrimaryButton>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-gradient-to-b dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-500/40 bg-indigo-500/10 text-lg font-bold text-indigo-100">
              BF
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">AI Data Visualizer</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">InformeBF</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right md:block">
              <p className="text-sm text-slate-700 dark:text-slate-200">Hola, {user?.username} 👋</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Sesión activa</p>
            </div>
            {renderNavButtons("desktop")}
            <GhostButton
              className="md:hidden px-3 py-2 border border-slate-200 bg-white/60 dark:border-slate-800 dark:bg-slate-900/70"
              aria-expanded={menuOpen}
              aria-label="Abrir menú"
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              ☰
            </GhostButton>
          </div>
        </div>
        {menuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white/95 px-4 py-4 shadow-xl dark:border-slate-800 dark:bg-slate-950/95">
            <div className="mb-3 text-sm text-slate-600 dark:text-slate-300">
              Sesión: <span className="font-semibold">{user?.username}</span>
            </div>
            {renderNavButtons("mobile")}
          </div>
        )}
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 md:px-6">{children}</main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 text-center text-sm text-slate-500 dark:text-slate-500 md:px-6">
        © {new Date().getFullYear()} InformeBF — diseñado para analítica moderna.
      </footer>
    </div>
  );
};

export default AppLayout;
