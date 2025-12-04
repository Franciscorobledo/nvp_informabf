import React from "react";

const SkeletonBlock = ({ className = "h-24" }) => (
  <div className={`animate-pulse rounded-2xl bg-slate-200/80 dark:bg-slate-800/70 ${className}`} />
);

export default SkeletonBlock;
