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
  api_admin.py   /api/agendas-v2/*          sesión + rol admin o director_comercial; setter solo lee (CSRF activo)
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

**El setter mira (10/10/2026).** Con rol activo `setter` solo responden los GET `/estado`, `/estadisticas`, `/version`, `/ocupacion`, `/fichas` y `/usuarios`; todo lo demás (escribir documentos, perfil, integraciones, el paquete con IA y su prompt) da 403. Lo que lee va sin datos personales de otros: `/estado` trae `solo_lectura: true`, las personas de Team sin `email` y cada reserva solo con `id, estado, inicio_ms, fin_ms, duracion_min, margen_min, closer_id, evento_id, funnel_id, creada, cancelada` (sin el lead, sus respuestas ni el Meet); `/ocupacion`, cada evento con `titulo: null` y cada agenda de n8n con `nombre: null`; `/usuarios`, sin `email`. La pantalla se pone en solo lectura con esa marca (`frontend/src/pages/agendas_v2/ui/soloLectura.js`).

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| GET | `/estado` | — | `{cols: {funnels, formularios, personas, grupos, eventos, roles}, perfil, integ, reservas, zona, version, solo_lectura}`. `zona`: la zona horaria de quien mira (la del país de su WhatsApp; sin número, la que eligió; si no, `null` y decide el navegador): la semana del equipo en Available se muestra en esa hora. `reservas`: las `appointments` con `agenda_payload` de los últimos 35 días y futuras, en el formato de `adaptadorLocal` (`id` = id de la Appointment, `inicio_ms`, `fin_ms`, `estado` `agendada` o `cancelada`, y los campos del payload). Thalamus no cancela ni reprograma: eso lo hace el closer en NeurOPS |
| GET | `/estadisticas` | — | `{leads: [{t, ev, llego, desc, agenda, score, closer, setter, origen, grupo, inicio, cancelada?}]}`: los últimos 180 días para Stats. Las `appointments` con `agenda_payload` (`agenda: true`, `llego: 999`, `t` = cuándo se creó, `inicio` = el horario, `closer` = id de la persona de Team, `setter` = usuario) y los `sched_intentos` (`llego` = su paso, `desc` si no calificó). Las visitas al link sin datos no se registran |
| GET | `/version` | — | `{version}` (el frontend lo consulta cada 15 s para traer cambios de otros) |
| GET | `/usuarios` | — | `{usuarios: [{id, nombre, email, rol, tz, calendar, yo}]}`: closers y setters activos de la app (`yo`: el de la sesión). Team suma personas solo desde esta lista, con su email, así cada persona queda unida a su cuenta (`sched_personas.user_id`) |
| GET | `/ocupacion?desde&hasta` | — | `{ocupacion: {persona_id: {estado, franjas: [[inicio_ms, fin_ms]], eventos: [{inicio, fin, titulo}]}}}`: lo ocupado en los calendarios de conflicto de Google de cada persona de Team, para Available. `franjas`, ya unido (lo que se pisa queda en un tramo); `eventos`, cada uno con su título solo si es del calendario de agendamiento (`null` en sus otros calendarios, si es privado o confidencial, o si el calendario solo deja ver libre/ocupado); los que van sin título traen `calendario`, el nombre del calendario de donde salen. `agendas`: las agendas de n8n de ese closer en el rango (`{id, inicio, fin, nombre, estado, resultado}`), con `estado` `vigente`, `cancelada` (marcada cancelada o reprogramada) o `sin_evento` (sigue vigente en NeurOPS pero ya no está en su Google Calendar: probablemente se canceló en Calendly). `trazas`: `{appointment_id: {estado, vinculo, inicio_nuevo?}}` de todas sus agendas en el rango (de los dos sistemas): qué pasó con su evento en Calendar. `vinculo`: cómo se encontró su evento (`propio`: lo creó NeurOPS; `email`: el de esa hora con el lead invitado; `nombre`: el único de esa hora con su nombre en el título). `estado`: `ok`, `cancelado`, `borrado`, `movido` (con `inicio_nuevo`), `disponible` (marcado «Disponible»), `rechazado` (el lead rechazó la invitación), `sin_vincular` (no se encontró su evento) o `sin_dato`. El vínculo se guarda en la agenda (`calendar_evento_id`, `calendar_id`, `calendar_vinculo`), aparte de `google_event_id`: solo se lee, nunca se toca el evento. Cada agenda de n8n trae su traza en `calendar`, y si está vinculada manda sobre la coincidencia por hora. Las reservas de `/estado` traen `cancelada`: si dejaron de estar agendadas por cancelarse o reprogramarse (y no porque el closer ya las procesó). Cuenta lo mismo que freebusy: sin cancelados, «Disponible» ni rechazados. `estado`: `ok`, `error` (Google no respondió: el visor no lo muestra como libre), `sin_google` o `sin_usuario`. Rango en ms, de hasta 10 días (400 si no). Se guarda 2 min por closer y rango, aparte de lo que usa el motor |
| GET | `/fichas?desde&hasta` | — | `{fichas: {appointment_id: {id, fecha, fuente, closer, setter, pre_call, post_call, asistio, presento, no_cerrada, retraso_dias, ya_paso, descartada}}}`: la fila de Closing (`ComercialService.agendas`, la de la tabla Agendas de Revisar) de cada agenda que empieza en el rango, de los dos sistemas, para el Filtro completo de Available. Sin el contacto del lead (nombre, email, instagram, teléfono). `pre_call` y `post_call` son chips `{key, label}`. El mismo rango que `/ocupacion` (hasta 10 días, 400 si no). El setter también la lee |
| POST | `/eventos/<id>/prueba` | `{grupo}` | `{version, slots: [{t, p}], grupo, regla, desborde}`: la prueba por segmento de Thalamus (`/agendas-v2?probar=<id>&seg=<segmento>`). Lo que vería un lead de esa prioridad salteando el formulario: los mismos horarios que la página pública (closers elegibles, sus agendas y su Google Calendar), con el closer de cada uno. Usa la versión publicada, o el borrador si nunca se publicó (`version`). No agenda nada. 404 si el evento no existe |
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
| POST | `/eventos/<evento_id>/conocido` | `{email}` o `{telefono, pais}` | El lead que ya agendó antes (se lo busca por email o por WhatsApp, 10 pedidos por minuto por IP). `{conocido: false}`, o `{conocido: true, completos, datos: {nombre, telefono, instagram}, proxima: {inicio} \| null, respuestas: {enviado, no, url} \| null}`: solo el primer nombre, el WhatsApp y el Instagram **tapados** (`+59 ••• 567`, `@an•••`), y el horario de su próxima agenda vigente. `completos`: lo guardado alcanza para los datos de contacto obligatorios de ese formulario (correo incluido). `respuestas`: su último envío fue a este mismo formulario y las preguntas no cambiaron; las respuestas no viajan, solo cómo terminaría con ellas (`no`: no califica, `url`: una regla lo manda a otra página) |
| POST | `/eventos/<evento_id>/avance` | `{resp, pais, origen, en_calendario, datos_guardados?, respuestas_guardadas?}` | 204. El lead avanzó un paso después de dejar sus datos (60 pedidos por minuto por IP): crea o actualiza su `sched_intentos`. Sin un email válido en `resp` (o guardado, con `datos_guardados`) no se registra nada. Solo para Stats: la página no espera la respuesta |
| POST | `/reservas` | `{evento_id, resp, pais, tz, inicio (ISO o null), origen, si_ya_tiene?, datos_guardados?, respuestas_guardadas?}` | 201 `{reserva: {id, inicio, fin, duracion, consultor: {nombre, color}}}`. Con `datos_guardados: true` (el lead que vuelve confirmó sus datos) el servidor completa correo, nombre, WhatsApp e Instagram con lo que ya tiene de ese email o WhatsApp (lo que el lead volvió a escribir de los dos vale). Con `respuestas_guardadas: true` (confirmó que sigue todo igual) completa las respuestas del formulario con su último envío; `/horarios` también acepta `respuestas_guardadas` y `pais` para segmentar con esas. Descalificado: 201 `{descalificada: true}`. Horario ocupado: 409 `{code: 'ocupado'}`. El lead ya tiene una agenda próxima: 409 `{code: 'ya_tiene', agenda: {inicio}}`; la página le pregunta y repite el pedido con `si_ya_tiene: 'reprogramar'` (mueve la anterior) o `'adicional'` (crea otra y avisa al closer para que decida si cancela la anterior). Datos inválidos: 400 `{code: 'invalido', errores}` |

**Disponibilidad real.** Los horarios y la reserva usan solo closers **elegibles**: la persona de Team tiene el email de un usuario activo de la app y ese usuario conectó su Google Calendar (`google_calendar_tokens`). Al resto se lo trata como sin horario, así que la prioridad desborda a la siguiente. A cada closer elegible se le resta lo que ya tiene ocupado: sus agendas vigentes en la operación (`appointments` sin procesar, ni canceladas ni reprogramadas). Las de Agendas 2.0 bloquean su sesión y su margen (`duracion_min` + `margen_min` del payload); las que entran por n8n, 60 minutos, porque esa tabla no guarda duración. También se resta lo que cada closer tiene en sus **calendarios de conflicto** de Google (como en Calendly: los elige en Configuración › Integraciones; si no eligió, el de destino y el principal), con `freebusy`, hasta 60 días hacia adelante y con 2 minutos de caché por closer. Los eventos marcados «Disponible» y los cancelados no bloquean. Al confirmar se vuelve a consultar ese horario sin caché. Si Google no responde, se ofrece igual (se prefiere una superposición ocasional a perder agendas). **Google Calendar manda:** con el calendario del closer leído, una agenda vigente en NeurOPS solo bloquea si a esa hora hay algo ocupado en su Calendar; la que se canceló, se borró o se marcó «Disponible» deja el horario libre aunque en NeurOPS siga abierta (no se la toca, y la reserva nueva a esa misma hora se crea igual). Sin poder leer su calendario, y en los 10 minutos después de tomada (caché o evento en camino), la agenda bloquea como siempre. Available hace lo mismo. Google también se lee para saber si el lead «ya tiene» una agenda próxima: una agenda cuyo evento el closer canceló o borró en su Calendar no cuenta (si Google no lo confirma, sigue contando), y no se toca en NeurOPS.

**Sesiones de cada closer.** El evento propone `duracion` (5 a 240 min) y `margen` (0 a 120 min, después de cada sesión); cada persona de Team puede ajustarlos por evento en `sesiones: {evento_id: {duracion?, margen?}}`: lo que no ajustó toma la propuesta. Lo ajusta el closer en su Configuración (`GET/PUT /api/auth/me/sesiones`, solo eventos que no son de un closer en particular) y la dirección comercial en Team o en el evento. Los horarios de cada closer se **encadenan** para que le entren la mayor cantidad de agendas: en cada franja de su horario la primera sesión arranca al principio y cada una empieza donde termina el margen de la anterior; si un inicio no está libre (una agenda o un evento de Google), se busca el siguiente de a 5 minutos y la cadena sigue desde ahí. La sesión tiene que entrar en el horario (el margen del final puede pasarse) y sesión + margen no pueden pisar nada. Por eso el lead puede ver inicios como 9:50 o 10:40. El `paso` (intervalo) del evento ya no se usa. El lead ve la duración propuesta; la reserva guarda la del closer que tocó (`duracion_min`, lo que dura la invitación de Google y lo que se le confirma) y su `margen_min`, que el lead nunca ve. Los eventos propios de un closer (persona fija) usan su propia duración y margen. Un `margen` de 0 no se escribe en `publicado`, así lo publicado antes sigue igual.

En `POST /reservas` el servidor no confía en nada de lo que calculó el cliente:

1. Valida cada respuesta con `validar_respuesta`, sobre las preguntas de la versión publicada.
2. Si alguna opción descalifica, busca o crea el **cliente** con su `formulario_payload` y termina: sin agenda.
3. Si no, recalcula la asignación con las agendas reales y busca el horario pedido.
4. Toma el closer de ese horario, lee su Google Calendar sin caché y recién después bloquea su usuario (`SELECT … FOR UPDATE` sobre `users`). Google va antes porque renovar el token hace commit, y un commit suelta el bloqueo.
5. Ya bloqueado, vuelve a comprobar que el closer no tenga otra agenda vigente en ese rato (su sesión más su margen). Dos leads que piden el mismo closer a la vez quedan en fila: el segundo lee después del commit del primero y recibe 409 `ocupado`; si es el mismo lead confirmando dos veces, recibe la agenda que ya tomó. Justo antes de escribir se bloquea y se comprueba otra vez, porque buscar la agenda previa del lead también lee Google.
6. Escribe en la operación (`operacion.py`), por el mismo camino que la «Nueva agenda» manual del closer:
   - cliente: `BookingService.find_or_create_client` (email, teléfono, Instagram) y su `formulario_payload`;
   - si el cliente ya tiene una agenda futura abierta (de Agendas 2.0 o de n8n), **la reprograma**: la mueve al horario y closer nuevos, marca `is_rescheduled` y actualiza su `FinancialAgenda`;
   - si no, `BookingService.create_appointment` (notifica al closer y a admin) y el espejo `sync_appointment_to_financial_agenda` (que reconcilia duplicados).
7. Ya guardada la agenda, crea el evento en el Calendar del closer (`GoogleService.crear_evento_con_meet`): título `<evento>: <lead> y <closer>`, el formulario en la descripción, link de Meet y el lead invitado por mail. Si la agenda se reprogramó, borra el evento anterior. **Si Google falla, la agenda queda igual** y se avisa a admin y al closer (`Notification`) para crearlo a mano.

8. Avisa al canal de ventas de Discord con un embed (lead, closer, horario de Bolivia, setter u origen, prioridad, nota, contacto, formulario y Meet). El webhook se lee de la variable de entorno `DISCORD_AGENDAS_WEBHOOK`; si falta o Discord falla, solo queda en el log.

Si el mismo lead (mismo email) manda dos veces el mismo horario, se devuelve la agenda que ya existe.

**Límite por IP** (en la base, compartido entre los workers; ver `app/services/limite_intentos.py`): 30 pedidos por minuto a `/horarios` y 10 por minuto a `/reservas`. Al pasarlo responde 429. La IP es `request.remote_addr` (ProxyFix), no el primer valor de `X-Forwarded-For`, que lo escribe el visitante.

## API de agenda para la Academia: `/api/external/academy/agenda`

Thalamus como **servicio** para las sesiones del programa que agenda el equipo de fulfillment de la Academia (código en `app/api/external/agenda.py`). La Academia decide todo y lo manda en cada pedido: quién da la sesión, duración, margen y horario semanal. Acá **no se guarda** horario, persona (`sched_personas`), funnel ni reserva, y nada toca `appointments`, `clients`, `financial_agendas` ni Discord de ventas. Thalamus pone lo ocupado en Google Calendar, el cálculo del núcleo (`slots_persona`), el evento con Meet que invita al alumno y el WhatsApp a quien da la sesión.

**Auth:** `Authorization: Bearer ACADEMY_INBOUND_API_TOKEN` (el mismo de `/api/external/academy`).

**Cuentas:** usuarios con el rol `fulfillment` (principal o adicional), buscados por email. No tienen pantallas en NeurOPS. Si el email ya es de una cuenta con otro rol, el alta solo le suma `fulfillment` y no toca su número ni su zona.

| Método y ruta | Cuerpo | Respuesta |
| :--- | :--- | :--- |
| `PUT /equipo` | `{email, nombre, tz, telefono}` | estado |
| `GET /equipo/<email>` | – | estado: `{email, calendar: conectado\|vencido\|no, calendario_elegido, whatsapp: confirmado\|pendiente\|sin_numero, numero, invitar_personal, lista}` |
| `POST /equipo/<email>/google` | `{volver}` (ruta de la Academia) | `{url}` |
| `GET /equipo/<email>/calendarios` | – | `{cuenta, calendarios: [{id, nombre, principal, escribe}], destino, conflicto, invitar_personal}` |
| `POST /equipo/<email>/calendarios` | `{nombre}` | crea un calendario en la cuenta conectada y lo deja como el suyo |
| `PUT /equipo/<email>/calendarios` | `{destino, conflicto: [ids], invitar_personal}` | lo mismo que el GET |
| `POST /equipo/<email>/whatsapp/prueba` | – | `{comprobante}` |
| `POST /equipo/<email>/whatsapp/confirmar` | `{comprobante}` | estado |
| `POST /horarios` | `{email, tz, horario, duracion, margen, antel_min, dias, ocupado: [{inicio, fin}], fresco}` | `{slots: [ms], google}` |
| `POST /reservas` | `{email, tz, inicio, duracion, titulo, descripcion, invitado: {nombre, email}, aviso: {sesion, alumno}}` | `{event_id, calendar_id, meet}` |
| `PATCH /reservas/<event_id>` | `{email, calendar_id, inicio, duracion}` | `{ok}` |
| `DELETE /reservas/<event_id>` | `{email, calendar_id}` | `{ok}` |
| `POST /reuniones` | `{email, tz, fecha, hora, duracion, dias, titulo, descripcion, invitados, saltear, hasta?}` | `{event_id, calendar_id, meet}` |
| `PATCH /reuniones/<event_id>` | lo mismo + `calendar_id` | `{ok}` |
| `DELETE /reuniones/<event_id>` | `{email, calendar_id}` | `{ok}` |
| `GET /equipo/<email>/eventos?desde&hasta` | – (ms, hasta 10 días) | `{eventos: [{id, calendar_id, serie, titulo, inicio, fin, meet, escribe}]}` |
| `GET /equipo/<email>/eventos/<event_id>?calendar_id` | – | `{estado: confirmed\|tentative\|cancelled\|borrado, inicio, fin}` |
| `POST /equipo/<email>/eventos/<event_id>/vincular` | `{calendar_id, invitado: {email}}` | `{meet}` |

- **Conectar Google sin sesión:** la URL es `/google/conectar/<firma>` (itsdangerous, no JWT: `load_user_from_request` toma cualquier JWT con `id` como sesión). Vence a los 15 minutos y sirve una vez: si la cuenta ya tiene un token guardado después de emitida la firma, se rechaza. El callback guarda el token para la cuenta de la firma y vuelve a `ACADEMY_URL` (env, por defecto `https://academy.thelearnation.com`) + `volver?google=ok|cancelado|error`.
- **Cuenta compartida y calendario propio:** el equipo puede conectar todos la misma cuenta de Google (team@, la que graba los Meet) y cada uno elige o crea **su** calendario dentro de ella: ahí se crean sus sesiones (`google_calendar_id`) y es el que se revisa para lo ocupado (`calendarios_conflicto`, más los que sume). Sin calendario elegido la cuenta no está `lista`, para que nadie agende en el principal compartido. La elección se guarda en `sched_perfiles.datos.academia` (`calendario_elegido`, `cuenta`, `invitar_personal`); si al listar la cuenta conectada ya no es la misma, se descarta y hay que elegir de nuevo.
- **Invitar al calendario personal (opcional):** con `invitar_personal`, cada evento también invita al email de la cuenta (el de la Academia), salvo que sea la misma cuenta conectada.
- **WhatsApp sin sesión:** la prueba devuelve un comprobante firmado con el número (15 min); confirmar lo exige. Cambiar el número en el alta vuelve a pedir la confirmación.
- **`/horarios`:** exige Google conectado y WhatsApp confirmado (409 `no_lista`). El horario usa 0 = domingo y acepta cualquier minuto. `ocupado` es lo que la persona tiene en la Academia (clases, días bloqueados, otras reservas) y se suma a su freebusy de Google (caché de 120 s; `fresco: true` lo lee en el momento).
- **`/reservas`:** no revisa disponibilidad (la Academia la confirmó antes con `fresco`, o es una fecha acordada por fuera). El evento dura `duracion` (el margen no va al evento). El WhatsApp usa la plantilla del aviso de agenda con `grupo = Academia` y la hora en la zona de quien da la sesión; si falla, solo queda en el log. Google falla: 502 `google`.
- **Mover y cancelar** van al calendario donde se creó (`calendar_id`) y Google avisa al alumno.
- **El closer de cada alumno (`POST /closers`, `{alumnos: [{email, work_client_id}]}`, hasta 1000):** el de su venta más reciente con vendedor (`FinancialSale.email_vendedor`, resuelto por email o alias como en Seguimientos); el cliente se busca por `work_client_id` y si no por email. Devuelve `{closers: [{email, work_client_id, cliente_id, closer: {email, nombre, activo, rol} | null}]}`. La Academia lo usa para sincronizar el closer de cada alumno (quién da sus Momentum).
- **Momentum con el closer (modo ventas, `ventas: true`; en el estado, `?ventas=1`):** la cuenta es la de un closer (rol `closer`) y se usa su configuración de ventas **sin tocarla**: su horario de ventas (su persona de Team; el horario que manda la Academia no aplica), su calendario de ventas y su freebusy. Está `lista` con Google conectado y horario de ventas; el WhatsApp es el de sus avisos de ventas. `/reservas` crea una **`Appointment` con origen `Momentum`** para el cliente del alumno (por email; se crea si no está), sin `create_appointment` (no es un lead nuevo: no toca su pipeline ni el espejo de `FinancialAgenda`), con `agenda_payload.academia` (`reserva_id`, `sesion_id`, `sesion`, `tipo`, `alumno_id`) y devuelve también `appointment_id`; mismo horario ocupado en NeurOPS: 409 `ocupado`. Mover y cancelar en modo ventas mueven la llamada o la dejan `Cancelada`. El closer la ve en el mazo y la reporta en la ficha; el resultado vuelve a la Academia (`integracion_learnation_api.md` §8). Es por pedido y no por cuenta: un closer que además da sesiones comunes (rol fulfillment) las sigue dando como fulfillment.
- **Su Google Calendar en la Agenda de la Academia:** `GET /equipo/<email>/eventos` devuelve los eventos de sus calendarios de conflicto en el rango (pide el calendario elegido, 409 `no_lista`; Google falla: 502), para que esa misma persona los vea en su Agenda: los recurrentes, cada uno por separado (`serie` = el que se repite); sin cancelados, «Disponible» ni rechazados; título salvo privados o confidenciales; `escribe` si el calendario deja editar. `POST …/eventos/<event_id>/vincular` convierte uno en una sesión: invita al alumno (si no estaba) y le agrega Meet si no tenía, sin tocar horario ni título y sin WhatsApp. Desde ahí la reserva de la Academia guarda ese `event_id`/`calendar_id`, y mover y cancelar van por `/reservas` como cualquier otra. `GET …/eventos/<event_id>` dice cómo sigue (movido o `borrado`) para que la Academia acompañe lo que se cambió directo en Google.
- **Reuniones de equipo** (las declara un admin en la Academia: reuniones de equipo y 1:1 diarias): **un solo evento de Google que se repite**, en el calendario elegido de quien organiza (`email`), con Meet, invitando a cada email de `invitados` (el de la cuenta de cada participante). `fecha` (YYYY-MM-DD, la primera) y `hora` (HH:MM) son locales en `tz`, y el evento se crea con esa zona para que Google lo repita bien con los cambios de horario. `dias`: 0 = domingo; arma `RRULE:FREQ=WEEKLY;BYDAY=…`. `saltear`: fechas sin reunión (`EXDATE`). `hasta`: último día (`UNTIL`, el fin de ese día en UTC): así se termina una serie sin borrar lo que ya pasó. Solo pide el calendario elegido (no el WhatsApp: no se avisa por WhatsApp). `PATCH` reescribe la serie entera (conserva el Meet) y `DELETE` la borra; en los dos Google avisa a los invitados.
