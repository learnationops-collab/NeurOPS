# Seguridad: variables de entorno y cómo desplegar sin cortar integraciones

> Guía operativa del despliegue de la protección de rutas y secretos (bitácora del 19/09/2026, entradas 4 a 7).
> Léela **antes** de pasar `develop` a `main`.

## 1. Qué cambió

- Las rutas de la herramienta interna que respondían a cualquiera en internet (lecturas de ventas, nómina y
  clientes; altas, ediciones y **borrados** de agendas, ventas, campañas y reportes; mantenimiento; ingesta de
  n8n) ahora exigen **sesión con el rol adecuado** o, las que usan n8n y Apps Script, el secreto
  `INGEST_API_TOKEN`. La tabla completa está en `app/access_policy.py`.
- Los crons ya no tienen un valor por defecto: sin su variable de entorno contestan 503; con ella, exigen el
  secreto.
- El webhook de ManyChat (`GET`/`POST /api/manychat-webhook`) se retiró el 26/10/2026: ManyChat está apagado desde
  el 23/10 y el motor propio de Instagram escribe las conversaciones directo. `MANYCHAT_WEBHOOK_TOKEN` ya no se usa.
- Backup y restauración exigen un admin **y** `BACKUP_SECRET_KEY`.

Los valores que estuvieron escritos en el código o en el frontend (clave de respaldo, token de los crons, token de
ManyChat, contraseñas por defecto) siguen en el historial de git: **considéralos comprometidos y rota**.

## 2. Variables de entorno (Railway)

Genera cada secreto con `python -c "import secrets; print(secrets.token_hex(32))"` (mínimo 20 caracteres; los
más cortos se rechazan).

| Variable | Qué protege | Quién presenta el valor y cómo |
|---|---|---|
| `SECRET_KEY` | firma de los JWT y las cookies (la app no arranca en Railway sin ella) | interna |
| `BACKUP_SECRET_KEY` | `/api/backup/secret-*` | el admin, en `/admin/backup` y `/admin/restore` |
| `CRON_SECRET` | `GET /api/sheets/cron-sync`, `GET /api/closer/followups/cron/send-reminders`, `GET /api/academia/cron/sincronizar` y `GET /api/marketing/anuncios/cron/meta` (ver docs/marketing_anuncios.md) | el cron externo: `Authorization: Bearer <valor>` (o `?token=<valor>`) |
| `INGEST_API_TOKEN` | rutas de ingesta y consulta de n8n y Apps Script (ver §3) | n8n / Apps Script: header `X-Api-Token: <valor>` (o `Authorization: Bearer <valor>`) |
| `INTEGRATIONS_AUTH_MODE` | **solo para migrar**: `log_only` deja pasar y registra (ver §4) | — |
| `RATE_LIMIT_ENABLED` | límite de intentos (§6): `0` lo apaga sin desplegar; sin definir, está prendido | — |

## 3. Qué sistema debe mandar qué

| Sistema | Llama a | Debe mandar |
|---|---|---|
| **n8n** (Calendly) | `POST /api/public/financial-agendas`, `POST /api/public/financial-agendas-form`, `POST /api/public/financial-agendas/verificar-hora` | `X-Api-Token: <INGEST_API_TOKEN>` |
| **Apps Script** (hoja de ventas) | `POST /api/public/financial-sales` | `X-Api-Token: <INGEST_API_TOKEN>` |
| **Otra página / integración de consulta de clientes** | `GET /api/public/clients/search`, `GET /api/public/new-clients`, `POST /api/public/clients/follow-up` | `X-Api-Token: <INGEST_API_TOKEN>` |
| **Cron externo** (Sheets, recordatorios, fotos de la Academia) | `GET /api/sheets/cron-sync`, `GET /api/closer/followups/cron/send-reminders`, `GET /api/academia/cron/sincronizar` | `Authorization: Bearer <CRON_SECRET>` |

**Fotos de la Academia** (`GET /api/academia/cron/sincronizar`, ver `app/services/academy_snapshot_service.py`):
cada llamada renueva un lote de clientes con venta, del más desactualizado al más fresco, con un presupuesto de 20
consultas a la Academia (`?presupuesto=N`, hasta 40) y un tope de 25 s; se corta sola ante un 401 o un 429. La
Academia admite 60 consultas por minuto compartidas con la ficha, así que conviene programarla cada 10 minutos, no
más seguido. Sin `ACADEMY_API_TOKEN` responde 200 sin consultar nada.

En n8n: en el nodo *HTTP Request* → *Send Headers* → nombre `X-Api-Token`, valor el secreto. En Apps Script:
`UrlFetchApp.fetch(url, { method: 'post', headers: { 'X-Api-Token': SECRETO }, ... })` (guarda el secreto en las
*Propiedades del script*, no en el código).

