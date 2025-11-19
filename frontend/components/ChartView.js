import React from "react";

const ChartView = ({ graphs }) => (
  <div className="mt-10">
    <h2 className="text-xl font-semibold mb-4">Visualizaciones</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {graphs.map((g, i) => (
        <div key={i} className="border p-4 rounded bg-white shadow">
          <h3 className="text-lg font-medium mb-2">{g.column}</h3>
          <img src={g.image} alt={`Gráfico de ${g.column}`} className="w-full" />
        </div>
      ))}
    </div>
  </div>
);

export default ChartView;
