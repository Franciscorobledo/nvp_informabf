import React from "react";

const AppLayout = ({
  user,
  theme,
  onToggleTheme,
  onLogout,
  activePage,
  navItems,
  onNavigate,
  children,
}) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="relative">
        <div className="pointer-events-none fixed inset-0 opacity-60">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
          <div className="absolute right-10 top-10 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute left-[-80px] bottom-0 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
        </div>

        <header className="relative z-10 border-b border-white/5 bg-slate-900/70 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-2xl shadow-lg shadow-blue-600/40">
                📊
              </div>
              <div className="leading-tight">
                <p className="text-sm uppercase tracking-wide text-slate-300">InformeBF</p>
                <p className="text-lg font-semibold text-white">Panel analítico</p>
              </div>
            </div>

            <div className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-1 shadow-inner md:flex">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                    activePage === item.id
                      ? "bg-white text-slate-900 shadow"
                      : "text-slate-200 hover:bg-white/10"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 md:hidden">
              <select
                value={activePage}
                onChange={(event) => onNavigate(event.target.value)}
                className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-semibold text-white shadow-inner"
              >
                {navItems.map((item) => (
                  <option key={item.id} value={item.id} className="text-slate-900">
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 text-right">
              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-white">{user?.username}</p>
                <p className="text-xs text-slate-300">{user?.role === "admin" ? "Administrador" : "Usuario"}</p>
              </div>
              <button
                onClick={onToggleTheme}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-lg shadow-sm hover:border-white/30"
                aria-label="Cambiar tema"
              >
                {theme === "dark" ? "🌙" : "☀️"}
              </button>
              <button
                onClick={onLogout}
                className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-red-500/30 hover:bg-red-600"
              >
                <span>Salir</span>
              </button>
            </div>
          </div>
        </header>

        <main className="relative z-10 mx-auto w-full max-w-6xl px-4 py-10">
          <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-2xl shadow-blue-500/5">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
