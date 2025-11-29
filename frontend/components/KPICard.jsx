import React from "react";

/**
 * Componente de KPI Card premium para mostrar métricas clave
 */
const KPICard = ({ icon, label, value, format = "number", trend, alert, extra }) => {
    const formatValue = (val, fmt) => {
        if (val === null || val === undefined) return "-";

        switch (fmt) {
            case "currency":
                return `$${val.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
            case "number":
                return val.toLocaleString('es-AR');
            case "percent":
                return `${val.toFixed(1)}%`;
            case "text":
                return val;
            default:
                return val.toLocaleString('es-AR');
        }
    };

    const getTrendIcon = () => {
        if (!trend) return null;
        if (trend.direction === "up") return "↗";
        if (trend.direction === "down") return "↘";
        return "→";
    };

    const getTrendColor = () => {
        if (!trend) return "";
        if (trend.direction === "up") return "text-emerald-400";
        if (trend.direction === "down") return "text-red-400";
        return "text-slate-400";
    };

    return (
        <div className={`kpi-card rounded-2xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 p-5 border ${alert ? 'border-amber-500/50' : 'border-slate-700/50'} shadow-lg hover:shadow-xl transition-all duration-300 animate-fade-zoom`}>
            <div className="flex items-start justify-between mb-3">
                <div className="text-3xl">{icon}</div>
                {trend && (
                    <span className={`text-sm font-bold ${getTrendColor()}`}>
                        {getTrendIcon()} {Math.abs(trend.value).toFixed(1)}%
                    </span>
                )}
            </div>

            <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-slate-400 font-medium">{label}</p>
                <p className="text-2xl font-extrabold text-white">
                    {formatValue(value, format)}
                </p>
                {extra && (
                    <p className="text-xs text-slate-300">{extra}</p>
                )}
            </div>

            {alert && (
                <div className="mt-3 pt-3 border-t border-amber-500/30">
                    <span className="text-xs text-amber-400 font-medium">⚠️ Requiere atención</span>
                </div>
            )}
        </div>
    );
};

export default KPICard;
