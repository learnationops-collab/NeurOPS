# Bitácora · Noviembre 2026

- **1 de Noviembre de 2026 (Hiring: cada formulario tiene su propio link)** *([LinkFormulario.jsx](../../frontend/src/pages/admin/hiring/components/forms/LinkFormulario.jsx), [hiring_forms.py](../../app/api/hiring_forms.py), [ADR-W052](../DECISIONS.md))*:
  - Talent › Forms: la tarjeta y el editor muestran el link público del formulario (`institute.thelearnation.com/vacante/<slug>/`), con botones para copiarlo y para cambiar su parte final.
  - Puede haber varios formularios activos a la vez, cada uno en su link. Los nuevos y las copias toman el link de su nombre.
  - `GET /api/public/assistant-form?slug=` devuelve el formulario de ese link (inactivo o inexistente: búsqueda cerrada). Sin slug, el activo más antiguo (link viejo `/vacante-assistant/`).
  - Migración `b7d9f1a3c5e8`: columna `hiring_forms.slug` (única); el formulario actual queda con `assistant`.
  - Va junto con institute-site (`.htaccess` y `vacante-assistant/`), que sirve `/vacante/<slug>/` y pide ese formulario.

- **2 de Noviembre de 2026 (Triage: el rol se llama «Triage» y descalificar pide el motivo en texto libre)** *([TeamManagementPage.jsx](../../frontend/src/pages/admin/team/TeamManagementPage.jsx), [SubDescalificar.jsx](../../frontend/src/components/ficha/tabs/confirmacion/SubDescalificar.jsx))*:
  - El rol `triage` ya no se muestra como «Call confirmer» en Equipo ni en el editor de cursos.
  - «Descalificar lead» en la confirmación deja de ser una lista cerrada de motivos: se escribe el porqué (mínimo 3 caracteres), igual que en el cierre del triage.
  - Reprogramar sigue ofreciendo solo horarios libres (sin cambios): la regla de bloquear el horario ocupado se mantiene.
- **2 de Noviembre de 2026 (Discord: la tarjeta de lo que el triage pasa al closer)** *([avisos_discord.py](../../app/agendas_v2/avisos_discord.py), [triage_service.py](../../app/services/triage_service.py))*: la agenda de closing que nace de una llamada de triage salía como «Nueva agenda» gris y vacía, porque nace sin formulario. Ahora es «Pasó de Triage a Closing»: lleva el segmento y las respuestas del formulario del lead, dice «Triage · quien la pasó» y trae la nota que le dejó al closer.
- **2 de Noviembre de 2026 (Santiago y Mario no aparecen a la dirección comercial)** *([user.py](../../app/models/user.py))*: quien es closer pero también admin u operador (Santiago por pruebas, Mario como dueño) sale del selector de miembros, del ranking de closers y del reporte del director. Sus agendas y ventas siguen contando en los totales.

- **2 de Noviembre de 2026 (Lo ya cargado se queda al cambiar de sección o de pestaña)** *([usePedidos.js](../../frontend/src/pages/comercial/usePedidos.js), [DashboardComercial.jsx](../../frontend/src/pages/comercial/DashboardComercial.jsx), [Finanzas.jsx](../../frontend/src/pages/comercial/components/finanzas/Finanzas.jsx), [api.js](../../frontend/src/services/api.js))*:
  - Dirección comercial recuerda lo que ya pidió (contexto, KPIs, Comparativas, Variabilidad, tablas de Revisar, Segmentos, Triage y todas las pestañas de Finanzas y Payroll): ir y volver entre Analizar, Revisar y Triage, o entre sus pestañas, ya no vuelve a pedir ni muestra el esqueleto.
  - Lo recordado vale 5 minutos; pasado ese tiempo se muestra igual y se actualiza en silencio. «Reintentar» y lo que sigue a un guardado piden siempre; y cualquier guardado (POST, PUT, PATCH, DELETE) vacía todo lo recordado.
  - En el espacio del triage, las métricas se recuerdan por período y la lista de Abandonos se muestra al instante con lo último visto y se actualiza sola.
- **2 de Noviembre de 2026 (Triage: trabaja el lead como un closer y cambia el estado de la agenda con un clic)** *([ficha_lead_service.py](../../app/services/ficha_lead_service.py), [ResultadoTriage.jsx](../../frontend/src/components/ficha/tabs/ResultadoTriage.jsx), [recorrido.js](../../frontend/src/components/ficha/triage/recorrido.js), [FichaLeadModal.jsx](../../frontend/src/components/ficha/FichaLeadModal.jsx))*:
  - El triage puede corregir el historial (agendas, seguimientos, objeciones y eventos), los datos del lead y el estado de la agenda; Juliana no podía registrar seguimientos porque esos permisos eran solo del closer. Sigue sin cobrar, borrar ni reasignar.
  - El progreso de Resultado es la navegación del lead, también en la agenda de closing: cada etapa es un botón que se abre en cualquier momento. «Confirmado» abre la confirmación dentro del mismo panel (el triage puede registrar la que se le olvidó, sin pestaña aparte); «Resultado» abre «¿Qué pasó con esta llamada?» para cambiar el estado; «Calificación» reabre esa pregunta; «Seguimiento» (antes «Siguiente paso» en el triage) abre «¿Qué pasó con este contacto?», el mismo reporte del closer. Los hitos ya salen según lo reportado (un No Show ya no muestra «Calificación»).
  - En el closer el progreso suma un hito «Seguimiento» al final si todavía no hay «Siguiente paso», y «Confirmado», «Resultado» y «Siguiente paso» reabren su reporte.
  - Volver a reportar como «Califica» una llamada que ya pasó al closer se rechaza: crearía una segunda agenda de closing.
  - «Viene de triage · aprobado por…» en la agenda de closing muestra solo el título; la nota se lee al pasar el ratón (en Comunicación sigue completa, en el chat).
- **2 de Noviembre de 2026 («Volver a mi sesión» lleva al Portal)** *([impersonation.js](../../frontend/src/utils/impersonation.js))*: al terminar una simulación se entra al Portal en vez de a la pantalla del rol (a un operador lo mandaba a Equipo).
- **2 de Noviembre de 2026 (Lo ya cargado se queda también en el closer, el triage, el setter, el operador y contratación)** *([CloserWorkflowPage.jsx](../../frontend/src/pages/closer/CloserWorkflowPage.jsx), [SeguimientosPane.jsx](../../frontend/src/pages/closer/components/SeguimientosPane.jsx), [MisAgendas.jsx](../../frontend/src/pages/setter/agendas/MisAgendas.jsx), [Historial.jsx](../../frontend/src/pages/setter/reporte/Historial.jsx), [PanelesConservados.jsx](../../frontend/src/components/ui/PanelesConservados.jsx))*:
  - Mazo del closer y del triage: cada pestaña y día (Confirmar, Reportar, Seguir) y Compartidos y Abandonos muestran al instante lo último que se vio, sin esqueleto, y se actualizan en silencio por detrás.
  - Espacio del setter: Mis agendas y el Historial de reportes recuerdan lo último que se vio (el reporte diario, que es un formulario, se sigue pidiendo fresco).
  - Operador (Equipo, Soporte, Datos, Formularios, Curso) y Formularios de contratación: el panel que ya se abrió queda montado y escondido, así que volver a él no pide nada.
- **2 de Noviembre de 2026 (Los descalificados agendan con el triage)** *([triage.py](../../app/agendas_v2/nucleo/triage.py), [servicio.py](../../app/agendas_v2/servicio.py))*: una opción que descalifica, «No califica» y la regla de otra página (`mk-academy`) ya no cortan el formulario público: el lead agenda con el triage en la Sesión diagnóstica, como los C y D. Sin grupo «Triage» no cambia nada.
- **2 de Noviembre de 2026 (Las notas largas del triage y de la Academia se leen con formato)** *([NotaFormateada.jsx](../../frontend/src/components/ficha/piezas/NotaFormateada.jsx), [NotaEnTooltip.jsx](../../frontend/src/components/ficha/piezas/NotaEnTooltip.jsx), [TabComunicacion.jsx](../../frontend/src/components/ficha/tabs/TabComunicacion.jsx))*:
  - El texto tenía formato de markdown pero se veía crudo. Ahora se reconocen los títulos en mayúsculas, los grupos que terminan en «:», las viñetas con `*` o `-` (también anidadas) y «Etiqueta: texto» con la etiqueta en negrita; los `**` sueltos se limpian. Lo que no se reconoce queda como párrafo.
  - «Viene de triage» abre la nota con ese formato en una ventana propia al pasar el ratón (antes, el tooltip nativo en texto plano y cortado), con scroll si es larga.
  - En Comunicación, las notas largas con títulos o viñetas usan el mismo formato; un mensaje corto se deja tal cual, con sus «@» resaltados.
- **2 de Noviembre de 2026 (Una persona suma una sola agenda en Closing y en Triage)** *([agendas_vigentes.py](../../app/services/agendas_vigentes.py), [comercial_agendas.py](../../app/services/comercial_agendas.py), [triage_service.py](../../app/services/triage_service.py), [tablasDef.js](../../frontend/src/pages/comercial/components/tablasDef.js), [ADR-W057](../DECISIONS.md))*:
  - Cuando alguien reagenda (o lo reagendan), la fila vieja ya no suma como otra agenda: cuenta la nueva. Tampoco suman dos filas de la misma persona a la misma fecha y hora. Vale para Analizar, Revisar, reportes, simulador, Marketing «por reunión» y los segmentos; el calendario sigue mostrando cada evento.
  - Las métricas del triage cuentan una agenda por persona (la que tiene calificación o, si no, la más reciente), sin la reagendada ni las repetidas: confirmadas, asistencias, calificados y low ticket salen de las mismas filas que la lista de leads.
  - Revisar › Agendas ofrece «Agrupar por Persona» con los grupos abiertos: todas las llamadas de un lead juntas. Las filas no se borran de la base.

- **2 de Noviembre de 2026 (Thalamus: segmento Alfa y reglas sin choques, aplicado en producción)** *([segmentacion_alfa.py](../../scripts/segmentacion_alfa.py), [ADR-W056](../DECISIONS.md))*:
  - Script que carga en «Sesión de Aceleración» las estrategias Segmento Alfa, Segmento A, Segmento B, Triage · Segmento C y Triage · Segmento D, y 11 reglas que no se pisan (sale `mk-academy`: nadie se descarta).
  - Examen: Colombia y Perú +2, el resto +1, sin examen −1, ENARM −2 (segmento `2026-12.4`).
  - Antes de guardar prueba todas las combinaciones con el ruteo real y frena si alguna cumple dos reglas o va a otro grupo.
- **2 de Noviembre de 2026 (Thalamus: la segmentación se escribe solo con respuestas)** *([formulario.js](../../frontend/src/pages/agendas_v2/core/formulario.js), [normalizar.py](../../app/agendas_v2/nucleo/normalizar.py), [segmentacion_alfa.py](../../scripts/segmentacion_alfa.py), [ADR-W058](../DECISIONS.md))*:
  - El editor de reglas ya no ofrece «Segmento del lead»; las reglas de «Sesión de Aceleración» pasan a escribirse solo con respuestas (no se pisan y cubren todas las combinaciones).
  - Un formulario puede tener hasta 40 reglas (antes 20).
  - Team queda con las cinco estrategias de los segmentos; se borran las que ningún otro formulario usa.

- **2 de Noviembre de 2026 (Agendas tomadas por fuera de Thalamus: botón «+» junto al buscador)** *([CloserWorkflowPage.jsx](../../frontend/src/pages/closer/CloserWorkflowPage.jsx), [closer.py](../../app/api/closer.py), [a_triage.py](../../app/agendas_v2/a_triage.py))*:
  - En la vista del triage y del closer, un «+» al lado del buscador abre «Nueva agenda» para cargar a mano una agenda que se tomó fuera del CRM. El closer ya tenía ese modal en el menú del dock; el triage no podía crearlas.
  - `POST /api/closer/appointments` acepta el rol `triage`: la agenda queda a su nombre (mismo camino que Thalamus: Meet, invitación y avisos) y dura lo que su sesión diagnóstica (`sesion_propia_de`).
  - Fuente nueva «Externa» (por defecto para el triage); el subtítulo del modal pasa a «Agendas que no llegaron por Thalamus».
- **2 de Noviembre de 2026 (Thalamus: «Probar un lead» en Segmentación)** *([RuteoSimulador.jsx](../../frontend/src/pages/agendas_v2/secciones/forms/RuteoSimulador.jsx), [Ruteo.jsx](../../frontend/src/pages/agendas_v2/secciones/forms/Ruteo.jsx), [Editor.jsx](../../frontend/src/pages/agendas_v2/secciones/forms/Editor.jsx), [ADR-W059](../DECISIONS.md))*:
  - Segmentación suma la vista «Probar un lead»: se eligen respuestas y se ve la regla, la estrategia con sus closers, la sesión y los puntos.
  - Sale «No califica» (botón de la barra y destino de las reglas). Eliminar un formulario pide dos confirmaciones.
  - La sesión «La del formulario» pasa a «La del link por el que agendó»; los eventos con el mismo nombre muestran su embudo.
- **2 de Noviembre de 2026 (Thalamus: «Simular» con mejor diseño)** *([RuteoSimulador.jsx](../../frontend/src/pages/agendas_v2/secciones/forms/RuteoSimulador.jsx))*:
  - «Probar un lead» pasa a llamarse «Simular». Cada pregunta lleva su ícono; el resultado va en una tarjeta con aura del color de la estrategia, anillo de puntos y entrada animada (sin animación si el sistema la pide reducida).
  - «Por qué cae acá» muestra la respuesta del lead en cada condición y cuántas más entran, en vez de la lista entera.
  - `segmentacion_alfa.py --revisar` también dice qué formularios y links usan cada estrategia que no es de los segmentos.
- **2 de Noviembre de 2026 (Thalamus: sale la vista Flujo de Segmentación)** *([Ruteo.jsx](../../frontend/src/pages/agendas_v2/secciones/forms/Ruteo.jsx))*: Segmentación queda con Reglas y Simular; se borra `RuteoFlujo.jsx` (pedido de Mario).
- **2 de Noviembre de 2026 (Thalamus: formularios sin segmentación)** *([RuteoSinSegmentacion.jsx](../../frontend/src/pages/agendas_v2/secciones/forms/RuteoSinSegmentacion.jsx), [Ruteo.jsx](../../frontend/src/pages/agendas_v2/secciones/forms/Ruteo.jsx), [ADR-W060](../DECISIONS.md))*: interruptor «Con / Sin segmentación»; sin ella, Segmentación lista los links del formulario con su persona y avisa el que no tiene.

- **2 de Noviembre de 2026 (Marketing: ordenar por tasa y arreglos en Segmentos)** *([metricas.js](../../frontend/src/pages/admin/marketing/anuncios/metricas.js), [SegmentosVista.jsx](../../frontend/src/pages/admin/marketing/todos/SegmentosVista.jsx), [rankingConfig.js](../../frontend/src/pages/comercial/components/rankingConfig.js))*:
  - Rendimiento: Calificados, Descalificados, En conversación y Sin respuesta suman un botón `%` en el encabezado que ordena por el porcentaje y no por el conteo (en la vista agrupada, una píldora por tasa). Lo que no tiene dato queda al final, también en el cruce de segmentos y en el ranking de Comparativas.
  - Todos › Segmentos: «Reintentar» recarga de verdad, y un fallo del tablero ya no tapa la vista ni lanza un toast.
- **2 de Noviembre de 2026 (Cash en neto y comisión promedio por plataforma)** *([comision_plataforma_service.py](../../app/services/comision_plataforma_service.py), [commission_service.py](../../app/services/commission_service.py), [anuncios_service.py](../../app/services/anuncios_service.py), [workshop_metrics_service.py](../../app/services/workshop_metrics_service.py), [ADR-W061](../DECISIONS.md))*:
  - La comisión de un pago es la suya si está verificada y, si no, el promedio de su plataforma calculado con las comisiones reales (hoy Stripe 4,30 % y Hotmart 9,04 %).
  - «Cobrado», New Cash, Cash total y los ROAS de Marketing y de los talleres salen en neto (bajan entre 4,8 % y 6,9 %). Las listas muestran Neto y, ocultas, Bruto y Comisión usada. Los talleres ya guardados siguen en bruto hasta correr `scripts/resync_workshop_events.py` en el servidor.
  - La comisión de respaldo de Hotmart sube de 8,2 % a 8,8 % (cobra 8,77 % real).
  - Muestra de 15 ventas para cuadrar contra Stripe y Hotmart: `docs/analisis_neto_vs_bruto_02_11.md`.
- **2 de Noviembre de 2026 (Comparativas: el triage cuenta; Mario, Gabriel y Santiago no)** *([comercial_service.py](../../app/services/comercial_service.py), [comercial_analitica.py](../../app/services/comercial_analitica.py), [ADR-W062](../DECISIONS.md))*: el ranking de Closers suma a las personas de triage activas, y ni el ranking ni la fila «Equipo» cuentan a Mario, Santiago ni los dos Gabriel. Así la fila Equipo cierra con la suma de las personas del ranking.
- **2 de Noviembre de 2026 (Tráfico: clics de reservar y aplicar, y 10 landings que ahora miden)** *([metrics.py](../../app/api/metrics.py), [workshop_trafico.py](../../app/api/workshop_trafico.py), [auditoria_track_visit_02_11.md](../auditoria_track_visit_02_11.md))*: `track-visit` acepta `clic_agendar` y `clic_aplicar`; Tráfico los cuenta aparte (columna «Reservar / aplicar») y las landings `/clase-*` y `/class*` entran en la base de la tasa visita → grupo. Falta subir por FTP `metricas-landing.js` y 10 HTML de `institute-site` (lista en la auditoría), después de desplegar Work.
- **2 de Noviembre de 2026 (Análisis y validación de datos, sin cambios de código)** *([analisis_segmentos_vs_experimento_02_11.md](../analisis_segmentos_vs_experimento_02_11.md), [validacion_datos_02_11.md](../validacion_datos_02_11.md), [validar_datos.py](../../scripts/validar_datos.py))*: A (17,9 %) y B (8,3 %) replican el experimento, C (12,4 %) ya no compra menos que B y octubre va al revés para A con muestra chica. Script de validación de solo lectura (`scripts/validar_datos*.py`): primera corrida en producción con 182 cruces que cierran y 9 diferencias.
- **2 de Noviembre de 2026 (Lo ya cargado se queda también en el triage viejo, Inbox, Estadísticas, Postulaciones, Workshop y el dashboard de admin)** *([inbox/recuerdo.js](../../frontend/src/pages/inbox/recuerdo.js), [api.js](../../frontend/src/services/api.js), [ADR-W063](../DECISIONS.md))*: confirmaciones del triage por fecha, Flujos, Campañas, Conversaciones/Embudo, chat, Leads sin atribuir, Correlaciones y Agendas de Revisar de Workshop, estadísticas de closers y setters y tarjetas del dashboard de admin muestran lo último visto; las pestañas de Postulaciones y de Ventas/Análisis quedan montadas. Marcar un chat como leído ya no vacía el recuerdo de todas las vistas (`conservarCache`).
- **2 de Noviembre de 2026 (Discord: la tarjeta de «Pasó de Triage a Closing» más resumida)** *([avisos_discord.py](../../app/agendas_v2/avisos_discord.py))*: en la imagen, la ficha de la nota dice «Nota de {persona} para el closer» como título y, en chico, solo las primeras líneas con contenido (sin marcas de formato ni encabezados sueltos); la nota entera sale como cita en el texto del mensaje, fuera de la imagen (hasta 1500 caracteres).
- **2 de Noviembre de 2026 (Cada pago es de su closer: la venta ya no sale a nombre del closer anterior y el pago se corrige desde el historial)** *([TabResultado.jsx](../../frontend/src/components/ficha/tabs/TabResultado.jsx), [FilaPago.jsx](../../frontend/src/components/ficha/historial/FilaPago.jsx), [ficha_pagos_service.py](../../app/services/ficha_pagos_service.py), [ADR-W064](../DECISIONS.md))*:
  - Causa (David Hernandez, 31/10): Jean Carlo se reasignó el lead desde la cabecera de la ficha y, con la pestaña Resultado ya abierta, registró el pago 4 segundos después; «La comisión va a» seguía con Mario Bühler (el closer de cuando se abrió la pestaña) y el pago, la nómina y el aviso de Wins salieron a su nombre.
  - Ahora «La comisión va a» sigue al closer de la agenda: si el lead se reasigna con la pestaña abierta y nadie eligió a otro a mano, pasa al closer nuevo.
  - Historial › Pagos: cada pago dice «de {closer}» y el lápiz suma «Closer del pago» para corregirlo (queda en la bitácora del lead). Un lead puede tener pagos de distintos closers.
  - Revisé producción (solo lectura): es el único pago cargado tras una reasignación con el closer anterior de vendedor (el pago 57752).
- **2 de Noviembre de 2026 (Un lead confirmado ya no vuelve a «Por contactar» al reagendarse)** *([reagenda.py](../../app/agendas_v2/reagenda.py), [closer_service.py](../../app/services/closer_service.py))*: Dari (triage) marcó leads como confirmados y reaparecieron en «Por contactar». Causa: toda reagenda (el lead desde el link, el closer moviendo el evento en Google Calendar o «Reagendado» en el mazo) cierra la fila vieja y crea una nueva que nacía sin `result` ni etapa. Producción (solo lectura): 12 leads con la agenda vieja confirmada y la nueva sin confirmar, entre ellos Ana Palomares (7088) y Montse García (7087) de Dari. Ahora la agenda nueva hereda resultado de confirmación, etapa, «cómo viene» y dolores (`heredar_confirmacion`); el recordatorio previo no, porque era para la hora vieja.
- **2 de Noviembre de 2026 (Triage: sin confirmaciones y con lo que pasa al closing)** *([triage_service.py](../../app/services/triage_service.py), [triage_pases.py](../../app/services/triage_pases.py), [TriagePaneles.jsx](../../frontend/src/pages/comercial/components/triage/TriagePaneles.jsx), [TriagePorCloser.jsx](../../frontend/src/pages/comercial/components/triage/TriagePorCloser.jsx), [triageFiltros.js](../../frontend/src/pages/triage/components/triageFiltros.js))*: pedido del director comercial.
  - Se quita «Confirmadas» del embudo, las tarjetas, Por persona y Día por día del Triage de Dirección y de las métricas del triage; la asistencia se calcula sobre las agendas (la tarjeta antes era asistieron ÷ (asistieron + no show)). `confirmadas` y `confirmada` salen de `GET /api/triage/metricas`; la confirmación sigue en la ficha y el mazo.
  - Nuevo: de las agendas de closing con `agenda_triage_id`, cuántas pasaron, asistieron (`Show up`) y cerraron (pago completo o split, la seña no cuenta), por closer y en total. Dos tarjetas (asistencia y conversión con el closer), tres etapas en el embudo, el panel «Por closer» y las claves `pasaron`, `closer_asistieron`, `closer_cerraron` y `cl:<closer>:<cuenta>` para abrir cada lista. Respeta el período y la persona.
  - Si el closer reagenda el pase, se sigue la cadena hasta la agenda en pie (si no, contaría como asistencia perdida). Probado en producción (solo lectura, 01/10–02/11): 27 agendas, 10 pases (todos a Jean Carlo), ninguno con asistencia todavía.
- **2 de Noviembre de 2026 (Closing: el embudo en agendas directas y desde triage, con un close rate cada una)** *([triage_pases.py](../../app/services/triage_pases.py), [cierres_reales.py](../../app/services/cierres_reales.py), [comercial_analitica.py](../../app/services/comercial_analitica.py), [Embudo.jsx](../../frontend/src/pages/comercial/components/Embudo.jsx), [CloseRatesCanales.jsx](../../frontend/src/pages/comercial/components/CloseRatesCanales.jsx))*: pedido del director comercial.
  - Cada barra del embudo de Closing se parte en dos colores: agendas directas (llegaron al closer) y agendas desde triage (`agenda_triage_id`, o reagenda de un pase). Leyenda con la cifra de cada parte; las partes suman el total. Respeta período, persona/closer y segmento. Una parte en cero no se dibuja.
  - Bajo el embudo, tres close rates reales: total, directas y desde triage (cierres por cobro, completo + split, sin señas, ÷ asistieron + cierres de llamadas anteriores).
  - Todo clicable: cada parte y la leyenda abren Agendas con la faceta nueva «Origen»; los cierres de cada close rate abren el modal de cobros filtrado por canal; los asistieron, la lista de Agendas.
  - Sin migración. ADR-W067. Sin tests ni probado en producción: solo se revisó que el código compile.
- **2 de Noviembre de 2026 (Reagendar, no asistir y cancelar piden un motivo escrito)** *([motivo_estado_service.py](../../app/services/motivo_estado_service.py), [closer_service.py](../../app/services/closer_service.py), [ficha_acciones_service.py](../../app/services/ficha_acciones_service.py), [triage_service.py](../../app/services/triage_service.py), [motivoEstado.js](../../frontend/src/utils/motivoEstado.js), [ADR-W066](../DECISIONS.md))*:
  - Marcar a mano «Reagendado», «No Show» o «Cancelado» pide el porqué («¿Por qué se reagenda?», «¿Por qué no asistió?», «¿Por qué se canceló?»): texto de 10 caracteres o más, con el botón de guardar apagado hasta que alcance. Queda como nota en Comunicación, con quién la escribió y el estado.
  - Dónde: el árbol de Resultado del closer (un cuadro por rama, reemplaza el detalle opcional), el reporte del triage, Reprogramar y «Canceló» de Confirmación, «Corregir estado» del historial y del modal del dashboard comercial, el modal de Agenda de Leads, la auditoría de leads, el Tablero de Agendas y el triage viejo.
  - El backend lo exige en todas esas puertas y en el write del mazo, el lote y el resultado previo del closer; el lote rechaza estos tres estados. No lo piden las reagendas y cancelaciones automáticas (link del lead, Google Calendar, duplicadas).
  - Sin migración. Los tests viejos de estos flujos quedan por ajustar (ver pendientes).
