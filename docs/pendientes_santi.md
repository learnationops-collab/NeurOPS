# Pendientes de Santi

Objetivo del 27/10: bajar toda la lista. Lo hecho va a la bitácora ([octubre_2026.md](bitacora/octubre_2026.md)).

## Hoy
Lo que tiene fecha o gente esperando.

- [ ] Recalcular el Cash total de los talleres en prod (Leadership 934, ADR-W035; lo aprueba Kerwin): ensayo `railway ssh --service "learnation work" -- python scripts/resync_workshop_events.py`, y si el ensayo muestra solo `cash_collected` cambiando en los talleres con cuotas (en la copia del 28/10: 5/9, 26/9 y 3/10, más el 29/8 que estaba desactualizado), `... resync_workshop_events.py --apply`. Después revisar Workshop › Resumen: ROAS Total ≥ ROAS New Cash en todos los talleres. No se pudo medir antes/después contra prod directo (el clasificador bloqueó la lectura); los números salen de la copia local. En la copia local de grupo-l (29/10, ensayo + `--apply`) solo cambió `cash_collected` de 4 talleres: 29/8 100→150, 5/9 583→1750, 26/9 800→1300, 3/10 200→500; el ROAS de los 4 talleres del período pasó de 0,90x a 1,21x.
- [ ] Facu: cuando termine su última agenda (6956, hoy a las 21:30 AR), sacarle el acceso de closer y borrarlo de Personas de Thalamus.
- [ ] QUIERO APLICAR del 27/10 sin respuesta: pasárselos a los setters (`ig_contactos` 1241, 1242, 1250, 1256; revisar el 1263 `rosmeryatao`).
- [ ] Avisarle a Dari que cierre «Perdido: que retome la preparación» de la cuenta 522 de Mónica (falsa alarma, estudia en la 523).

## Triage
Pasar al lead del triage al closing.

- [x] Confirmar A/B al pasar a closing (plan §8.5, [plan_segmentos_triage.md](plan_segmentos_triage.md)).

- [ ] Triage (Leadership 1018, 30/10): los abandonos del formulario pasan al triage (aviso de Discord etiqueta a las triage y lista «Abandonos» en su espacio, `abandonos.py` + `api/triage_abandonos.py`). Falta cargar el `discord_id` de Dari y Juliana (Leadership 1005): sin él el aviso sale con `@everyone`. Al desplegar corre la migración `a6c8e0b2d4f6` (columnas de contacto en `sched_intentos`).
- [ ] Discord (Leadership 982/983): el diseño de las tarjetas es `Agenda Segmentos.dc.html` de Claude Design (proyecto 085f329e-6ba8-4cdc-86f2-9a338e27b5b1). DesignSync pide `/design-login` desde una sesión interactiva; hasta entonces hay que pasar el archivo al repo o autorizar.
- [x] Triage (Leadership 1019, 30/10): panel «Día por día» en las métricas del triage y en Dirección (`por_dia` de `triage_service.metricas`, ADR-W044). Los días sin agendas no salen como fila; si Kerwin los quiere en cero, rellenarlos en `diasDe`.
- [x] Triage (Leadership 1014, 30/10): el chat de la ficha avisa con «@» (ADR-W045). La ficha usa `lead_event_logs` y `avisos_service`, no `ClientComment`.
- [x] Triage (Leadership 1015, 30/10): «Compartidos» en el dock del closer, del triage y del setter (ADR-W047). Falta, si se pide, en el dock de Dirección Comercial.
- [ ] Agendas repetidas (02/11, ADR-W057): no se pudo medir en prod (el clasificador bloqueó la lectura). Correr en el servidor, solo lectura, cuántas personas tienen filas `Reagendado` con sucesora y cuántas tienen dos agendas en el mismo minuto, antes y después. Decisiones de Kerwin: (a) ¿dejar de crear una fila nueva al reagendar y mover la misma, como el triage y el link de Thalamus? (cambia el embudo del mazo, la cola «reagendar» y la cartera); (b) ¿«Persona» como agrupación por defecto de Revisar › Agendas? (hoy es una opción; cambiar el defecto rompe los tests de Revisar que esperan «Sin agrupar»); (c) las agendas del triage también entran en Closing «Todo el equipo» (hace falta para los segmentos C/D): ¿se separan?
- [ ] Reprogramar con otra persona (Leadership 986 a 989, ADR-W046): probar en staging que el evento de Google se mueve del calendario de quien la tenía al de quien la recibe (en local los sockets están bloqueados, no se vio), y que `reagenda_de` / el embudo del closer cuentan bien la agenda nueva.
- [ ] Low ticket (`LT`, 100 USD por mes, Academia `low-ticket`): definir comisiones del triage y de Fulfillment (`comision_tasas_service.PROGRAMAS` no tiene LT) y cómo se cobra cada mes (hoy: un «LT - Renovacion» de 1 mes por la ficha).
- [ ] Tests de suscripción que ya fallaban antes del low ticket (27/10): `test_la_sena_da_7_dias_y_el_saldo_la_pasa_a_completo`, `test_la_venta_da_4_meses_y_las_cuotas_no_mueven_la_fecha`, `test_encendido_manda_la_suscripcion_con_su_ultimo_cambio`, `test_el_aviso_del_pago_lleva_el_vencimiento_de_la_suscripcion` (vencimientos corridos 2 días).
- [ ] Triage (02/11, [ADR-W065](DECISIONS.md)): cuando haya asistencias reales al closer, revisar los números de «Por closer» contra Revisar (hoy 10 pases y 0 asistencias en prod, todos de noviembre). Dos dudas abiertas: `pasaron` incluye las llamadas futuras (decidir si el % de asistencia las excluye) y los pases manuales desde la ficha no llevan `agenda_triage_id` (no cuentan; 2 de 9 al 02/11).
- [ ] Triage (02/11): la tarjeta de asistencia pasó a asistieron ÷ agendas (antes ÷ (asistieron + no show)) en Dirección y en las métricas de la triage; avisarle al director.

