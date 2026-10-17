# Bitácora - Octubre 2026

- **4 de Octubre de 2026** *(Agendas 2.0: el prototipo "Learnation Thalamus" pasa a React en `/agendas-v2`, sin backend; reemplaza el laboratorio del 01/10. [frontend/src/pages/agendas_v2/](../../frontend/src/pages/agendas_v2/) [NEW/REPLACE], [index.css](../../frontend/src/index.css) [MODIFY], [index.html](../../frontend/index.html) [MODIFY])*:
  - **Qué es**: la herramienta del director comercial (Forms, Team, Events, Stats, Configuración) y la página pública de reserva del lead (`/agendas-v2/agenda/:funnel/:evento?o=origen`). Es fiel al prototipo publicado como artifact. Los datos se guardan en el navegador, así que no llega nada a `FinancialAgenda`/`Appointment`, tal como pide el paso 1 del plan (pérdida cero, sin tocar la operación).
  - **Arquitectura pensada para el backend**:
    - `core/` es lógica pura (puntaje, ruteo por reglas, horarios, asignación, publicación, contrato de reserva) y es lo que se porta a `app/agendas_v2/`.
    - `data/adaptadorLocal.js` es el único archivo que sabe dónde se guarda. Al conectar se escribe un `adaptadorApi.js` con los mismos métodos.
    - El contrato de `POST /api/agendas-v2/reservas` es `armarReserva()` en `core/reserva.js`.
    - Detalle en [README.md](../../frontend/src/pages/agendas_v2/README.md).
  - **Cambios de comportamiento respecto del prototipo**:
    - Desborde entre prioridades cuando una no tiene lugar.
    - "Llenar en orden" mira una ventana de 7 días.
    - "Repartir parejo" usa las agendas reales.
    - Publicar guarda una copia del formulario.
    - "Descartar" vuelve todos los campos.
    - "Días hábiles" no ofrece fines de semana.
    - La zona por defecto es La Paz.
    - El teléfono queda en formato internacional.
    - El `?o=` se guarda en la reserva.
    - Se quitó el ruteo por tramos de puntaje y el link personal.
  - **Estilos globales**: los reseteos con `!important` de `index.css` e `index.html` imponían Inter y quitaban pesos y cursivas. Se sumó `.thalamus` a la misma exclusión que ya tenían `.bg-v6`, `.ws-shell`, `.ce-shell` y `.dc-shell`. El resto de la app sigue en Inter (verificado en `/login`).
  - **Verificación**:
    - 41 tests de vitest (núcleo, Team, pantalla del lead, Configuración).
    - `vite build` limpio.
    - Recorrido completo en Chrome sin ventana, en escritorio y celular: crear funnel, rol, closers, prioridades, formulario con regla y evento; publicar; reservar desde el link público. La reserva salió con el closer correcto, la nota, el teléfono `+591…` y el origen. Una segunda reserva saltó al horario siguiente porque el primero ya estaba ocupado. Sin errores de consola.
    - En ese recorrido aparecieron y se corrigieron:
      - la página pública cargaba sin la hoja de estilos;
      - el fondo no ocupaba toda la pantalla;
      - faltaban los degradados SVG del dial;
      - el campo del link se cortaba.

- **5 de Octubre de 2026** *(Agendas 2.0: pasada final del frontend antes del backend)*:
  - **Corregido**:
    - las tarjetas de Prioridades se salían de la pantalla en celular (era una grilla sin columna definida; el prototipo tenía el mismo error);
    - las letras de las opciones ahora siguen al arrastre;
    - cambiar el link de un evento a uno que ya existe avisa que quedó con `-2`;
    - el linter de `agendas_v2` quedó sin avisos (el hook de arrastre ya no usa `useRef`).
  - **Probado en Chrome**:
    - todas las secciones a 390 px de ancho, con un chequeo automático de desbordes;
    - tema claro y "sistema";
    - rol Setter simulado (ve solo Events y Stats, todo en solo lectura salvo copiar el link);
    - aviso "El formulario cambió" en la revisión del evento;
    - lead descalificado desde el link público (registrado sin horario);
    - duplicar, borrar y Ctrl+Z;
    - reordenar arrastrando;
    - "Crear rápido" con teclado.