- **2 de Noviembre de 2026 (Triage de Dirección: filtros como los de Closing, color por closer y tarjetas simétricas; el embudo de Closing con el aspecto del de Triage)** *([DashboardComercial.jsx](../../frontend/src/pages/comercial/DashboardComercial.jsx), [TriageDireccion.jsx](../../frontend/src/pages/comercial/components/TriageDireccion.jsx), [TriagePaneles.jsx](../../frontend/src/pages/comercial/components/triage/TriagePaneles.jsx), [Embudo.jsx](../../frontend/src/pages/comercial/components/Embudo.jsx), [triage_service.py](../../app/services/triage_service.py), [ADR-W068](../DECISIONS.md))*:
  - Triage usa la misma barra de arriba que Closers y Setters: período (Hoy, Ayer, 7 y 30 días, Este mes, Mes pasado, 90 días y Personalizado), «Todo el equipo» (las personas de triage) y el filtro de segmentos A/B/C/D/sin. `GET /api/triage/metricas` acepta `segmento`; los segmentos suman las agendas totales. El período por defecto pasa a «Este mes».
  - El embudo ya no repite «Pasaron» (son los calificados): el grupo «Lo que pasó a closing» arranca en «Asistieron». «Asistieron» y «Cerraron» se parten por closer, cada uno con su color (leyenda con el nombre) y cada parte abre las llamadas de ese closer; el mismo color va en «Por closer».
  - Las seis tarjetas: cuatro iguales arriba y las dos del closer (asistencia y conversión) del doble de ancho abajo, con su barra.
  - El embudo de Closing toma el aspecto del de Triage: barras redondeadas más altas, sin cuello entre una y otra y «N de M» bajo cada una (solo con los dos canales; el de Setters no cambia).
- **2 de Noviembre de 2026 (Close rate general y del período, los dos a la vista)** *([CloseRatesCanales.jsx](../../frontend/src/pages/comercial/components/CloseRatesCanales.jsx), [CierresReales.jsx](../../frontend/src/components/dashboard/CierresReales.jsx))*: en el embudo, cada close rate (total, directas y desde triage) muestra dos columnas: «General» (cierres ÷ asistieron + llamadas anteriores que cerraron) y «Del período» (solo las llamadas de este período, `del_periodo` ÷ asistieron). En la tarjeta Cierre, bajo el close rate real, se suma «Close rate del período» con su cuenta. Solo frontend: los datos ya venían en `cierres.reales`.

- **3 de Noviembre de 2026 (Hiring: preguntas que se arrastran y se borran, WhatsApp con código de país)** *([EditorPreguntas.jsx](../../frontend/src/pages/admin/hiring/components/forms/EditorPreguntas.jsx), [hiring_forms.py](../../app/services/hiring_forms.py), [ADR-W069](../DECISIONS.md))*:
  - Talent › Forms: cada pregunta se arrastra desde su asa a cualquier lugar (pasa al bloque donde cae).
  - Se pueden eliminar las preguntas originales (menos el nombre y las que tienen una condicional que depende de ellas); al final de la lista se recuperan. Para el score, una borrada cuenta como apagada.
  - Sin pregunta de país, el país de la postulación sale del código del WhatsApp (`pais_de_whatsapp`).
  - Va junto con institute-site: el WhatsApp tiene selector de código de país, que arranca en el país detectado.
- **3 de Noviembre de 2026 (Hiring: el tipo de cualquier pregunta se cambia)** *([formularios.js](../../frontend/src/pages/admin/hiring/lib/formularios.js), [ADR-W070](../DECISIONS.md))*:
  - El selector de tipo ya no está bloqueado en las originales (solo en el nombre). Una original que cambia de tipo pasa a ser nueva: sus respuestas van aparte y deja de sumar al score.
- **3 de Noviembre de 2026 (Hiring: editor de preguntas en dos columnas)** *([EditorPreguntas.jsx](../../frontend/src/pages/admin/hiring/components/forms/EditorPreguntas.jsx), [PanelPregunta.jsx](../../frontend/src/pages/admin/hiring/components/forms/PanelPregunta.jsx), [ADR-W071](../DECISIONS.md))*:
  - Lista de preguntas a la izquierda (se arrastran y se prenden o apagan desde la fila) y la configuración de la elegida en un panel a la derecha, con el tipo como fichas con ícono.
  - Sin la nota «Pregunta original» ni el chip «Nueva». Las borradas se recuperan en «Eliminadas».
- **3 de Noviembre de 2026 (Hiring: límites excluyentes en las preguntas numéricas)** *([PanelPregunta.jsx](../../frontend/src/pages/admin/hiring/components/forms/PanelPregunta.jsx), [hiring_form.py](../../app/models/hiring_form.py), [ADR-W072](../DECISIONS.md))*:
  - Una pregunta de tipo número (expectativa salarial, edad…) tiene «Descarta si es menor a / mayor a». Fuera del rango, la postulante va a la pantalla de descarte y el panel la marca como cortada por el formulario.
  - Va junto con institute-site, que aplica el rango en el formulario.
- **3 de Noviembre de 2026 (Hiring: pulido del editor de preguntas)** *([PanelPregunta.jsx](../../frontend/src/pages/admin/hiring/components/forms/PanelPregunta.jsx), [editorPreguntas.css](../../frontend/src/pages/admin/hiring/components/forms/editorPreguntas.css), [ADR-W073](../DECISIONS.md))*:
  - Tipos «Correo electrónico» y «Dinero». El tipo se elige en un desplegable con íconos.
  - «Activa» y «Obligatoria» junto al tipo; el panel con aura de marca, campos con espaciado parejo y notas sin recuadro.
  - La fila elegida se marca con un tono suave en lugar del borde rosa; el foco se ve solo con teclado y en rosa, sin los recuadros azules.
- **3 de Noviembre de 2026 (Hiring: opciones necesarias en varias opciones)** *([PanelPregunta.jsx](../../frontend/src/pages/admin/hiring/components/forms/PanelPregunta.jsx), [assistant_application.py](../../app/models/assistant_application.py), [ADR-W074](../DECISIONS.md))*:
  - En una pregunta de varias opciones, cada opción se puede marcar como «Necesaria». Si la postulante no marca todas las necesarias, va a la pantalla de descarte (puede marcar otras además) y el panel la muestra cortada por el formulario.
  - Va junto con institute-site, que aplica la regla en el formulario.
- **3 de Noviembre de 2026 (Hiring: segunda pasada de diseño del editor de preguntas)** *([PanelPregunta.jsx](../../frontend/src/pages/admin/hiring/components/forms/PanelPregunta.jsx), [editorPreguntas.css](../../frontend/src/pages/admin/hiring/components/forms/editorPreguntas.css))*:
  - Panel sin borde ni brillo rosa; más aire entre la cabecera del formulario y la lista; número de la pregunta en blanco.
  - «Texto de ayuda» pasa a «Descripción»; los textos crecen solos (sin la manija de tamaño) y hay menos rótulos.
  - Al elegir una pregunta, el número aparece y los bloques del panel entran en cascada; las filas se corren apenas al pasar el mouse.
- **3 de Noviembre de 2026 (Hiring: las opciones de una pregunta se ordenan arrastrando)** *([PanelPregunta.jsx](../../frontend/src/pages/admin/hiring/components/forms/PanelPregunta.jsx))*:
  - Cada opción se arrastra desde su letra (al pasar el mouse muestra el asa); las letras se reacomodan y las marcas de necesaria o excluyente viajan con la opción.
- **3 de Noviembre de 2026 (Hiring: el nombre de cada bloque se edita)** *([EditorPreguntas.jsx](../../frontend/src/pages/admin/hiring/components/forms/EditorPreguntas.jsx))*:
  - Clic en el nombre del bloque en la lista (Experiencia, Idiomas…) para cambiarlo; se aplica a las preguntas de ese tramo y es lo que la postulante ve arriba de cada pregunta. Hasta 60 caracteres (lo valida el backend).
- **3 de Noviembre de 2026 (Hiring: sin variantes de texto por país)** *([PanelPregunta.jsx](../../frontend/src/pages/admin/hiring/components/forms/PanelPregunta.jsx), [hiring_forms.py](../../app/services/hiring_forms.py))*:
  - El editor ya no muestra «Si vive en Brasil»; la API pública no manda `t_pais`/`h_pais` (las guardadas quedan sin efecto) y el formulario de institute-site usa siempre el mismo texto para todos.
- **3 de Noviembre de 2026 (Hiring: arreglos del editor y sin reales)** *([EditorPreguntas.jsx](../../frontend/src/pages/admin/hiring/components/forms/EditorPreguntas.jsx), [formularios.js](../../frontend/src/pages/admin/hiring/lib/formularios.js))*:
  - Con títulos largos la lista se ensanchaba por debajo del panel (pista de grilla sin `minmax(0,1fr)`): arreglado.
  - Una pregunta de la que depende otra ya se puede eliminar: las que dependían quedan apagadas y sin condición, y el panel lo avisa antes.
  - Fuera el equivalente en reales: la API no publica `ref` y el formulario de institute-site no lo muestra; el editor ya no pide la tasa.
- **3 de Noviembre de 2026 (Closer: el reporte de no asistió, canceló y reagenda pide solo un cuadro de texto)** *([arbolResultado.preguntas.js](../../frontend/src/components/ficha/arbolResultado.preguntas.js), [arbolResultado.payload.js](../../frontend/src/components/ficha/arbolResultado.payload.js))*:
  - Se quitan las opciones fijas de motivo; queda un único cuadro obligatorio (10+ caracteres) por rama, que viaja como `motivo_estado` y se anota en Comunicación.
  - El subestado del seguimiento se recorta a 180 caracteres (`seguimiento_sub` es String(255)): un motivo largo ya no rompe el guardado.
  - Contrato front/back (`reportes.json`) regenerado; pruebas del reporte ajustadas.
- **3 de Noviembre de 2026 (Hiring: la ficha de la postulación sigue al formulario)** *([SeccionesFicha.jsx](../../frontend/src/pages/admin/hiring/components/SeccionesFicha.jsx), [hiring_ficha.py](../../app/services/hiring_ficha.py), [ADR-W075](../DECISIONS.md))*:
  - La ficha muestra una tarjeta por bloque del formulario (con ícono), cada respuesta con el ícono de su tipo; varias opciones como etiquetas; textos largos con «Ver todo» y copiar; la respuesta que corta, en rojo.
  - Contacto aparte (correo y WhatsApp con copiar, abrir WhatsApp, país, edad, CV). Sin la píldora del video.
- **3 de Noviembre de 2026 (Hiring: score por puntos del formulario)** *([hiring_puntaje.py](../../app/services/hiring_puntaje.py), [PuntajePregunta.jsx](../../frontend/src/pages/admin/hiring/components/forms/PuntajePregunta.jsx), [ADR-W076](../DECISIONS.md))*:
  - Cada opción vale 0 a 3 pts (en las de varias opciones suman con tope 3), las numéricas puntúan por tramos y cada pregunta tiene importancia ×0 a ×3. Score = promedio ponderado, 0-100. Con puntos en el formulario reemplaza a la rúbrica de Clarity.
  - Los puntajes no se publican en el formulario. `scripts/puntajes_asistente_ejecutiva.py` carga los iniciales de «Asistente Ejecutiva».
- **3 de Noviembre de 2026 (Hiring: ficha de la postulación con el diseño nuevo)** *([HiringCandidateModal.jsx](../../frontend/src/pages/admin/hiring/components/HiringCandidateModal.jsx), [PanelDecision.jsx](../../frontend/src/pages/admin/hiring/components/PanelDecision.jsx), [ADR-W077](../DECISIONS.md))*:
  - Contacto en cápsulas con copiar, secciones en dos columnas con color e ícono, puntos por pregunta y panel de decisión fijo con el score y su desglose por sección.
  - «Próxima a revisar» muestra las secciones con más puntos en vez de los criterios viejos.
- **3 de Noviembre de 2026 (Hiring: el cierre de la búsqueda se configura por formulario)** *([CierreFormulario.jsx](../../frontend/src/pages/admin/hiring/components/forms/CierreFormulario.jsx), [hiring_forms.py](../../app/api/hiring_forms.py), [ADR-W078](../DECISIONS.md))*:
  - En la cabecera del formulario: «Cierre» con Fecha fija (la misma para todos), Por visita (N horas desde la primera visita) o Sin cuenta. Se guarda solo.
  - Migración `c4e6a8b0d2f4`: `hiring_forms.cierre_modo`, `cierre_en`, `cierre_horas`. La API pública manda `cierre` y la página de la vacante lo usa para su reloj (va con institute-site).
- **3 de Noviembre de 2026 (Dirección comercial: el motivo de No show, Canceló y Reagendó se lee al pasar el mouse)** *([motivos_agenda.py](../../app/services/motivos_agenda.py), [MotivoDeEstado.jsx](../../frontend/src/pages/comercial/components/MotivoDeEstado.jsx), [Tip.jsx](../../frontend/src/pages/comercial/components/Tip.jsx))*:
  - En Revisar › Agendas, el chip de esos estados muestra en un globito el motivo, quién lo escribió, cuándo y (si se reagendó) la cita nueva; hay además una columna «Motivo» con el texto, que también sale en la exportación.
  - Lo marcado antes del 02/11 muestra «Sin motivo registrado»; las reagendas automáticas muestran la nota del sistema.
  - Se borra la función `registrar_de_persona`, que estaba repetida en `motivo_estado_service.py`.
- **3 de Noviembre de 2026 (Marketing: se abre la ficha del lead desde las listas de cifras)** *([ficha_de_fila.py](../../app/services/ficha_de_fila.py), [useFichaDeFila.jsx](../../frontend/src/pages/admin/marketing/anuncios/useFichaDeFila.jsx), [__init__.py](../../app/api/ficha/__init__.py))*:
  - Tocar una fila de las listas de Setting, Workshop y Otras (agendas, cobros, entradas por palabra clave, Resumen de Workshop) abre la ficha del lead encima de la lista, solo para leer; Escape o cerrar vuelven a la lista.
  - El director de marketing entra a la ficha solo con lectura (el servidor rechaza cualquier escritura) y abrir un cliente sin agenda no le crea una.
- **3 de Noviembre de 2026 (Pruebas: se arreglan las desactualizadas de la ficha, Marketing y Workshop)**:
  - 46 pruebas del frontend de la ficha, 17 de Marketing, 8 de Workshop y 23 del servidor (ficha, triage, motivos y contrato) vuelven a pasar; ninguna reveló un bug de la app. Quedan en verde 622 de vitest y 434 de pytest en esas carpetas.
  - La regla de pendientes del flujo de trabajo deja de mandar a `pendientes_santi.md`: lo resoluble se resuelve y lo abierto va a Leadership.
- **3 de Noviembre de 2026 (Reasignar un lead le pasa también sus ventas)** *([ficha_acciones_service.py](../../app/services/ficha_acciones_service.py), [sale_service.py](../../app/services/sale_service.py), [ADR-W081](../DECISIONS.md))*:
  - Al reasignar el closer desde la ficha, las ventas activas del lead que eran del closer anterior pasan al nuevo: le aparecen en «Mis ventas», en su deuda y en sus clientes. Los pagos siguen con quien los cobró.
  - La nota de la bitácora del lead dice qué ventas pasaron.
  - Se pasaron a mano a Jean Carlo las ventas de David Hernandez (era de Mario) y José Manuel Oliva (era de Gabriel), que él ya se había reasignado.
- **3 de Noviembre de 2026 (Cargar un upsell: la opción se ve y el aviso ya no lo desaconseja)** *([arbolResultado.preguntas.js](../../frontend/src/components/ficha/arbolResultado.preguntas.js), [sales_consistency_service.py](../../app/services/sales_consistency_service.py))*:
  - «¿Qué estás registrando?» dice «Una venta nueva, renovación o upsell», y «Un pago de algo que ya compró» aclara que si renueva o pasa a otro programa es venta nueva. Mario había cargado un upsell como cuota por ese camino.
  - El aviso de «¿Cómo paga?» ya no dice «no corresponde Upsell» cuando el alumno no compró el programa nuevo: alcanza con que haya comprado cualquier otro. La renovación sigue pidiendo una venta del mismo programa.
- **2 de Noviembre de 2026 (El interno sin dinero va al triage)** *([segmentos_formulario.py](../../scripts/segmentos_formulario.py), [backfill_segmentos.py](../../scripts/backfill_segmentos.py), [ADR-W084](../DECISIONS.md))*:
  - En el formulario «Sesión de Aceleración», «Soy estudiante o estoy en mi internado» se separa en «Soy estudiante» y «Estoy en mi internado». Solo el estudiante sin dinero va a la página de gracias; el interno sin dinero va al triage (caso Mitzia Vazquez). El formulario vivo ya estaba guardado; los internos que quedaron como «No calificó» antes se pasan a mano.
- **3 de Noviembre de 2026 (Hiring: pulido del diseño de la ficha)** *([SeccionesFicha.jsx](../../frontend/src/pages/admin/hiring/components/SeccionesFicha.jsx), [IconosSeccion.jsx](../../frontend/src/pages/admin/hiring/components/IconosSeccion.jsx), [PanelDecision.jsx](../../frontend/src/pages/admin/hiring/components/PanelDecision.jsx))*:
  - Cada sección muestra solo su título, más grande y en tipo oración («Inteligencia artificial»), sin bajada. Preguntas en letra fina y respuestas en semibold.
  - El score ya no se corta en el panel (la tarjeta se encogía); número más grande y desglose con los nombres de sección en tipo oración.
  - Íconos propios duotono para Excluyentes, Deseables, Inteligencia artificial y Cualitativo, con el trazo que se dibuja al abrir.
- **3 de Noviembre de 2026 (Talent en el teléfono)** *([talentMovil.css](../../frontend/src/pages/admin/hiring/talentMovil.css))*:
  - Dock: ocupa el ancho de la pantalla y muestra solo íconos; entran las seis secciones, el orbe y la sesión sin que la sesión tape secciones.
  - Inbox: buscador y filtro en una fila, pestañas debajo; en «Próxima a revisar» el score va al lado del nombre y «Abrir postulación» ocupa el ancho.
  - Ficha: arriba el score con el desglose (excluyentes, deseables, IA…) y el perfil con la pretensión; después las secciones; los botones de decisión quedan fijos abajo. Nombre, flechas y cerrar en una fila; el contacto (WhatsApp, correo, CV) en otra que se desliza.
- **3 de Noviembre de 2026 (Talent en el teléfono, segunda vuelta)** *([talentMovil.css](../../frontend/src/pages/admin/hiring/talentMovil.css), [AlDia.jsx](../../frontend/src/pages/admin/hiring/components/AlDia.jsx))*:
  - Dock como la barra de iOS: más alto, íconos grandes de trazo fino y el nombre de cada sección debajo; la activa en rosa y con su cuenta.
  - Inbox: Online es la primera pestaña y la que se abre; Híbridos aparece solo si hay alguna. En el teléfono no se muestra «Avance de la revisión».
  - Sin nadie por revisar ya no se repite el aviso (la tarjeta «Al día» y «Revisaste todas las online»): queda uno solo, con un check animado.
- **3 de Noviembre de 2026 (El lead que pasa del triage sube de segmento y ya no se le agenda encima)** *([triage_service.py](../../app/services/triage_service.py), [subir_segmento_pases.py](../../scripts/subir_segmento_pases.py), [ADR-W085](../DECISIONS.md))*:
  - Al pasar al closer, el segmento de la agenda de closing sube: C→A y D→B. Antes se copiaba el C/D y el evento nacía «Disponible» en Google, así que el pase de otro lead podía caer en el mismo horario (Astolfo y Cristina con Jean Carlo el 04/11 a las 23:30).
  - Se corrigieron las 5 agendas futuras de Jean Carlo que ya habían pasado del triage: segmento subido y evento de Google ocupado.
- **3 de Noviembre de 2026 (Margen de 15 minutos también en las Momentum y en la carga manual)** *([momentum.py](../../app/agendas_v2/momentum.py), [agenda.py](../../app/api/external/agenda.py), [manual.py](../../app/agendas_v2/manual.py), [ADR-W086](../DECISIONS.md))*:
  - La Momentum deja después el margen del closer, igual que las del link, y ya no se puede reservar pegada a otra llamada ni encima de una que empezó antes: se mira que los horarios se pisen, no solo que empiecen a la misma hora.
  - Los horarios que se le ofrecen a la Academia para la Momentum ya respetan el margen de las llamadas de Work.
  - La llamada cargada a mano, cuando no sale de otra agenda, dura y deja el margen de la sesión de quien atiende.
- **3 de Noviembre de 2026 (Marketing: eliminar leads de prueba con su pago y modo Completa)** *([lead_prueba_service.py](../../app/services/lead_prueba_service.py), [ModalEliminarLead.jsx](../../frontend/src/components/ficha/piezas/ModalEliminarLead.jsx), [VerRegistros.jsx](../../frontend/src/components/standard/VerRegistros.jsx))*:
  - Tacho en cada fila de agenda de las listas de cifras y papelera en la ficha: la confirmación dice qué se borra; si el lead tiene pago o venta de prueba, ofrece «Eliminar lead, pago y venta» (dirección y director de marketing). Pueden eliminar la dirección, el director de marketing, los closers y triage; una suscripción lo frena.
  - Las listas de registros tienen un tercer modo, «Completa», a pantalla completa (se recuerda).
  - La ventana de agendas de un taller también abre la ficha al director de marketing.
- **4 de Noviembre de 2026 (Las fechas de Mis datos, en la zona de quien mira)** *([user_time_service.py](../../app/services/user_time_service.py), [comercial_service.py](../../app/services/comercial_service.py), [closer_service.py](../../app/services/closer_service.py))*:
  - Un closer que filtraba del 1 al 4 veía agendas del 31: el rango se comparaba en UTC y una llamada de las 20:30 de su hora cae en el día siguiente en UTC. Ahora los períodos («Hoy», «Este mes», personalizado) y sus límites son los del día del usuario que mira, en Analizar, Revisar, Mi cartera y el dashboard del closer.
  - Lo que corre sin usuario (crons, scripts) sigue en UTC como antes.
- **4 de Noviembre de 2026 (Resumen del día antes de enviar el reporte del closer)** *([ResumenDelDia.jsx](../../frontend/src/pages/closer/components/ResumenDelDia.jsx), [cierre_dia_service.py](../../app/services/cierre_dia_service.py), [ADR-W088](../DECISIONS.md))*:
  - «Enviar reporte del día» abre un resumen con lo que se hizo y lo que falta: agendas sin resultado (y las que se guardaron hoy y siguen en Pendiente) y tareas atrasadas. «Corregir» abre Mi cartera ya filtrada por ese día y por Pendiente; «Enviar igual» manda el reporte.
- **4 de Noviembre de 2026 (País del lead en Dirección comercial y Marketing)** *([paises_lectura.py](../../app/services/paises_lectura.py), [paises_comercial.py](../../app/services/paises_comercial.py), [PanelPaises.jsx](../../frontend/src/pages/comercial/components/PanelPaises.jsx), [BarraPais.jsx](../../frontend/src/pages/comercial/components/BarraPais.jsx), [ADR-W089](../DECISIONS.md))*:
  - Filtro «País» en Analizar y Revisar (KPIs, Segmentos y listas) y panel «Por país» con agendas, show up, ventas y cash de cada uno; tocar un país lo filtra. El país sale del código del WhatsApp.
  - En Marketing, Todos › Segmentos se puede agrupar por País.
- **4 de Noviembre de 2026 (Segmento del lead visible y editable en la ficha)** *([ficha_segmento_service.py](../../app/services/ficha_segmento_service.py), [SegmentoLead.jsx](../../frontend/src/components/ficha/piezas/SegmentoLead.jsx), [ADR-W090](../DECISIONS.md))*:
  - La cabecera de la ficha muestra el segmento junto al nombre (también «Sin segmento») y se cambia con un menú; el cambio vale para toda la persona, queda marcado «manual» y anotado en la bitácora.
  - En el filtro «País» del dashboard comercial, «Ver todos» ahora cierra el menú.
- **4 de Noviembre de 2026 (Ajustes de país, Otras y el segmento de la ficha)** *([paises_lectura.py](../../app/services/paises_lectura.py), [segmentos_marketing_service.py](../../app/services/segmentos_marketing_service.py), [OrigenDeOtras.jsx](../../frontend/src/pages/admin/marketing/OrigenDeOtras.jsx), [SegmentoLead.jsx](../../frontend/src/components/ficha/piezas/SegmentoLead.jsx))*:
  - Segmento de la ficha: un círculo del color del segmento con su letra junto al nombre (punteado sin segmento); ya no desordena la línea de examen, llamada, closer, teléfono y fuente.
  - Marketing › Otras: se quitó «% de Otras» y se muestra «Con resultado», para que el show up (asistieron ÷ con resultado) se entienda: 5 agendas, 4 con resultado, 4 asistieron, 100%.
  - Marketing › Segmentos por país: los 352 leads de Workshop se repetían en cada país; ahora van una sola vez junto al número de grupos.
  - País: Renan Aguilera (+504) quedaba «Sin país» porque Honduras no estaba en la lista del formulario de agendas; se suman Guatemala, El Salvador, Honduras, Nicaragua, Cuba, Portugal, Italia y República Dominicana.
- **4 de Noviembre de 2026 (Revisar: Ventas en Setters y agrupar las ventas por setter)** *([tablasDef.js](../../frontend/src/pages/comercial/components/tablasDef.js))*:
  - Con el switch en Setters, Revisar suma la pestaña «Ventas» (las cobradas del equipo, con su fuente) junto a Leads entrantes y Agendas generadas.
  - La tabla de Ventas (en Setters y en Closers) se puede agrupar y filtrar por «Setter»: el de la fuente del cobro cuando entró por Setting («Setting · Elias»); el resto de las fuentes queda en «Sin setter». En la base de prueba: Elias 20 cobros ($8.239), Paula 6 ($875) y Sin setter 16 ($4.512).