## Segmentos en Marketing y dashboards
Matriz A/B/C/D en Todos › Segmentos y panel de segmentos de setters y closers (28/10/2026, [MARKETING.md](MODELO/MARKETING.md)).

- [ ] **Costo por lead por segmento (Leadership 839, decisión de Kerwin):** Meta no conoce el segmento. Dos opciones: (a) prorratear el gasto de la fuente por la mezcla de segmentos de sus leads (cada segmento carga con la parte del gasto que le toca por su peso en los leads); (b) gasto de la fuente ÷ leads del segmento (cada segmento se divide por el gasto entero, y los costos no suman al total). Hasta que se decida, la matriz no muestra el costo.
- [ ] Backfill del segmento de las ~120 agendas viejas (Leadership 840): `scripts/backfill_segmentos.py` en simulación contra la copia local del 28/10 no escribe nada nuevo (990 clientes y 924 agendas ya tenían segmento; 6 clientes del formulario viejo no se pueden segmentar). Confirmar con Kerwin y correr con `--apply` en el servidor.
- [ ] Leads de Workshop por segmento: los clics al grupo no traen formulario; si se quiere, medir los leads de Workshop como personas con agenda.
- [ ] Actualizar `TodosPage.test.jsx` («Métrica por métrica corona…»): ya no hay texto «Volumen» ni pestaña «Costos» (ahora son desplegables: `Embudo`/`Plata`/`Costos`, ADR-W036). Sin escribir tests nuevos hasta que Kerwin lo pida.
- [ ] Segmentos de Todos (29/10): mirar con Kerwin si prefiere la tabla del primer grupo abierta al entrar (hoy abre el Cruce y las tablas cerradas con su resumen); es cambiar un `open` en `bloquesSegmentos.jsx`.
- [ ] Segmentos cortados (28/10, ADR-W021): el filtro de segmento aún no llega al reporte diario del setter (ManyChat), a Comparativas, a Variabilidad ni a la tabla de palabras clave; y el origen de un cobro (procedencia) no siempre coincide con el de la agenda del mismo cliente. Decidir si vale la pena partir esos tableros.
- [ ] Países en Marketing (pedido de Gabriela, 28/10): no entró en esta entrega.

## Motivo obligatorio (02/11, ADR-W066)
Reagendado, No Show y Cancelado piden un motivo de 10+ caracteres que queda en el hilo del lead.

