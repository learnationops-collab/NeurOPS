# Agendas 2.0 — backend

Este es el backend de Learnation Thalamus. La **configuración** (funnels, formularios, equipo, prioridades, eventos) vive en tablas propias `sched_*`. Las **agendas** no: cada reserva del link público se escribe en la operación como cualquier otra agenda de NeurOPS (`Appointment` + su espejo `FinancialAgenda`) y crea el evento en el Google Calendar del closer con Meet. No pasa por n8n. Discord y WhatsApp al lead todavía no.

## Módulo

```
app/agendas_v2/
  nucleo/        Port 1:1 de frontend/src/pages/agendas_v2/core (sin Flask ni base). Mismos nombres, en snake_case.
  modelos.py     Tablas sched_*
  servicio.py    Lectura y escritura de documentos, versión, disponibilidad y reservas con bloqueo
  operacion.py   Escribe la reserva en la operación: cliente, Appointment, FinancialAgenda, evento de Calendar y aviso a Discord
  paquete.py     Configuración con IA: el prompt que se exporta y la importación del JSON («paquete»)
  api_admin.py   /api/agendas-v2/*          sesión + rol admin o director_comercial (CSRF activo)
  api_publico.py /api/agendas-v2/publico/*  anónimo, exento de CSRF, con límite por IP
tests/agendas_v2/  test_nucleo.py (mismos casos que core/nucleo.test.js), test_api_admin.py, test_api_publico.py
```

## Tablas

| Tabla | Clave | Contenido |
|---|---|---|
| `sched_funnels`, `sched_formularios`, `sched_grupos`, `sched_eventos`, `sched_roles` | `id` String(40) | `datos` JSON: el documento normalizado, sin `id`. `orden`, `creado_en`, `actualizado_en`, `actualizado_por_id` (users) |
| `sched_personas` | `id` String(40) | Lo mismo más `email` y `user_id` (users, nullable). `user_id` se completa solo si el email coincide con una cuenta de la app; lo usa el paso 3 |
| `sched_config` | `clave` String(40) | `datos` JSON. Claves: `integraciones` y `version`, un contador que sube con cada escritura |
| `sched_perfiles` | `user_id` (users) | `datos` JSON: perfil de Thalamus de cada usuario |
| `sched_intentos` | `id` Integer | Un lead que dejó sus datos en un link y **no agendó**: `evento_id`, `funnel_id`, `email`, `estado` (`incompleta` o `descalificada`), `paso` (1 contacto, 2+j respondió la pregunta j, n+2 llegó al calendario; nunca baja), `resp` JSON, `origen`, `setter_user_id`, `creado_en`. Uno por lead y evento. Si agenda, sus incompletos se borran: desde ahí cuenta la `Appointment`. Es lo que usa Stats para ver dónde se caen |

Columnas que Agendas 2.0 agregó a la operación (opcionales, NULL en lo que entra por n8n):

| Tabla | Columna | Contenido |
|---|---|---|
| `appointments` | `agenda_payload` JSON | La agenda completa: el contrato de `armar_reserva` (`version: 1`: respuestas con el texto de cada pregunta, nota, prioridad, regla, origen, duración, lead) más `evento_nombre`, `closer_user_id`, `setter_user_id`, `meet` (link de Meet) y, si se reprogramó, `reprogramada_desde` |
| `clients` | `formulario_payload` JSON | El último formulario que completó el lead, también si no calificó (los descalificados quedan como cliente, sin agenda) |

`financial_agendas.raw_data['agendas_v2']` lleva el mismo payload que la `Appointment`.

Todo documento que entra pasa por el normalizador de `nucleo/normalizar.py`, el mismo esquema que el frontend. Lo que no cumple el esquema se corrige o se descarta; nunca se guarda tal cual.

## API de gestión: `/api/agendas-v2`

