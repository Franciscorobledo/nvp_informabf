import React from "react";

const DataTable = ({ columns, rows }) => (
  <div className="mt-8">
    <h2 className="text-xl font-semibold mb-4">Datos cargados</h2>
    <p>{rows} filas encontradas</p>
    <div className="overflow-x-auto mt-2">
      <table className="min-w-full bg-white border">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col} className="border px-4 py-2">{col}</th>
            ))}
          </tr>
        </thead>
      </table>
    </div>
  </div>
);

export default DataTable;