- [ ] Probar en el servidor de prueba antes de subir: reportar un No Show / Canceló / Reagenda desde el árbol del closer y del triage, corregir el estado desde el historial y el modal del dashboard, y cancelar desde Confirmación; ver que el hilo de Comunicación muestra una sola nota por acción (con el autor) y que sin motivo el botón queda apagado.
- [ ] Tests viejos a revisar, porque marcan estos estados sin motivo (no se corrieron; sin escribir tests nuevos hasta que Kerwin lo pida): backend `tests/api/test_ficha_lead_escritura.py`, `tests/agendas_v2/test_manual.py`, `tests/api/test_comercial_dashboard.py`, `tests/services/test_descalificada.py`, `tests/services/test_estado_lead.py`; front `arbolResultado.test.js` (las ramas `no_asistio` y `cancelo` mandan `noshow_detalle`/`cancel_detalle` con `notes`: ahora son `motivo_noshow`/`motivo_cancelo`, y la reagenda suma `reag_detalle`), `arbolResultado.contrato.test.js`, `fichaApi.test.js` y los de `ResultadoTriage`/`recorrido` (la nota ya no es opcional).
- [ ] «Nueva agenda» sobre una agenda existente reprograma con una nota automática («reprogramada desde “Nueva agenda” por X», `manual._reprogramar_en_neurops`) y no pide motivo. Decidir con Kerwin si debe preguntarlo (hoy se cuenta como reagenda automática).
- [ ] Reagendar desde «Corregir estado» (historial o modal del dashboard) o desde la edición del Tablero de Agendas no mueve la llamada: solo cambia el estado, y el Tablero con «Reagendada» sin `reschedule_date` falla («Fecha de reagenda requerida»). Ya era así; ahora al menos queda el motivo.
- [ ] Código muerto con estos estados que conviene borrar: el modal de motivo y las acciones rápidas de `CloserWorkflowPage.jsx` (`reasonModal`, `executeQuickAction`: nada los abre), `handleSetOutcome` de `closer/leads/LeadsPage.jsx` y `LeadsManagementPage.jsx` (sin ruta).
- [ ] La edición en lote de Revisar › Agendas ya excluye estos estados del «Pre call» (solo «Confirmada» y «Sin confirmar»); si se pide cambiarlos en lote, hay que decidir cómo se carga un motivo por agenda.

## Agendas y reparto
Cómo se reparten las agendas entre closers.

- [x] Capacidad de Jean Carlo configurable (llamadas por semana).
- [x] Momentum sessions por encima de C y D, o en los huecos de 15 minutos entre llamadas.
- [x] Parte visual: el C/D desplazado en el mazo del closer y del triage; segmento y puntos en la ficha, la agenda del closer y el panel del triage; vista de Fulfillment reorganizada para el closer.
- [ ] Revisar los puntos del segmento cada mes con `scripts/ajuste_segmentos.py`.
- [ ] Reparar las agendas que ya perdieron la confirmación por una reagenda (02/11): 7088, 7087, 7095, 7080, 7075, 7071, 7070 y 7056 siguen pendientes, sin etapa, y su agenda vieja estaba confirmada. Copiar `result`, etapa, «cómo viene» y dolores de la agenda vieja con un script en producción (necesita OK explícito de Kerwin).

## Cobros y deudores
Que el closer cobre las cuotas y que los datos de venta lleguen limpios.

- [x] Cobros del closer en Work: deudores del mes y vencidos, primero los atrasados, filtro opcional por monto. Ver antes si Deudores de la Academia ya alcanza.
- [x] Toda la deuda la cobra Jean Carlo por ahora, también la de Marlon (`app/services/cobrador.py`).
- [ ] Revisar con Jean Carlo los errores de lógica que encuentre y corregirlos de raíz.
- [ ] Desactivar los flows automáticos que se pisan con el contacto manual.
- [x] Formulario de venta: que no se reusen los datos del anterior ni se acepte su nombre o «no tengo» como Instagram; avisar si el correo o el Instagram son de otra ficha.
- [x] Vista Conflictos ([mockup](mockups/conflictos.html)) con los casos de Jean Carlo: Andres Simon (AL 697, posible upsell sobre RR, cuota de $500), Yrein (reembolso, v57525), Saúl Logreira ($250 que no aparece en la pasarela), María Alejandra Villa y Natalia Salazar (v57629 sin cobro), Sureiny Marrero (suscripción de $150 falló el 20/08), Nadia Rodríguez ($2.000 el 08/08 y $500 el 13/08 sin venta).