- **4 de Noviembre de 2026 (Palabras clave: leads, agendas y ventas por conjunto de Meta)** *([anuncios_atribucion_service.py](../../app/services/anuncios_atribucion_service.py), [anuncios_service.py](../../app/services/anuncios_service.py), [metricas.js](../../frontend/src/pages/admin/marketing/anuncios/metricas.js), [ADR-W091](../DECISIONS.md))*:
  - El conjunto «Winners | Guía Gratis | MX+PE» mostraba gasto y ceros porque la palabra clave corre en cuatro conjuntos y todo lo demás iba al principal. Ahora las personas cuyo DM trae el anuncio de Meta se cuentan en el conjunto de ese anuncio (36 leads de GUIA GRATIS y 30 de GUIA PERU pasan a Winners en la base de prueba).
  - Lo que no trae anuncio queda en el conjunto principal; los totales de la tabla no cambian, y un pie lo explica.
- **4 de Noviembre de 2026 (Finanzas: pestaña Cobros)** *([Cobros.jsx](../../frontend/src/pages/comercial/components/finanzas/Cobros.jsx), [finance_cobros.py](../../app/api/public/finance_cobros.py), [ADR-W092](../DECISIONS.md))*:
  - Nueva pestaña Cobros en Finanzas: cada cobro del período con cliente, tipo de pago, procesador, bruto, neto y comisión. El neto lleva `*` si todavía es estimado.
  - Filtro por closer, buscador, totales (cobros, bruto, neto, comisiones) y descarga en CSV de lo filtrado, para cotejar con las transferencias reales.
- **4 de Noviembre de 2026 (Marketing: gasto de «LM Funnel» en OBTENER GUIA)** *([meta_ads_service.py](../../app/services/meta_ads_service.py))*
  - Los anuncios «Pide gratis al DM la guía…» de la campaña LM Funnel ya no van a GUIA STEPS, GUIA PERU ni GUIA GRATIS según el conjunto: su gasto va a OBTENER GUIA, que es con lo que entran sus leads (ADR-W093).
- **4 de Noviembre de 2026 (Finanzas › Cobros: cotejo contra los CSV)** *([Cobros.jsx](../../frontend/src/pages/comercial/components/finanzas/Cobros.jsx), [finance_cobros.py](../../app/api/public/finance_cobros.py), [ADR-W094](../DECISIONS.md))*:
  - Cada cobro muestra el neto del sistema, el neto según los CSV de Stripe y Hotmart y la diferencia, con su estado: coincide, neto distinto, otra pasarela, no está en el CSV, transferencia.
  - Las transferencias tienen un botón Aprobar que queda guardado. Los cobros de los CSV sin venta en el sistema aparecen como «Sin reportar».
  - Botón «Subir CSV» en la misma pestaña, filtro por estado y KPIs neto sistema, neto CSV, diferencia y para revisar. Se sacan las comisiones de las pasarelas.
- **4 de Noviembre de 2026 (Setter: ventas sin palabra clave junto a las agendas pendientes)** *([MisAgendas.jsx](../../frontend/src/pages/setter/agendas/MisAgendas.jsx), [VentasSinPalabra.jsx](../../frontend/src/pages/setter/agendas/VentasSinPalabra.jsx), [useVentasSinPalabra.js](../../frontend/src/pages/setter/agendas/useVentasSinPalabra.js))*
  - «Ventas sin palabra clave» ya no está al pie de la bandeja: va dentro de «Pendientes», debajo de las agendas, con un selector Todo · Agendas · Ventas (y el contador de la pestaña suma las dos). Las ventas ya asignadas están en «Completadas». El setter asigna ahí la palabra clave de cada venta de sus leads y Marketing suma esos ingresos a ese anuncio.
- **4 de Noviembre de 2026 (Todo en neto: Dirección comercial, closer, setter y admin)** *([ADR-W095](../DECISIONS.md), [comercial_analitica.py](../../app/services/comercial_analitica.py), [Revisar.jsx](../../frontend/src/pages/comercial/components/Revisar.jsx))*
  - Ingresos por fuente, Revisar › Ventas, los desgloses del Analizar, Variabilidad, Países, Reportar, el ranking, la composición del cash del closer y los widgets del panel admin muestran el cash en neto. El ticket promedio se ve en bruto y en neto.
  - Un ⚠ junto al monto de Revisar › Ventas avisa cuando Marketing y la lista no cuentan un pago igual (Setting sin palabra clave, o con palabra clave pero de otra fuente).
- **4 de Noviembre de 2026 (Marketing: la venta hereda la palabra clave de la agenda)** *([anuncios_service.py](../../app/services/anuncios_service.py), [ADR-W096](../DECISIONS.md))*
  - Si ManyChat y el Inbox no encuentran la palabra clave de una venta, toma la que el setter ya le puso a la agenda del mismo cliente. Las ventas viejas sin palabra clave que siguen pendientes (24 de Elias, 1 de Paula en producción) se asignan a mano en Mis agendas › Pendientes › Ventas.
- **4 de Noviembre de 2026 (Triage: asistencia sobre llamadas con resultado, pendientes del closer, señas y cash)** *([triage_service.py](../../app/services/triage_service.py), [triage_pases.py](../../app/services/triage_pases.py), [TriagePaneles.jsx](../../frontend/src/pages/comercial/components/triage/TriagePaneles.jsx), [ADR-W097](../DECISIONS.md))*
  - El % de asistencia es asistieron ÷ (asistieron + no show); las llamadas sin reportar y las que aún no ocurren se ven aparte en la tarjeta y abren su lista. Lo mismo en la dona, el embudo y Por persona.
  - Asistencia al closer separa asistieron, no asistieron y pendientes de llamada (chips «Pendiente de llamada con X», «Sin reporte de X», «No asistió al closer»). «Por closer» suma Señas y Cash.
- **4 de Noviembre de 2026 (Ficha: el reporte del triage se guarda junto y se verifica)** *([triage_service.py](../../app/services/triage_service.py), [BarraGuardado.jsx](../../frontend/src/components/ficha/piezas/BarraGuardado.jsx), [ADR-W098](../DECISIONS.md))*
  - El reporte de la llamada guarda resultado y calificación juntos, completa un pase ya creado y vuelve a leer la agenda para confirmar. La ficha muestra la hora de la última lectura del servidor y el botón «Verificar guardado».
- **4 de Noviembre de 2026 (Setter y Marketing: una palabra clave por persona y ventas por mes)** *([anuncios_service.py](../../app/services/anuncios_service.py), [MisAgendas.jsx](../../frontend/src/pages/setter/agendas/MisAgendas.jsx), [ADR-W099](../DECISIONS.md))*
  - Todos los pagos de una persona llevan la misma palabra clave (la del primero que la tiene): una seña pagada antes de escribir la palabra ya no sale «Sin palabra clave» cuando el parcial sí la tiene. Las agendas anteriores a la primera interacción también la toman.
  - En Mis agendas, las ventas siguen el filtro de mes como las agendas, y cada chip de mes suma las agendas y las ventas que faltan.
- **4 de Noviembre de 2026 (Finanzas › Cobros: cabecera fija y CSV de octubre cargados)** *([Cobros.jsx](../../frontend/src/pages/comercial/components/finanzas/Cobros.jsx), [finanzas.css](../../frontend/src/pages/comercial/components/finanzas/finanzas.css), [ADR-W100](../DECISIONS.md))*
  - La cabecera de la tabla queda fija al bajar y cada columna dice qué es debajo del nombre.
  - Se subieron a producción los CSV de octubre (Stripe, Hotmart y el Hotmart completo desde el 01/10): 31 coinciden, 14 con neto estimado distinto (−$10,08 en total), 2 transferencias por aprobar y Javier Carpintero ($250, Stripe) sin cobro en el CSV.
- **4 de Noviembre de 2026 (Marketing: el cruce por segmento sin ceros y con colores)** *([CruceSegmentos.jsx](../../frontend/src/pages/admin/marketing/todos/CruceSegmentos.jsx), [segmentos.css](../../frontend/src/pages/admin/marketing/todos/segmentos.css))*
  - Los grupos sin nada en la cifra elegida (ni en el período comparado) no se dibujan; un pie dice cuántos son. Si no queda ninguno, avisa.
  - Cada número lleva el color de su segmento (A verde, B azul, C ámbar, D magenta, sin segmento gris, total magenta) con más fuerza cuanto más alto es frente al resto de su columna, y el cero se apaga. También lo ve el panel de Segmentos del Analizar.
- **4 de Noviembre de 2026 (Países: República Dominicana y el teléfono del cliente)** *([paises_lectura.py](../../app/services/paises_lectura.py))*
  - Un WhatsApp dominicano llega a veces sin el «1» (`+829 470 1148`) y quedaba en «Sin país»: ahora los códigos de área 809, 829 y 849 son República Dominicana con o sin el «1».
  - Si el teléfono de la persona no se reconoce o no existe, se prueba con el de su cliente antes de dejarla en «Sin país».
- **4 de Noviembre de 2026 (Eliminar un lead de prueba que no tiene agenda)** *([escritura.py](../../app/api/ficha/escritura.py), [lead_prueba_service.py](../../app/services/lead_prueba_service.py), [BorrarLead.jsx](../../frontend/src/components/ficha/piezas/BorrarLead.jsx))*
  - Un lead que solo está en el libro de agendas (como Kerwin Quintero: 16 agendas del libro y ninguna propia) no tenía cómo eliminarse: la papelera y el tacho de las listas necesitaban una agenda. Ahora se elimina por su cliente (`DELETE /ficha/cliente/<id>/lead`, con su resumen previo), con los mismos permisos y bloqueos (pagos, ventas y suscripciones).
  - Las filas de las listas de Marketing que solo traen la persona ahora también traen su cliente, y por eso muestran el tacho.
- **4 de Noviembre de 2026 (Setter: «Es de Workshop» en las ventas)** *([ventas_palabra_clave_service.py](../../app/services/ventas_palabra_clave_service.py), [TarjetaVenta.jsx](../../frontend/src/pages/setter/agendas/TarjetaVenta.jsx))*
  - Una venta de la lista del setter que en realidad es del workshop (Alvaro Sarmiento Reyna, 24/07: su agenda figuraba a nombre de Elias) se saca con «Es de Workshop», con confirmación en la misma tarjeta: la fuente de la agenda que la originó pasa a «workshop» y el pago pierde su setter. Sale de las dos listas del setter y pasa a Workshop en Marketing y en Dirección. Solo la puede pasar el setter dueño de esas ventas.
- **4 de Noviembre de 2026 (Marketing: la «Tabla por grupo» sin ceros y con color)** *([TablaSegmentos.jsx](../../frontend/src/pages/admin/marketing/todos/TablaSegmentos.jsx), [bloquesSegmentos.jsx](../../frontend/src/pages/admin/marketing/todos/bloquesSegmentos.jsx))*
  - Un grupo sin nada en las columnas que se ven (ni en el período comparado) no se dibuja, y dentro de cada grupo tampoco los segmentos sin datos; un pie dice cuántos. «Sin país» con todo en cero ya no ocupa lugar.
  - Cada número lleva el color de su segmento, más fuerte cuanto más alto es frente al resto de su columna, y el cero se apaga: queda un mapa de calor parejo, como el del cruce.
- **4 de Noviembre de 2026 (Marketing: sin «Leads entrantes» cuando no tiene segmento)** *([SegmentosVista.jsx](../../frontend/src/pages/admin/marketing/todos/SegmentosVista.jsx))*
  - Al agrupar por país o por closer los leads no se parten por segmento: la cifra «Leads entrantes» ya no se ofrece en el cruce ni se dibuja su columna de «—» en las tablas. Vale para cualquier cifra sin dato en ningún grupo; los leads de Workshop (que sí traen total) se mantienen.
- **4 de Noviembre de 2026 (Marketing: el origen de cada agenda queda guardado y la venta lo hereda)** *([origen_service.py](../../app/services/origen_service.py), [backfill_origenes.py](../../scripts/backfill_origenes.py), [ADR-W101](../DECISIONS.md))*
  - Cada agenda guarda su conversación y palabra clave (Setting) o su taller (Workshop), y cómo se supo. La venta nueva apunta a su agenda; renovación y upsell heredan el origen de la primera venta nueva de la persona. Se fija cada 10 min para lo nuevo y con el backfill para lo viejo.
  - Marketing lee primero lo guardado y la regla de siempre queda de respaldo. La bandeja «Sin anuncio» deja de listar ventas que vinieron de un taller.
- **5 de Noviembre de 2026 (Notas de Meet: las notas de Gemini entran a Work)** *([notas_meet/](../../app/services/notas_meet/), [notas_meet.py](../../app/api/notas_meet.py), [TabReuniones.jsx](../../frontend/src/components/ficha/tabs/TabReuniones.jsx), [PanelIntegraciones.jsx](../../frontend/src/pages/operations/PanelIntegraciones.jsx), [ADR-W102](../DECISIONS.md))*
  - Operaciones suma la sección «Integraciones»: «Conectar con Google» conecta el Drive de la cuenta (o un link para que otra persona conecte la suya). Permiso `drive.readonly`: con `drive.meet.readonly` Google lista las notas pero no deja abrirlas.
  - Cada 15 minutos se bajan los Docs «Notas de Gemini» nuevos o editados a la tabla `meeting_notes` (migración `50726ef2bc21`) y se cuelgan de la agenda por el evento de Calendar o por el email del invitado. «Leer ahora» corre en segundo plano.
  - La ficha del lead suma la pestaña «Reuniones» con el resumen, la nota completa y los links al Doc y a la grabación.
- **5 de Noviembre de 2026 (API de notas de Meet para la Academia)** *([notas_meet.py](../../app/api/external/notas_meet.py), [agendas_v2_api.md](../agendas_v2_api.md), [ADR-W103](../DECISIONS.md))*
  - `/api/external/academy/notas`, con el token de la Academia: estado de la conexión, link para conectar el Drive que vuelve a la Academia, lectura en segundo plano, lista de notas filtrable por evento de la reserva, email del alumno, título, tipo y fechas, y cada nota con su contenido completo.
- **5 de Noviembre de 2026 (Notas de Meet: varias cuentas y categorías)** *([categorias.py](../../app/services/notas_meet/categorias.py), [conexion.py](../../app/services/notas_meet/conexion.py), [TarjetaCategoriasMeet.jsx](../../frontend/src/pages/agendas_v2/secciones/conf/TarjetaCategoriasMeet.jsx), [ADR-W104](../DECISIONS.md))*
  - Integraciones conecta varias cuentas de Google a la vez (santiago@, team@, mario@…): «Conectar otra cuenta» deja elegir cuál, cada una muestra sus notas y su última lectura y se desconecta sola. Una reunión que está en dos Drives queda una vez.
  - Cada nota tiene categoría: venta, sesión con estudiante, reunión del equipo, entrevista u otra. Work la pone solo y la tarjeta «Categorías de las reuniones» la cambia por reunión recurrente, para todas sus notas y las que vengan (migración `8c3e1f5a7b92`).
  - Se entienden los títulos de 2025 y las horas en «CST», y los calendarios de grupo ya no cuentan como invitados.
  - La API de la Academia filtra por categoría, serie y cuenta, y puede cambiar la categoría de una serie o de una nota.
- **5 de Noviembre de 2026 (El closer ya no cae en la agenda de triage al buscar un lead)** *([closer_followup_service.py](../../app/services/closer_followup_service.py), [ficha_pagos_service.py](../../app/services/ficha_pagos_service.py), [ADR-W105](../DECISIONS.md))*:
  - Jean Carlo no podía registrar la venta de Eugenia González: el buscador abría la agenda de triage de Dari («Show up» sin venta, seguimiento sin fecha) y Resultado mostraba el reporte de triage. Ahora quien no es triage no cae en una agenda de triage si el lead tiene otra.
  - Un pago cargado con «Agregar pago» sobre una agenda de triage queda a nombre de quien lo carga, no del triage.
  - La venta de Eugenia (RR parcial, USD 500) se pasó de Dari a Jean Carlo.
- **5 de Noviembre de 2026 (Cada pago se verifica con su comprobante)** *([comprobantes/](../../app/services/comprobantes/), [comprobantes.py](../../app/api/ficha/comprobantes.py), [ADR-W106](../DECISIONS.md))*:
  - El closer sube el comprobante del pago (imagen, PDF o CSV) al registrar la venta o después, desde Pagos en la ficha. Learnito lo lee y el pago queda verificado o no, con el motivo.
  - Diferencias: al subir el CSV de Stripe o Hotmart, lo que coincide queda verificado con el neto de la pasarela.
  - La nómina paga igual, pero marca lo no verificado; el closer ve el estado en cada pago, en Mis ventas, en el detalle de la venta y en su comisión del mes.
- **5 de Noviembre de 2026 (El CSV de la pasarela queda como evidencia, no verifica solo)** *([conciliacion.py](../../app/api/public/conciliacion.py), [ADR-W107](../DECISIONS.md))*:
  - Subir un CSV en Diferencias guarda sus filas y no cambia el estado de ningún pago: verificar es de Learnito, con el comprobante.
  - Se cargaron los CSV de Stripe y Hotmart de enero a octubre (los del cruce del 26/10) y 370 de los 377 pagos verificados quedaron atados a su archivo y su fila; 18 pendientes que coincidían exacto quedaron verificados.
- **5 de Noviembre de 2026 (Reagendar ya no duplica la agenda y el Calendar la sigue)** *([evento_sigue.py](../../app/agendas_v2/evento_sigue.py), [movidas.py](../../app/agendas_v2/movidas.py), [agendas_vigentes.py](../../app/services/agendas_vigentes.py), [ADR-W108](../DECISIONS.md))*:
  - Dari reagendó a Gerardo Morales desde Resultado y el evento de Google se quedó a la hora vieja; a los 15 minutos Work leyó ese evento como «movido» y devolvió la agenda a la hora vieja con otra fila: dos tarjetas en Confirmado.
  - Ahora, al reagendar desde Triage o Closing, corregir la fecha o el closer, reasignar o editar en el Tablero de Agendas, el evento se mueve a la hora nueva (o se recrea en el calendario del nuevo dueño) y al lead le llega el cambio. Una llamada que ya pasó no se toca.
  - La revisión cada 15 minutos ya no devuelve a la hora vieja una agenda que Work reagendó.
  - El tablero de confirmación muestra a cada persona una vez (la próxima llamada) y el «X de Y confirmados» cuenta lo mismo. La agenda anterior queda en el historial del lead.
- **6 de Noviembre de 2026 (Un no show descartado sigue contando como no show)** *([ficha_acciones_service.py](../../app/services/ficha_acciones_service.py), [ADR-W109](../DECISIONS.md))*:
  - En Resultado, «No show» y después «Descartar» guardaba la agenda como «Lead perdido» y el no show no se contaba en el show up ni en el close rate. Ahora queda como No show y el lead sale igual de los seguimientos, con una nota del descarte.
  - En producción hay 13 agendas que hicieron ese recorrido desde el 08/10 (entre ellas la 7075, del 04/11); se corrigen solo con el visto bueno de Kerwin.
- **6 de Noviembre de 2026 (Etiqueta «Descartado» en los no show)** *([noshow_descartado.py](../../app/services/noshow_descartado.py), [EtiquetaDescartado.jsx](../../frontend/src/components/shared/EtiquetaDescartado.jsx), [ADR-W110](../DECISIONS.md))*:
  - Se corrigieron en producción las 13 agendas de No show + Descartar que figuraban como «Lead perdido»: ahora cuentan como No show, cada una con una nota que guarda el valor anterior.
  - En Revisar y en Mis agendas del setter, un no show que el closer descartó (no respondió ningún mensaje) lleva la etiqueta «Descartado» al lado del estado.
  - En Analizar › Estados, el grupo No show dice cuántos fueron descartados y cuántos no.
- **6 de Noviembre de 2026 (Proyección con tendencia en el Simulador)** *([proyeccion_tendencia.py](../../app/services/proyeccion_tendencia.py), [Tendencia.jsx](../../frontend/src/pages/comercial/components/simulador/Tendencia.jsx), [ADR-W111](../DECISIONS.md))*:
  - En Simulador › Proyección, el panel «Cómo cierra el mes» proyecta seis cifras (agendas generadas, asistieron, agendas y entrantes de anuncios, ventas y cash de ventas nuevas) con lo que ya pasó, un rango y el mes anterior.
  - Cada cifra usa el modelo que menos se equivocó en una prueba hacia atrás con 4 semanas reales: ritmo de 30 o 60 días, regresión con día de la semana, con tendencia o el combinado. El botón «Cálculo actual» muestra el ritmo de siempre para comparar.
- **6 de Noviembre de 2026 (El show up sigue la regla de Mario)** *([comercial_vocabulario.py](../../app/services/comercial_vocabulario.py), [comercial_agendas.py](../../app/services/comercial_agendas.py), [ADR-W112](../DECISIONS.md))*:
  - El show up de Analizar (closers y setters), Revisar y Estados es ahora los que se presentaron sobre las agendas que se presentaron, cancelaron, reprogramaron o no se presentaron, contando cada agenda (también la 2ª llamada). Antes dejaba afuera canceladas y reprogramadas y contaba personas.
  - Octubre: closers 57,0 % → 57,5 %; Juliana baja de 50 % a 30 % por sus 4 cancelaciones.
- **6 de Noviembre de 2026 (Descartar no pisa el destino de la llamada)** *([ficha_acciones_service.py](../../app/services/ficha_acciones_service.py), [ADR-W113](../DECISIONS.md))*:
  - En Resultado, descartar a un lead que se presentó y no compró (o que canceló) ya no guarda «Lead perdido»: queda como Show up (o Cancelado) y el lead sale de los seguimientos con una nota del descarte. Así cuenta en el show up.
- **6 de Noviembre de 2026 (Agendas por palabra clave, por persona y por fecha de alta)** *([anuncios_service.py](../../app/services/anuncios_service.py), [ADR-W114](../DECISIONS.md))*:
  - El tablero de Marketing contaba como agenda nueva una cita que se volvía a crear al reagendar, y sumaba a Setting personas del Workshop. Ahora cuenta a cada persona que se agendó por Setting una vez, el día en que se agendó: el 05/11 pasa de 6 a 3 y los últimos 30 días de 149 a 128.
- **6 de Noviembre de 2026 (Una reagenda no suma agenda del setter)** *([comercial_agendas.py](../../app/services/comercial_agendas.py), [ADR-W115](../DECISIONS.md))*:
  - Las agendas generadas de los setters ya no cuentan otra vez a una persona que se reagenda: cuenta el día en que se agendó por primera vez. El 05/11 Setting pasa de 5 a 3 (Gerardo y Osvaldo eran del 04/11).
- **6 de Noviembre de 2026 (Una seña vieja no marca la llamada como Seña)** *([ventas_previas.py](../../app/services/ventas_previas.py), [comercial_agendas.py](../../app/services/comercial_agendas.py))*:
  - En Revisar › Agendas, una llamada queda en «Seña» solo si la seña se pagó del día de la llamada en adelante, igual que una venta. Ivette (seña del 05/05, cuota del 18/05, llamada del 10/07) salía como seña: el filtro pasa de 6 a 5.
- **6 de Noviembre de 2026 (Columna Triage en Revisar › Agendas)** *([triage_pases.py](../../app/services/triage_pases.py), [tablasDef.js](../../frontend/src/pages/comercial/components/tablasDef.js), [ADR-W116](../DECISIONS.md))*:
  - La lista de agendas muestra quién hizo el triage de cada llamada (Dari, Juliana) o «Directa», y se puede filtrar y ordenar por eso.
- **6 de Noviembre de 2026 (Asistieron del embudo de setting, sin las llamadas por venir)** *([setter_analitica.py](../../app/services/setter_analitica.py))*:
  - En el embudo de Setting, el porcentaje de Asistieron se mide sobre las agendas generadas cuya llamada ya llegó a su hora, no sobre todas: las que todavía no ocurrieron lo bajaban. Noviembre (1 al 6): equipo 36,4 % → 80 %, Elias 30 % → 60 %, Paula 41,7 % → 100 %. Octubre casi no cambia (37,9 % → 38,2 %).
- **6 de Noviembre de 2026 (Comparaciones en el embudo de setting)** *([DashboardSetters.jsx](../../frontend/src/pages/comercial/components/DashboardSetters.jsx), [comercial_analitica.py](../../app/services/comercial_analitica.py), [ADR-W117](../DECISIONS.md))*:
  - En Analizar › Setters, cada etapa del embudo de punta a punta muestra cuánto subió o bajó contra el período anterior (también en Anuncios e Inbound), y los paneles Conversión y Después de la agenda llevan las mismas flechas que las tarjetas de arriba.
- **7 de Noviembre de 2026 (/finanzas es la app de Finanzas)** *([FinanzasApp.jsx](../../frontend/src/pages/comercial/components/finanzas/app/FinanzasApp.jsx), [finance_liquidez.py](../../app/api/public/finance_liquidez.py), [ADR-W118](../DECISIONS.md))*:
  - /finanzas pasa a tener las vistas del artifact de payroll en el dock: Dashboard, Payroll, Comisiones, Diferencias y Profit, más Registros con las pestañas de siempre (integrantes, software, anuncios, medios de pago, CSV y cobros).
  - Funciona para cualquier mes o rango personalizado con la nómina, las comisiones, los cobros y los porcentajes de la plataforma. Con un rango se ve todo sumado; los pagos se marcan eligiendo un mes.
  - Cada persona del payroll guarda su estado (pendiente, en tránsito, pagado, revisar), sus pagos y descuentos, y se descarga su recibo en PDF. En Comisiones, cada venta se puede sacar del cálculo con «No cuenta».
  - Profit usa los saldos de las cuentas cargados con «Saldos» (tabla nueva `finance_liquidity`); lo que se paga después de cargarlos sigue restando.
  - Learnito con el isotipo animado, el widget «Falta pagar» junto al dock y la acción fijable «Copiar lo que falta pagar» en el menú.
  - Migración `c7d1f4a9e2b6`: columnas `status`, `movements` y `sent_at` en `monthly_payroll` y la tabla `finance_liquidity`.
- **7 de Noviembre de 2026 (Corregir un Instagram que ya tiene el mismo lead)** *([agenda_contacto_service.py](../../app/services/agenda_contacto_service.py), [ADR-W119](../DECISIONS.md))*:
  - Al corregir el Instagram de una agenda (palabra clave, mazo del setter, Tablero) con uno que ya tiene otra persona del mismo nombre, se unen en una sola y el Instagram mal escrito se da de baja. Antes daba «ya es de otra persona» y no dejaba corregirlo (caso Grecia Rojo, Elias). Con otro nombre sigue frenando y dice de quién es.
