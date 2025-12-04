import React from "react";

const SectionHeader = ({ title, subtitle, badge }) => (
  <div className="flex items-center justify-between">
    <div>
      <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
    </div>
    {badge && <span className="text-xs text-slate-500">{badge}</span>}
  </div>
);

export default SectionHeader;