## Vencimientos y suscripciones
El acceso del alumno, su renovación y sus pagos.

- [x] Renovación de 1 o 4 meses a elección del closer en el formulario de venta (campo en `Sale`).
- [ ] Recordatorios de pago para el alumno: tarjeta en su perfil con cuotas y fecha límite, y avisos antes del vencimiento y en la semana de gracia.
- [ ] Si no agendan la renovación, Dari los contacta (primero los activos) para una «entrevista final».
- [ ] Señas sin completar: decidir qué pasa después del 02/11 con Lysander, Valentina, Leslie y Cynthia. Santiago Herrera tiene hasta el 15/11.
- [ ] Andrea Pérez (residencia, grupo personal): se le venció el acceso sin respuesta.

## Scale
Reparto de agendas en los scale.

- [x] Sumar a Belu.
- [x] «Máxima disponibilidad» en lugar de «llenar en orden»; si coinciden los horarios, va Andy primero.
- [x] Mario solo recibe cuando todos los demás están llenos.
- [x] Ventana de 3 días.
- [x] Reporte después de cada scale para Mario (puede que ya esté).

## Inbox y palabras clave
Que cada palabra clave lleve a un flujo que funcione.

- [ ] Cuando Kerwin publique «Lead Magnet (conversion)» (flujo 3), pasar QUIERO APLICAR y APLICAR a ese flujo.
- [ ] Prevención de palabras sin flujo, elegir cuáles: flujo por palabra dentro de la campaña; confirmar antes de sacar una palabra con leads o anuncio activo; red de seguridad por `anuncio_id`; registro de quién cambió palabras o flujos.
- [ ] Mover las palabras solas según el ad set de Meta del DM cuando la otra campaña ya no tiene anuncios activos.
- [ ] Palabras huérfanas (HOJAS, LECCIÓN, TRÍADA, GUÍA CHILE, MÉTODO y otras): ver con Marketing si siguen con anuncios y crearles campaña.
- [ ] En espera del corte de Kommo: escribir desde Work (`HUMAN_AGENT`, audios con URL pública, app predeterminada) y que el link de agenda lleve el id de la conversación.

## Academia
La plataforma del alumno.

- [x] Al simular un rol, que el avatar sea un perfil de prueba con todos los accesos (pedido de Mario) y que no aparezca bloqueado.
- [x] Learnito corrige entregas: Ace hasta 5 por día, Residencia 10, Specialist sin límite; feedback obligatorio antes de la siguiente; Belu revisa ejemplos al final de la semana; Santi hace el anuncio.
- [x] Entregar desde la pizarra.

## Fulfillment y accesos
Las fichas y los permisos del equipo.

- [x] Unificar las tablas de comentarios (closers, setters, Dari).
- [ ] Que todos puedan crear sesiones desde Leadership.

## Seguridad
Lo que quedó de la auditoría.

- [x] Motor de tablas y Learnito: agrupar por texto devuelve datos de todo el equipo a closer, setter, triage y hiring (`app/services/tablas/motor.py`).
- [x] Cabeceras CSP y frame-ancestors (antes, confirmar que ninguna landing embebe la reserva en un iframe).
- [x] Menores: JWT en `?token=` y `/session-entry`, sin revocación al cambiar la clave, ~167 respuestas con `str(e)`, Dockerfile como root.
- [ ] Confirmar que se rotaron los 5 webhooks de Discord y las contraseñas por defecto que quedaron en git.
- [ ] Ver si hace falta el proxy TCP público de Railway hacia el Postgres de producción.

## Rituales del workshop en Leadership
Ver ADR-W022. Hecho y probado en local; para que funcione en producción falta:

