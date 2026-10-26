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
- El backup exige un admin u operador **y** `BACKUP_SECRET_KEY` (header `X-Backup-Key`). Desde el 26/10/2026 es un
  `pg_dump` y la restauración desde la web ya no existe (ver §5 bis).

Los valores que estuvieron escritos en el código o en el frontend (clave de respaldo, token de los crons, token de
ManyChat, contraseñas por defecto) siguen en el historial de git: **considéralos comprometidos y rota**.

## 2. Variables de entorno (Railway)

Genera cada secreto con `python -c "import secrets; print(secrets.token_hex(32))"` (mínimo 20 caracteres; los
más cortos se rechazan).

| Variable | Qué protege | Quién presenta el valor y cómo |
|---|---|---|
| `SECRET_KEY` | firma de los JWT y las cookies (la app no arranca en Railway sin ella) | interna |
| `BACKUP_SECRET_KEY` | `GET /api/backup/preview` y `GET /api/backup/export` | el admin u operador, en Operaciones › Datos › Respaldo (`/admin/backup` redirige ahí); viaja en el header `X-Backup-Key` |
| `CRON_SECRET` | `GET /api/sheets/cron-sync`, `GET /api/closer/followups/cron/send-reminders`, `GET /api/academia/cron/sincronizar` y `GET /api/marketing/anuncios/cron/meta` (ver docs/marketing_anuncios.md) | el cron externo: `Authorization: Bearer <valor>` (o `?token=<valor>`) |
| `INGEST_API_TOKEN` | rutas de ingesta y consulta de n8n y Apps Script (ver §3) | n8n / Apps Script: header `X-Api-Token: <valor>` (o `Authorization: Bearer <valor>`) |
| `INTEGRATIONS_AUTH_MODE` | **solo para migrar**: `log_only` deja pasar y registra (ver §4) | — |

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

## 5 bis. Respaldo y restauración de la base

**Respaldo.** Operaciones › Datos › Respaldo descarga un `pg_dump -Fc` (formato custom, `.dump`) de toda la base.
El servidor corre `pg_dump` 17 (del repositorio PGDG, ver `Dockerfile`) con la conexión en variables `PG*`: la URL
no va en los argumentos ni en el log. Antes era un script SQL armado a mano que no escapaba las comillas dentro de
los JSON (un «O'Brien» rompía la restauración, y un texto de un formulario público podía terminar como SQL).

**Restauración (a mano, nunca desde la web).** Ejecutar un archivo subido contra producción desde un pedido web era
demasiado peligroso: se retiró el 26/10/2026. Para restaurar:

1. Saca **antes** un respaldo fresco de cómo está la base ahora (pantalla de Respaldo, o
   `pg_dump -Fc -f antes_de_restaurar.dump "$DATABASE_URL"`), por si hay que volver atrás.
2. Desde una máquina con `pg_restore` 17 o desde el servicio de Railway (`railway ssh --service <servicio>`, con el
   `.dump` copiado ahí):

   ```bash
   pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" archivo.dump
   ```

   `--clean --if-exists` borra y recrea cada objeto del volcado; `--no-owner` evita depender del usuario que lo
   generó. Para ver qué trae un archivo sin tocar nada: `pg_restore -l archivo.dump`.
3. Reinicia el servicio y vuelve a iniciar sesión (los usuarios pueden haber cambiado).

## 6. Qué **no** cubre todavía (decisiones pendientes)

- `POST /api/workshop/interaction|plantilla-sent` son webhooks públicos por diseño: hoy aceptan datos de cualquiera.
  Protegerlos con un secreto exige configurarlo en quien los llama; los decoradores y el modo de migración ya existen.
- `POST /api/public/clients/check` (pagina de reservas) le dice a un anónimo si un email o un Instagram es un cliente
  conocido, y su `id` (desde el 26/10/2026 ya no devuelve nombre, teléfono ni Instagram). Que la existencia se pueda
  consultar exige rehacer la experiencia de la reserva (verificar al visitante).
- Los formularios públicos (`submit-lead`, `book`, postulaciones, `workshop-lead`) no tienen límite de intentos.
- No hay límite de intentos de login ni forma de revocar un JWT antes de que venza (24 h).
- Las rutas protegidas siguen exentas de CSRF (el frontend usa Bearer, y las cookies son `SameSite=Lax`).