Pide sesión y rol `admin` o `director_comercial`. Si no hay sesión responde 401; si el rol no corresponde, 403.

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| GET | `/estado` | — | `{cols: {funnels, formularios, personas, grupos, eventos, roles}, perfil, integ, reservas, version}`. `reservas`: las `appointments` con `agenda_payload` de los últimos 35 días y futuras, en el formato de `adaptadorLocal` (`id` = id de la Appointment, `inicio_ms`, `fin_ms`, `estado` `agendada` o `cancelada`, y los campos del payload). Thalamus no cancela ni reprograma: eso lo hace el closer en NeurOPS |
| GET | `/estadisticas` | — | `{leads: [{t, ev, llego, desc, agenda, score, closer, setter, origen, grupo, inicio, cancelada?}]}`: los últimos 180 días para Stats. Las `appointments` con `agenda_payload` (`agenda: true`, `llego: 999`, `t` = cuándo se creó, `inicio` = el horario, `closer` = id de la persona de Team, `setter` = usuario) y los `sched_intentos` (`llego` = su paso, `desc` si no calificó). Las visitas al link sin datos no se registran |
| GET | `/version` | — | `{version}` (el frontend lo consulta cada 15 s para traer cambios de otros) |
| GET | `/usuarios` | — | `{usuarios: [{id, nombre, email, rol, tz, calendar}]}`: closers y setters activos de la app. Team suma personas solo desde esta lista, con su email, así cada persona queda unida a su cuenta (`sched_personas.user_id`) |
| GET | `/ocupacion?desde&hasta` | — | `{ocupacion: {persona_id: {estado, franjas: [[inicio_ms, fin_ms]], eventos: [{inicio, fin, titulo}]}}}`: lo ocupado en los calendarios de conflicto de Google de cada persona de Team, para Available. `franjas`, ya unido (lo que se pisa queda en un tramo); `eventos`, cada uno con su título solo si es del calendario de agendamiento (`null` en sus otros calendarios, si es privado o confidencial, o si el calendario solo deja ver libre/ocupado). Cuenta lo mismo que freebusy: sin cancelados, «Disponible» ni rechazados. `estado`: `ok`, `error` (Google no respondió: el visor no lo muestra como libre), `sin_google` o `sin_usuario`. Rango en ms, de hasta 10 días (400 si no). Se guarda 2 min por closer y rango, aparte de lo que usa el motor |
| PUT | `/<col>/<id>` | documento completo (sin `id`) | `{doc, version}`. Crea o reemplaza |
| PATCH | `/<col>/<id>` | campos sueltos | `{doc, version}`. Mezcla con lo guardado y normaliza; 404 si no existe |
| DELETE | `/<col>/<id>` | — | `{ok, version}` |
| PUT | `/perfil` | perfil | `{perfil}` (del usuario de la sesión) |
| GET | `/paquete/prompt` | — | `{prompt}`: el prompt para Claude/ChatGPT, con el formato del paquete y el equipo real de Team (por email) |
| POST | `/paquete` | `{paquete, simular}` | Valida el JSON que devolvió la IA. Con `simular`: 200 `{resumen}` sin escribir. Si no: 201 `{resumen, creados: {prioridades, formulario, funnel, evento}, version}`, todo en una transacción. Inválido: 400 `{code: 'invalido', errores: [...]}` (cada error dice dónde). Siempre crea documentos nuevos (un slug de funnel repetido es error), referencia al equipo por email y deja el evento **sin publicar** |
| PUT | `/integraciones` | integ | `{integ, version}` |

`col` ∈ `funnels | formularios | personas | grupos | eventos | roles`. `id`: `^[A-Za-z0-9_-]{1,40}$`.

## API pública: `/api/agendas-v2/publico`

Sin sesión. Solo trabaja con la **versión publicada** de un evento activo cuyo funnel también está activo. Nunca devuelve emails ni horarios del equipo; recién con la agenda tomada el lead ve el nombre de su consultor. La copia del formulario que guarda la publicación se pone al día sola cada vez que se guarda el formulario (`republicar_form`): editar un formulario cambia sus links en vivo, y lo demás del evento sigue esperando a que se publique.

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| GET | `/eventos/<funnel_slug>/<evento_slug>` y `/eventos/<evento_slug>` | — | `{evento, form, funnel: {nombre, slug}}`. `evento`: solo los campos que necesita la página (`id`, `nombre`, `slug`, `duracion`, `reservas`, `antel`, `paso`, `zona`, `desc`, `redir`). Si no está disponible: 404 `{code: 'no_disponible'}` |
| POST | `/eventos/<evento_id>/horarios` | `{resp, tz}` | `{slots: [ms...]}`: inicios libres para esas respuestas, calculados en el servidor sin decir de qué closer es cada uno |
| POST | `/eventos/<evento_id>/conocido` | `{email}` | El lead que ya agendó antes (se lo busca por email, 10 pedidos por minuto por IP). `{conocido: false}`, o `{conocido: true, completos, datos: {nombre, telefono, instagram}, proxima: {inicio} \| null}`: solo el primer nombre, el WhatsApp y el Instagram **tapados** (`+59 ••• 567`, `@an•••`), y el horario de su próxima agenda vigente. `completos`: lo guardado alcanza para los datos de contacto obligatorios de ese formulario |
| POST | `/eventos/<evento_id>/avance` | `{resp, origen, en_calendario, datos_guardados?}` | 204. El lead avanzó un paso después de dejar sus datos (60 pedidos por minuto por IP): crea o actualiza su `sched_intentos`. Sin un email válido en `resp` no se registra nada. Solo para Stats: la página no espera la respuesta |
| POST | `/reservas` | `{evento_id, resp, pais, tz, inicio (ISO o null), origen, si_ya_tiene?, datos_guardados?}` | 201 `{reserva: {id, inicio, fin, duracion, consultor: {nombre, color}}}`. Con `datos_guardados: true` (el lead que vuelve confirmó sus datos) el servidor completa nombre, WhatsApp e Instagram con lo que ya tiene de ese email. Descalificado: 201 `{descalificada: true}`. Horario ocupado: 409 `{code: 'ocupado'}`. El lead ya tiene una agenda próxima: 409 `{code: 'ya_tiene', agenda: {inicio}}`; la página le pregunta y repite el pedido con `si_ya_tiene: 'reprogramar'` (mueve la anterior) o `'adicional'` (crea otra y avisa al closer para que decida si cancela la anterior). Datos inválidos: 400 `{code: 'invalido', errores}` |