- [ ] Cargar en Railway (producción) `LEADERSHIP_URL=https://leadership.thelearnation.com`, `LEADERSHIP_TOKEN` (el token personal de Kerwin, Setting › Conexiones) y `LEADERSHIP_SYNC=1`; opcional `LEADERSHIP_TZ` (por defecto America/Caracas). Sin esas tres variables no se hace nada.
- [ ] Programar el cron diario `GET /api/workshop/cron/leadership` con `CRON_SECRET` (como el de Meta): cada día entra un taller más al horizonte de 10 días.
- [ ] En la PC de Kerwin: tras integrar, volver a correr `scriptsvisos_leadership.ps1 -Instalar` desde el checkout principal (hoy la tarea apunta al worktree `avance-local`) y confirmar que ve el aviso de Windows de las 10:30 del 29/10 (30 min antes del recordatorio de las 11:00).
- [ ] Decidir con Kerwin si se quitan los pasos fijos «Enviar mensajes a los grupos» y «Preparar lista y flujo para broadcast» del ritual «Preparar workshop» (jue/vie/sáb 16:00): ahora se duplican con las tareas que genera Work.
- [ ] Las tareas de un taller que ya empezó (más de 1 día) no se tocan; si se quieren cerrar solas al cargar los datos del taller, falta la llamada inversa Work → Leadership.

## Fuera del código
Gestiones y decisiones.

- [ ] Medición por segmento con Kerwin: qué necesita (endpoints, filtros por segmento, bloque del triage).
- [ ] Preguntarle a Kerwin si canceló ManyChat; si no, cancelarlo.
- [ ] Cancelar las suscripciones de lo que ya se reemplazó; n8n solo queda por el mailing de ingreso de venta nueva.
- [ ] Documentos del papá de Mario el viernes 30/10.
- [ ] Atribución venta → agenda → conversación (`appointments.conversation_id`), con Agendas 2.0.

## Cifras con N de M y listas (28/10, rama mk-tooltips)
- [ ] Decidir si las cuotas suman al cash de un taller: hoy New Cash (con primera cuota) puede superar a Cash total (ADR-W017).
- [ ] Analizar: destinos de Revisar para el denominador de cada tasa (con resultado, entrantes, aperturas) para que ambas partes abran lista.
- [x] `TablaAnuncios.jsx`: importar `CifraConCuenta` de `components/standard` y borrar el re-export `marketing/todos/CifraConCuenta.jsx`.
- [ ] Tests de vitest que leen el texto «N de M» de los tiles de Analizar y las 6 tarjetas de `WorkshopKpiCards` quedaron sin actualizar (no se corrieron).

## Marketing: una sola definición de lead y de gasto (tarea 868 de Leadership)
Falta la fórmula de backend; la presentación ya tiene su rótulo.

- [x] Definido y aplicado (29/10, ADR-W037, `docs/MODELO/MARKETING.md`): lead de Setting = entrada por palabra clave (2.453 en 29/09–28/10: Palabras clave, Todos y Entrantes; Entrantes además cuenta 2.402 personas); gasto = Meta del embudo (tabla = tarjeta Setting = $3.352; Meta Ads y Gasto en Meta = $4.284 con Workshop y Contratación). Conversaciones ya no es una pestaña.
- [ ] **Decisión de Kerwin (lead de Workshop):** Todos usa clics al grupo de WhatsApp (325) y Workshop › Resumen los Leads de Meta (607). Cada cifra lleva su ícono; ¿cuál es «el» lead de Workshop para comparar con Setting?
- [ ] **Decisión de Kerwin (CAC):** costo por venta = gasto ÷ pagos de venta nueva; CAC = gasto ÷ personas que compraron (hoy iguales: 13 y 5). ¿Está bien separarlos o CAC = costo por venta?
- [ ] La inversión de los 3 talleres del período ($796) no es el gasto de Workshop del período ($821): la ventana del taller no cubre los días sueltos. Dos cuentas con ícono, no se unificaron.
- [ ] El «Cobrado» de la tabla de palabras clave ($9.718) y el Cash total de la tarjeta de Setting ($10.418) son distintos (atribución por palabra clave contra origen del cliente).
- [ ] `TablaAnuncios.test.jsx` y los tests de `FuentesResumen`/Entrantes no se corrieron: la tabla ahora llama `usarFormulas(datos.formulas)` y los totales dependen de `formulas` (si el fixture no las trae, los costos salen vacíos). `metricas.test.js` ya las carga.
- [ ] Mientras tanto, quien abre cada vista ve de qué habla: «Habla de:» bajo la cabecera de Workshop y en Todos (28/10/2026).


## Workshop: Meta por hora (29/10, worktree meta-ventana-horaria, [ADR-W028](DECISIONS.md))
Leads e inversión de cada taller entre el fin del anterior y el suyo (inicio + 2 h), con el desglose por hora de Meta.