- **5 de Octubre de 2026 (2)** *(Agendas 2.0: backend del paso 2, aislado de la operación. [app/agendas_v2/](../../app/agendas_v2/) [NEW], [a5c2e9d71b04_agendas_v2_tablas_sched.py](../../migrations/versions/a5c2e9d71b04_agendas_v2_tablas_sched.py) [NEW], [app/__init__.py](../../app/__init__.py) [MODIFY], [docs/agendas_v2_api.md](../agendas_v2_api.md) [NEW], frontend `agendas_v2` conectado a la API)*:
  - **Qué hay**:
    - 9 tablas `sched_*`.
    - `nucleo/`: el port 1:1 a Python del núcleo del frontend, con 0 diferencias en 8 escenarios de asignación comparados contra Node.
    - API de gestión `/api/agendas-v2` (sesión con rol `admin` o `director_comercial`, CSRF activo).
    - API pública `/api/agendas-v2/publico` (anónima, exenta de CSRF, con límite por IP).
    - Contrato completo en [agendas_v2_api.md](../agendas_v2_api.md).
  - **No toca la operación**: no escribe en `financial_agendas` ni en `appointments` (hay tests que lo comprueban), no llama a n8n, Discord ni WhatsApp, ni crea eventos en Calendar. Eso es el paso 3.
  - **La reserva no confía en el navegador**:
    1. revalida las respuestas contra la versión PUBLICADA del evento;
    2. recalcula la asignación con las reservas reales;
    3. el closer lo elige el servidor;
    4. bloquea la fila del closer y vuelve a comprobar que no tenga otra reserva en ese rato antes de insertar.

    La página pública nunca recibe nombres, emails ni horarios del equipo.
  - **Frontend**:
    - `data/adaptadorApi.js` guarda con PATCH (solo los campos que cambiaron) o PUT y consulta `/version` cada 15 s.
    - La página pública usa un *proveedor* que pide horarios y reservas al servidor.
    - Thalamus pasó a ruta protegida (admin, director_comercial). La página pública es una ruta aparte que no importa nada de Thalamus.
  - **Migración escrita a mano**: el autogenerate sigue roto por el problema preexistente. Se verificó en SQLite, subiendo y bajando desde `3b8f2d61c4a9`, y al compararla con los modelos no da diferencias. La cadena completa no corre sobre una SQLite vacía por una migración vieja (`2c6524b78276`, preexistente).
  - **Inventarios de seguridad**: las 4 rutas públicas quedaron en `PUBLICAS_POR_DISENO` y el blueprint `agendas_v2_publico` en los exentos de CSRF.
  - **Verificación**:
    - 60 tests de `tests/agendas_v2`: núcleo, gestión, y pública con carrera de dos leads, horario inventado, respuestas manipuladas, descalificado, idempotencia y límite por IP.
    - 54 tests de vitest.
    - Recorrido real con Flask y Vite sobre una SQLite local: el director arma y publica desde Thalamus, un visitante anónimo reserva (201, closer elegido en el servidor) y otro queda descalificado; el director ve la reserva en Available. Sin errores de consola.

- **15 de Octubre de 2026** *(Thalamus como servicio de agenda para la Academia. [app/api/external/agenda.py](../../app/api/external/agenda.py) [NEW], [app/api/google_calendar.py](../../app/api/google_calendar.py) [MODIFY], [app/services/google_service.py](../../app/services/google_service.py) [MODIFY], [app/models/user.py](../../app/models/user.py) [MODIFY])*:
  - La Academia agenda las sesiones del programa de su equipo con Thalamus por API: horarios contra Google Calendar, evento con Meet que invita al alumno y WhatsApp a quien da la sesión. Contrato en [agendas_v2_api.md](../agendas_v2_api.md).
  - Rol nuevo `fulfillment`, sin pantallas. Las cuentas las crea la Academia; conectan Google con un link firmado de un solo uso y confirman el WhatsApp con un comprobante firmado.
  - No guarda nada de agenda ni toca la operación de ventas. `GoogleService` suma `mover_evento` y `delete_event` acepta el calendario donde se creó.
  - Verificación: `tests/agendas_v2/test_api_academia.py` (14 tests); `/google/conectar/<firma>` inventariada en `PUBLICAS_POR_DISENO`.
  - Cuenta compartida: el equipo conecta team@ (la que graba los Meet) y cada uno elige o crea su calendario dentro de ella; sin calendario elegido no está lista. Opcional: invitar también a su calendario personal.