## 4. Procedimiento de despliegue sin cortar flujos

> **Estado (26/10/2026):** producción ya no tiene `INTEGRATIONS_AUTH_MODE`; todo es obligatorio. Se quitó tras revisar
> una semana de logs: solo quedaban ManyChat (apagado) y el formulario viejo de agendas de n8n (en desuso).

1. En Railway, define **`BACKUP_SECRET_KEY`, `CRON_SECRET` e `INGEST_API_TOKEN`** con valores
   nuevos, y confirma que `SECRET_KEY` está en todos los servicios.
2. Define **`INTEGRATIONS_AUTH_MODE=log_only`** (modo de migración: nada se rechaza por falta de secreto, todo lo que
   se habría rechazado queda en el log).
3. Despliega.
4. Configura cada sistema de la tabla del §3 con su secreto.
5. Mira el log de Railway buscando **`[MIGRACION DE SECRETOS]`**: cada línea es una llamada que pasó *sin*
   credencial válida (método, ruta, motivo, origen y agente). Cuando pasen unos días sin líneas nuevas, todos los
   llamadores están migrados. Las rutas de usuarios (el frontend) no deberían aparecer: si aparece una, revisa el
   rol (una pantalla que un rol usa y la tabla no le permite).
6. **Quita `INTEGRATIONS_AUTH_MODE`.** Desde ese momento todo es obligatorio.
7. Vigila **`[INTEGRACION RECHAZADA]`**: un sistema legítimo al que le falte su secreto aparecerá ahí con la ruta,
   el motivo y el origen.

**Vuelta atrás rápida:** si una integración se corta, vuelve a definir `INTEGRATIONS_AUTH_MODE=log_only` en Railway
(el servicio se reinicia solo) mientras corriges el secreto en quien llama.

## 5. Rotar un secreto

Cambia el valor en Railway y, a la vez, en quien lo presenta (§3). Para un secreto compartido con varios sistemas
(`INGEST_API_TOKEN`) conviene usar el modo de migración durante el cambio.

## 6. Límite de intentos (desde el 26/10/2026)

Vive en Postgres (tabla `intentos_limitados`, `app/services/limite_intentos.py`) porque gunicorn corre varios
workers y un contador en memoria no se comparte. Una fila por intento; las de más de un día se borran solas. La IP
es `request.remote_addr`, que `ProxyFix(x_for=1)` ya deja con la del visitante (el primer valor de
`X-Forwarded-For` lo escribe él y no sirve). Al pasarlo, 429 con `{"message": "Demasiados intentos. Probá de nuevo
en unos minutos."}`. Si la base falla, deja pasar y lo anota con `[LIMITE]` en el log.

| Ruta | Límite |
|---|---|
| `POST /api/auth/login` | solo los **fallidos**: 20 por IP y 8 por usuario cada 15 min. Se corta antes de mirar la clave. Con un usuario que no existe se calcula igual un hash, para que la respuesta tarde lo mismo |
| `POST /api/public/submit-lead`, `submit-survey`, `book`, `clients/check`, `workshop-lead` | 30 por IP cada 10 min |
| `POST /api/public/job-applications`, `assistant-applications` | 120 por IP cada 10 min (postean en cada pregunta) |
| `POST /api/public/landing-session` | 300 por IP cada 10 min (un latido cada ~15 s) |
| `POST /api/v1/metrics/track-visit` | 120 por IP cada 10 min |
| `/api/agendas-v2/publico/*` | los suyos, por minuto (docs/agendas_v2_api.md) |

En las rutas de `/api/public` y `track-visit`, un usuario logueado o un sistema con su secreto no tiene límite.
Muchos visitantes detrás de una misma IP (una oficina, datos móviles) comparten el contador: por eso los límites
son holgados. `RATE_LIMIT_ENABLED=0` en Railway lo apaga.

## 7. Qué **no** cubre todavía (decisiones pendientes)

- `POST /api/workshop/interaction|plantilla-sent` son webhooks públicos por diseño: hoy aceptan datos de cualquiera.
  Protegerlos con un secreto exige configurarlo en quien los llama; los decoradores y el modo de migración ya existen.
- `POST /api/public/clients/check` (pagina de reservas) le dice a un anónimo si un email o un Instagram es un cliente
  conocido, y su `id` (desde el 26/10/2026 ya no devuelve nombre, teléfono ni Instagram). Que la existencia se pueda
  consultar exige rehacer la experiencia de la reserva (verificar al visitante).
- No hay forma de revocar un JWT antes de que venza (24 h).
- Las rutas protegidas siguen exentas de CSRF (el frontend usa Bearer, y las cookies son `SameSite=Lax`).