- **8 de Noviembre de 2026 (Hiring: la ficha de postulación entra sin scroll)** *([HiringCandidateModal.jsx](../../frontend/src/pages/admin/hiring/components/HiringCandidateModal.jsx), [fichaPostulacion.css](../../frontend/src/pages/admin/hiring/components/fichaPostulacion.css), [PanelDecision.jsx](../../frontend/src/pages/admin/hiring/components/PanelDecision.jsx))*:
  - Ficha más compacta: cabecera, tarjetas de sección, renglones, chips y botones más bajos; el score va en una línea con su estado y sin el rótulo «Decisión».
  - Si igual no entra (formulario largo o pantalla baja), la ficha se achica en bloque hasta entrar, hasta un 70 %; abrir un «Ver todo» la vuelve a medir. En el teléfono sigue con scroll.
  - Cabecera: el país con su bandera al lado del nombre, íconos de correo y WhatsApp en las cápsulas y el botón «Abrir CV» con el humo de marca.
- **8 de Noviembre de 2026 (Hiring: ficha con Cualitativo a la izquierda y la pretensión arriba)** *([SeccionesFicha.jsx](../../frontend/src/pages/admin/hiring/components/SeccionesFicha.jsx), [HiringCandidateModal.jsx](../../frontend/src/pages/admin/hiring/components/HiringCandidateModal.jsx), [fichaPostulacion.css](../../frontend/src/pages/admin/hiring/components/fichaPostulacion.css))*:
  - La pretensión salarial pasa a la cabecera, al lado del WhatsApp, en verde y grande; sale del bloque Perfil.
  - Cualitativo ocupa sola la columna izquierda (más angosta) y Excluyentes, Deseables e Inteligencia artificial van apilados en la del medio, más ancha. En el teléfono Cualitativo queda después de las otras.
- **8 de Noviembre de 2026 (Hiring: letra más grande en la ficha)** *([fichaPostulacion.css](../../frontend/src/pages/admin/hiring/components/fichaPostulacion.css))*:
  - Respuestas, preguntas, chips, títulos de sección, desglose del score y perfil, un punto o punto y medio más grandes.
- **8 de Noviembre de 2026 (Hiring: los textos de Cualitativo más grandes)** *([fichaPostulacion.css](../../frontend/src/pages/admin/hiring/components/fichaPostulacion.css))*:
  - Las respuestas largas (Experiencia previa, Cualidad diferencial, Persona indicada) pasan de 15 a 17 px, con más interlineado y más blancas.
- **8 de Noviembre de 2026 (Hiring: ficha con letra más grande que igual entra)** *([fichaPostulacion.css](../../frontend/src/pages/admin/hiring/components/fichaPostulacion.css))*:
  - Medida en una réplica a 1481 × 725: la ficha se achicaba al 79 % y las respuestas se veían de ~13,6 px. Ahora se achica al 93 % y se ven de ~16 px.
  - En la columna ancha, las respuestas cortas de Excluyentes y Deseables van de a cuatro por renglón; Cualitativo más angosto muestra 5 renglones de cada respuesta antes del «Ver todo».
  - Respuestas a 17 px, chips a 15, preguntas a 14 y títulos a 19; menos margen en cabecera, tarjetas y renglones. El panel del score y el perfil también más grandes.
- **8 de Noviembre de 2026 (Talent: la más barata primero)** *([vista.js](../../frontend/src/pages/admin/hiring/lib/vista.js), [HiringDashboardPage.jsx](../../frontend/src/pages/admin/hiring/HiringDashboardPage.jsx))*:
  - Las tablas de Talent (Inbox, Analyze, Winners) arrancan siempre ordenadas por lo que pide, menor primero; a igual pretensión, mejor score. Otro orden elegido dura lo que dura la visita.
  - «Próxima a revisar» es la que pide menos entre las sin analizar, y las flechas de la ficha siguen ese mismo orden.
- **8 de Noviembre de 2026 (Hiring: las respuestas largas de la ficha se leen de a una)** *([SeccionesFicha.jsx](../../frontend/src/pages/admin/hiring/components/SeccionesFicha.jsx), [fichaPostulacion.css](../../frontend/src/pages/admin/hiring/components/fichaPostulacion.css))*:
  - «Ver todo» abre una sola respuesta a la vez: la abierta pasa a 19,5 px y las otras de la sección quedan en un renglón, apagadas.
  - La columna de Cualitativo ya no decide el alto de la ficha: abrir una respuesta larga no achica el resto; si no entra, se desliza solo esa columna.
- **8 de Noviembre de 2026 (Talent: Inbox con la pretensión a la vista y solo aprobación y reserva)** *([ResumenInbox.jsx](../../frontend/src/pages/admin/hiring/components/ResumenInbox.jsx), [talent.css](../../frontend/src/pages/admin/hiring/talent.css))*:
  - «Próxima a revisar» muestra lo que pide grande y en verde, con «La más barata», al lado del score (antes era un chip más).
  - «Avance de la revisión» pasa a dos anillos: % de aprobación (seleccionadas + finalistas) y % de reserva, sobre las postulaciones con decisión. Cada uno abre su pestaña.
- **8 de Noviembre de 2026 (Hiring: el «Ver todo» de la última respuesta de Cualitativo se cortaba)** *([fichaPostulacion.css](../../frontend/src/pages/admin/hiring/components/fichaPostulacion.css))*:
  - La tarjeta de Cualitativo se encogía al alto de la columna y cortaba «Persona indicada» y su «Ver todo». Ahora no se encoge (si no entra, se desliza la columna) y cada respuesta cerrada muestra 4 renglones en vez de 5, así en una pantalla de 1481 × 725 entran las tres con su botón.
- **9 de Noviembre de 2026 (Analizar: Cash collected con el monto del período comparado)** *([Analizar.jsx](../../frontend/src/pages/comercial/components/Analizar.jsx), [comercial.css](../../frontend/src/pages/comercial/comercial.css))*:
  - El tile se llama «Cash collected» (es el neto). Debajo, en vez de bruto y comisión, va «VS $X»: lo que entró en el período comparado.
- **9 de Noviembre de 2026 (Analizar: una venta por lead, panel Cierre nuevo y embudo con el total por canal)** *([comercial_agendas.py](../../app/services/comercial_agendas.py), [comercial_analitica.py](../../app/services/comercial_analitica.py), [CierreComercial.jsx](../../frontend/src/pages/comercial/components/CierreComercial.jsx), [Embudo.jsx](../../frontend/src/pages/comercial/components/Embudo.jsx))*:
  - Error de datos: el pago es posterior a la 1ª y a la 2ª llamada del lead, y las dos quedaban en «Venta» (dos ventas por un cobro). Ahora la venta va solo en la última llamada con show up del lead; la seña igual, y no cuenta si el lead ya tiene la venta.
  - Panel Cierre: ventas, señas y no cerradas arriba; dos anillos con el close rate por llamada y por presentación (solo ventas) y «con señas» debajo; abajo el close rate de directas y desde triage (`cierres_canal`, mismas reglas).
  - Embudo: arriba el total de agendas y cuánto se lleva cada canal (número y %); sin las líneas de texto bajo las barras; las descartadas como chip. El close rate salió del embudo (se borró `CloseRatesCanales.jsx`).
- **9 de Noviembre de 2026 (Analizar: panel Cash rehecho, con CAC)** *([PanelCash.jsx](../../frontend/src/pages/comercial/components/PanelCash.jsx), [comercial_analitica.py](../../app/services/comercial_analitica.py))*:
  - Todo neto: sin fees ni bruto. Arriba el Cash collected con «vs» el período comparado y las barras por día.
  - Dos promedios: Ticket promedio y CAC (gasto de Meta en Setting y Workshop ÷ clientes nuevos, `datos.adquisicion`; solo con todo el equipo y sin segmento ni país), cada uno con su «vs».
  - Por cobrar a hoy: una barra partida en vencido, por vencer y sin cronograma, con monto y % de cada uno. Sin la tabla, la torta ni el texto de pie.
  - Panel Cierre: la tabla de directas / desde triage con una columna por cifra (Llamada, Present., + Señas) y rótulos que ya no se parten.
- **9 de Noviembre de 2026 (Analizar: la comparación dice contra qué compara)** *([PiezasAnalizar.jsx](../../frontend/src/pages/comercial/components/PiezasAnalizar.jsx), [PanelCash.jsx](../../frontend/src/pages/comercial/components/PanelCash.jsx), [CierreComercial.jsx](../../frontend/src/pages/comercial/components/CierreComercial.jsx))*:
  - Pieza única `Comparado`: el rótulo elegido en el selector VS («Período anterior», «Mes anterior», las fechas), el valor de entonces y la variación con flecha y color (en el CAC bajar es verde).
  - Va en el tile y el panel de Cash collected, el ticket promedio, el CAC y los dos close rates de Cierre (en puntos). El «▼ %» suelto de las cabeceras salió: ya está en la pieza.
- **9 de Noviembre de 2026 (Analizar: comparación más clara y Por cobrar en su propio panel)** *([PiezasAnalizar.jsx](../../frontend/src/pages/comercial/components/PiezasAnalizar.jsx), [PanelCash.jsx](../../frontend/src/pages/comercial/components/PanelCash.jsx), [PanelPorCobrar.jsx](../../frontend/src/pages/comercial/components/PanelPorCobrar.jsx))*:
  - `Comparado`: más contraste; la variación es relativa (de 11.8% a 6.1% es ▼ 48%, los puntos quedan en el tooltip) y lleva la cuenta del período comparado: «4/34» en los close rates, las ventas en el ticket, el gasto y los clientes en el CAC, la diferencia en plata en el Cash collected.
  - Por cobrar sale de Cash a un panel propio a lo ancho: total con clientes con saldo y con cuota vencida, barra partida tocable y una tarjeta por parte (monto, medidor y % del total).
  - Lo que abre una lista es una tarjeta-botón con flecha (`Tocable`): Cash collected, ticket promedio, el total y cada parte de Por cobrar.
- **9 de Noviembre de 2026 (Analizar: Segmentos rehecho, triage aparte de los closers)** *([SegmentosPanel.jsx](../../frontend/src/pages/comercial/components/SegmentosPanel.jsx), [segmentos_comercial.py](../../app/services/segmentos_comercial.py))*:
  - Lo central es el % de A, B, C y D: cada grupo es una barra al 100% partida por segmento (con el % adentro) y, debajo y finita, la del período comparado. Cifra a elegir: agendas, asistieron o ventas. Cada tramo abre su lista.
  - Arriba siempre el General: la barra grande y una tarjeta por segmento con su %, cuántas, el cambio en puntos de participación, show up y cierre.
  - Cortes: Closers, Triage, Setters, Fuente, Origen. Las agendas de las personas con rol triage salen de Closers y van a Triage. «Sin agrupar», las tablas y el cruce salieron.
- **9 de Noviembre de 2026 (Inbox: campaña «Setting Funnel · ROAS MAX» y log de cambios de campañas)** *([campanas.py](../../app/automatizaciones/campanas.py), ADR-W120)*:
  - Campaña 5 «Setting Funnel · ROAS MAX» (Meta 120249210694070532, flujo «Lead Magnet», reparto 60/40): PROTOCOLO, ACCESO, TRÍADA, VACÍO, DOCUMENTO 25, DOCUMENTO25, y movidas desde Winners (CURSO GRATUITO, APROBACIÓN, QUIERO APLICAR) y LM Funnel (GUÍA STEPS). Atiende DM y comentario.
  - `aut_campanas.cambios`: cada guardado anota quién, cuándo y qué cambió (palabras y Meta como agregadas/quitadas); `GET /api/inbox/campanas/<id>/cambios`. Migración `e8b2c4d6f1a3`.
- **9 de Noviembre de 2026 (Discord: un solo servicio y todo con imagen; ventas fuera de n8n, ADR-W121)** *([discord_avisos/](../../app/services/discord_avisos/), [aviso.html](../../app/templates/reports/aviso.html))*
  - Todos los avisos salen por `discord_avisos/envio.py` (webhook o el bot del equipo): en el texto, título, nombre y número para buscar; el resto en la tarjeta. Las agendas se ven igual (sus estilos pasaron a `_tarjeta.html`).
  - Venta o cobro: tarjeta con monto, programa, método, closer, origen, saldo, plan de cuotas y si convirtió una seña. A #wins siempre y a #onboardings si entra un alumno nuevo. Reemplaza al flujo «New Sales» de n8n.
  - Resultado de cada llamada (ficha, triage y mazo) a #onboardings: asistió, no asistió, canceló, reagendó o no cerró, con objeción, nota y próximo seguimiento. No repite un mismo resultado.
  - `POST /api/external/academy/discord/aviso`: la Academia manda por acá Onboarding, reactivación, Momentum, upsell y tours.
- **9 de Noviembre de 2026 (Meta Ads: miniatura y publicación de cada anuncio)** *([MiniaturaAnuncio.jsx](../../frontend/src/pages/admin/marketing/anuncios/MiniaturaAnuncio.jsx), ADR-W122)*:
  - Cada fila de anuncio en Campañas, conjuntos y anuncios muestra la miniatura del creativo; al tocarla se abre la publicación en Instagram. Migración `f3a5c7e9b1d4`.
- **9 de Noviembre de 2026 (Correo: los mails de la Academia salen por Work con Gmail, ADR-W123)** *([correo.py](../../app/services/correo.py))*
  - Conexión aparte de una cuenta de Google solo para enviar (team@), sin contraseña ni verificación en dos pasos, sin tocar Calendar ni las notas de Meet.
  - `POST /api/external/academy/correo`: la Academia manda el mail entero y Work lo envía. Reemplaza al flujo «Mail Academia» de n8n y hace andar «Olvidé mi contraseña».
- **9 de Noviembre de 2026 (Work deja de usar n8n, ADR-W124)** *([sheets_service.py](../../app/services/sheets_service.py))*
  - La venta ya no se manda al webhook de n8n. «Reenviar aviso» (antes «Reenviar webhook») y la corrección desde el mazo vuelven a mandar la tarjeta de la venta a Discord. En la ficha, la casilla dice «Avisar en Discord».
