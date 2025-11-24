import React from "react";

const SectionHeader = ({ title, description, eyebrow, actions }) => (
  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
    <div className="space-y-1">
      {eyebrow && (
        <span className="accent-pill">
          <span aria-hidden="true">{eyebrow.icon}</span>
          {eyebrow.label}
        </span>
      )}
      {title && <h2 className="text-2xl font-semibold text-slate-50">{title}</h2>}
      {description && (
        <p className="text-sm text-slate-400 leading-relaxed max-w-3xl">{description}</p>
      )}
    </div>
    {actions && <div className="flex items-center gap-3">{actions}</div>}
  </div>
);

export default SectionHeader;
