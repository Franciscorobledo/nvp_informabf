# SaaS de bots conversacionales de agenda (Slack + OpenAI + Google Calendar)

Este repositorio contiene un SaaS multi-tenant para crear, configurar y operar bots de agenda sin código por cliente. Incluye backend (FastAPI) y panel de administración (React + Vite), listos para desplegar en Render.

---

## Arquitectura

**Decisión de stack**: se mantiene **Python + FastAPI** porque ya existe en el repositorio, es ideal para APIs async, y facilita integraciones con Slack, OpenAI y Google Calendar con un único backend multi-tenant.

**Componentes principales**

1. **Frontend Admin (React + Vite)**: panel para autenticación, administración de clientes, bots, servicios, reservas y estado.
2. **Backend API (FastAPI)**:
   - Autenticación de administradores (`/auth/login`).
   - CRUD para clientes, bots y servicios.
   - Recepción de eventos Slack (`/slack/events`).
   - Motor de agenda (máquina de estados + Google Calendar).
   - OpenAI para extracción estructurada de intención y entidades.
3. **PostgreSQL**: persistencia multi-tenant (clientes, bots, servicios, reservas, estados).
4. **Integraciones externas**:
   - **Slack**: Events API + Web API.
   - **OpenAI**: clasificación de intención y entidades.
   - **Google Calendar**: disponibilidad y creación de eventos.

---

## Modelo de datos (tablas principales)

```
clientes (clients)
  - id (PK)
  - name
  - contact_email
  - timezone
  - is_active

bots
  - id (PK)
  - client_id (FK -> clients.id)
  - name
  - system_prompt
  - slack_channel_id
  - slack_team_id
  - slack_bot_user_id
  - is_active
  - openai_model
  - openai_temperature
  - google_calendar_id

services
  - id (PK)
  - bot_id (FK -> bots.id)
  - name
  - duration_minutes
  - is_active

reservations
  - id (PK)
  - client_id (FK -> clients.id)
  - bot_id (FK -> bots.id)
  - service_id (FK -> services.id)
  - slack_user_id
  - slack_channel_id
  - status
  - start_time
  - end_time
  - google_event_id

conversation_states
  - id (PK)
  - bot_id (FK -> bots.id)
  - slack_user_id
  - state
  - collected_data (JSON)

slack_event_logs
  - id (PK)
  - bot_id (FK -> bots.id)
  - event_id
  - event_type
  - payload (JSON)
```

---

## Diagrama lógico (alto nivel)

```
Slack -> /slack/events
          |
          v
     Bot resolver (por channel_id)
          |
          v
     OpenAI (intent + entidades)
          |
          v
Máquina de estados (servicio/fecha/hora)
          |
          v
Google Calendar (freebusy + create event)
          |
          v
Slack confirmación + Reserva persistida
```

---

## Endpoints mínimos

```
GET  /health
POST /auth/login
POST /slack/events
CRUD /clientes
CRUD /bots
CRUD /servicios
GET  /reservas
```

---

## Variables de entorno (Render)

Backend:

```
DATABASE_URL=postgresql://...
FORCE_SQLITE=false
SECRET_KEY=...
SLACK_SIGNING_SECRET=...
SLACK_BOT_TOKEN=...
OPENAI_API_KEY=...
GOOGLE_SERVICE_ACCOUNT_INFO=<json o base64>
```

Frontend:

```
VITE_API_URL=https://tu-backend.onrender.com
```

---

## Deploy en Render

1. Configura un servicio **web** para el backend (Python) con las variables anteriores.
2. Configura un servicio **web** para el frontend (Node) usando `npm run build` y `npm run preview`.
3. Apunta `VITE_API_URL` al backend desplegado.
4. Configura el endpoint `/slack/events` en tu Slack App y define permisos para `chat:write` y `channels:history`.

---

## Flujo conversacional de agenda

1. Detección de intención (OpenAI devuelve JSON).
2. Solicitud de datos faltantes (servicio/fecha/hora).
3. Validación de disponibilidad (Google Calendar).
4. Confirmación con el usuario.
5. Creación del evento.
6. Confirmación final por Slack.