- **16 de Octubre de 2026** *(Componentes estándar de UI y reglas de agentes unificadas. [frontend/src/components/standard/](../../frontend/src/components/standard/) [NEW], [.agents/](../../.agents/) [MODIFY], [CLAUDE.md](../../CLAUDE.md) [NEW])*:
  - Componentes estándar: `Button`, `IconButton`, `LinkButton`, `PageHeader` + `HeaderActions`, `Card` + `Aura`, `EmptyState`, `ConfirmDelete` y `Chip`. Dibujan con las clases de thalamus.css, así que la pantalla se ve igual.
  - Thalamus los usa en todas sus secciones: 106 botones, la cabecera (reemplaza a `ui/EnTope`), 12 estados vacíos y 4 confirmaciones de borrado que estaban copiadas. `Humo` pasa a ser el `Aura` estándar.
  - Reglas de agentes: `.agent/` y `.agents/` quedan unificadas en `.agents/`. Se corrigió `arquitectura.md` (Python 3.11, temas propios y componentes estándar). Regla nueva `ui.md` y skill `ui-builder`, con el catálogo de componentes. `CLAUDE.md` importa las reglas para Claude Code.
  - Verificación: 178 tests de Thalamus, 11 de los componentes y 15 de la Configuración de sesión (que usa piezas de Thalamus); build de producción.

- **16 de Octubre de 2026** *(Workshop y Marketing con el estilo estándar, leads y calificación de ManyChat. [frontend/src/pages/admin/workshop/](../../frontend/src/pages/admin/workshop/) [MODIFY], [frontend/src/pages/admin/marketing/](../../frontend/src/pages/admin/marketing/) [MODIFY], [app/api/manychat.py](../../app/api/manychat.py) [MODIFY], [app/api/manychat_calificacion.py](../../app/api/manychat_calificacion.py) [NEW])*:
  - Workshop pasa de 9 pestañas a 4 (Resumen, Talleres, Planificar, Tráfico landings) con la cabecera del dashboard comercial; Resumen con comparación, Talleres en tarjetas o tabla, Planificar con acciones por taller (migración `d4a8e2c6f1b7`).
  - Lista estándar `components/listas/ListaConfigurable` (columnas elegibles, filtro completo, agrupar, orden) y `useEnPantalla`: ningún menú se sale de la pantalla.
  - Tráfico landings solo en Workshop (en Marketing daba error), con campañas y anuncios de Meta por nombre.
  - Meta Ads: árbol campaña › conjunto › anuncio, enlaces al Administrador y sincronización de estado. Los leads de cada taller salen de la columna Leads de Meta (migración `e7b3c9a1d5f2`). Las guías por DM toman su palabra clave.
  - Marketing › Entrantes (antes Webhooks): una fila por persona con estado (calificado, descalificado, en conversación, sin respuesta) y paso del flujo. Se retiraron «Migrar data antigua» y «Limpieza inteligente».
  - Calificación: del 28/07 al 16/10 ManyChat mandaba «yes» fijo en el webhook de la respuesta a la apertura (corregido en ManyChat). El webhook lee también `cualificado` y registra el valor crudo; se puede corregir la calificación de a uno o en lote.
  - Verificación: suites de pytest y vitest de Workshop, Marketing y ManyChat; revisión visual con un servidor local.
  - Marketing › Conversaciones: el catálogo de mensajes del flujo de ManyChat (número, título, categoría, activo) con enviados, respondidos, % de respuesta, calificados y descalificados del período; marketing ya puede administrarlo. Los 651 leads que fueron por la rama «no calificado» entre el 28/07 y el 16/10 quedaron descalificados (cargados con «Cargar calificaciones»).

- **17 de Octubre de 2026** *(El reporte del setter ya no precarga los mensajes de ManyChat. [frontend/src/pages/setter/reporte/modelo.js](../../frontend/src/pages/setter/reporte/modelo.js) [MODIFY], [app/api/public/setter.py](../../app/api/public/setter.py) [MODIFY])*:
  - Paula no podía enviar el reporte («23 cualificados + 10 no leads + 0 in-abribles = 33, más que los 25 mensajes de los que salen»): los 25 venían precargados de ManyChat, que cuenta solo a quien escribió por primera vez ese día, y el setter también califica a gente que escribió otros días.
  - Ahora el formulario precarga solo las agendas de cada canal. Nuevos mensajes, no leads e in-abribles arrancan vacíos y los carga el setter, porque el reporte mide su rendimiento. La regla de que cualificados + no leads + in-abribles no superen los mensajes sigue igual.
  - Verificación: 127 tests de vitest del espacio del setter.

