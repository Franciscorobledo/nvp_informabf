# nvp_informabf

## Persistencia de usuarios

Los usuarios ya no se almacenan directamente en `backend/users.json` (que se
puede sobrescribir en cada despliegue). El backend ahora guarda y lee los
usuarios desde `backend/data/users.json` —o desde la ruta que definas en la
variable de entorno `AUTH_STORAGE_DIR`. Si el archivo nuevo no existe, se
migrará automáticamente el contenido del archivo legado ubicado junto al código
(`backend/users.json`) para no perder cuentas creadas previamente.

## Duración de los tokens de sesión

Por defecto los tokens de acceso ahora duran 24 horas. Puedes ajustar este
comportamiento estableciendo la variable de entorno
`ACCESS_TOKEN_EXPIRE_MINUTES` con la duración deseada (en minutos) antes de
levantar el backend.

## Integración con Google Drive (frontend)

Para permitir que el usuario seleccione archivos directamente desde Google
Drive, el frontend necesita las siguientes variables en tu archivo `.env`
local:

```
VITE_GOOGLE_CLIENT_ID=tu_client_id_de_google
VITE_GOOGLE_API_KEY=tu_api_key_de_google
```

Ambos valores se obtienen desde la consola de Google Cloud (OAuth 2.0 Client ID
para la clave de cliente y API key para habilitar Google Picker).

