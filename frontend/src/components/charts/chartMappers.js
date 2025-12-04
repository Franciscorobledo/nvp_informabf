const palette = [
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#ec4899",
  "#0ea5e9",
  "#22c55e",
];

export const toChartCardConfig = (chart) => {
  if (!chart) return null;
  const labels = chart.x || [];
  const series = chart.series || [];
  const baseType = chart.type === "stacked" ? "stacked" : chart.type || "bar";

  if (baseType === "pie" && series.length === 1) {
    const data = labels.map((label, idx) => ({
      name: label,
      value: series[0].data?.[idx] ?? 0,
    }));

    return {
      title: chart.title,
      type: "pie",
      data,
      series: [{ dataKey: "value", nameKey: "name" }],
    };
  }

  const data = labels.map((label, idx) => {
    const row = { label };
    series.forEach((serie) => {
      row[serie.name] = serie.data?.[idx] ?? 0;
    });
    return row;
  });

  return {
    title: chart.title,
    type: baseType === "stacked" ? "stacked" : baseType,
    data,
    xKey: "label",
    series: series.map((serie, idx) => ({
      name: serie.name,
      dataKey: serie.name,
      color: palette[idx % palette.length],
    })),
  };
};