- **17 de Octubre de 2026** *(El Inbox pasa a los componentes estándar. [frontend/src/pages/inbox/](../../frontend/src/pages/inbox/) [MODIFY], [frontend/src/components/standard/Feedback.jsx](../../frontend/src/components/standard/Feedback.jsx) [MODIFY])*:
  - Cabecera con `PageHeader`: logo del Inbox, «Solo lectura» y el modo del motor como insignias con ayuda al pasar el mouse.
  - Flujos: filtro por estado con contadores y «Nuevo flujo» en línea, los dos en la fila del título. Tarjetas como las de Forms (estado, palabras clave, pasos, en curso, versión). Borrar confirma con `ConfirmDelete`.
  - Lienzo: la barra del flujo sube a la fila del título y el lienzo ocupa todo el ancho. Los pasos se agregan desde una paleta de íconos flotante, y el editor del nodo flota encima, como el inspector de Thalamus. Los avisos salen como toast. Salir con cambios abre un modal con «Guardar y salir».
  - Conversaciones: buscador y filtro (Todas · Sin responder · Bot pausado) en la cabecera; avatares, marca de «sin responder», variables del contacto como chips y el chat abre en el último mensaje.
  - Componente estándar nuevo `Status` (estado con punto de color), que también usa Thalamus en lugar de `EstadoEv`. Está en el catálogo `/ui` y en la skill.
  - Verificación: 43 tests (Inbox, componentes estándar y Eventos de Thalamus), lint y build de producción.

- **17 de Octubre de 2026** *(Marketing › Entrantes sin «Cargar calificaciones» ni «Herramientas». [frontend/src/pages/admin/marketing/entrantes/EntrantesVista.jsx](../../frontend/src/pages/admin/marketing/entrantes/EntrantesVista.jsx) [MODIFY], [frontend/src/pages/admin/marketing/AdminMarketingHubPage.jsx](../../frontend/src/pages/admin/marketing/AdminMarketingHubPage.jsx) [MODIFY])*:
  - Se quitaron los dos botones de la cabecera de «Leads entrantes», junto con el modal de carga en lote y el monitor viejo de webhooks que abrían (`CargarCalificaciones`, `WebhookMonitorTab`). La calificación se sigue corrigiendo de a uno desde la ficha; el endpoint de carga en lote del backend queda.
  - Verificación: 33 tests de vitest de Marketing y build de producción.

- **17 de Octubre de 2026 (2)** *(Marketing › Entrantes: sin «Pendientes por paso» y con el historial en palabras. [frontend/src/pages/admin/marketing/entrantes/EntrantesVista.jsx](../../frontend/src/pages/admin/marketing/entrantes/EntrantesVista.jsx) [MODIFY])*:
  - Se quitó la tarjeta «Pendientes por paso».
  - Historial de la persona: el webhook sin mensajes dice «Inicio de la automatización» y la respuesta sola, «Respondió X» (sin «Webhook ·»). Cuando enviado y respondido traen el mismo número se muestra solo el envío: en prod ese par llega a los 30 s del inicio, igual que el envío solo, así que no es una respuesta. **Mal: corregido en la entrada (4), ese par sí es una respuesta.**
  - Los nombres de los pasos salen del catálogo de Marketing › Conversaciones. Los mensajes 11 y 12 de ManyChat (desde el 17/10) todavía no están cargados, por eso se ven como «Mensaje 11» y «Mensaje 12».
  - Verificación: 34 tests de vitest de Marketing, lint y build de producción.