- [ ] Probar en el servidor de prueba: migración `f2a6c8e0b4d1`, «Sincronizar 180 días» (tramos de 30) y que el pedido por hora y `timezone_name` respondan (nunca corrió contra la cuenta real). Un fallo solo deja el log `Gasto por hora de la cuenta…` y los talleres siguen por día.
- [ ] Comprobar en un taller que la suma por hora de un día entero da el gasto diario, y que `meta_leads` del taller de hoy sube hacia los clics al grupo.
- [ ] Cargar `inicio_at` en los talleres anteriores al 15/10 si se quieren por hora; sin hora siguen por día.
- [ ] Confirmar con Kerwin el corte: la franja termina a inicio + 2 h (propuesta de este cambio) y no al inicio, para que las 2 horas del vivo no queden sin taller.
- [ ] Si la zona horaria de la cuenta de Meta no se puede leer, se usa `America/La_Paz`: confirmar la real.
- [ ] Tests de la franja por hora (`franjas`, `cubre`, `desglose`): sin escribir, a proponer cuando no queden pendientes.

## Integración de las ramas de Marketing (28/10, avance-local)
- [ ] La matriz de segmentos (Todos › Segmentos) cuenta siempre por fecha de alta; con «Contar por: fecha de reunión» sus totales no cambian y no suman las 223 de Closing. Decidir si se parte también por reunión (y sumar «Otras»).
- [ ] Analizar › Segmentos da show up 64,2% (79 de las llamadas) y la tarjeta de arriba 63,9% (78 de 122 leads): cuenta llamadas contra leads. Unificar el denominador (tarea 853).
- [ ] `tests/services/test_fuentes_service.py` usa `fuentes_service.agendas_por_fuente` y `personas_por_fuente`, que ahora viven en `conteo_agendas_service`: los tests quedaron rotos (no se corrieron).- [ ] Otras: hay agendas con origen «Setter» (genérico, sin nombre de setter) que caen en Otras y no en Setting. Confirmar si son de Setting y cómo identificarlas (se ven en Otras › De dónde viene cada agenda).

## Revisión visual de Marketing (29/10, grupo-a-visual)
- [ ] Confirmar con Kerwin que Entrantes, Conversaciones y Meta Ads no llevan el selector «Contar por» (en el código solo lo tienen Setting › Palabras clave, Todos y Otras).
- [ ] Revisar (dashboard comercial) y Setters usan la misma `.sg-barra` que ya se midió en Analizar, pero no se miraron a ojo.
- [ ] En 390 px las tarjetas KPI de Otras parten el rótulo («SHOW / UP», «NEW / CASH»): caben dos íconos y el rótulo con tracking en media tarjeta. Cosmético, no se tocó.
- [ ] `TodosPage.test.jsx` (ajustado a mano: «Gana Setting» ahora es `aria-label`) y los tests de Todos que busquen «Setting»/«Workshop» junto a las cifras no se corrieron.
## ROAS de Workshop (Leadership 850, 29/10/2026)
- [x] Qué ROAS manda (Kerwin, 29/10): «deja los 2». Se quedan ROAS New Cash y ROAS Total con el mismo peso, sin titular; el Total ya muestra su parte de ventas anteriores.
- [ ] **Decisión de Kerwin:** Workshop › Resumen y Marketing muestran «ROAS Total» y «Cash total» con cuentas distintas (cohorte del taller sin cuotas contra período de cobro con cuotas): octubre da 0,9x en el Resumen y 6,05x en Marketing. Opciones: renombrar los del Resumen («ROAS del taller») o llevarlos a la definición de Marketing. Es del rediseño de Workshop (otra sesión).
## Segmentos: backfill de las agendas del flujo viejo (tarea 840 de Leadership)
- [x] Backfill probado en staging (dry-run y `--apply`, 29/10/2026): no escribe nada nuevo (931 clientes y 844 agendas ya tenían segmento; 6 clientes con formulario viejo incompleto). Ahora informa al final las agendas sin segmento por motivo y mes (`--desde=AAAA-MM-DD`, `--ids`).
- [x] Corrido en prod (29/10/2026, aprobado por Kerwin): ensayo y `--apply` escribieron 1 agenda (copia del segmento D de su cliente); 961 agendas y 1.021 clientes ya tenían; 36 de 285 agendas desde el 01/10 siguen sin segmento (32 clientes sin formulario, 4 formularios que no segmentan).
- [ ] Las ~31 agendas de octubre del flujo viejo (17 son del 01/10) sin segmento tienen un cliente sin ningún formulario: no se pueden segmentar. Decidir si quedan sin segmento en los cortes o van a una fila «Sin dato».

