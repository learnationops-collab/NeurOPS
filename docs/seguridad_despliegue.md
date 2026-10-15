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
- Desde el 15/10/2026 también el webhook de los anuncios, `POST /api/manychat-webhook`, exige el header
  `X-ManyChat-Token` (el mismo `MANYCHAT_WEBHOOK_TOKEN`): desde el 14/10 una palabra clave nueva crea un anuncio, y
  antes cualquiera podía crearlos. El `GET` de verificación sigue abierto.
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
| `MANYCHAT_WEBHOOK_TOKEN` | `POST /api/manychat-webhook` (leads y palabras clave de los anuncios) y `POST /api/webhooks/manychat` | ManyChat: header `X-ManyChat-Token` en cada «Solicitud externa» (ver §3) |
| `INGEST_API_TOKEN` | rutas de ingesta y consulta de n8n y Apps Script (ver §3) | n8n / Apps Script: header `X-Api-Token: <valor>` (o `Authorization: Bearer <valor>`) |
| `INTEGRATIONS_AUTH_MODE` | **solo para migrar**: `log_only` deja pasar y registra (ver §4) | — |

## 3. Qué sistema debe mandar qué

| Sistema | Llama a | Debe mandar |
|---|---|---|
| **n8n** (Calendly) | `POST /api/public/financial-agendas`, `POST /api/public/financial-agendas-form`, `POST /api/public/financial-agendas/verificar-hora` | `X-Api-Token: <INGEST_API_TOKEN>` |
| **Apps Script** (hoja de ventas) | `POST /api/public/financial-sales` | `X-Api-Token: <INGEST_API_TOKEN>` |
| **Otra página / integración de consulta de clientes** | `GET /api/public/clients/search`, `GET /api/public/new-clients`, `POST /api/public/clients/follow-up` | `X-Api-Token: <INGEST_API_TOKEN>` |
| **ManyChat** (leads de Instagram) | `POST /api/manychat-webhook` (todas las solicitudes externas de los flujos de anuncios) y `POST /api/webhooks/manychat` | `X-ManyChat-Token: <MANYCHAT_WEBHOOK_TOKEN>` |
| **Cron externo** (Sheets, recordatorios, fotos de la Academia) | `GET /api/sheets/cron-sync`, `GET /api/closer/followups/cron/send-reminders`, `GET /api/academia/cron/sincronizar` | `Authorization: Bearer <CRON_SECRET>` |

**Fotos de la Academia** (`GET /api/academia/cron/sincronizar`, ver `app/services/academy_snapshot_service.py`):
cada llamada renueva un lote de clientes con venta, del más desactualizado al más fresco, con un presupuesto de 20
consultas a la Academia (`?presupuesto=N`, hasta 40) y un tope de 25 s; se corta sola ante un 401 o un 429. La
Academia admite 60 consultas por minuto compartidas con la ficha, así que conviene programarla cada 10 minutos, no
más seguido. Sin `ACADEMY_API_TOKEN` responde 200 sin consultar nada.

En n8n: en el nodo *HTTP Request* → *Send Headers* → nombre `X-Api-Token`, valor el secreto. En Apps Script:
`UrlFetchApp.fetch(url, { method: 'post', headers: { 'X-Api-Token': SECRETO }, ... })` (guarda el secreto en las
*Propiedades del script*, no en el código).

### ManyChat: el header de cada «Solicitud externa»

Un solo secreto para todo ManyChat: `MANYCHAT_WEBHOOK_TOKEN`. Pasos, en este orden:

1. Genera el valor (comando del §2) y cárgalo en Railway como `MANYCHAT_WEBHOOK_TOKEN`: producción (proyecto
   `selfless-adventure`, servicio «learnation work») y, si quieres probar antes, staging («Servidor de prueba»).
   Deja `INTEGRATIONS_AUTH_MODE=log_only` mientras tanto: lo que llegue sin el header sigue entrando.
2. En ManyChat, en **cada flujo** con una acción **«Solicitud externa»** (External Request) que llame a
   `https://work.thelearnation.com/api/manychat-webhook` (suele haber más de una por flujo, y una que falte se
   ve en el paso 3): abre la acción → pestaña **Encabezados** (Headers) → **Agregar encabezado**:

   | Clave | Valor |
   |---|---|
   | `X-ManyChat-Token` | el mismo valor que pusiste en Railway, tal cual (sin `Bearer`, sin comillas, sin espacios) |

   Deja como está el resto (el cuerpo JSON y el `Content-Type`). Guarda la acción y **publica** el flujo: un
   borrador no cambia nada. Ojo con «Probar la solicitud»: mientras siga `log_only` responde `201`/`200` aunque el
   valor esté mal (y registra una interacción real con el contacto de prueba); lo que dice si el valor es el
   correcto es el log del paso 3. Sin `log_only`, un valor equivocado responde `401`.
3. Mira el log de Railway buscando **`[MIGRACION DE SECRETOS] POST /api/manychat-webhook`**. El motivo dice qué
   falta: `no presento el secreto` = una solicitud externa sin el encabezado; `secreto incorrecto` = el valor no
   coincide; `MANYCHAT_WEBHOOK_TOKEN sin configurar` = falta la variable en Railway. Cuando pasen unos días sin
   esas líneas, ManyChat está migrado.
4. `INTEGRATIONS_AUTH_MODE` es una sola llave para todas las integraciones (n8n, Apps Script, crons, ManyChat):
   quítala recién cuando ninguna aparezca en el log (§4). Desde ese momento una solicitud sin el header recibe
   `401` y ese dato de ManyChat **no entra**.

El `GET` de verificación de ManyChat (`/api/manychat-webhook`) no pide el header. El webhook viejo
`POST /api/webhooks/manychat` usa el mismo encabezado y el mismo valor.

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

- `POST /api/workshop/interaction|plantilla-sent` son webhooks públicos por diseño: hoy aceptan datos de cualquiera.
  Protegerlos con un secreto exige configurarlo en quien los llama; los decoradores y el modo de migración ya existen
  (`POST /api/manychat-webhook` ya lo exige desde el 15/10/2026, ver §3).
- `POST /api/public/clients/check` (pagina de reservas) devuelve nombre y teléfono de un cliente conocido a quien acierte
  un email o un Instagram. Cerrarlo exige rehacer la experiencia de la reserva (verificar al visitante).
- Los formularios públicos (`submit-lead`, `book`, postulaciones, `workshop-lead`) no tienen límite de intentos.
- No hay límite de intentos de login ni forma de revocar un JWT antes de que venza (24 h).
- Las rutas protegidas siguen exentas de CSRF (el frontend usa Bearer, y las cookies son `SameSite=Lax`).