- **17 de Octubre de 2026 (3)** *(Las agendas que crea el equipo siguen el camino de Thalamus. [app/agendas_v2/manual.py](../../app/agendas_v2/manual.py) [NEW], [app/api/closer.py](../../app/api/closer.py) [MODIFY], [app/services/closer_service.py](../../app/services/closer_service.py) [MODIFY], [app/services/ficha_acciones_service.py](../../app/services/ficha_acciones_service.py) [MODIFY], [frontend/src/pages/closer/components/YaTieneAgenda.jsx](../../frontend/src/pages/closer/components/YaTieneAgenda.jsx) [NEW])*:
  - Calendly ya no recibe agendas: la última por n8n entró el 14/10 a las 20:51 UTC y desde el 15/10 todo entra por Thalamus.
  - La Nueva agenda del closer, la de la ficha, reprogramar y la 2da llamada crean el evento con Meet e invitación al lead (antes salía sin Meet), guardan el payload de Thalamus y avisan por Discord y WhatsApp.
  - La hora es libre: solo frena un choque con otra agenda del closer (aunque no empiece a la misma hora) o con su Google Calendar. El chequeo va antes de tocar nada: si choca, no se cierra la agenda vieja.
  - Si el lead ya tiene una agenda abierta, el closer elige reprogramarla (sigue con su closer) o crear una adicional.
  - El tracking de NeurOPS no cambia: reprogramar y 2da llamada siguen siendo dos filas (Reagendado / 2da call + reprogramada / 2TH Call), de las que salen el embudo, la cartera y el roadmap.
  - Lo que carga el equipo no cuenta como conversión en las Stats de Thalamus.
  - Verificación: 678 tests de pytest relacionados (Thalamus, ficha, mazo, comercial), vitest de las pantallas del closer y build de producción.

- **17 de Octubre de 2026 (4)** *(Entrantes: el historial vuelve a mostrar la respuesta pegada al envío. [frontend/src/pages/admin/marketing/entrantes/EntrantesVista.jsx](../../frontend/src/pages/admin/marketing/entrantes/EntrantesVista.jsx) [MODIFY])*:
  - La entrada (2) se equivocó: cuando enviado y respondido traen el mismo número, la persona sí contestó. El webhook pega la respuesta en la fila del envío si llega dentro de los 30 min (`manychat.py`). Por eso la fila conserva la hora del envío, 30 s después del inicio. En prod, 2174 de 2176 de esas filas se actualizaron entre 1 s y 30 min después de crearse.
  - El historial ahora dice «Se le mandó X y respondió». Con números distintos dice «Se le mandó X · respondió Y».
  - Conversaciones no cambia: ya contaba ese par como respuesta, así que «Respondidos» y «% respuesta» estaban bien.
  - Verificación: 4 tests de vitest de Entrantes, lint y build de producción.

- **17 de Octubre de 2026 (5)** *(La reagenda del lead desde el link de Thalamus cuenta como reagenda. [app/agendas_v2/reagenda.py](../../app/agendas_v2/reagenda.py) [NEW], [app/agendas_v2/operacion.py](../../app/agendas_v2/operacion.py) [MODIFY], [app/agendas_v2/servicio.py](../../app/agendas_v2/servicio.py) [MODIFY])*:
  - Antes el link movía la misma fila y para el embudo del closer, la cartera y la cola «reagendar» la reagenda no existía.
  - Ahora es como «Reagendado» del mazo: la agenda vieja queda cerrada como Reagendado, la nueva nace reprogramada y queda un comentario en el roadmap del lead.
  - El registro de agendas sigue con una sola fila, con la fecha nueva (no suma otra agenda en el workshop ni en Confirmación).
  - Stats de Thalamus: la agenda original cuenta una vez, con el horario y la vigencia de su última reagenda; vale también para las reagendas del mazo.
  - Verificación: 614 tests de pytest (Thalamus, ficha, mazo, cartera y comercial).

- **17 de Octubre de 2026 (6)** *(El selector de categoría de Conversaciones funciona. [frontend/src/components/standard/standard.css](../../frontend/src/components/standard/standard.css) [MODIFY], [frontend/src/pages/admin/marketing/conversaciones/](../../frontend/src/pages/admin/marketing/conversaciones/) [MODIFY])*:
  - El menú de cualquier `Select` dentro de un `Modal` estándar salía corrido abajo a la derecha y cortado. Pasaba porque la animación de entrada del modal quedaba en efecto (`both`) y el modal pasaba a ser la referencia de lo `position: fixed`. Ahora la animación va con `backwards`.
  - En «Nuevo mensaje» la categoría ocupa su propia fila y se lee entera (antes, «Cualific…»).
  - Verificación: 31 tests de vitest (componentes estándar y Conversaciones). Prueba en el navegador con el usuario de marketing: el menú abre justo debajo del botón, dentro de la pantalla, y elegir «Seguimiento» cambia el valor.