## Marketing: «CLASE 26» no es una palabra clave de DM (tarea 852 de Leadership)
- [x] Causa: el anuncio «TC5 | Clase 26» (campaña Meta «WORKSHOP FUNNEL | Testing Creativos | PE + CO», lleva a /clase-hero/) tomó la clave CLASE 26 del nombre de su conjunto y cayó en Setting porque `/clase-hero/` no estaba entre los destinos de clase. Nunca hubo un DM con esa palabra (0 ejecuciones del Inbox). `meta_ads_service._DESTINO_CLASE` ahora reconoce `/clase*`.
- [ ] Tras el deploy, la próxima sincronización de Meta lo pasa solo a Workshop y quita la clave (mapeo auto): el aviso «sin campaña» y los ~$20 de Setting desaparecen. Si no se mueve, Sincronizar a mano en Marketing › Anuncios.

## Workshop: rediseño gráfico (tarea 851, 29/10/2026)
- [ ] Las agendas partidas del Resumen (No asistieron, Sin reporte, Otras) abren una lista más ancha que su número: sumar a `GET /workshop/registros` una métrica por estado (`no_show`, `sin_reporte`) para que cada tramo abra exactamente lo que suma.
- [ ] Los grupos de agendas del detalle de un taller (`AgendasEstados`) siguen sin abrir su lista.
- [ ] New Cash ($12.650) es mayor que Cash total ($12.258) en el Resumen: dos definiciones distintas (ADR-W017). La barra «Invertido y cobrado» lo deja a la vista; decidir si las cuotas suman al cash del taller (grupo B, backend).
- [ ] `ResumenTab.test.jsx`, `TalleresVista.test.jsx` y los de `WorkshopKpiCards` no se corrieron tras el cambio (regla: sin tests); el Resumen ahora monta `FlujoEmbudo` y `Bars`.

