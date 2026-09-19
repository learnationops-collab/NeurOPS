# Seguridad: variables de entorno y cómo desplegar sin cortar integraciones

> Guía operativa del despliegue de la protección de rutas y secretos (bitácora del 19/09/2026, entradas 4 a 7).
> Léela **antes** de pasar `develop` a `main`.

## 1. Qué cambió

- Las rutas de la herramienta interna que respondían a cualquiera en internet (lecturas de ventas, nómina y
  clientes; altas, ediciones y **borrados** de agendas, ventas, campañas y reportes; mantenimiento; ingesta de
  n8n) ahora exigen **sesión con el rol adecuado** o, las que usan n8n y Apps Script, el secreto
  `INGEST_API_TOKEN`. La tabla completa está en `app/access_policy.py`.
- Los crons y el webhook de ManyChat ya no tienen un valor por defecto: sin su variable de entorno contestan
  503; con ella, exigen el secreto.
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
| `CRON_SECRET` | `GET /api/sheets/cron-sync` y `GET /api/closer/followups/cron/send-reminders` | el cron externo: `Authorization: Bearer <valor>` (o `?token=<valor>`) |
| `MANYCHAT_WEBHOOK_TOKEN` | `POST /api/webhooks/manychat` | ManyChat: header `X-ManyChat-Token` |
| `INGEST_API_TOKEN` | rutas de ingesta y consulta de n8n y Apps Script (ver §3) | n8n / Apps Script: header `X-Api-Token: <valor>` (o `Authorization: Bearer <valor>`) |
| `INTEGRATIONS_AUTH_MODE` | **solo para migrar**: `log_only` deja pasar y registra (ver §4) | — |

## 3. Qué sistema debe mandar qué

| Sistema | Llama a | Debe mandar |
|---|---|---|
| **n8n** (Calendly) | `POST /api/public/financial-agendas`, `POST /api/public/financial-agendas-form`, `POST /api/public/financial-agendas/verificar-hora` | `X-Api-Token: <INGEST_API_TOKEN>` |
| **Apps Script** (hoja de ventas) | `POST /api/public/financial-sales` | `X-Api-Token: <INGEST_API_TOKEN>` |
| **Otra página / integración de consulta de clientes** | `GET /api/public/clients/search`, `GET /api/public/new-clients`, `POST /api/public/clients/follow-up` | `X-Api-Token: <INGEST_API_TOKEN>` |
| **ManyChat** (leads de Instagram) | `POST /api/webhooks/manychat` | `X-ManyChat-Token: <MANYCHAT_WEBHOOK_TOKEN>` |
| **Cron externo** (Sheets, recordatorios) | `GET /api/sheets/cron-sync`, `GET /api/closer/followups/cron/send-reminders` | `Authorization: Bearer <CRON_SECRET>` |

En n8n: en el nodo *HTTP Request* → *Send Headers* → nombre `X-Api-Token`, valor el secreto. En Apps Script:
`UrlFetchApp.fetch(url, { method: 'post', headers: { 'X-Api-Token': SECRETO }, ... })` (guarda el secreto en las
*Propiedades del script*, no en el código).

## 4. Procedimiento de despliegue sin cortar flujos

1. En Railway, define **`BACKUP_SECRET_KEY`, `CRON_SECRET`, `MANYCHAT_WEBHOOK_TOKEN` e `INGEST_API_TOKEN`** con valores
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

## 6. Qué **no** cubre todavía (decisiones pendientes)

- `POST /api/manychat-webhook` y `POST /api/workshop/interaction|plantilla-sent` son webhooks públicos por diseño: hoy
  aceptan datos de cualquiera. Protegerlos con un secreto exige configurar ManyChat/n8n; los decoradores y el modo de
  migración ya existen.
- `POST /api/public/clients/check` (pagina de reservas) devuelve nombre y teléfono de un cliente conocido a quien acierte
  un email o un Instagram. Cerrarlo exige rehacer la experiencia de la reserva (verificar al visitante).
- Los formularios públicos (`submit-lead`, `book`, postulaciones, `workshop-lead`) no tienen límite de intentos.
- No hay límite de intentos de login ni forma de revocar un JWT antes de que venza (24 h).
- Las rutas protegidas siguen exentas de CSRF (el frontend usa Bearer, y las cookies son `SameSite=Lax`).