- **17 de Octubre de 2026 (7)** *(Inbox: métricas por paso y gráficos estándar. [frontend/src/pages/inbox/](../../frontend/src/pages/inbox/) [MODIFY], [app/automatizaciones/](../../app/automatizaciones/) [MODIFY], [frontend/src/components/standard/Charts.jsx](../../frontend/src/components/standard/Charts.jsx) [NEW])*:
  - Flujos: tarjetas con métricas, plantillas para crear un flujo y el lienzo con las métricas de cada paso.
  - Conversaciones: examen, calificación, flujo y paso en cada fila; el detalle muestra el recorrido y la mediana de respuesta.
  - Componente estándar nuevo `Bars`, que ya usa el embudo de los talleres de Workshop (catálogo `/ui` y skill).
  - Las campañas del Inbox (con su migración) quedan para otro commit.

- **17 de Octubre de 2026 (8)** *(La grabación de Drive de cada taller, con carga masiva por CSV. [app/services/workshop_grabaciones_service.py](../../app/services/workshop_grabaciones_service.py) [NEW], [app/api/workshop_grabaciones.py](../../app/api/workshop_grabaciones.py) [NEW], [migrations/versions/a3f9c1e7b2d4_grabacion_drive_workshop.py](../../migrations/versions/a3f9c1e7b2d4_grabacion_drive_workshop.py) [NEW], [frontend/src/pages/admin/workshop/talleres/CargarGrabaciones.jsx](../../frontend/src/pages/admin/workshop/talleres/CargarGrabaciones.jsx) [NEW])*:
  - Cada taller tiene un campo para el link del Meet grabado en Google Drive (`grabacion_url`). Va aparte del Loom, que es lo que muestra la landing.
  - Workshop › Talleres › «Cargar grabaciones»: se pega el CSV que arma Claude in Chrome recorriendo Drive (`event_id,fecha,nombre,link_drive,notas`). «Revisar» muestra qué se carga, qué ya estaba y qué falla, y recién después se guarda. Si un taller ya tenía otra grabación, no se pisa salvo con el switch «Reemplazar».
  - Solo se aceptan links de Drive; los de archivo quedan como `/file/d/<id>/view`.
  - La pestaña Grabación de cada tarjeta abre el «Meet en Drive». El estado sin Loom ahora dice «Sin Loom».
  - Verificación: 21 tests de pytest, 78 de vitest de Workshop, migración arriba y abajo, y prueba en el navegador con talleres de prueba.

- **17 de Octubre de 2026 (9)** *(La grabación de Drive en el detalle del taller; se va «Cargar grabaciones». [frontend/src/pages/admin/workshop/components/WorkshopReplayConfigPanel.jsx](../../frontend/src/pages/admin/workshop/components/WorkshopReplayConfigPanel.jsx) [MODIFY], [frontend/src/pages/admin/workshop/talleres/TalleresVista.jsx](../../frontend/src/pages/admin/workshop/talleres/TalleresVista.jsx) [MODIFY])*:
  - En el detalle de cada taller, la pestaña Grabación tiene «Ver grabación en Drive». Si el taller no la tiene, dice «Sin la grabación de Drive.».
  - Ya se cargaron las grabaciones, así que se sacó el botón «Cargar grabaciones» de Talleres junto con su modal. El endpoint `POST /api/workshop/events/grabaciones` sigue, por si hay que volver a cargar en masa.
  - Verificación: 76 tests de vitest de Workshop.

- **17 de Octubre de 2026** *(El reporte del setter acepta lo que escribe el setter. [frontend/src/pages/setter/reporte/modelo.js](../../frontend/src/pages/setter/reporte/modelo.js) [MODIFY], [app/services/setter_reporte_v2.py](../../app/services/setter_reporte_v2.py) [MODIFY])*:
  - Elias no podía enviar el reporte («31 cualificados + 11 no leads + 0 in-abribles = 42, más que los 37 mensajes de los que salen»). Los setters califican también a gente que escribió otros días, y el reporte tiene que medir lo que ellos dicen.
  - Cualificados + no leads + in-abribles por encima de los mensajes ya no es error ni aviso: el formulario lo envía y la lectura del reporte y Discord ya no lo marcan. «Sin respuesta» queda en 0 en ese caso. Las demás advertencias siguen igual y ninguna bloquea.
  - Verificación: 66 tests de pytest del reporte del setter y 619 de vitest del setter y del comercial.