**Disponibilidad real.** Los horarios y la reserva usan solo closers **elegibles**: la persona de Team tiene el email de un usuario activo de la app y ese usuario conectó su Google Calendar (`google_calendar_tokens`). Al resto se lo trata como sin horario, así que la prioridad desborda a la siguiente. A cada closer elegible se le resta lo que ya tiene ocupado: sus agendas vigentes en la operación (`appointments` sin procesar, ni canceladas ni reprogramadas). Las de Agendas 2.0 bloquean su sesión y su margen (`duracion_min` + `margen_min` del payload); las que entran por n8n, 60 minutos, porque esa tabla no guarda duración. También se resta lo que cada closer tiene en sus **calendarios de conflicto** de Google (como en Calendly: los elige en Configuración › Integraciones; si no eligió, el de destino y el principal), con `freebusy`, hasta 60 días hacia adelante y con 2 minutos de caché por closer. Los eventos marcados «Disponible» y los cancelados no bloquean. Al confirmar se vuelve a consultar ese horario sin caché. Si Google no responde, se ofrece igual (se prefiere una superposición ocasional a perder agendas). Google también se lee para saber si el lead «ya tiene» una agenda próxima: una agenda cuyo evento el closer canceló o borró en su Calendar no cuenta (si Google no lo confirma, sigue contando), y no se toca en NeurOPS.

**Sesiones de cada closer.** El evento propone `duracion` (5 a 240 min) y `margen` (0 a 120 min, después de cada sesión); cada persona de Team puede ajustarlos por evento en `sesiones: {evento_id: {duracion?, margen?}}`: lo que no ajustó toma la propuesta. Lo ajusta el closer en su Configuración (`GET/PUT /api/auth/me/sesiones`, solo eventos que no son de un closer en particular) y la dirección comercial en Team o en el evento. Un horario se ofrece si la sesión entra en el horario del closer (el margen puede pasarse del final) y sesión + margen no pisan nada. El lead ve la duración propuesta; la reserva guarda la del closer que tocó (`duracion_min`, lo que dura la invitación de Google y lo que se le confirma) y su `margen_min`, que el lead nunca ve. Los eventos propios de un closer (persona fija) usan su propia duración y margen. Un `margen` de 0 no se escribe en `publicado`, así lo publicado antes sigue igual.

En `POST /reservas` el servidor no confía en nada de lo que calculó el cliente:

1. Valida cada respuesta con `validar_respuesta`, sobre las preguntas de la versión publicada.
2. Si alguna opción descalifica, busca o crea el **cliente** con su `formulario_payload` y termina: sin agenda.
3. Si no, recalcula la asignación con las agendas reales y busca el horario pedido.
4. Toma el closer de ese horario y bloquea su usuario (`SELECT … FOR UPDATE` sobre `users`).
5. Vuelve a comprobar que el closer no tenga otra agenda vigente en ese rato (su sesión más su margen).
6. Escribe en la operación (`operacion.py`), por el mismo camino que la «Nueva agenda» manual del closer:
   - cliente: `BookingService.find_or_create_client` (email, teléfono, Instagram) y su `formulario_payload`;
   - si el cliente ya tiene una agenda futura abierta (de Agendas 2.0 o de n8n), **la reprograma**: la mueve al horario y closer nuevos, marca `is_rescheduled` y actualiza su `FinancialAgenda`;
   - si no, `BookingService.create_appointment` (notifica al closer y a admin) y el espejo `sync_appointment_to_financial_agenda` (que reconcilia duplicados).
7. Ya guardada la agenda, crea el evento en el Calendar del closer (`GoogleService.crear_evento_con_meet`): título `<evento>: <lead> y <closer>`, el formulario en la descripción, link de Meet y el lead invitado por mail. Si la agenda se reprogramó, borra el evento anterior. **Si Google falla, la agenda queda igual** y se avisa a admin y al closer (`Notification`) para crearlo a mano.

8. Avisa al canal de ventas de Discord con un embed (lead, closer, horario de Bolivia, setter u origen, prioridad, nota, contacto, formulario y Meet). El webhook se lee de la variable de entorno `DISCORD_AGENDAS_WEBHOOK`; si falta o Discord falla, solo queda en el log.

Si el mismo lead (mismo email) manda dos veces el mismo horario, se devuelve la agenda que ya existe.

**Límite por IP** (en memoria, por proceso): 30 pedidos por minuto a `/horarios` y 10 por minuto a `/reservas`. Al pasarlo responde 429.
