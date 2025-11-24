import React from "react";

const AppCard = ({ title, subtitle, actions, className = "", children }) => {
  return (
    <section
      className={`app-surface p-6 md:p-7 w-full ${className}`.trim()}
      role="region"
      aria-label={typeof title === "string" ? title : undefined}
    >
      {(title || subtitle || actions) && (
        <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            {title && <h3 className="text-xl font-semibold leading-tight text-slate-50">{title}</h3>}
            {subtitle && <p className="text-sm text-slate-400 leading-relaxed">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="space-y-4 text-slate-200">{children}</div>
    </section>
  );
};

export default AppCard;