## Recordar lo cargado (Kerwin, 02/11)
- [x] Extender el recuerdo de `cacheDeVistas` (ADR-W053) al resto de las vistas: hecho el 02/11 en closer, triage, setter, operador y contratación (ADR-W055). Queda por mirar la página vieja `TriageWorkflowPage` y las pantallas sueltas de Marketing/Inbox.
- [ ] Verificar en el espacio del triage (entrando como Dari o Juliana) que Métricas y Abandonos no esperan al volver a la pestaña: cambié su código por el mismo patrón que Dirección, pero solo verifiqué esta última.
## Hallazgos de la prueba a mano del 02/11 (local, como Juliana)
- [ ] Buscador del mazo: al abrir un resultado que es un contacto de Instagram sin agenda ni cliente (p. ej. «dari polanco») la ficha dice «No se pudo abrir la ficha · Falta appointment_id, client_id o person_uuid». Ocultar esos resultados o abrir su lead de otra forma (`BuscadorGlobalDeck.jsx`, `GET /closer/leads/search`).
- [ ] La revisión del reporte de triage («Nota para el closer») muestra la nota cruda, sin formato: usar `NotaFormateada` en esa fila (`ResultadoTriage.jsx`, `PantallasTriage.jsx` › `Revision`).
- [ ] Probar en real (producción o staging con Google conectado) lo que local no puede: evento de Google al pasar al closer y al reprogramar, aviso de Discord y WhatsApp. En local salen bloqueados a propósito.
- [ ] Servidores locales de varias sesiones en `localhost` se pisan la cookie de sesión (misma `SECRET_KEY`, mismo nombre): en un `run_local.py` poner `SESSION_COOKIE_NAME` y `REMEMBER_COOKIE_NAME` propios.
## Integración del 02/11 (sesiones en paralelo)
- [ ] Al desplegar Work: correr `scripts/resync_workshop_events.py` en el servidor (primero ensayo, luego `--apply`) para que los talleres ya guardados pasen a neto; y desplegar Work ANTES de subir por FTP los 11 archivos de `institute-site` (lista en `docs/auditoria_track_visit_02_11.md`; comparar contra el remoto, `clase`, `bienvenido` y `class1` a `class4` pueden estar atrasados).
- [ ] Revisar contra la pasarela los pagos 57347, 57712, 57708 y 57682 (comisión imposible o distinta del CSV de Stripe).
- [ ] Actualizar el tooltip de «Cobrado» en `metricas.js` para que diga neto.
- [ ] Subir el CSV de octubre de Stripe y Hotmart en Finanzas › Diferencias y cuadrar la muestra de `docs/analisis_neto_vs_bruto_02_11.md`.
- [ ] Decidir si el neto SQL del closer usa también el monto real verificado (hoy solo el promedio).
- [ ] Capturas de Kerwin de los errores de carga y visualización en vistas de segmentos y costos que no se reprodujeron (URL, período, filtro, consola F12); «Importe gastado»: separar «—» de «$0,00» al ordenar; cruce de segmentos: decidir si se ordena por tasa.
- [ ] Segmentos A/B/C/D: decidir la medida oficial de «compra» (propuesta: completo + split a 14–30 días y plata por lead, con la seña aparte); decidir qué hacer con los B de 0 puntos o menos (112 de 231, compran ~3 %); repetir la comparación el 15/11 con octubre completo; revisar la caída de show-up de A en octubre (72 % → 52 %); guardar la letra con la que se ruteó cada lead; vincular a su agenda los pases manuales del triage (7053 y 7075 sin `agenda_triage_id`); excluir «Venta histórica sin agenda» donde se mida «ventas por agenda».
- [ ] Validación de datos: Dirección (`MetricasEquipo.get_detailed_closer_metrics`) cuenta 279 agendas contra 247 en Revisar en octubre (reagendas); confirmar el cobro de $1.000 de Mario Bühler; revisar las `Sale` #697 y #730 (cuota sin pago inicial); los pares #7001/#7002 y #7048/#7049 (el reagendado de triage crea dos filas a las 00:00); confirmar que los 114 pagos en ventas canceladas son bajas; agregar a `cruce_e` el cruce contra el promedio.
- [ ] Siguiente tarea de fuentes («Conectar las fuentes que falten»): `fbclid`/`_fbp`/`_fbc` en el lead (1–1,5 días), eventos de compra por CAPI (2–3 días), gasto por segmento (1–1,5 días); los links de reservar no llevan UTM a la agenda de Tálamus.
- [ ] Caché de vistas: probar en staging «Closers» de Talent con muchas postulaciones (queda montada y escondida; si pesa, volver a desmontarla) y decidir si Postulaciones refresca al volver pasados 5 min.
- [ ] Corregir en producción el pago 57752 (David Hernandez, 1000 USD, «RR - Cuota», 31/10) de Mario Bühler a Jean Carlo: con el editor «Closer del pago» una vez desplegado, o con una actualización autorizada. Es el único pago cargado tras una reasignación con el closer anterior de vendedor.
- [ ] Embudo de Closing por origen (02/11): confirmar con el director si las agendas de las propias personas de triage (hoy cuentan en «Agendas» de «Todo el equipo» y como directas) deben salir del embudo de Closing; ver el embudo en staging con datos reales (hoy en prod hay ~10 pases al mes, las barras de triage serán finitas); si el tamaño de la parte de triage molesta a la vista, subir su ancho mínimo.
- [ ] Embudo de Closing por origen: los pases manuales desde la ficha no llevan `agenda_triage_id` y cuentan como directos; si se quiere medirlos, hay que sellarlos al pasar.
- [ ] Reporte del closer sin opciones (03/11): quedan 23 tests de `arbolResultado.test.js` desactualizados (varios asumen las opciones de motivo que se quitaron; otros ya estaban rotos desde «Descalificado»/`motivo_sin_oferta`) y `test_setter_y_triage_no_reportan_la_llamada[triage]` (el triage ya reporta con permisos de closer, ADR-W054). Reescribirlos cuando se proponga la etapa de tests. Falta probar a mano «Reagenda → Sí dejó fecha» (necesita Google Calendar; local no tiene).
- [ ] Reporte del closer: los demás reportes (Asistió/No cerró, venta, seguimientos, cobro) no se recorrieron de punta a punta en esta pasada; si algún closer vuelve a decir «no me deja», pedir captura de la pantalla y del paso exacto.
