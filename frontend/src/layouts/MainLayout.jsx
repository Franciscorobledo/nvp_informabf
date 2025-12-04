import React from "react";

const MainLayout = ({ children, className = "" }) => (
  <div
    className={`min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/60 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 flex flex-col items-center font-sans px-4 pt-28 pb-10 text-gray-900 dark:text-slate-100 transition-colors duration-300 ${className}`}
  >
    <div className="w-full max-w-6xl p-8 bg-white/85 dark:bg-slate-900/80 backdrop-blur-lg rounded-3xl shadow-[0_25px_70px_-30px_rgba(15,23,42,0.45)] border border-white/70 dark:border-slate-800 transition-all duration-300 mt-6">
      {children}
    </div>
  </div>
);

export default MainLayout;
