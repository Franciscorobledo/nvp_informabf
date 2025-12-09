import React from "react";

const Terms = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Términos y Condiciones
        </h1>
        <p className="text-gray-600 dark:text-slate-300">
          Estos términos son un borrador inicial y pueden ajustarse según las
          políticas de InformeBF. Incluye aquí el resumen de usos permitidos y
          responsabilidades clave.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 space-y-4 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Uso del servicio
        </h2>
        <p className="text-gray-600 dark:text-slate-300">
          Describe las condiciones de uso, limitaciones y buenas prácticas para
          aprovechar la plataforma. Agrega información sobre acceso, límites de
          cuentas y obligaciones del usuario.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 space-y-4 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Responsabilidades
        </h2>
        <p className="text-gray-600 dark:text-slate-300">
          Incluye advertencias sobre la precisión de los datos, limitaciones de
          responsabilidad y procesos para resolver disputas o dar por terminado
          el servicio.
        </p>
      </div>
    </div>
  );
};

export default Terms;