- **9 de Noviembre de 2026 (Discord: el triage no se avisa en #onboardings)** *([resultado.py](../../app/services/discord_avisos/resultado.py))*
  - El resultado de una llamada de triage ya no sale a #onboardings (por ninguna ruta: ficha ni mazo). Solo se avisan las llamadas de los closers.

### 09/11/2026 — Analizar sin llamadas de triage y CAC por closer
- `comercial_analitica._sin_triage`: con «Todo el equipo», el bloque de closers (embudo, estados, show up, close rates, variabilidad, fila Equipo de Comparativas) ya no cuenta las agendas de quienes tienen rol triage; solo las de closing. Elegir una persona sigue mostrando lo suyo.
- CAC con filtro (persona, segmento o país): el gasto de Meta se reparte por la parte de las agendas de closing del equipo que le tocaron ÷ sus clientes nuevos. Sin CAC para personas de triage.
- `triage_service.nombres_de_triage`: una sola definición de quién es triage (la usa también Segmentos).

### 09/11/2026 — Presentaciones: manda lo que respondió el closer
- `comercial_agendas`: una llamada en la que el closer marcó «no presenté la oferta» ya no cuenta como presentación por haber terminado sin venta ni seguimiento (`cerro_sin_venta` solo infiere cuando el campo está vacío). Venta y seña siguen contando siempre. Afecta embudo, tasa de presentación y cierre por presentación.

### 09/11/2026 — Cierre: cada cifra con su período comparado
- Panel Cierre: ventas, señas y no cerradas llevan debajo «antes N» y el cambio en % (verde si mejoró; en no cerradas, bajar es mejorar). Bajo cada anillo, una tabla Ahora / Antes (con su cuenta) / cambio para el close rate solo ventas y con señas. La tabla por canal muestra la tasa de antes y el cambio debajo de cada %. El período se nombra una vez en la cabecera del panel («vs …»).
- Nueva pieza `VsPrevio.jsx` (`VsPrevio`, `Delta`) con flechas de lucide en vez de ▲▼.

### 09/11/2026 — Tiles de arriba con el período comparado
- Show up, Close rate real, Cash collected y Ticket promedio: arriba a la derecha el cambio relativo (flecha y %) y abajo, junto a los botones, «antes X» discreto. Sale la caja grande de período anterior del Cash. El Ticket muestra el neto.
- `Tile` suma la prop `antes`; los estilos de la comparación pasan a `vsPrevio.css` (los importa `VsPrevio.jsx`).

### 09/11/2026 — Cierre: tasa de presentación
- Panel Cierre: nueva fila «Presentación» (llamadas con show up en las que el closer respondió que presentó la oferta ÷ las que asistieron), con barra, cuenta y la del período comparado. En noviembre los closers marcaron «Sí» en las 13 reportadas (100%); en octubre, 77 de 87.
- Tabla por canal: sin período anterior ya no muestra «— =».
- **9 de Noviembre de 2026 (Academia: la venta pagada de a partes recibe la Momentum de seña)** *([academy_payment_sync.py](../../app/services/academy_payment_sync.py))*
  - El aviso de pago a la Academia lleva `en_cuotas`: seña, parcial o cuota de una venta nueva o upsell (no renovación). La Academia le da la Momentum de seña aunque el alumno ya no sea seña.

### 09/11/2026 — Mis datos del setter dejaba la pantalla en negro
- `embudoSetter.etapasParaDibujar`: la base de Asistieron llega del backend como número (generadas que ya ocurrieron) y `FlujoEmbudo` esperaba `{ label, n }`; con al menos una llamada pasada la píldora hacía `undefined.toLowerCase()` y se caía toda la pantalla. Ahora se convierte a `{ label: 'Generadas que ya ocurrieron', n }`. Arregla también los embudos de Comparativas.

### 09/11/2026 — Cartera de Jean Carlo y ventas que se partían al cambiar el programa
- `sale_service`: reubicar varios pagos en un mismo guardado (cambiar el programa desde la ficha) abría una venta por pago, sin total y a precio de lista. Ahora cuentan los pagos ya guardados que se movieron en ese guardado, y una venta con plan de cuotas y sin cobros recibe el primero (`sales_grouping.decidir`). Caso: Silka Rodríguez figuraba con 3 ventas y 3,200 de deuda en vez de 200.
- Datos en prod (06–09/11, con el registro del closer): montos, cuotas y fechas de 29 clientes de Jean Carlo; 12 señas inactivas sin cuota vencida; bajas de Carolina Murillo y Jhonatan Cahuin con el acceso a la Academia cortado; foto de la Academia refrescada. Pagos «Desconocido» unidos a su venta en 5 clientes (Alisson Izabal, Lucero Aroquipa, Melany Caballero, Sandra Zhimnay, Angeles Valerio): su deuda bajó de 4,000 a 1,400 entre los cinco.

### 09/11/2026 · Visitas de Workshop con UTM escritas a mano
- Workshop › Tráfico y el desglose por taller asignan a su anuncio las visitas que llegaron con etiquetas escritas a mano (`utm_content=tc1_pp_a4`, `utm_campaign=tc_pe_co`, TC1 a TC5 desde el 27/10): por el código del nombre del anuncio (`utm_etiquetas`, ADR-W125). Desde el 26/10, TC1 recupera 631 visitas y 115 clics al grupo que figuraban «sin anuncio».
- TC1 ya manda `{{ad.id}}` y `{{campaign.id}}` en «Parámetros de URL» (cambiado por Mario el 09/11).

### 09/11/2026 — Triage con el tablero de la dirección y agendas futuras fuera de los porcentajes (pedido de Marlon, ADR-W126)
- Métricas de la triage es ahora el tablero Triage de Dirección comercial con sus datos: mismos períodos (Hoy, Ayer, 7 y 30 días, Este mes, Mes pasado, Personalizado) y paneles; «Vos y el equipo» muestra las cifras de cada triage, sin los leads de las demás (`triage_alcance.solo_de`). Se retira `TriageMetricas.jsx`.
- Con el closer, las pendientes de llamada se parten en «sin reportar» y «por venir», y el embudo mide «Asistieron al closer» contra las que ya tuvieron resultado: las de mañana o pasado ya no parecen faltantes.
- Show up del closer: las agendas que ya pasaron sin reporte entran en la base; las que no llegaron, no. Prod: equipo octubre 55,4 % → 54,7 %, noviembre 56,0 % → 53,8 %.
- **9 de Noviembre de 2026 (Momentum: las organiza team@, ADR-W127)** *([organizador.py](../../app/agendas_v2/organizador.py))*
  - La Momentum se crea como team@ en su calendario «Momentum · closers» e invita al alumno y al closer, para que la nota de Gemini quede en el Drive que Work lee. Mover, cancelar y borrar usan la cuenta de team@. Sin team@ conectado, va al calendario del closer como antes.
- **9 de Noviembre de 2026 (Momentum: notas de Gemini automáticas, ADR-W128)** *([meet_config.py](../../app/services/meet_config.py))*
  - Al crear la Momentum como team@, la reunión queda con las notas de Gemini, la transcripción y la grabación automáticas (API de Meet). team@ se conecta con ese permiso aparte, como el correo; las dos autorizaciones comparten `google_aparte.py`.
- **9 de Noviembre de 2026 (Momentum: reporte de si sigue y su plan, ADR-W129)** *([momentum_reporte.py](../../app/services/momentum_reporte.py), [arbolResultado.momentum.js](../../frontend/src/components/ficha/arbolResultado.momentum.js))*
  - En la ficha de una Momentum, después de «Asistió»: ¿sigue? Pagó (venta), con plan de pago (arma el plan del saldo), lo está pensando o no sigue. Va así a la Academia (resultado nuevo «plan») y a la tarjeta de Discord, con las cuotas.
  - Si hay nota de Gemini de la llamada, la ficha muestra lo que dice y «Usar en el reporte» lo precarga.
- **9 de Noviembre de 2026 (Discord: las tarjetas vuelven a salir como imagen)** *([report_image_service.py](../../app/services/report_image_service.py))*
  - La carpeta de plantillas de Flask es la del frontend, y `{% import "reports/_tarjeta.html" %}` no se encontraba: desde ADR-W121 las tarjetas (agendas, ventas, resultados, avisos de la Academia) salían con el texto de respaldo. El render busca ahora también en `app/templates`.

### 09/11/2026 · Correlaciones de Workshops sin falsos «no es azar»
- El punto del mapa ahora marca solo los pares que resisten la corrección por todas las comparaciones (16 en vez de 31), y la confianza sale del método elegido (Pearson o Spearman).
- Ventas, cash, ticket, close rate y ROAS no cuentan los talleres de menos de 30 días; show up de citas usa las citas reportadas, como el Resumen; ventas/ROAS, close rate/cash y close rate/ROAS quedan como «por construcción»; los porcentajes de más de 100% se excluyen y se avisan (ADR-W130).
- **9 de Noviembre de 2026 (Sesiones de la Academia en team@: notas automáticas, ADR-W131)** *([agenda.py](../../app/api/external/agenda.py))*
  - La sesión que se crea o se vincula en un calendario de team@ sale con las notas de Gemini, la transcripción y la grabación automáticas, como la Momentum.

### 09/11/2026 · «APLICAR» y «QUIERO APLICAR» son una sola palabra clave en Marketing
- El tablero de anuncios cuenta las entradas, agendas, ventas y gasto de «APLICAR» (como guardaba ManyChat hasta el 23/10) dentro de «QUIERO APLICAR» (ADR-W132). En 30 días al 08/11 su ROAS pasa de 0,21 a 1,38; los totales no cambian.

### 09/11/2026 — Revisar y Triage: show up sobre todas las agendas y el resultado en closing
- Tira de totales de Revisar: el show up y el % de no show se calculan sobre TODAS las agendas de la lista (pedido de Mario: «de las 17, cuántas»). Con llamadas de triage en la lista, una tarjeta más: «pasó a closing», de las que asistieron.
- Triage Dashboard: el % de asistencia también sobre todas las agendas, para dar lo mismo que Revisar.
- Revisar › Agendas: columna y faceta «Closing». En una llamada de triage dice si pasó a closing y, si pasó, el post call de la llamada con el closer, quién la tomó y si presentó la oferta (`comercial_agendas._con_closing`, `triage_pases.pases_de` suma `post_call` y `presento`).

### 11/11/2026 · Las palabras clave en comentarios vuelven a responder siempre
- Desde el 09/11, con la campaña «Setting Funnel · ROAS MAX», la mitad de los comentarios con palabra clave (PROTOCOLO, DOCUMENTO 25, VACÍO, TRÍADA…) no recibían la respuesta privada: 15 de 31 terminaron en «The thread owner has archived or deleted this conversation» porque el hilo era de otra app (ManyChat/Kommo) y el motor solo tomaba el control al escribir por DM. Ahora lo toma también para responder un comentario y reintenta ([motor.py](../../app/automatizaciones/motor.py)).

### 11/11/2026 · El resultado de cada llamada de venta va a #agendas de fulfillment
- Pedido de Mario: los avisos «Llamada de venta · No asistió / No cerró / Reagendó…» y los de Momentum salían en #🙌-onboardings. Ahora el bot los publica en #agendas de fulfillment (canal `resultados`, `DISCORD_RESULTADOS_CHANNEL_ID` para cambiarlo). Primero se mandaron a #📋-reportes de adquisitions y el mismo día se pasaron a #agendas, el canal nuevo. Los de onboarding y venta siguen donde estaban ([resultado.py](../../app/services/discord_avisos/resultado.py)).

### 11/11/2026 · El WhatsApp de agenda nueva dice la hora del lead y la del closer
- Jean Carlo vio «6:00 pm 🇲🇽» en el WhatsApp y 8 pm en su calendario para la misma llamada (lead en Tijuana, él en Ciudad de México) y pensó que estaba mal agendada. Si el closer está en otra zona, la hora del aviso ahora suma la suya: «6:00 pm 🇲🇽 (lead) · 8:00 pm (tuya)», con el día si también cambia ([operacion.py](../../app/agendas_v2/operacion.py)).

### 11/11/2026 · Los avisos de Discord dejan de usar la hora de Bolivia
- El aviso de agenda nueva (imagen y texto) mostraba la hora del lead y, al lado, «(09:00 Bolivia)» como hora del equipo, aunque ya casi nadie trabaja en esa zona. Ahora la segunda hora es la del closer de esa agenda, con su nombre: «18:00 🇲🇽 México (20:00 Jean Carlo)». El resultado de la llamada dice el día y la hora en la zona del closer («Vie 13/11 20:00 (hora de Jean Carlo)»). Si el closer no tiene zona cargada, sigue Bolivia ([avisos_discord.py](../../app/agendas_v2/avisos_discord.py), [resultado.py](../../app/services/discord_avisos/resultado.py)).

### 11/11/2026 · Las llamadas del día, cada mañana en #🔔-new-call
- Pedido de Elias: todos los días a las 12:00 UTC (8:00 Bolivia, 6:00 México) el bot publica en #🔔-new-call las llamadas de triage y aceleración hasta la medianoche de México, agrupadas por setter y con el setter etiquetado, para que le escriba a cada lead por Instagram antes de su llamada. La hora va en formato de Discord: cada uno la ve en su zona. La Momentum no entra. Hora configurable con `LLAMADAS_DEL_DIA_HORA_UTC` ([llamadas_del_dia.py](../../app/services/discord_avisos/llamadas_del_dia.py)). Más adelante, también por WhatsApp con la plantilla `notificacion_learnation` de Whatchimp, cuando Meta la apruebe.

### 11/11/2026 · La disponibilidad del equipo se carga en Leadership y Thalamus la respeta
- Leadership pasa a ser el dueño de cuándo puede cada uno (horario semanal, días bloqueados y rituals con hora) y le manda a Work la foto de la persona en cada cambio. Para quien la cargó allá: el closer toma ese horario en su persona de Team (en Configuración se ve de solo lectura), el staff de la Academia lo usa en vez del que manda la Academia, y los bloqueos y rituals cuentan como ocupado y se escriben en su Google Calendar. Quien no la cargó sigue igual. ADR-W133 ([leadership.py](../../app/agendas_v2/leadership.py)).
- El Calendar de Leadership también muestra lo de tu Google Calendar (`GET /api/external/leadership/eventos`), sin repetir los rituals y bloqueos que escribió Leadership.

### 11/11/2026 · Las reuniones de «🎥 Team Meetings» pasan a Leadership como rituals
- Leadership lee las series del calendario compartido de reuniones (`GET /api/external/leadership/reuniones`) y las convierte en rituals de cada invitado; si alguien les cambia la hora desde Leadership, la serie se reescribe en Google y les llega a todos (`PATCH`). ADR-W134 ([reuniones_equipo.py](../../app/agendas_v2/reuniones_equipo.py)).
- Las reuniones de Team Meetings pasan a tener el Meet de team@ con notas de Gemini, transcripción y grabación automáticas, así nadie se olvida de grabar (`POST /api/external/leadership/reuniones/asegurar-notas`, lo llama Leadership en cada sincronización).

### 11/11/2026 · Una agenda de Workshop ya no cuenta en dos talleres
- Al comparar las 322 agendas del tablero de Workshop con las de Revisar aparecieron 6 agendas del taller del 14/07 que sumaban también al del 08/07: entraban a una ventana por la fecha de creación (13/07 a la noche, hora de Bolivia) y a la otra por la fecha de registro. Ahora, cuando las dos fechas caen en talleres distintos, manda la de registro ([workshop_metrics_service.py](../../app/services/workshop_metrics_service.py), `_agendas_por_embudo`). El taller del 08/07 pasa de 21 a 15 agendas y el total de julio a noviembre de 322 a 316; ningún otro taller cambia.

### 11/11/2026 · Revisar: la línea de vigentes y descartadas sigue el filtro
- En Revisar › Agendas, la línea «N agendas = vigentes + descartadas» contaba todas las agendas del período aunque la lista estuviera filtrada (con la fuente «workshop» decía 1069 sobre una lista de 316). Ahora cuenta las mismas filas que la lista, con sus filtros y su búsqueda ([Revisar.jsx](../../frontend/src/pages/comercial/components/Revisar.jsx), [ConciliacionAgendas.jsx](../../frontend/src/pages/comercial/components/ConciliacionAgendas.jsx)).

### 12/11/2026 · Inbox: el primer mensaje sin palabra clave ya no queda sin respuesta
- Una campaña se puede marcar «Atiende los mensajes sin palabra clave»: el primer mensaje de alguien nuevo que no es ninguna palabra vigente («hola, info», una palabra mal escrita) entra a su flujo con su reparto de setters. Solo el primer mensaje y solo si nadie del equipo le escribió antes. Una sola campaña a la vez. ADR-W135 ([motor.py](../../app/automatizaciones/motor.py), [campanas.py](../../app/automatizaciones/campanas.py)).
- En 14 días habían quedado sin flujo 56 personas que escribieron «OBTENER ACCESO» y unas 70 que escribieron otra cosa.

### 12/11/2026 · Una Momentum ya no pasa al triage
- Juliana (triage) recibió la Momentum de Fátima, una alumna que pagó la seña. Fátima heredó de cuando era lead el segmento D, y cuando Karla Mora, un lead A, agendó con Jean Carlo a la misma hora, Work trató la Momentum como una C/D que se puede desplazar y la pasó al triage. La Momentum es una sesión del closer con su alumno: ahora un lead A/B no puede tomar su horario y no se puede pasar al triage, ni sola ni con «Pasar a triage» desde la ficha ([desplazar.py](../../app/agendas_v2/desplazar.py), [a_triage.py](../../app/agendas_v2/a_triage.py)). Era la única Momentum afectada.

### 13/11/2026 · Workshop: el cobro de cada taller suma todas las cuotas de sus clientes
- El Cash total de un taller sumaba las ventas nuevas, las señas y solo la primera cuota de cada venta: las cuotas que llegaban después no se le contaban a ningún taller. Ahora suma también las cuotas, renovaciones y upsells de quien compró o dejó seña en ese taller, aunque los pague meses después, y una cuota nueva recalcula el taller del que salió esa persona. ADR-W136 ([workshop_metrics_service.py](../../app/services/workshop_metrics_service.py), [workshop_live_sync.py](../../app/services/workshop_live_sync.py), [workshop_registros_service.py](../../app/services/workshop_registros_service.py)).
- La tabla de talleres suma la columna «ROAS New Cash» al lado de «ROAS Total», para ver siempre las dos caras ([columnasTalleres.jsx](../../frontend/src/pages/admin/workshop/talleres/columnasTalleres.jsx)).
- Con el recálculo, el ROAS Total de los talleres de julio a noviembre pasa de 2,52 a 2,88 (26/09: 6,4 → 11,3; 05/09: 4,3 → 5,5; 12/09: 0,9 → 1,9; 03/10: 1,3 → 2,0).

### 13/11/2026 · La seña sale con total y fecha de pago, y el seguimiento de venta dura una semana
- Con Seña o Parcial el «Precio total» tiene que ser mayor a lo cobrado hoy, y la Seña pide siempre la fecha del próximo pago (el plan). 4 señas de octubre y noviembre se habían registrado con el total igual a la seña y quedaron sin plan. ADR-W137 ([arbolResultado.preguntas.js](../../frontend/src/components/ficha/arbolResultado.preguntas.js), [ficha_acciones_service.py](../../app/services/ficha_acciones_service.py)).
- El seguimiento de un lead que no compró pasa de 4 contactos en 14 días a 3 en 7 (días 0, 3 y 7). Después del tercero solo se puede cerrar, y cerrar el seguimiento lo marca Lead Perdido. Los seguimientos de clientes y de cobro no cambian ([arbolResultado.payload.js](../../frontend/src/components/ficha/arbolResultado.payload.js), [closer_followup_service.py](../../app/services/closer_followup_service.py)).

- **13 de Noviembre de 2026 (Notas de Gemini automáticas en las reuniones del equipo de la Academia)** *([agenda.py](../../app/api/external/agenda.py), [meet_config.py](../../app/services/meet_config.py), [google_service.py](../../app/services/google_service.py))*:
  - Nuevo `POST /api/external/academy/agenda/reuniones/notas`: prende notas, transcripción y grabación automáticas en el Meet de una reunión del equipo. La Academia lo llama al crear cada reunión y desde «Activar notas».
  - Si quien organiza está conectado con team@, usa la autorización de Meet de team@; si no, su propio Google. Por eso conectar Google Calendar ahora pide también el permiso de Meet. El calendario sigue renovando su token sin ese permiso, así que las conexiones de antes no se rompen; solo las notas piden reconectar.

### 13/11/2026 · El ticket promedio suma la seña a su venta y se ve en bruto
- La seña de un cliente que completa la venta en el mismo mes (o a ≤ 7 días) se suma a esa venta en el ticket promedio; una seña sola sigue sin contar. Producción: sep $745,65 → $757,08; oct $616,18 → $619,12; nov $693,70 → $750,00. ADR-W139 ([ticket_service.py](../../app/services/ticket_service.py)).
- Comercial › Analizar muestra el ticket en bruto, con el neto de la pasarela debajo, igual que el tablero del closer ([Analizar.jsx](../../frontend/src/pages/comercial/components/Analizar.jsx)).
- Correcciones a mano en producción (reunión con Jean Carlo): la renovación de Yancarlos quedó enlazada a su agenda del 07/11 (Show up) y tres agendas del 11/11 pasaron a Cancelado.

### 14/11/2026 · Triage solo con Dari y mínimo diario de 5 agendas para Jean Carlo con leads C
- Thalamus › Team › Estrategias: «Segmento C» y «Segmento D» quedan solo con Dari; Juliana deja de recibir leads.
- Las estrategias pueden tener un «Mínimo diario» de un closer ([Grupos.jsx](../../frontend/src/pages/agendas_v2/secciones/team/Grupos.jsx), [asignacion.py](../../app/agendas_v2/nucleo/asignacion.py), [ADR-W140](../DECISIONS.md)). «Segmento C» queda con Jean Carlo y 5 agendas por día: los días en que tiene menos, el lead C ve sus horarios mezclados con los de Dari y, si elige uno de Jean, se le agenda una Sesión de Aceleración. Los D siguen yendo solo al triage.

### 16/11/2026 · «Pasar a triage» ya no elige a quien salió del triage
- La agenda que un closer pasa al triage (o la C/D que desplaza un A/B) va solo a una persona del triage que esté en algún grupo de reparto y con su cuenta activa. Juliana, que salió de los grupos el 14/11, seguía siendo candidata y, por no tener agendas por delante, era la primera ([a_triage.py](../../app/agendas_v2/a_triage.py)).
- Correcciones en producción de la Academia: las dos Momentum quedaron con Giancarlos como responsable (sin responsable, 19 alumnos veían el link de la Momentum sin horarios) y los 14 alumnos de Facundo pasaron a Giancarlos.

### 16/11/2026 · El setter llega a los turnos libres del equipo desde su espacio
- Botón «Tálamus» en el encabezado del espacio del setter, junto a sus links (antes estaba en el menú del avatar; pedido de Sales Team 07/11). Abre directo Team › Available, con los turnos libres del equipo, para ver cuándo hay lugar y cuándo abrir días (Resultad-OS 14/11) ([SetterEspacioPage.jsx](../../frontend/src/pages/setter/SetterEspacioPage.jsx), [MisLinks.jsx](../../frontend/src/pages/setter/MisLinks.jsx)).
- Thalamus acepta `?ver=available` para abrir esa vista ([ThalamusApp.jsx](../../frontend/src/pages/agendas_v2/ThalamusApp.jsx)). Lo de setters salió de la rama `wip/pendientes-2026-11`; el resto de esa rama sigue sin subir.

### 16/11/2026 · Los links de agenda del setter, a mano en la bandeja de entrada
- En la conversación, el menú del rayito (o «/» en la caja) trae «Links de agenda»: los links del setter (uno por evento de setting, con su nombre como fuente). Tocar uno lo pega en el mensaje. El formulario de la reserva decide si el lead va a closing o a triage, así que no hay un link aparte para cada uno ([MenuRayo.jsx](../../frontend/src/pages/inbox/conversaciones/MenuRayo.jsx); pedido de Sales Team 07/11).

### 16/11/2026 · El botón «OBTENER ACCESO» de ManyChat ya no arranca el Lead Magnet
- Los seguidores nuevos que tocaban «OBTENER ACCESO» en la bienvenida de ManyChat recibían el recurso de ManyChat y, además, nuestro flujo «Lead Magnet» (desde el 13/11, 24 personas; 7 con error de Meta). El texto del botón coincidía con la palabra clave cargada el 12/11. Ahora un botón de otra app no dispara nada del motor ([motor.py](../../app/automatizaciones/motor.py), [ADR-W141](../DECISIONS.md); aviso de Elías 13/11).
- Producción no desplegaba desde las 14:02: el menú del rayito importaba `rotuloDeLink` de [MisLinks.jsx](../../frontend/src/pages/setter/MisLinks.jsx), que quedó en la rama `wip` al pasar lo de setters. Se agregó el export.

### 16/11/2026 · Cash collected y Ticket promedio en neto, con el bruto debajo
- Comercial › Analizar: las tarjetas Cash collected y Ticket promedio, y el panel Cash, muestran el neto de la pasarela en grande y el bruto debajo ([Analizar.jsx](../../frontend/src/pages/comercial/components/Analizar.jsx), [PanelCash.jsx](../../frontend/src/pages/comercial/components/PanelCash.jsx)). El ticket deja de verse en bruto en grande (cambio del 13/11).
- Tablero del closer: «Ticket promedio · neto» con el bruto debajo, igual que el cash, y la columna «Ticket neto» del ranking ([PerformanceKpis.jsx](../../frontend/src/pages/closer/dashboard/components/PerformanceKpis.jsx), [columnasRanking.jsx](../../frontend/src/pages/closer/dashboard/components/columnasRanking.jsx)). El servidor manda `ticket_promedio_neto` ([closer_service.py](../../app/services/closer_service.py)). [ADR-W142](../DECISIONS.md).

### 16/11/2026 · El cash neto del tablero del closer usa el neto real de cada pago
- El tablero del closer pasaba el cash a neto con la comisión promedio de la pasarela para todos los pagos; Analizar usa lo que entró de verdad cuando el pago está verificado. En los meses ya verificados el cash neto por closer no coincidía entre las dos pantallas. Ahora el tablero usa el mismo neto que Analizar ([closer_service.py](../../app/services/closer_service.py), `commission_service.cash_neto`). El bruto y los conteos no cambian.
- Producción, octubre: Jean Carlo $13.866,31 → $13.928,05; Facundo $2.200,38 → $2.183,43; Marlon Garcia $1.195,86 → $1.149,60; equipo $17.262,54 → $17.261,08. Noviembre no cambia (todavía sin pagos verificados).

### 16/11/2026 · Discord: el texto que acompaña a cada imagen queda en una línea
- Los reportes diarios de closer, triage y setter mandaban varias líneas con separadores y cifras que ya están en la imagen. Ahora el texto es una línea: título, nombre, fecha y la mención ([closer.py](../../app/api/public/closer.py), [triage.py](../../app/api/public/triage.py), [setter.py](../../app/api/setter.py), [booking_avisos.py](../../app/services/booking_avisos.py)). Las imágenes no cambian.
- Reporte nuevo del setter: el resumen completo en texto sale solo si la tarjeta no se puede dibujar ([setter_reporte_discord.py](../../app/services/setter_reporte_discord.py), `texto_corto`).
- Pase de triage a closing: el aviso ya no repite la nota entera como texto; queda el resumen en la imagen y la nota completa en la ficha ([avisos_discord.py](../../app/agendas_v2/avisos_discord.py)).

### 16/11/2026 · «Canceló» y «reprogramó sin fecha» ya no se guardan como No Show
- El árbol de Resultado guardaba «No Show» cuando el closer elegía «canceló → seguimiento» o «reagenda sin fecha»; el guardado correcto existía desde el 26/10, a prueba solo para Mario Bühler. Ahora vale para todos ([arbolResultado.payload.js](../../frontend/src/components/ficha/arbolResultado.payload.js), [ADR-W143](../DECISIONS.md)). El lead sigue en «Seguir» como antes.
- Las agendas ya guardadas no cambian: del 26/10 al 16/11 hay 11 de closing por corregir a mano (10 de Jean Carlo, 1 de Marlon Garcia).

### 16/11/2026 · Triage: «Lo va a pensar» y la nota de la llamada ya se guarda
- Tercera calificación del triage, «Lo va a pensar»: el lead asistió y no decidió. Pide la fecha del próximo contacto y qué quedó pensando, queda en «Seguir» y se cuenta aparte en las métricas del triage; cuando decide, se vuelve a reportar como Califica o No califica ([triage_service.py](../../app/services/triage_service.py), [recorrido.js](../../frontend/src/components/ficha/triage/recorrido.js), [ADR-W138](../DECISIONS.md)).
- La nota del triage en una llamada a la que el lead asistió («por qué no califica», «qué quedó pensando») se perdía al guardar; ahora queda como nota de la llamada y sale en el Reporte. Las llamadas ya reportadas no la recuperan.

### 17/11/2026 · Preventa: destino de las agendas, 1ª y 2ª llamada, y el triage con la misma base
- Comercial › Analizar › Closers: el panel de estados pasa a llamarse «Destino de las agendas» y reparte el 100 % entre se presentó, no show, canceló, reprogramó y sin reportar; lo que no cuenta (aún no ocurren, descalificadas, descartadas) queda aparte y a la vista ([RepartoEstados.jsx](../../frontend/src/pages/comercial/components/RepartoEstados.jsx)). Las cantidades no cambian; los porcentajes sí, porque cambia el denominador (ADR-W144).
- El panel Cierre suma la tira «1ª y 2ª llamada»: asistieron, ventas y close rate de cada grupo ([CierrePorLlamada.jsx](../../frontend/src/pages/comercial/components/llamadas/CierrePorLlamada.jsx)). El orden sale de las llamadas de closing a las que ese lead ya asistió en los 90 días anteriores ([comercial_llamadas.py](../../app/services/comercial_llamadas.py)). Límite conocido: la «2ª llamada» del árbol de Resultado mueve la misma agenda, así que hoy casi todas cuentan como primera.
- Dirección comercial › Triage: la asistencia se mide sobre la misma base que closing, con «Reprogramó» y lo que queda fuera de la base a la vista, y el embudo tiene seis pasos: agendas, asistieron, cualificadas, pasaron a closing, asistieron al closer y cerraron ([TriagePaneles.jsx](../../frontend/src/pages/comercial/components/triage/TriagePaneles.jsx), [triage_filas.py](../../app/services/triage_filas.py), ADR-W145). El % de asistencia solo cambia en períodos con llamadas por venir.
- Cada cifra de los tres paneles abre la lista de las agendas que la suman (`GET /api/comercial/llamadas/registros` y los filtros del Reporte de triage). Una cancelación hecha desde Confirmación se contaba pero no salía en la lista; ahora sale.

### 17/11/2026 · El reporte del setter en Discord dice qué pasó con sus agendas
- Debajo de la línea del reporte sale qué pasó con las agendas que el setter generó en los últimos 7 días: cuántas ya ocurrieron, cuántas asistieron (con el show up), cancelaron, reprogramaron, no show, y cuántas de las que asistieron al triage pasaron a closing. Son las mismas filas y la misma base que Analizar con Setters ([setter_reporte_discord.py](../../app/services/setter_reporte_discord.py); pedido de Mario en la Estrategia del 16/11).

### 17/11/2026 · El setter le escribe al lead desde el Inbox
- El chat de Conversaciones manda el mensaje por Instagram (Ctrl+Enter o «Enviar»), y el modal de Audios manda el audio elegido. Antes se copiaba y se pegaba en Kommo ([Composer.jsx](../../frontend/src/pages/inbox/conversaciones/Composer.jsx), [escribir.py](../../app/automatizaciones/escribir.py), [ADR-W146](../DECISIONS.md)).
- Pasadas las 24 h sale como respuesta de una persona (HUMAN_AGENT, hasta 7 días); después la caja avisa que Instagram no deja. Si Kommo tiene el hilo, Work lo toma para mandar y lo devuelve. Cada mensaje muestra quién lo mandó (migración `d4e6f8a1b3c5`).
- Se borró la aserción del texto exacto del reporte de setter en Discord, que quedó vieja con el cambio de la mañana.

### 17/11/2026 · Agendas: un evento de persona fija respeta sus días
- El link público de un evento de persona fija ofrece solo los días que eligió esa persona («3 días hábiles» son 3). Antes, si sus días tenían 1 o 2 horarios libres, se abrían hasta 14 días más (ADR-W027) y el lead veía horarios de varias semanas: le pasó a Mario con «Consultoría» ([asignacion.py](../../app/agendas_v2/nucleo/asignacion.py), [asignacion.js](../../frontend/src/pages/agendas_v2/core/asignacion.js), ADR-W147).
- «Horarios libres» espera a leer los Google Calendar antes de mostrar horarios: antes mostraba todo libre y después desaparecían los ocupados ([HorariosLibres.jsx](../../frontend/src/pages/agendas_v2/secciones/eventos/HorariosLibres.jsx)).

### 17/11/2026 · Agendas: la ventana de días es exacta
- Un evento de «2 días hábiles» ofrece solo esos 2 días, aunque tengan pocos horarios. Antes, los días con menos de 3 horarios no contaban y se abrían días más lejos: Segmentos A y B mostraban el viernes y el lunes (aviso de Marlon). Solo se abre un día más si el grupo no tiene ningún horario ([asignacion.py](../../app/agendas_v2/nucleo/asignacion.py), [asignacion.js](../../frontend/src/pages/agendas_v2/core/asignacion.js), ADR-W148).
- Se borró la prueba de «se abre un día más», que había quedado vieja con ADR-W027.

### 17/11/2026 · Los setters proponen cambios de estructura de los flujos
- En Flujos, el setter abre un flujo publicado con «Cambiar estructura», mueve o agrega pasos y lo manda con «Proponer cambios» y una nota. Admin, operador o dirección comercial lo ven arriba de la grilla, lo revisan en el lienzo y lo aprueban (se publica) o lo rechazan con el motivo ([api_propuestas.py](../../app/automatizaciones/api_propuestas.py), [AccionesPropuesta.jsx](../../frontend/src/pages/inbox/editor/AccionesPropuesta.jsx), [ADR-W147](../DECISIONS.md); acordado en la Estrategia del 16/11).
- El operador entra al Inbox con los permisos de admin. Migración `e5f7a9b2c4d6`.
- Investigado (sin cambios): los leads «argentinos» del 07/11 son argentinos de verdad (+54 11); en 4 meses hay 6 agendas, 4 cobros y 4 leads de Argentina.

### 17/11/2026 · Audios en «/» y seguimientos si no responde
- En el chat, «/» muestra los audios del equipo y tocar uno lo manda ([MenuRayo.jsx](../../frontend/src/pages/inbox/conversaciones/MenuRayo.jsx)).
- El reloj de la caja programa un seguimiento: «si no responde en 1 h, 3 h, 24 h, 2 o 3 días, mandarle esto» (texto o audio). Sale solo; si el lead escribe antes, se cancela. Lo programado se ve arriba de la caja con su hora y se puede cancelar ([seguimientos.py](../../app/automatizaciones/seguimientos.py), [Seguimientos.jsx](../../frontend/src/pages/inbox/conversaciones/Seguimientos.jsx), [ADR-W148](../DECISIONS.md)). Migración `f6a8b1c3d5e7`.

### 17/11/2026 · Aviso diario de reportes que faltan
- Todos los días a las 10:00 (Caracas y Bolivia) sale en #📋-reportes de adquisitions quién no mandó el reporte de ayer y quién tiene llamadas sin resultado, con la persona etiquetada: closers y triage con llamadas ayer, setters de lunes a sábado. Si no falta nada, no sale ([reportes_faltantes.py](../../app/services/discord_avisos/reportes_faltantes.py), [ADR-W154](../DECISIONS.md); acordado en la Estrategia del 16/11). Probado contra producción sin enviar: hoy etiquetaría a 3 personas.
- Revisado (sin cambios): la Momentum muestra horarios a los 212 alumnos activos (Jean Carlo, y Marlon a sus 10 alumnos). El «0 turnos» del 16/11 ya no pasa.

### 17/11/2026 · El aviso de suscripción lleva el closer de la venta
- Cada suscripción que Work manda a la Academia lleva `closer_email`, el closer de la venta más reciente. La Academia se lo deja al alumno que no tiene un closer de ventas: el que se inscribía después de la venta quedaba sin closer y su Momentum sin nadie que la diera (Luis Martínez, 13/11) ([subscription_sync.py](../../app/services/subscription_sync.py)).

### 17/11/2026 · Learnito sugiere la respuesta del setter
- En el chat, el botón ✨ deja en la caja la próxima respuesta para el lead y, debajo, por qué. Lo escrito en la caja va como borrador o pedido («más corto», «invitalo a agendar»). Lee la conversación, los datos del lead, las notas del equipo y el material del programa de la Academia ([sugerir.py](../../app/automatizaciones/sugerir.py), [ADR-W149](../DECISIONS.md), [LEARNITO.md](../MODELO/LEARNITO.md) §9; pedido de Mario en la Estrategia del 16/11).

### 17/11/2026 · Learnito en el Inbox: el mismo cerebro, con información en vez de un mensaje redactado
- El botón ✨ del chat ya no redacta: abre el Learnito de siempre con el contexto del lead y le pregunta qué información del programa le sirve al setter y qué conviene preguntar o evitar ([learnito_inbox.py](../../app/automatizaciones/learnito_inbox.py), [Composer.jsx](../../frontend/src/pages/inbox/conversaciones/Composer.jsx), [ADR-W150](../DECISIONS.md)). Reemplaza la sugerencia de la mañana (ADR-W149).
- El Learnito de Work tiene el material del programa: se lo pide a la Academia (`buscar_material`, `leer_recurso`, `findMaterial`) ([learnito_material.py](../../app/services/learnito_material.py), [LEARNITO.md](../MODELO/LEARNITO.md) §3 y §9).

### 17/11/2026 · Solicitudes al equipo de desarrollo, con registro (ADR-W151)
- El widget de reportes suma un tercer tipo, «Necesito que me hagan algo» (`solicitud`), al lado de bug y mejora: pregunta qué se necesita y para qué y para cuándo, y queda con su hilo y su estado como cualquier reporte ([reportTypes.js](../../frontend/src/components/feedback/reportTypes.js), [ReportTypeStep.jsx](../../frontend/src/components/feedback/ReportTypeStep.jsx), [bug_report.py](../../app/models/bug_report.py)).
- El botón del menú pasa a «Reportar o pedir algo». La cola del operador se ordena bug, solicitud, mejora y cuenta los pendientes de cada tipo ([BugReportsPanel.jsx](../../frontend/src/components/operations/BugReportsPanel.jsx)); la API de la plataforma de desarrollo acepta `type=solicitud` ([dev_platform_bug_reports.md](../dev_platform_bug_reports.md)).

### 17/11/2026 · Triage: al descalificar se elige por qué el lead no pasó a closing
- La ficha del triage cambia la nota libre «¿Por qué no califica?» por la pantalla «¿Por qué no pasó a closing?»: no tenía dinero, no encontramos horario, puso una objeción y no la resolví, u otro motivo. El texto es obligatorio solo con la objeción y con «otro» ([PantallasTriage.jsx](../../frontend/src/components/ficha/triage/PantallasTriage.jsx), [triage_motivos.py](../../app/services/triage_motivos.py), ADR-W153). Sin migración: el motivo es una fila del log de la agenda.
- Dirección comercial › Triage suma la tarjeta «Por qué no pasaron a closing», con una barra por motivo que abre su lista, y el Reporte muestra el motivo como chip ([TriagePaneles.jsx](../../frontend/src/pages/comercial/components/triage/TriagePaneles.jsx)). Las descalificadas anteriores quedan «Sin motivo».

### 17/11/2026 · Workshop: tipo del taller (frío o caliente) y un grupo de WhatsApp por conjunto de anuncios
- Planificar › Próximos talleres: cada taller muestra su tipo y cuántos grupos tiene, y el botón «Grupos» abre el modal para elegir frío o caliente, el grupo general y un grupo por conjunto de anuncios ([ModalGruposTaller.jsx](../../frontend/src/pages/admin/workshop/planificar/ModalGruposTaller.jsx), [workshop_grupos_service.py](../../app/services/workshop_grupos_service.py), ADR-W152). Talleres suma el filtro «Tipo».
- `GET /api/public/workshops/proximos` acepta `utm_term`, `utm_content` y `utm_campaign` y devuelve el grupo del conjunto que trajo la visita; sin parámetros responde igual que antes. Las visitas guardan `utm_term`. Migración `b8d0f2a4c6e1` (`workshop_events.tipo`, `workshop_grupos`, `landing_trackings.utm_term`).
- Falta para que funcione de punta a punta: que la landing mande los UTM al pedir los talleres (institute-site) y que los anuncios nuevos lleven `utm_term={{adset.id}}`. Las fases siguientes (CSV de miembros, cruce con agendas, métricas por conjunto) no están hechas.

### 17/11/2026 · Grabación automática de las llamadas de venta de Jean Carlo
- Cada 15 minutos, las llamadas de venta que vienen de Jean Carlo quedan con grabación, transcripción y notas de Gemini automáticas, prendidas con su cuenta, sin recrear nada. La nota llega a la ficha (con la transcripción) cuando su Drive esté conectado en Notas de Meet ([grabar_llamadas.py](../../app/agendas_v2/grabar_llamadas.py), [ADR-W155](../DECISIONS.md)). Para que arranque, Jean Carlo tiene que reconectar Google Calendar en Work (le falta el permiso de Meet) y conectar su Drive.

### 17/11/2026 · Inbox: el chat se trabaja más rápido (ADR-W156)
- Lo que manda el setter aparece al instante («enviando…»); si no sale, queda con el motivo y Reintentar ([useEnvio.js](../../frontend/src/pages/inbox/conversaciones/useEnvio.js), [Feed.jsx](../../frontend/src/pages/inbox/conversaciones/Feed.jsx)).
- Borrador por conversación, visible en la fila ([borradores.js](../../frontend/src/pages/inbox/conversaciones/borradores.js)). Enter envía y Shift+Enter salta de línea; ↑↓ cambian de chat y Esc lo cierra ([Composer.jsx](../../frontend/src/pages/inbox/conversaciones/Composer.jsx), [Conversaciones.jsx](../../frontend/src/pages/inbox/Conversaciones.jsx)).
- La fila avisa cuándo se cierra la ventana de Instagram (últimas 24 h de los 7 días) y el próximo seguimiento programado; cola nueva «Se cierra la ventana» ([colas.js](../../frontend/src/pages/inbox/conversaciones/colas.js), [Fila.jsx](../../frontend/src/pages/inbox/conversaciones/Fila.jsx), [api.py](../../app/automatizaciones/api.py)).
- Sin leer en el título de la pestaña y avisos del escritorio con la campana de la bandeja ([useAvisos.js](../../frontend/src/pages/inbox/conversaciones/useAvisos.js)).
- Learnito en el panel derecho, en una pestaña al lado de la ficha ([PanelDerecho.jsx](../../frontend/src/pages/inbox/conversaciones/PanelDerecho.jsx)). En el menú «/», la vista previa resalta las variables completadas ([MenuRayo.jsx](../../frontend/src/pages/inbox/conversaciones/MenuRayo.jsx)).

### 17/11/2026 · Cero superposiciones en las agendas
- Mover una agenda que viene (reagendar desde la ficha o desde la triage, el mazo, reasignar, editar la agenda o el Tablero) revisa antes las agendas del closer con su margen y su Google Calendar: si choca, no se mueve y dice por qué ([manual.py](../../app/agendas_v2/manual.py), [ADR-W157](../DECISIONS.md)).
- Pasar al triage solo va a una triage libre a esa hora. Sin ninguna libre, a mano se rechaza y la C/D desplazada sigue con el closer para reagendar ([a_triage.py](../../app/agendas_v2/a_triage.py)).
- La Momentum mira Google al momento de reservarla, y la Academia pregunta si el horario está libre antes de moverla (`POST /api/external/academy/agenda/libre`).

### 17/11/2026 · Inbox: los leads ya no aparecen «Sin usuario»
- El usuario y el nombre de Instagram se pedían solo cuando el lead arrancaba un flujo: los que escribían sin palabra clave (1172 de 3104) quedaban «Sin usuario». Ahora se piden con su primer mensaje y, si Instagram no los da, se reintenta a las 24 h ([perfil.py](../../app/automatizaciones/perfil.py), [motor.py](../../app/automatizaciones/motor.py)). Los que faltaban se completaron con un script en el servidor.

### 17/11/2026 · Turnos que quedan, para los setters
- Arriba de Tálamus › Team › Available (lo que abre el botón Tálamus del setter): cuántas llamadas quedan libres cada día de la semana para Triage y para Closers, con el detalle por persona al pasar el mouse y un «Por persona» que abre la tabla de cada grupo ([TurnosEquipo.jsx](../../frontend/src/pages/agendas_v2/secciones/team/TurnosEquipo.jsx), [ADR-W158](../DECISIONS.md)).

### 17/11/2026 · Ventanas y herramientas en el dock; Turnos para los setters
- Work suma ventanas flotantes, como la Academia y Leadership: se abren encima de cualquier pantalla, se arrastran, se maximizan soltándolas arriba y se minimizan al dock soltándolas abajo; el dock muestra las abiertas ([ventanas/](../../frontend/src/ventanas/), [ADR-W159](../DECISIONS.md)).
- Las herramientas van por rol en el menú de sesión y se fijan en el dock. La primera es **Turnos**: los turnos que quedan de triage y de closers por día. El setter la tiene fijada y con un botón en su encabezado.

### 17/11/2026 · Dock 2.0: tres islas, Herramientas y navegación editable
- El dock pasa a tres islas, como la Academia y Leadership: lo fijado a la izquierda, las secciones en el centro y, a la derecha, el botón **Herramientas** y la sesión ([DockSecciones.jsx](../../frontend/src/pages/comercial/components/DockSecciones.jsx), [ADR-W160](../DECISIONS.md)).
- Herramientas junta las herramientas en ventana (Turnos), las acciones de la pantalla y las secciones ocultas, cada una con su 📌 para fijarla ([BotonHerramientas.jsx](../../frontend/src/ventanas/BotonHerramientas.jsx)).
- «Editar navegación»: arrastrar para ordenar, el ojo para ocultar y doble clic para renombrar las secciones ([DockEdicion.jsx](../../frontend/src/pages/comercial/components/DockEdicion.jsx)).

### 17/11/2026 · Turnos con horarios y zona; «Nuevo» en el dock
- Turnos cuenta solo a quienes la reserva ofrece (usuario activo, Google y WhatsApp). Juliana Avila quedó desactivada en Work ([ADR-W161](../DECISIONS.md)).
- En Turnos, tocar un número muestra los horarios libres de ese día, y la ventana deja elegir en qué hora verlos ([TurnosEquipo.jsx](../../frontend/src/pages/agendas_v2/secciones/team/TurnosEquipo.jsx), [TurnosVentana.jsx](../../frontend/src/ventanas/herramientas/TurnosVentana.jsx)).
- Botón «Nuevo» en la isla izquierda del dock (Nueva agenda, Referido manual, Reportar o pedir algo); el avatar queda con la cuenta ([DockSecciones.jsx](../../frontend/src/pages/comercial/components/DockSecciones.jsx), [MenuSesion.jsx](../../frontend/src/pages/comercial/components/MenuSesion.jsx)).

### 17/11/2026 · El avatar abre Configuración; todo lo demás está en Herramientas
- Tocar el personaje del dock abre Configuración directo; el personaje se elige en Configuración › Datos ([MenuSesion.jsx](../../frontend/src/pages/comercial/components/MenuSesion.jsx), [ElegirPersonaje.jsx](../../frontend/src/components/mascota/ElegirPersonaje.jsx), [ADR-W162](../DECISIONS.md)).
- Herramientas junta las herramientas (Nuevo, Turnos), las acciones de la pantalla, las secciones ocultas y lo de tu cuenta (Portal, avisos, reportes, cerrar sesión). «Nuevo» es una herramienta más y se puede fijar ([BotonHerramientas.jsx](../../frontend/src/ventanas/BotonHerramientas.jsx)).

### 17/11/2026 · Barra lateral y Herramientas ordenadas, como en la Academia
- Configuración › Dock: la navegación puede ir en una barra lateral, desplegada o solo con íconos ([DockLateral.jsx](../../frontend/src/pages/comercial/components/DockLateral.jsx), [ADR-W163](../DECISIONS.md)).
- Herramientas se ordena por tipo (Crear, Agendas, Asistente, Pendientes, Esta pantalla, Ir a, Sesión), en dos columnas, con ícono en color y una línea de para qué sirve cada una ([catalogoHerramientas.js](../../frontend/src/ventanas/catalogoHerramientas.js)).

### 17/11/2026 · Barra lateral en secciones, Buscar lead, atajos y el dock en la cuenta
- La barra lateral se ordena en la tarjeta de usuario (personaje grande, Herramientas, cerrar sesión y lo fijado), la navegación alineada a la izquierda y las ventanas al fondo ([DockLateral.jsx](../../frontend/src/pages/comercial/components/DockLateral.jsx), [ADR-W164](../DECISIONS.md)).
- Herramienta **Buscar lead** (Ctrl+K): cualquier lead y su ficha, desde cualquier pantalla ([BuscarLeadVentana.jsx](../../frontend/src/ventanas/herramientas/BuscarLeadVentana.jsx)). Nuevo suma «Registrar un pago» y «Declarar una venta». Playbook y Simular pasan a ser herramientas. Ctrl+L abre Learnito y Ctrl+J, Herramientas.
- Lo fijado, la navegación editada y el modo del dock se guardan en la cuenta: otra compu arranca igual ([dockServidor.js](../../frontend/src/sesion/dockServidor.js), migración `c4e7a9d1f3b2`).

### 17/11/2026 · Dock unificado: la tarjeta de sesión y la barra en dos contenedores
- Mockup de referencia del dock y los temas para Work, Academy y Leadership ([docs/mockups/dock-unificado](../mockups/dock-unificado/index.html), [ADR-W165](../DECISIONS.md)).
- Tarjeta de sesión: Avisos arriba a la derecha, el personaje grande y el nombre, y la fila Cerrar sesión · Mensajes (pronto) · Leadership · Herramientas · Configuración. En el dock de abajo aparece al pasar el mouse por el avatar ([TarjetaSesion.jsx](../../frontend/src/pages/comercial/components/TarjetaSesion.jsx)).
- La barra lateral separa la tarjeta de la navegación. Plegada muestra hasta 3 fijadas y 5 secciones, con «+N» para el resto ([DockLateral.jsx](../../frontend/src/pages/comercial/components/DockLateral.jsx)).
- Las secciones ya no llevan número. El texto de cada herramienta del menú ya no se aplasta ([dock2.css](../../frontend/src/pages/comercial/dock2.css)).

### 17/11/2026 · Mockup de la Configuración unificada
- Una sola Configuración para Work, Academy y Leadership, en Baldosas (como Academy) o en Pestañas a la izquierda (como Work), con los cuatro temas únicos y los ajustes de pantalla ([docs/mockups/configuracion-unificada](../mockups/configuracion-unificada/index.html), [ADR-W166](../DECISIONS.md)).

### 17/11/2026 · Temas únicos y la Configuración nueva
- Cuatro temas en Configuración › Apariencia: Learnation (el Modern de antes, que absorbe a Classic), Sólido, Relámpago y Puro, cada uno claro u oscuro ([temas-unicos.css](../../frontend/src/temas/temas-unicos.css), [ADR-W167](../DECISIONS.md)).
- Ajustes nuevos: modo «como el equipo», efectos, modo liviano (solo al simular) y tamaño de letra. La apariencia se guarda en la cuenta ([AparienciaContext.jsx](../../frontend/src/context/AparienciaContext.jsx)).
- Configuración en pestañas a la izquierda o en baldosas como Academy, con Notificaciones, el Portal y Cerrar sesión arriba, y las secciones Notificaciones, Seguridad y Ayuda ([Configuracion.jsx](../../frontend/src/sesion/Configuracion.jsx)).

### 17/11/2026 · Herramientas en una ventana
- Herramientas se abre en una ventana centrada y ancha, con buscador y los grupos en dos columnas, en vez de un menú sin espacio ([BotonHerramientas.jsx](../../frontend/src/ventanas/BotonHerramientas.jsx), [ADR-W168](../DECISIONS.md)).

### 17/11/2026 · Configuración como ventana
- Configuración se abre en una ventana que se minimiza al dock, se maximiza y se arrastra, como Turnos y Buscar lead, con Notificaciones, Portal y Cerrar sesión en su barra ([ConfiguracionContext.jsx](../../frontend/src/sesion/ConfiguracionContext.jsx), [ADR-W169](../DECISIONS.md)).
- Baldosas más prolijas. Los cinco botones de la tarjeta de la barra lateral ya no se salen ([dock2.css](../../frontend/src/pages/comercial/dock2.css)).

### 17/11/2026 · Mockup del chat cruzado
- Mockup de un solo chat del equipo para Work, Academy y Leadership, sobre el chat de la Academia: canales por área, quién está conectado y en qué servicio, y Learnito adentro (su conversación, `@Learnito` en un canal y al costado de un mensaje) ([chat-cruzado](../mockups/chat-cruzado/index.html), [ADR-W170](../DECISIONS.md)).

### 17/11/2026 · «Pasar a triage» ya no acepta una agenda que viene del triage
- Un closer devolvió al triage, sin querer, la agenda de un lead que ya había calificado (13/11): quedó como llamada de triage sin reportar de quien la recibió, y el pase de quien la calificó apuntaba a una triage. Ahora la acción se rechaza con «Este lead ya pasó por el triage y calificó: reagendala o pasala a otro closer» ([a_triage.py](../../app/agendas_v2/a_triage.py)). La Momentum ya se rechazaba.

### 17/11/2026 · Chat del equipo dentro de Work (primer paso)
- Nueva herramienta **Chat** (en Herramientas, se puede fijar en el dock): el canal General · Equipo de la Academia, con los avisos de Work como tarjeta y desde qué servicio escribió cada uno ([ChatVentana.jsx](../../frontend/src/ventanas/herramientas/chat/ChatVentana.jsx), [chat.py](../../app/api/chat.py), [ADR-W171](../DECISIONS.md)).
- Quién está conectado en Work, la Academia y Leadership. Cada sesión de Work avisa una vez por minuto ([usePresencia.js](../../frontend/src/ventanas/herramientas/chat/usePresencia.js)).
- Learnito se abre dentro del chat, con la conversación de siempre.

### 17/11/2026 · Triage: una cuenta desactivada no borra sus llamadas del tablero
- Las métricas del triage solo contaban a las personas con cuenta activa. Al desactivar la de Juliana Avila, sus llamadas salieron de Dirección comercial › Triage: del 26/10 al 17/11 el total bajó de 74 agendas a 44. Ahora cuentan también quienes atendieron llamadas en el período aunque hoy no tengan cuenta activa ([triage_service.py](../../app/services/triage_service.py), `_personas_del_periodo`). Los avisos de Discord siguen mencionando solo a las activas.
- Datos: las dos agendas de Yulissa Jimenez, que habían quedado a nombre de Dari González por el «Pasar a triage» equivocado del 13/11, volvieron a Jean Carlo.

### 17/11/2026 · Mensajes abre el chat del equipo
- El botón Mensajes del dock abre la ventana Chat ([TarjetaSesion.jsx](../../frontend/src/pages/comercial/components/TarjetaSesion.jsx), [ADR-W172](../DECISIONS.md)). En la Academia ya lo abría; en Leadership, Mensajes suma el canal Equipo y Learnito.

### 17/11/2026 · Leadership rápido: lo tuyo de Leadership sin salir de Work
- El botón **Leadership** de la tarjeta de sesión abre una ventana nueva (también en Herramientas, se puede fijar en el dock) en vez de llevar a Leadership entero ([LeadershipVentana.jsx](../../frontend/src/ventanas/herramientas/leadership/LeadershipVentana.jsx), [ADR-W173](../DECISIONS.md)).
- Anotar algo y dejarlo definido con un arquetipo (Quick o Project, cuánto lleva o sus pasos, fecha, quién la hace); lo que falte va al Inbox de Leadership.
- **Lo mío:** lo que te pasaron para definir, los rituals de hoy y lo que sigue en el orden de tu Momentum: completar (con la entrega ahí mismo si la pide), cambiar la fecha, ajustar o pasársela a otro, con «Deshacer». **Lo que pedí:** lo repartido, con su estado y «Pedir un update».
- Work firma un pase por pedido y lo pasa a la API `v1/rapido` de Leadership ([leadership_rapido.py](../../app/api/leadership_rapido.py)); «Abrir en Leadership» abre esa ficha en otra pestaña (`/api/leadership/entrar?abrir=`).

### 17/11/2026 · Chat: reacciones, etiquetas, búsqueda y Learnito en el canal
- En el chat del equipo se reacciona, se etiqueta con @ (llega el aviso a la campanita o a la Academia) y se busca en la conversación ([Mensaje.jsx](../../frontend/src/ventanas/herramientas/chat/Mensaje.jsx), [Escribir.jsx](../../frontend/src/ventanas/herramientas/chat/Escribir.jsx), [ADR-W174](../DECISIONS.md)).
- @Learnito responde en el canal, y la chispa de un mensaje abre Learnito al costado con ese mensaje; su respuesta se puede compartir en el canal ([LearnitoAlCostado.jsx](../../frontend/src/ventanas/herramientas/chat/LearnitoAlCostado.jsx)).

### 17/11/2026 · Chat: conversaciones directas y lo no leído
- Tocar a alguien conectado, o elegirlo con «+» en Conversaciones, abre una conversación directa con esa persona; la lista las muestra con el último mensaje y lo no leído ([ListaConversaciones.jsx](../../frontend/src/ventanas/herramientas/chat/ListaConversaciones.jsx), [ADR-W175](../DECISIONS.md)).
- Quien no tenía cuenta en la Academia (setters, triage, marketing) ya tiene una solo para el chat: se lo ve conectado y se le puede escribir directo (Academia ADR-224).
- El botón Mensajes de la tarjeta de sesión muestra cuántos mensajes hay sin leer ([usePresencia.js](../../frontend/src/ventanas/herramientas/chat/usePresencia.js)).

### 17/11/2026 · Chat: «En llamada» y los desconectados
- Debajo de cada persona conectada se ve lo que está haciendo: «En llamada · hasta 16:30» si tiene una agenda en curso en Work, o «En sesión con…», «En clase», «En reunión» según su agenda de la Academia ([chat.py](../../app/api/chat.py), [ADR-W176](../DECISIONS.md)).
- Debajo de los conectados, los desconectados de los últimos 30 días con cuándo se los vio; la cabecera de una conversación directa también lo dice ([Conectados.jsx](../../frontend/src/ventanas/herramientas/chat/Conectados.jsx)).

### 17/11/2026 · Chat: «En llamada» también en la Academia y Leadership
- Work le pasa a la Academia el «En llamada» de cada persona con su presencia de cada minuto, así lo ven también la Academia y Leadership ([chat.py](../../app/api/chat.py), Academia ADR-226).

### 18/11/2026 · Chat de la Academia: error al abrirlo
- El chat de la Academia daba error 500 al abrirse (código QCIEMADQ): faltaba importar una clase en ChatCenter, y lo mismo en Learnito para @Learnito en el chat. Arreglado en la Academia (`2fb08f40`).

### 18/11/2026 · Cuotas a medida, Learnito en Contacto y reporte diario
- En el plan de cuotas (venta con saldo y Momentum), la opción «Fechas a mano» ahora dice «A medida: quincenal u otras fechas», para que se vea que ahí se cargan los planes quincenales y los montos distintos ([arbolResultado.momentum.js](../../frontend/src/components/ficha/arbolResultado.momentum.js), Leadership 1312).
- Academia: botón «Preguntar a Learnito» en Contacto, sin salir de la lista (Leadership 1318), y el reporte diario de Discord etiqueta a quien no cerró el día (Leadership 973). Informe del recontacto de los 19 inactivos en `academy/docs/AUDITORIA/2026-11-18_RECONTACTO_19_INACTIVOS.md` (Leadership 1356).

### 18/11/2026 · Programas y segmentos, cobranza por origen, pagos que faltaban y victorias
- Vista nueva «Programas y segmentos» (Dirección comercial › Analizar y Marketing › Todos): por programa ventas, cash, ticket, LTV, % cobrado y CAC/ROAS con la etiqueta de programa de cada campaña (Marketing › Meta Ads); por segmento A/B/C/D, CAC y ROAS repartiendo el gasto de setting por agendas (ADR-W177, Leadership 1395 y 1403).
- El estado de pago lleva el origen (setting o workshop) y el setter a la Academia (ADR-W178, Leadership 1392); los pagos llevan el tipo de venta, los que rebotan se reintentan cada 3 h y el gasto de Meta se sincroniza cada 6 h desde Work: faltaba desde el 10/11 (ADR-W179).
- En la ficha › Fulfillment, las victorias del alumno van aparte y con su prueba, para usarlas al cobrar (ADR-W180, Leadership 1401).

### 19/11/2026 · Pedido a los devs
- Herramienta nueva «Pedido a los devs» (Herramientas › Crear, fijable en el dock): un cambio, un error o una duda de la plataforma va directo al Inbox de Leadership del dev. Fijada en el dock de Jean Carlo (ADR-W181, Leadership 1430).

### 19/11/2026 · Workshop: el nombre del taller es su fecha
- El nombre de cada taller sale de su fecha y se actualiza solo al moverlo de día; el formulario ya no tiene el campo «Nombre del workshop». Se corrigieron los nombres que habían quedado atrás (p. ej. «19 de noviembre» con fecha 21/11).
- Los talleres del 21/11 y del 28/11 tienen un grupo de WhatsApp por anuncio (G1–G8 Gral, U1–U6 US y TC1), por ahora con el grupo actual del taller.

### 20/11/2026 · Agendas: franjas fijas, Momentum de 30 y perfil de Mario
- Los horarios que ve el lead son franjas fijas de a sesión + margen desde el comienzo del horario del closer: si una está ocupada se saltea y no se corre la cadena, así no aparecen inicios desalineados como 14:15 (ADR-W182, Leadership 1432).
- La Momentum Session de Jean Carlo pasa de 45 a 30 minutos (dato del evento, Leadership 1433).
- Academia: la cuenta de Mario con el correo de Learnation se llamaba «Mario Testea» (así salía en el chat y en Leadership); ahora es «Mario Bühler», con su foto (Leadership 1444).
- El día que un closer ya tiene una Momentum, a la siguiente solo se le ofrece el horario pegado (cuando termina la anterior con su margen), para que no le corten las sesiones de closing (ADR-W183).
- Academia: canal Sesiones en el chat del equipo, con la nota del reporte de cada sesión, en reemplazo de Discord (Academia ADR-236, Leadership 1389).
- Inbox › Conversaciones: el buscador pasa de la derecha de la cabecera a arriba de la lista de chats, donde lo ve el setter; en la vista Embudo sigue en la cabecera (Leadership 1434).

### 20/11/2026 · Inbox en el espacio del setter, con las fases del setting
- Conversaciones es una sección del dock del setter: trabaja el Inbox sin salir a otro portal (Leadership 1435).
- Las conversaciones tienen fase del setting (Apertura, Conexión, Dolor, Consecuencia, Compromiso, Propuesta, Link, Confirmación, No lead, In-abrible): se cambia desde la tarjeta del lead o con «Adelantar», y al pasar a una fase con varios mensajes se elige cuál pegar en la caja. El Embudo va por fase (ADR-W184).
- Arriba de la lista: buscador, asignación, filtro en dos columnas (con fase y etiquetas), Ordenar (espera, cierre de la ventana, etapa…), filtros guardados como chips y «Elegir» para etiquetar varias de una vez (Leadership 1434 y 1426).
- La tarjeta del lead junta lo que iba en la cabecera del chat (delegar, canal, etiquetas, etapa); arriba del chat queda cuánto espera y cuánto falta para que se cierre la ventana de Instagram.
- Seleccionar parte de un mensaje del lead lo anota para la venta: aparece en la ficha del lead › Comunicación.

- La tarjeta del lead ya no desborda la columna derecha: el canal con campaña larga se corta con «…».
- Reporte del setter precargado con lo que contó el Inbox (ADR-W185): nuevos mensajes, cualificados, no leads e in-abribles por canal; embudo y follow-ups cuando el setter usa las fases. Cada número lleva «Inbox ›» con la lista de conversaciones en un modal, y «Corregido» si el setter lo cambia. Aperturas y bienvenidas siguen a mano, «A confirmar».
- Panel Cierre del dashboard comercial (ADR-W186): aviso de agendas sin resultado por closer (abre Revisar), el camino agendas → se presentaron → presentación → compraron, y el close rate por agenda como tercer anillo y en directas contra triage. No se sacó nada de lo que ya mostraba.
- Dashboard comercial (ADR-W187): Segmentos suma el corte «Respuesta» (cuánto compra cada opción del formulario de agenda y si los puntos del segmento coinciden), y Analizar suma el panel «Por qué compran y por qué no» (decide × invierte y las objeciones de las llamadas que no cerraron, agrupadas).

### 20/11/2026 · El low ticket sale del Closing y cuenta como cierre en el Triage
- Closing (dirección comercial): el low ticket (programa LT) y lo que carga alguien con rol triage ya no cuentan en ventas, cash, close rate, ticket, CAC, fuentes, reporte diario, simulador ni proyección. Pedido del director comercial: la venta de $100 de Dari (Celia Salgado, 18/11) subía el close rate del equipo a 20 % contra 11,1 % de Jean Carlo y bajaba el ticket a $230; ahora el equipo da 11,1 % y $360 (ADR-W188, Leadership 1448).
- Revisar › Ventas suma la faceta «Área» (Closing / Triage); los números del Closing abren la lista con «Área: Closing».
- Las Comparativas de closers ya no muestran a las personas de triage (revierte ADR-W062).
- Triage: el cierre del low ticket es por cobro, con la llamada anterior en la base, como el close rate real del Closing (25 % la semana del 16/11). La tarjeta y el panel muestran lo cobrado y abren sus ventas (ADR-W189).

### 20/11/2026 · Analizar con el Filtro completo de Revisar
- Analizar (dirección comercial, closers) tiene arriba el mismo Filtro completo que Revisar › Agendas y lo comparte con esa tabla: lo que se elige en una se ve en la otra, y queda guardado por usuario. Segmento y País pasan a ser columnas del panel; sus barras se van de esas dos vistas (ADR-W190, Leadership «Analizar con el Filtro completo…»).
- Con el filtro, todo el tablero se recalcula sobre esas agendas y sus leads: show up, close rate, embudo, cash, ticket, por cobrar, fuentes y CAC. Nueva tira con agendas y % de cancelaciones, reprogramaciones y no show. La barra dice «X de Y agendas de closing» y cuántas de triage suma Revisar.
- «Seguimientos en curso»: las agendas filtradas con seguimiento pendiente por contacto de la cadencia (1 a 4) y las vencidas; cada fila abre Revisar.
- «Motivos» y «Copiar motivos para IA»: los motivos de no show, cancelación, reprogramación y no cierre de lo filtrado, con un prompt listo para pegar en cualquier IA y sin nombre ni contacto del lead.
- Probado en local con una copia de producción de hoy: sin filtro, el mes da lo mismo que producción (73 agendas, show up 39,1 %, close rate real 11,1 %, cash $6.982).
- Filtro completo de Analizar y Revisar: «Cumple / No cumple» reemplaza a «Todas / Alguna». «Cumple» deja las agendas (o filas) que cumplen todas las condiciones y «No cumple» el resto, así las dos suman el total (pedido de Kerwin). Thalamus, Marketing y las listas configurables siguen con Todas / Alguna.
- Analizar: arreglos de solapes. En el embudo, el rótulo de cada paso baja a dos líneas y la pastilla «N descartadas» ya no queda debajo de la barra. En el Cierre, con tres anillos el cambio va debajo de «Antes» en vez de meterse en la columna de al lado, y en la tabla por canal el cambio baja debajo del valor anterior.
- Filtros guardados en Analizar y Revisar: el botón «Filtros guardados», al lado de Filtro completo, guarda las condiciones y Cumple / No cumple con un nombre y los vuelve a poner con un clic; se renombran y se borran con deshacer. Son de cada persona y de cada tabla; los de Agendas sirven en las dos pantallas.
- Analizar con filtro muestra solo lo del filtro: Segmentos, Por país, Por qué compran y las listas detrás de cada cifra (Destino de las agendas, No cerradas, Segmentos) cuentan solo las agendas filtradas. Se ocultan las personas sin datos en Segmentos, los segmentos en cero y las fuentes sin cobros. Con Jean Carlo + Elias, Paula, workshop + México, Perú: 39 agendas y $2.043 en todos los paneles.
- Analizar: «Seguimientos en curso» y «Motivos» bajan al final del tablero, después de Por país (pedido de Kerwin, 21/11).
### 21/11/2026 · El motivo de las agendas canceladas en Google
- Cuando el closer cancela o borra el evento en su Google Calendar, Work le pide el motivo: aviso en #📋-reportes que lo etiqueta, línea en el aviso diario de reportes pendientes y tarjeta «Canceladas en tu Google Calendar» arriba de su mazo, con opciones rápidas y un detalle. «La pasé a otro closer», «La reagendé por fuera» y «Error mío» vuelven la agenda a pendiente (ADR-W191, Leadership «Pedir al closer el motivo…»).
- Revisar muestra «Falta el motivo · canceló en Google» en esas agendas; «Copiar motivos para IA» ya no copia la nota automática. Entran las de noviembre (en la copia de producción del 20/11, 5 de Jean Carlo; la de Mario es del 29/10 y queda afuera).
### 21/11/2026 · Closers en el Inbox de Talent
- El Inbox de Talent tiene un desplegable al lado del título: 1 · Asistentes y 2 · Closers, con lo que espera en cada uno; se recuerda por navegador (ADR-W192).
- Con Closers: próximo a revisar (mejor score sin votos), % de preselección y reserva, y tabla con conocimiento, cierre, inglés, video y llamada, WhatsApp y score. Pestañas «Por revisar» e «Incompletas». La búsqueda de la cabecera busca closers.
- Ficha del closer con el diseño de la de Asistente: Cualitativo, Experiencia, Motivación y Archivos, desglose del score por criterio de Clarity (`GET /api/job-applications/<id>` suma `criterios`) y Preseleccionar / Reserva / Descartar como votos, más «Pasar a prueba» con la preselección.
- Dock: la gema de Talent y el avatar ya no se apilan en la isla derecha (la envoltura del avatar va en fila en todas las pantallas) y la gema mide lo que la llave.
### 21/11/2026 · Búsqueda nueva de closers: Antiguos y Hiring · Closers
- Las postulaciones de Closer se archivan (`job_applications.archivada_at`, migración `f7b9d1e3a5c7`): salen del Inbox, las pestañas, Analizados, Revisores y Estadísticas, pero quedan en la base con sus votos (ADR-W193). Se archivan las 682 de septiembre a noviembre para arrancar la búsqueda nueva con el Inbox en cero.
- «Antiguos»: botón discreto al lado de las pestañas del Inbox de Closers con las postulaciones archivadas y el estado que tenían. Se abren con la misma ficha y, una vez abierto, la búsqueda también las encuentra.
- Rol nuevo «Hiring · Closers» (`hiring_closers`), como rol adicional: Talent solo con Inbox (fijo en Closers) y la sección Closers. Puede votar, pero no ve Asistentes, Forms, Stats ni los ajustes de Talent. Para Marlon.
- Confirmaciones: Darian ve en su tablero las agendas sin confirmar de todos los closers y de todos los segmentos («A de Jean Carlo»); al confirmar una de otro closer sale de su tablero y sigue en el del closer, que puede confirmar como respaldo (ADR-W194, Leadership «Darian confirma todas las llamadas…»).

### 22/11/2026 · Aviso de alumno nuevo para fulfillment
- El aviso de #onboardings ya no muestra la plata (sigue en #wins). Lleva programa, fecha de ingreso, etapa, examen, lo que quiere resolver (del formulario de la agenda), dolores, notas del closer y del setter, y el teléfono grande en la tarjeta (ADR-W195, Leadership 1439).
- Academia: guion en vivo de la Onboarding Session con la demostración de Mario y sus correcciones del 17/11 (Academia ADR-243, Leadership 1440).

### 22/11/2026 · Reuniones sin agenda en Operaciones
- Sección nueva «Reuniones» en el espacio del operador: las notas de Meet que no cuelgan de ninguna agenda, en Grupales, Con alumnos y Otras, con búsqueda, filtro por serie y el detalle al costado (resumen, nota completa, Doc, grabación, ficha). Desde el detalle se cambia la categoría de la nota o de toda su serie (ADR-W196, Leadership 1190).

### 22/11/2026 · Guía del setting en el Inbox
- Sección nueva «Guía» en el Inbox y en el espacio del setter: las etapas del setting y lo que se manda en cada una, editable por el equipo y publicada por versiones. Arranca con el documento de setting completo (ADR-W197, Leadership 1436).
- Cada paso tiene opción A y B (o una por respuesta del lead), «Cuándo se usa» (Siempre, Solo si…, Opcional, No se usa), nota y si al mandarlo pasa a la etapa siguiente. Debajo de cada opción, qué porcentaje respondió en 14 días.
- El chat toma la Guía: el guion al pasar de etapa y el «/» (los pasos de la etapa del lead, o de todas escribiendo el atajo). Completa nombre y link de agenda, no deja mandar con [corchetes] sin completar y separa en varios mensajes con una línea en blanco.
- «Quién es lead» y las etapas se proponen y los responde la dirección comercial; el historial deja volver a una versión anterior.

### 23/11/2026 · Segmento C con Mario y Marlon
- El mínimo diario de una estrategia admite varios closers, cada uno con su tope de agendas por día. En Team › Estrategias se suman y se quitan como etiquetas. Segmento C: Marlon y Mario, hasta 5 por día cada uno, además de Dari (ADR-W198, Leadership 1469).

### 23/11/2026 · «Ningún horario me sirve»
- Después de agendar, el lead puede tocar «Ningún horario me sirve» y escribir qué días y horarios le quedan bien. La agenda sigue en pie y la tarjeta del closer y del triage dice «Reagendar: ningún horario le sirve», con lo que escribió (ADR-W199, Leadership 1465, pedido de Marlon).

### 23/11/2026 · El triage confirma todas las agendas de los closers
- Quien tiene el rol triage ve en Confirmaciones todas las agendas de los closers, también las ya confirmadas (quedan en la columna «Confirmado»). Antes era solo Dari por nombre y las confirmadas salían de su tablero. Hoy la única cuenta triage activa es Dari González (ADR-W200).

### 23/11/2026 · Confirmar con vistas: tablero, lista y semana
- Confirmar (triage y closers) tiene vistas guardadas como pestañas, en la misma fila que el título, con Filtro, Ordenar, Agrupar y Propiedades, como en Notion. De fábrica son tres: Por etapa (el tablero de siempre, se entra ahí), Por hora (lista agrupada por urgencia) y Semana (calendario). Cada uno elige qué propiedades y respuestas del formulario ver; se guardan en su cuenta (ADR-W201).

### 23/11/2026 · Darian sin Momentum y sin canceladas fantasma
- En Confirmaciones, el triage ya no ve las Momentum de otros closers: las confirma el closer con su alumno (ADR-W202, pedido de Darian).
- «Canceladas en tu Google Calendar» ya no pide motivo si el lead tiene otra agenda más adelante sin cancelar. Le pasaba a Darian con Gerardo Morales: la movida del 05/11 había dejado dos filas, reportó una y la otra se canceló sola (ADR-W202).

### 24/11/2026 · Embudos: flujos, Guía y seguimientos por fase en un solo lugar
- En el Inbox, Flujos y Guía pasan a ser una sola sección, **Embudos** (también en el espacio del setter). Puede haber varios embudos: Conversión, el de siempre, y otros que se crean aparte, como uno de lead magnet, con sus fases y variables. Cada fase muestra lo que manda el bot (sus flujos), lo que manda el setter (la Guía) y «Si no contesta», la cadencia de seguimientos.
- Cada seguimiento sale a tantas horas del último mensaje del lead, si lo último es nuestro. Lo escribe el setter (le aparece «Toca seguimiento N» en la conversación) o lo manda el motor, con texto y botón con link, siempre antes de las 24 horas. Sirve para la invitación al workshop del proyecto #195 (Estrategia 23/11).
- Los seguimientos arrancan apagados en cada embudo. Al prenderlos queda la fecha y desde ahí solo cuentan las conversaciones nuevas.
- «Simular conversación» prueba el embudo entero con el borrador: escribir como el lead, contestar como setter, adelantar el reloj. No manda ni guarda nada (ADR-W204).

### 24/11/2026 · Webhook de WhatsApp y arreglo del deploy de Embudos
- El deploy de Embudos falló en producción: su migración repetía el ID `c4e6a8b0d2f4`, que ya usaba una de hiring, y Alembic quedó con dos heads. Pasa a `e8f0a2c4b6d1`. Producción siguió con el deploy anterior; no se aplicó nada a medias.
- Nuevo `/api/webhooks/whatsapp` para la app propia «Learnation Contacts» (Neurocogniciones LLC), primer paso del broadcast de WhatsApp al inbox de setters (proyecto #192, Estrategia 23/11). Verifica la suscripción con `WA_WEBHOOK_VERIFY_TOKEN`, comprueba la firma con `WA_APP_SECRET` y guarda cada evento crudo en `whatsapp_webhook_eventos`; el procesamiento al inbox va aparte.

### 24/11/2026 · Broadcast de WhatsApp: backend
- Difusiones de WhatsApp desde Work (proyecto #192): una plantilla aprobada sale a una lista de números de a poco, de 9 a 21 h de Argentina y con tope diario por difusión (arranca en 30; Mario: subir a 60 y 100 si no hay errores). A quien recibió otra difusión en los últimos 7 días no se le vuelve a mandar.
- Sale por el +54 9 387 547-2662 («Neurocogniciones»), no por el +55, que también usa Whatchimp para los avisos de agenda: si el broadcast lo quema, los avisos siguen.
- Las respuestas entran al Inbox de setters como conversaciones de WhatsApp (`wa:<número>`), asignadas al setter con menos WhatsApp nuevos en 24 h y marcadas con la difusión de origen. El setter contesta desde la misma caja, dentro de las 24 h.
- API `/api/whatsapp` (admin): difusiones (crear con lista o CSV, sumar números, activar/pausar, tope) y plantillas (listar y crear).

### 24/11/2026 · Darian recibe el WhatsApp de las agendas de los closers
- El WhatsApp de agenda nueva que recibe cada closer le llega también al triage (Darian), con el nombre del closer y la hora en su zona. No le llegan las Momentum ni se le duplica el de sus propias agendas (ADR-W205).

### 24/11/2026 · Broadcast de WhatsApp: flujos e Inbox (ADR-W206)
- Los flujos del Inbox funcionan por WhatsApp: una difusión puede tener un flujo, y tocar un botón de la plantilla sigue por el botón del nodo de inicio que se llama igual (por ejemplo «Sí, tengo conocidos» → el link del grupo). Lo que el flujo no responde queda para el setter en «Esperan respuesta».
- WhatsApp no dispara las campañas por palabra clave ni la bienvenida de Instagram. Si un setter escribe, el bot se pausa como en Instagram.
- El webhook de WhatsApp despierta al reloj del motor y los eventos se procesan con su candado.
- Inbox: ícono de Instagram o WhatsApp en la lista y en el chat. En WhatsApp la ventana es de 24 h (avisa en las últimas 3 h) y el nombre sale del perfil, no como @usuario.
- Migración `a7c9e1f3b5d8` (`flujo_id` en `wa_difusiones`, idempotente).

### 24/11/2026 · Darian etiquetada en los avisos de agenda de Discord
- El aviso de agenda nueva, reprogramada o pasada a closing en Discord etiqueta también a Darian (triage), además del closer y el setter. No en las Momentum ni en sus propias agendas (ADR-W207, pedido de Mario).

### 25/11/2026 · Un «Training» personal vuelve a ocupar
- El filtro de capacitaciones internas (29/10) tomaba cualquier título con «training», así que el «🥊 Training» diario de Mario (13:30, su calendario personal) no bloqueaba y le cayó una agenda encima. Ahora solo se saltean «Training Session», «Trainning…» y «Capacitación»; las «Trainning Session» de Andrés siguen sin ocupar.

### 25/11/2026 · Work como conector de claude.ai para la tabla de Testeo (ADR-W208)
- Ruta nueva `/api/mcp/<MCP_PUBLICACION_TOKEN>`: un servidor MCP de solo lectura con la herramienta `metricas_publicacion` (visitas y clics a WhatsApp por anuncio de Meta, entrantes/agendas/ventas/cobrado por campaña de DM y agendas/ventas/cobrado del workshop del período, neto).
- La usa Learnation Marketing (Publicación › Testeo, Escalado y Apagado) junto con los números de Meta. Se carga en claude.ai como conector propio «Learnation Work».
- `workshop_metrics_service.resumen_periodo`: las cifras del workshop para cualquier período, con el criterio de `calcular_prefill`.
- Variable nueva en Railway: `MCP_PUBLICACION_TOKEN`.

### 25/11/2026 · Confirmación y reprogramar, rehechos (ADR-W209)
- Confirmación: el pie queda con «Seguir después» y el CTA «Listo · 100% confirmado», más grande. Arriba, «¿Cambió algo con la llamada?» con Reprogramar, Canceló y Descalificado en tarjetas iguales que dicen qué hacen; «Eliminar lead» pasa a un link chico.
- Reprogramar en tres pasos (con quién → día y hora → motivo): grupo Closers/Triage (por defecto el de quien tiene la llamada) y una persona o «Cualquiera» con sus horarios libres contados. Días y horas se tocan, en la hora del lead con la tuya debajo, en mañana/tarde/noche y de a 30 min.
- «Con al menos»: la anticipación mínima de los horarios ofrecidos (15 min, 1 h, 2 h, 4 h o 1 día; 1 h por defecto, se recuerda).
- Con «Cualquiera» la llamada queda con la persona actual si está libre; si no, con la que tiene más horarios libres (se puede cambiar entre las libres a esa hora).
- `GET /api/ficha/<id>/reprogramar/opciones` devuelve los horarios de todo el grupo por persona con una sola lectura de ocupación (`a_triage.horarios_de_varios`).

### 25/11/2026 · Confirmación: No show, CTA a todo el ancho y pestañas repartidas (ADR-W210)
- Las tarjetas de «¿Cambió algo con la llamada?» son Reprogramar, Canceló y No show, sin descripción. Se sacan «Descalificado» y «Seguir después».
- «No show»: motivo obligatorio y fecha para volver a escribirle (opcional); deja la cita en «No Show». Ruta nueva `POST /api/ficha/<id>/no-show`.
- «Listo · 100% confirmado» va solo, a todo el ancho.
- Las pestañas de la ficha (Confirmación, Resultado, Historial…) se reparten todo el ancho en pantalla ancha.

### 25/11/2026 · Reprogramar con calendario y la ficha en modo enfoque (ADR-W211)
- Al abrir Reprogramar, Canceló o No show, la ficha muestra solo la cabecera del lead y esa tarea: sin pestañas ni barra de guardado hasta «Volver».
- Reprogramar: primero el día en un calendario (con cuántos horarios tiene), después la hora. Cada hora está en la del lead y dice de quién es y qué hora es para esa persona («Marlon · 10:30 en Bogotá»).
- Tarjetas de personas con su cuenta de horarios y ciudad; resumen final con día, hora del lead y quién; movimiento en los pasos.
- El pie de las sub-vistas ya no deja el hueco a la derecha en pantallas anchas.

### 25/11/2026 · Confirmar: calendario de 1, 2, 3 o 7 días y barra siempre pegada (ADR-W214)
- La fila de Confirmar (vistas, filtro, propiedades) queda pegada debajo del header en todas las vistas. El calendario es una sola caja del alto de la pantalla con la fila de días pegada y arranca una hora antes de ahora.
- «Semana» pasa a «Calendario»: Hoy, anterior/siguiente, Día · 2 días · 3 días · Semana y zoom −/+.
- Cada llamada muestra hora, nombre, etapa en texto y etiquetas: Triage/Closing, closer, decide, invierte, ingresos, segmento y respuestas del formulario. Las que se pisan se escalonan.
- Propiedades nuevas: «Tipo de llamada» e «Ingresos». El filtro separa Triage de Closing.
- El mazo de confirmaciones manda `closer_role`.

### 25/11/2026 · Reprogramar con colores por closer, todos los horarios y banderas (ADR-W212)
- Cada closer tiene su color: en su tarjeta, en los puntos del calendario y en cada hora. Las horas con más de uno libre se marcan como superpuestas.
- Todos los horarios del día a la vista, en chips chicos por mañana/tarde/noche. Al elegir uno se ve con quién queda y su hora, con banderas.
- Menos texto en los pasos; íconos en la cabecera, el grupo y las franjas.
- Confirmación: tarjetas Reprogramar/Canceló/No show, pestañas y «Listo · 100% confirmado» con más calidad y movimiento.

### 25/11/2026 · Configuración: Disponibilidad a lo ancho, Sesiones aparte y cupos libres (ADR-W213)
- La ventana de Configuración abre más ancha (1240 px) y el horario se ve en 7 columnas.
- Disponibilidad sin descripciones; zona y tope semanal más cortos, con ícono; se saca «Vaciar».
- El tope por semana de la Configuración ahora se guarda (antes se perdía).
- Sesiones es una pestaña propia.
- Google Calendar: arriba los calendarios que te bloquean, abajo los que no, en dos columnas. WhatsApp en una fila.
- Cupos libres de los próximos 7 días, por día, en Disponibilidad y en Google Calendar; se recalculan al editar el horario o cambiar un calendario y muestran cuánto subió o bajó (`POST /api/auth/me/disponibilidad/cupos`).

### 25/11/2026 · Inbox: «Esperan respuesta» por último mensaje
- La cola «Esperan respuesta» ordena por defecto por el último mensaje (el más reciente arriba), no por el que más espera: arriba quedaban los chats viejos ya cerrados y tapaban los importantes (pedido de Paula). «Esperan más de 1 h» sigue por espera, y cada uno puede cambiar el orden con Ordenar.

### 25/11/2026 · Reprogramar: pasos y controles en la fila del título
- El título «Reprogramar», los pasos y, en «Día y hora», la zona del lead y la anticipación van en una sola fila: más lugar para el calendario y los horarios.
- La zona del lead dice solo el país («Chile»), sin «· la del lead».

### 25/11/2026 · Workspace con sidebar y calendario con etiquetas (ADR-W215)
- Siguiente, Confirmación y Comisión pasan a un sidebar chico a la derecha, pegado al scrollear: anillo animado, racha y chips, menos texto.
- La barra de Confirmar arranca con las pestañas (sin repetir «Confirmar»).
- Calendario: cada llamada con etiquetas de color (etapa, segmento, decisor, inversión por defecto) que entran animadas; al pasar el mouse se abre entera. Teclas 1, 2, 3, 7 (días), ← → y T (hoy).
- El calendario de Confirmar (antes anotado como ADR-W212, número repetido) queda como ADR-W214.


### 25/11/2026 · Reprogramar sin indicador de pasos
- Se saca la fila «Con quién · Día y hora · Motivo»: se avanza con «Siguiente» y se vuelve con «Volver». Closers/Triage pasa a la fila del título, como la zona del lead y la anticipación.
- Los controles de «Día y hora» dicen qué son en una palabra: «Lead:» con la bandera y «Espera:» con el reloj de arena, separados por una línea y con más aire entre ellos.

### 25/11/2026 · Horario en calendario, Google Calendar y WhatsApp separados (ADR-W216)
- El horario se marca en un calendario: arrastrar para marcar (también varios días de una), mover un bloque, estirar sus bordes, × para quitar, copiar el día desde su cabecera. La vista Lista queda como opción.
- En la Lista, la ×, el + y copiar van en una sola fila; todos los íconos explican qué hacen al pasar el mouse.
- Configuración: Google Calendar y WhatsApp son pestañas separadas.
- WhatsApp con sus tres pasos (número, prueba, confirmado) y «Mandarme otra prueba».
- Cupos con número que cuenta, aura y barras de color; la primera es «Hoy».

### 25/11/2026 · Reprogramar más directo; «Volver» en la cabecera de la ficha
- Tocar a una persona (o «Cualquiera») pasa solo a «Día y hora».
- «Siguiente» aparece en la franja del horario elegido; el pie de abajo queda solo para «Reprogramar» en el último paso.
- El «Volver» de toda sub-vista de la ficha (Reprogramar, Canceló, No show, cobros…) pasa a la cabecera, al lado de los íconos y de cerrar.

### 25/11/2026 · Confirmar: tarjetas enteras de entrada, teclas 1 a 9 y menos movimiento
- Calendario de Confirmar: cada llamada se ve entera desde el principio (todas sus etiquetas), sin tener que pasar el mouse.
- Las teclas 1 a 9 eligen cuántos días ver (antes solo 1, 2, 3 y 7); desde 5 días las columnas van angostas.
- Menos movimiento: las tarjetas y etiquetas aparecen al instante (sin escalonar ni agrandarse), igual que la columna de la derecha del Workspace y la Configuración (Disponibilidad, cupos, WhatsApp).

### 25/11/2026 · Confirmar: lápiz para renombrar las vistas
- Al pasar el mouse por una vista (Por etapa, Mis llamadas, Mi calendario…) aparece un lápiz que la renombra; el doble clic sigue andando.

### 25/11/2026 · Workspace: riel derecho a toda la altura y barra pegada al header (ADR-W217)
- El sidebar de tarjetas pasa a ser un riel de 288 px de arriba abajo: siguiente lead con sus etiquetas, barra por etapa animada, «Hoy» (pendientes por sección, racha, XP), próximas llamadas y comisión.
- La barra de vistas de Confirmar queda pegada justo debajo del header, de borde a borde; el tablero y el calendario llenan el alto hasta el dock.


### 25/11/2026 · Riel del Workspace: el siguiente lead entero y sin pisarse con el dock
- La tarjeta del siguiente lead se achicaba (el riel la comprimía) y no se veían el nombre ni el botón: ahora ninguna pieza del riel se achica y el riel scrollea si no entra.
- El riel termina arriba del dock y se desvanece al final; el fondo y la línea siguen hasta abajo. Secciones un poco más compactas.

### 25/11/2026 · Reintento solo cuando Work se está actualizando
- «Application failed to respond» al guardar Sesiones no era un error del guardado: Work tiene un volumen en Railway y en cada deploy el servidor se apaga ~1 minuto (ese día hubo cinco seguidos).
- Ahora `services/api.js` reintenta solo los pedidos repetibles (GET, PUT, DELETE; un POST con `reintentable: true`) que reciben 502/503/504, durante ~90 s, con el aviso «Work se está actualizando… reintentando solo». Si igual falla, el mensaje sale en castellano.

### 25/11/2026 · Riel más corto y tarjeta de Confirmar más limpia
- Riel: sin la tarjeta del siguiente lead ni «Próximas llamadas» (pedido de Mario); queda Confirmación, Hoy y la comisión, y entra todo.
- Tarjeta del tablero: el segmento es solo la letra (A, B, C, D) sobre el avatar, con los puntos en el title; la fila de datos queda en inversión · decisor · origen, y debajo del teléfono una línea chica con examen y país (sale del prefijo del teléfono).
- Calendario y lista también muestran el segmento como letra sola.

### 25/11/2026 · Novedades del Workspace: portada y recorrido (ADR-W218)
- Closers y triage ven, al entrar, una portada a pantalla completa «Hay novedades en Work» con los seis cambios del día y «Mostrame».
- El recorrido ilumina cada lugar real (riel, pestaña Calendario, calendario, tarjeta, la llamada para Confirmación, el personaje del dock) con una tarjeta animada al lado; Reprogramar y «Y además» van al centro.
- Se vuelve a abrir desde Herramientas › Novedades o con `?novedades=1`. Se muestra una vez por persona y navegador.

### 25/11/2026 · Novedades otra vez para todos y obligatorias (ADR-W219)
- Vuelve a aparecer a todos los closers y triage, también a quien ya lo había visto.
- No se puede cerrar ni posponer hasta terminar el último paso; recargar a la mitad lo empieza de nuevo.

### 25/11/2026 · Confirmar: propiedades que no saltan, orden arrastrando y Hora que se apaga (ADR-W220)
- Prender o apagar una propiedad ya no cambia el orden de la lista (antes la fila tocada saltaba y parecía que no cambiaba).
- Cualquier fila se ordena arrastrándola; las etiquetas de la llamada salen en ese orden.
- En el calendario, Hora prende y apaga la hora del título.

### 25/11/2026 · Novedades: se puede probar todo durante el recorrido (ADR-W221)
- «Probalo» en cada paso: abre una llamada en Confirmación, Reprogramar o tu horario; tocar lo iluminado también deja usarlo.
- Mientras se prueba, el recorrido queda como un botón abajo a la izquierda, «Seguir el recorrido».

### 25/11/2026 · Propiedades que quedan guardadas y changelog que vuelve con cada cambio (ADR-W222)
- El servidor rechazaba las preferencias del dock de más de 20 000 caracteres sin avisar: el cambio de propiedades se perdía al recargar. Tope 100 000 y el rechazo queda en el log.
- Prender o apagar una propiedad no guarda el orden; arrastrar guarda uno corto (sin las preguntas del formulario).
- Novedades: cualquier cambio en el recorrido lo vuelve a mostrar a todos, también a quien ya lo terminó.

### 25/11/2026 · Inbox: un mensaje que «no salió» ya no se manda dos veces
- Cuando la conversación es de otra app (Kommo, ManyChat), Instagram a veces devuelve error y el mensaje sale igual: el setter veía «no salió» y al reintentar el lead lo recibía dos veces (4 casos de Paula hoy, también a Eli). Ahora, si Instagram ya entregó ese mismo texto hace menos de 2 minutos y quedó sin autor, Work no lo vuelve a mandar: lo da por enviado y lo pone a nombre de quien lo escribió.
- En el chat, el «no salió» desaparece solo cuando el mensaje aparece como enviado.

### 25/11/2026 · Inbox: el buscador encuentra lo que el equipo ya escribió
- El buscador de Conversaciones busca por usuario o nombre; con «#palabra» (por ejemplo «#resúmenes») busca en los mensajes que el equipo le mandó a cada lead: sirve para encontrar una devolución ya dada y reusarla (pedido de Paula).

### 25/11/2026 · «Mi sueldo» en Herramientas (ADR-W223)
- Setters, closers y el director comercial tienen «Mi sueldo» en Herramientas › Mi cuenta: el total del mes con su estado, de qué se compone (sueldo base, comisión por primer pago, cuotas, renovaciones y upsells —o ventas propias y como director—, ajuste manual, bonos y descuentos) y los últimos 4 meses.
- A la derecha, los pagos que suman la comisión; tocar un concepto deja solo los suyos. El «?» explica cómo se calcula.
- El director, admin y operador eligen a cualquiera del equipo comercial (pedido de Marlon).

### 25/11/2026 · Mi sueldo: lo que da 0 no aparece
- Un sueldo base de 0 o un concepto sin comisión (por ejemplo, con todos sus pagos excluidos) ya no se muestra en la lista ni como filtro de pagos.

### 25/11/2026 · Agendas: «días hábiles» incluye el sábado (ADR-W224)
- Los eventos con «N días hábiles» cuentan y ofrecen de lunes a sábado; solo el domingo queda afuera. Antes salteaban el sábado: el lead nunca veía esos horarios y la ventana se estiraba (un miércoles con 3 hábiles llegaba al lunes; a Mario le agendaron así). Ahora llega al sábado ([disponibilidad.py](../../app/agendas_v2/nucleo/disponibilidad.py), [disponibilidad.js](../../frontend/src/pages/agendas_v2/core/disponibilidad.js)).

### 25/11/2026 · Inbox: lo que pidieron los setters (reunión del 24/11)
- La bandeja carga 500 conversaciones (antes 300, que se llenaban en 4 días) y al final ofrece «Cargar 500 más», hasta 2000. El último mensaje de cada una sale en una sola consulta (antes, una por conversación en cada refresco).
- En el chat, lo que entró por un comentario dice «Comentario en una publicación», con link a la publicación (se le pide a Meta una vez y queda guardado).
- Los mensajes de la Guía con varias partes salen de a uno, con 5 segundos entre cada uno; los que esperan se ven «en cola». Si uno no sale, los siguientes quedan con Reintentar para mandarlos en orden (antes se perdían).
- La caja de texto crece hasta 220 px y después se desplaza: lo que pasaba del alto quedaba cortado.

### 25/11/2026 · Discord: los reportes vuelven a #📋-reportes y sin @everyone
- Desde el 23/11 los reportes de setter y closer llegaban a #📄-reports de fulfillment (la variable del webhook de reportes apuntaba a otro canal). Ahora los de closer, setter y triage salen por el bot al canal fijo de #📋-reportes de adquisitions; el webhook queda solo si no hay bot ([envio.py](../../app/services/discord_avisos/envio.py)). Se borraron los 10 mensajes que llegaron mal.
- Los reportes ya no etiquetan a todos (pedido de Santi).
- El reporte de closer cerrado solo a las 10:00 salía siempre «enviado tarde»: tomaba la hora del cierre como hora de envío. Ahora toma la última vez que escribió la persona ([cierre.py](../../app/reporte_dia/cierre.py)).

### 25/11/2026 · Novedades: «Después» hasta 3 días (ADR-W225)
- La portada de novedades ofrece «Después» con los días que quedan: lo deja hasta mañana. A los 3 días de haber aparecido ya no se puede aplazar y hay que hacer el recorrido ([Novedades.jsx](../../frontend/src/pages/closer/novedades/Novedades.jsx)).

### 25/11/2026 · Turnos: lo que ve el lead y los días de cada link (ADR-W226)
- Turnos abre en «Por link»: Workshop, Setting y Academy Web con los próximos 10 días, closers y triage, qué días ve el lead, qué queda fuera y los horarios de cada día con quién atiende. «Por segmento» muestra A, B, C y D del link elegido. La tabla de antes queda en «Semana del equipo».
- Los días del link se cambian ahí mismo (− / +, hábiles o corridos) y van directo al link en vivo; los puede cambiar también el setter. «Copiar link» y «Abrir» en cada tarjeta; al setter le copia su link con su código.

### 25/11/2026 · Portal: los setters ven Agendamiento
- La tarjeta Agendamiento aparece en el Portal de los setters (Eli y Paula), en solo lectura como ya lo permitía el servidor desde el 10/10. Antes el rol setter solo tenía Setting e Inbox ([areas.js](../../frontend/src/utils/areas.js)).
- Los setters ya no entran en solo lectura: configuran Agendamiento igual que la dirección comercial (ADR-W227, [api_admin.py](../../app/agendas_v2/api_admin.py)).

### 25/11/2026 · #agendas de fulfillment: solo los resultados de Momentum
- El resultado de cada llamada que reporta el closer iba entero a #agendas (y al canal Agendas del chat de la Academia). Ahora solo van las Momentum (seña y cierre); las llamadas de venta ya no se avisan ahí (pedido de Mario, 19/11 y 25/11) ([resultado.py](../../app/services/discord_avisos/resultado.py)).

### 25/11/2026 · Work en el celular (ADR-W228)
- El riel ya no queda encimado con el tablero: en el celular es una tira de tarjetas que se desliza; las vistas y sus controles van en dos filas deslizables; las etapas del tablero se deslizan de costado; la lista deja el nombre fijo; el calendario arranca en 3 días ([sidebar-v6.css](../../frontend/src/pages/closer/sidebar-v6.css), [confirmar.css](../../frontend/src/pages/closer/confirmar/confirmar.css)).
- La ficha se abre a pantalla completa con la cabecera compacta, y las etapas de confirmación ya no se pisan ([ficha-telefono.css](../../frontend/src/components/ficha/ficha-telefono.css)).
- El dock tapa bien las secciones detrás de Herramientas y el avatar. En el recorrido de novedades, la barra «Probando» vuelve a su alto (también en la compu).

### 25/11/2026 · Inbox: el chat en el orden real y ajustes visuales
- Los mensajes del bot se guardaban todos con la hora en que arrancó a responder, sin contar las pausas de «escribiendo…»: si el lead contestaba en el medio, su mensaje quedaba al final y el chat figuraba «sin respuesta» (caso de Paula). Ahora cada uno lleva la hora en que sale. Los chats anteriores no se corrigen.
- La columna de la lista se desbordaba sobre el chat (buscador, filtros y «Elegir»): ahora respeta su ancho y «Asignadas a» se achica con «…». «Cargar 500 más» pasa a ser un link chico y el buscador dice «Usuario, nombre o #palabra».

### 25/11/2026 · Broadcast de WhatsApp a mano (ADR-W229)
- Herramienta nueva «Broadcast de WhatsApp» (Herramientas › Crear, admin y operador): se carga el CSV, se elige una plantilla aprobada y se manda a los próximos N, con el tope de 100 por día a la vista y «Frenar» ([broadcastWa/](../../frontend/src/ventanas/herramientas/broadcastWa/)).
- «Historial» muestra cada envío con entregados, leídos, respondieron y fallaron; cada número con el botón que tocó, su chat en el Inbox y el setter. Se descarga en CSV.
- Una sola tabla, `wa_envios`, en lugar de las dos de difusiones (vacías); sin envío automático ni flujo por difusión ([envios.py](../../app/whatsapp/envios.py)).

### 25/11/2026 · Inbox: abren las conversaciones que empezaron por un comentario
- Las conversaciones que arrancaron con un comentario en una publicación no cargaban (31 en las últimas 48 h; lo reportó un setter): el link a la publicación se le pedía al transporte real, pero el método había quedado en el de simulación. Ahora está en el real ([transporte.py](../../app/automatizaciones/transporte.py)).

### 25/11/2026 · Inbox: el feedback de Mario
- No lead e In-abrible salen de la bandeja: solo queda lo pendiente. Si el lead vuelve a escribir, reaparece; se ven filtrando por esa etapa y siguen en el Embudo (ADR-W230).
- Filtro por canal (Instagram o WhatsApp), con cuántos hay de cada uno.
- El nombre del lead va primero y grande (lista, chat y tarjeta); el @usuario queda debajo en la tarjeta.
- Lo que Meta no deja ver se explica en palabras: «Mensaje que WhatsApp no deja ver acá: miralo en el teléfono» en vez de «[unsupported]», y los adjuntos de Instagram («📷 Imagen», «🎬 Compartió un reel»…) en vez de «📎 unsupported_type».

### 25/11/2026 · Inbox: el bot contesta en público los comentarios (ADR-W231)
- Cuando un comentario dispara un flujo, además del DM el bot contesta debajo del comentario («¡Te escribí por privado! 📩» y otras cuatro, al azar), como hacía ManyChat: al lead le llega la notificación y es más probable que abra el mensaje ([respuesta_publica.py](../../app/automatizaciones/respuesta_publica.py)).

### 25/11/2026 · Broadcast de WhatsApp: al azar entre plantillas (ADR-W232)
- Cada número recibe una de las marcadas, en partes iguales, y el historial compara cuánto leyó y respondió cada una.

### 25/11/2026 · Agendas: Work sigue la reagenda hecha en Google después de la llamada (ADR-W233)
- Dari movió en su Google Calendar la llamada de Melanie Rivera al domingo y Work la seguía mostrando atrasada: solo seguía los eventos movidos hasta 2 h después de la hora de la agenda. Ahora también sigue los de agendas sin reportar de los últimos 14 días, cuando el evento quedó en una hora futura ([movidas.py](../../app/agendas_v2/movidas.py)).

### 25/11/2026 · Plantillas de WhatsApp con botones
- El alta de plantillas acepta `botones` de respuesta rápida (hasta 10, de 25 caracteres): para las plantillas de la estrategia de referidos. Al enviarlas no llevan parámetros y el toque llega al inbox como texto, para el setter ([api.py](../../app/whatsapp/api.py)).

### 25/11/2026 · Flujo de conversión con su propia apertura (dato, sin código)
- «Direct Sale (conversión)» mandaba los mismos mensajes que Lead Magnet. Versión 2 con los de Eli: «Vi que comentaste una de mis publicaciones para ayudarte con tu preparación…» y «Genial entonces», con el saludo de cada setter.

### 25/11/2026 · Inbox: los audios en ogg, opus o webm se pueden subir
- Las notas de voz de WhatsApp (ogg/opus) y lo grabado en el navegador (webm) no se podían mandar: Instagram no los reproduce y el inbox los rechazaba (lo reportó Elias; no había ningún audio subido). Ahora el servidor los pasa a mp3 al subirlos ([audio_formato.py](../../app/automatizaciones/audio_formato.py), ffmpeg en el Dockerfile). Si el navegador no sabe el tipo, manda la extensión.
- La fila de la bandeja muestra «🎤 Audio» (o el adjunto que sea) cuando el último mensaje no tiene texto, como un audio mandado desde la app; antes quedaba «…».

### 25/11/2026 · Broadcast de WhatsApp: pestaña Plantillas y respuesta por botón (ADR-W234)
- «Plantillas» al lado de «Historial»: todas las de Meta con su estado (aprobada, en revisión, rechazada con el motivo), cómo le llegan, crear una con botones, duplicar y borrar.
- Cada botón de una plantilla puede contestar solo, con sus propios botones, asignar la conversación y ponerle una etiqueta ([respuestas.py](../../app/whatsapp/respuestas.py)). Sin configurar, queda para el setter como antes.
- Triage (Dari) entra al Inbox como un setter y se le pueden asignar conversaciones; no entra al reparto de las campañas.

### 25/11/2026 · Broadcast de WhatsApp: un envío fallido no saca al número
- La prueba interna de referidos (Santi, Mario, Dari, Marlon) falló entera con «131042: Business eligibility payment issue»: la cuenta de WhatsApp Business no tiene método de pago. Esos envíos no llegaron, pero el número quedaba como «ya recibió» y no se le podía volver a mandar. Ahora un envío fallido no cuenta ([envios.py](../../app/whatsapp/envios.py)); las 4 filas de la prueba se borraron.

### 25/11/2026 · WhatsApp: los celulares de Argentina y México se reconocen con y sin el 9 (o el 1)
- En la prueba de referidos, Santi tocó un botón y quedó para el setter: el broadcast salió a 54 387… y WhatsApp respondió desde 549 387…, así que Work no lo reconocía como del broadcast ni sabía de qué plantilla era. Ahora las dos formas son el mismo número, al marcar la respuesta y al saltear a quien ya recibió ([cliente.py](../../app/whatsapp/cliente.py) `variantes`).

### 25/11/2026 · Inbox: «No requiere respuesta» (ADR-W235)
- Pedido de Paula y Elias (reporte #26): los leads que ya agendaron y mandaron el último mensaje quedaban en «Esperan respuesta». Arriba del chat hay un botón «No requiere respuesta» que lo saca de las colas de espera hasta que el lead vuelva a escribir; el mismo botón lo deshace ([api_trabajo.py](../../app/automatizaciones/api_trabajo.py) `marcar_resuelta`, [colas.js](../../frontend/src/pages/inbox/conversaciones/colas.js) `resuelta`). Migración `a2c4e6f8b0d1`.

### 26/11/2026 · Broadcast de WhatsApp: tope de 200 por día
- El tope propio del broadcast pasa de 100 a 200 por día ([envios.py](../../app/whatsapp/envios.py) `TOPE_DIARIO`). El número está en calidad verde y Meta permite 250 personas por día en este nivel; queda margen para las respuestas de los setters.
- Un envío que falla ya no ocupa el tope del día ([envios.py](../../app/whatsapp/envios.py) `usados_hoy`): el primer lote real (64 no cerrados y 36 del taller) falló entero con «131042» (pago de Meta) y dejaba el día sin cupo.

### 26/11/2026 · Inbox: el mensaje del broadcast se ve en el chat
- Cuando un lead responde a un broadcast de WhatsApp, el chat arranca con la plantilla que recibió (con su nombre y los botones al pie), para que el setter sepa a qué responde ([plantilla_en_chat.py](../../app/whatsapp/plantilla_en_chat.py)). Se completó en los que ya habían respondido.
- Primer envío real (26/11 de madrugada): 54 no cerrados y 33 del taller entregados; a la mañana respondieron 9 y 8.

### 26/11/2026 · Broadcast de WhatsApp: la respuesta a un botón puede esperar y saludar por el nombre (ADR-W236)
- En «Cuando tocan un botón» cada respuesta elige si sale al instante o a 1, 2 o 5 minutos, y `{nombre}` pone el primer nombre del lead ([respuestas.py](../../app/whatsapp/respuestas.py)). Pedido de Marlon para que «soy mario no el bot» no llegue en un segundo. Migración `b3d5f7a9c1e2`.

### 26/11/2026 · Inbox: el número de WhatsApp arriba del chat
- En los chats de WhatsApp, el número del lead aparece al lado del nombre en la línea de arriba; tocarlo lo copia ([Detalle.jsx](../../frontend/src/pages/inbox/conversaciones/Detalle.jsx) `Telefono`). Pedido de Mario: con nombres como «👻» no había forma de saber quién era sin abrir la ficha.

### 26/11/2026 · Inbox: en WhatsApp se ve a qué mensaje responde el lead, y sus stickers, fotos y audios (ADR-W237)
- Cuando el lead responde (o reacciona) a un mensaje en particular, arriba de su burbuja aparece el mensaje citado; tocarlo lleva hasta él ([medios.py](../../app/whatsapp/medios.py) `citas`, [Whatsapp.jsx](../../frontend/src/pages/inbox/conversaciones/Whatsapp.jsx)).
- Los stickers, fotos, audios, videos y documentos se ven en el chat: se bajan de Meta cuando se abre la conversación ([api_medios.py](../../app/automatizaciones/api_medios.py)). Probado en producción con el chat de Jesus Montes: 4 citas encontradas y el sticker bajado.

### 26/11/2026 · Inbox: panel del lead y línea de arriba del chat rediseñados (ADR-W238)
- La tarjeta del lead muestra el nombre con que agendó en Work (no «👻»), su número y su última agenda; asignado, canal y bot en pastillas; la etapa con su avance y «Adelantar» al lado ([TarjetaLead.jsx](../../frontend/src/pages/inbox/conversaciones/TarjetaLead.jsx), [cliente_del_contacto.py](../../app/automatizaciones/cliente_del_contacto.py)).
- La ficha (tareas, notas, variables, recorrido) son filas con ícono y cuenta ([FichaLead.jsx](../../frontend/src/pages/inbox/conversaciones/FichaLead.jsx)).
- Arriba del chat y en la lista: barrita de etapa, reloj de espera y anillo de la ventana en vez de los tres puntos y los textos largos ([Indicadores.jsx](../../frontend/src/pages/inbox/conversaciones/Indicadores.jsx)).

### 26/11/2026 · Inbox: tarjeta en bloques, chat más alto, caja más ancha y sin recuadro oscuro (ADR-W239)
- El recuadro oscuro detrás de la barra de Conversaciones venía de Confirmar del closer, que usa las mismas clases; ahora no aplica dentro del Inbox ([confirmar.css](../../frontend/src/pages/closer/confirmar/confirmar.css)).
- La tarjeta del lead va en bloques y trae lo que antes iba arriba del chat (número, espera, anillo, «No requiere»), el bot con «Pausar» y No lead / In-abrible a un toque ([Ahora.jsx](../../frontend/src/pages/inbox/conversaciones/Ahora.jsx), [TarjetaLead.jsx](../../frontend/src/pages/inbox/conversaciones/TarjetaLead.jsx)).
- La caja de escribir: herramientas y Learnito en la fila de Chat/Nota/Tarea; el texto a todo el ancho ([Composer.jsx](../../frontend/src/pages/inbox/conversaciones/Composer.jsx)).
- La fila de la bandeja en dos líneas, con el nombre con que agendó en Work ([Fila.jsx](../../frontend/src/pages/inbox/conversaciones/Fila.jsx)).
- La bandeja termina arriba del dock ([useAltoLibre.js](../../frontend/src/pages/inbox/conversaciones/useAltoLibre.js)). «Volver a mi sesión» es una pastilla chica al lado del saludo.

### 26/11/2026 · Espacio del setter: encabezado en una fila y el dock ya no tapa el chat (sigue ADR-W239)
- El encabezado es «Hola, Paula.» y, a la derecha, botones redondos con ícono: Links (con un link lo copia; con varios abre la lista), Turnos, Tálamus y, simulando, el fantasma para volver a la sesión propia. Al pasar el mouse cada uno se estira y dice qué es. El subtítulo de la sección queda solo para el lector de pantalla ([SetterEspacioPage.jsx](../../frontend/src/pages/setter/SetterEspacioPage.jsx), [MisLinks.jsx](../../frontend/src/pages/setter/MisLinks.jsx)).
- La bandeja seguía metida bajo el dock: el alto se medía una sola vez al montar, cuando la bandeja todavía estaba cargando. Ahora mide apenas aparece y con cada cambio de tamaño ([useAltoLibre.js](../../frontend/src/pages/inbox/conversaciones/useAltoLibre.js)).

### 26/11/2026 · Espacio del setter: la barra de Conversaciones sube a la fila del saludo
- En Conversaciones y Embudos, los filtros guardados, Chats | Embudo, Tareas, Avisos y Stats van en la misma fila que «Hola, Paula.» y los botones redondos; ya no hay fila «Conversaciones». El Inbox manda su barra con `HeaderActions` a un lugar del encabezado del setter con las clases de Thalamus ([SetterEspacioPage.jsx](../../frontend/src/pages/setter/SetterEspacioPage.jsx), [InboxEmbebido.jsx](../../frontend/src/pages/inbox/InboxEmbebido.jsx)).
- Tareas, Avisos y Stats llevan su palabra al lado del ícono ([Conversaciones.jsx](../../frontend/src/pages/inbox/Conversaciones.jsx), [MisTareas.jsx](../../frontend/src/pages/inbox/conversaciones/MisTareas.jsx)).

### 26/11/2026 · Broadcast de WhatsApp: los alumnos activos se saltean
- Al revisar un CSV, el broadcast cuenta a los que tienen una suscripción vigente (por teléfono) y por defecto los saltea: un mensaje de captación no le llega a quien ya compró ([envios.py](../../app/whatsapp/envios.py) `alumnos_activos`). Se pueden incluir con «Incluirlos» (para referidos). Pedido de Mario: a un alumno le llegó el de reactivación del workshop.

### 26/11/2026 · Agendas: sin duplicados al reportar una agenda movida en Google (ADR-W240)
- Fernando Sánchez le quedaba duplicado a Dari: movió la llamada en Google y reportó la agenda vieja que tenía abierta, y la nueva quedó pendiente. Ahora el reporte va a la agenda que la reemplazó ([reagenda.py](../../app/agendas_v2/reagenda.py), [escritura.py](../../app/api/ficha/escritura.py)).

### 26/11/2026 · Triage: «Seguir» como bandeja en cero y reagenda sin fecha (ADR-W241)
- Pedido de la reunión del 25/11 (Dari y Mario). Para triage, Seguir tiene Hoy (atrasados y del día), Esperan fecha y Hechos hoy, con la cuenta de pendientes hacia 0 ([SeguirTriage.jsx](../../frontend/src/pages/closer/components/seguirTriage/SeguirTriage.jsx), [triage_seguir_service.py](../../app/services/triage_seguir_service.py)).
- Cada fila se cierra ahí: «No respondió» programa el siguiente contacto; «Contestó» → agendó, pasa a closing, low ticket, más adelante o no le interesa (con motivo, sin pisar el show up). Todo se puede deshacer desde el aviso.
- Reportar: «Reagenda → ¿Dejó una fecha? → No, va a avisar» en la ficha y «Reprogramó sin fecha» en la tarjeta de Atrasadas: sale de Atrasadas sin contar como cancelación. La ficha abierta desde Seguir arranca en el contacto.
- La fila de Seguir del closer decía «Seguimiento N de 4»: la cadencia es de 3.
