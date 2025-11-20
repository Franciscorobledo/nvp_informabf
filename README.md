# nvp_informabf

## Persistencia de usuarios

Los usuarios ya no se almacenan directamente en `backend/users.json` (que se
puede sobrescribir en cada despliegue). El backend ahora guarda y lee los
usuarios desde `backend/data/users.json` —o desde la ruta que definas en la
variable de entorno `AUTH_STORAGE_DIR`. Si el archivo nuevo no existe, se
migrará automáticamente el contenido del archivo legado ubicado junto al código
(`backend/users.json`) para no perder cuentas creadas previamente.

