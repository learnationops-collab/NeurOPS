# Registro de decisiones — Work (NeurOPS)

> **Solo se agrega.** Una entrada por mejora o decisión de diseño de cualquier subsistema, tenga modelo en `docs/MODELO/` o no: contexto, decisión y consecuencias. El estado actual vive en el modelo (o en el código); acá queda por qué llegó a ser así.
> Una decisión tomada sobre un mockup entra con **Estado: propuesta**. Cuando se implementa, se agrega otra entrada que la nombra; la vieja no se toca.
> Numeración `ADR-W###`, aparte de los ADR de la Academia (`../academy/docs/DECISIONS.md`). Cuando una decisión depende de un ADR de la Academia, se lo nombra.
> Lo que se subió, día por día, sigue en `docs/bitacora/`. Un arreglo puntual no genera entrada.

---

## ADR-W001: Una sola puerta a Claude, con registro de uso
- **Fecha:** 2026-10-19 · **Subsistema:** Learnito · **Estado:** implementado
- **Contexto:** iba a haber varias funciones con IA y hacía falta saber quién gasta y cuánto sin depender de que cada una se acuerde de anotarlo.
- **Decisión:** `ClaudeService.create_message(feature, user_id, …)` es la única forma de llamar al SDK. Cada llamada, también las fallidas, deja una fila en `ai_usage` (tokens, costo, duración, request-id; sin el texto). Haiku 5.5 por defecto; un modelo sin precio cargado se rechaza.
- **Consecuencias:** el tope de gasto se aplica en un solo lugar. Resumen y llamadas en `/api/ai-usage`, solo admin y operator.

## ADR-W002: Learnito como copiloto de closers, en un modal global con dictado
- **Fecha:** 2026-10-19 · **Subsistema:** Learnito · **Estado:** implementado
- **Contexto:** idea de Mario del 19/10: un copiloto con IA para closers que vive en Work y lee la Academia.
- **Decisión:** acción del menú de sesión (fijada de fábrica a closers) que abre un modal encima de cualquier pantalla; la conversación vive en `LearnitoContext` y en `/copiloto`. Dictado con la Web Speech API del navegador. Siempre con el tema Learnation Modern.
- **Consecuencias:** la conversación no se guarda en la base (se pierde al recargar). Distinto de la Academia, que lo tiene como pantalla con conversaciones guardadas.

## ADR-W003: Herramientas de solo lectura del closer y tope por persona
- **Fecha:** 2026-10-19 · **Subsistema:** Learnito · **Estado:** implementado
- **Contexto:** el closer necesitaba datos reales (agendas, deuda) sin abrirle la base al modelo, y con gasto acotado.
- **Decisión:** tres herramientas (`mis_agendas`, `deuda_de`, `los_que_mas_deben`) que corren con la sesión del closer y los mismos servicios que sus pantallas, y devuelven texto corto. Historial solo con texto, 10 mensajes como máximo. Tope de US$ 8 por persona y mes; en pantalla, solo porcentajes.
- **Consecuencias:** el closer nunca ve datos de otro. El tope es por persona, no del equipo como en la Academia.

## ADR-W004: Motor de tablas de Work y agentes pares con la Academia
- **Fecha:** 2026-10-22 · **Subsistema:** Learnito · **Estado:** implementado
- **Contexto:** idea de Santiago del 21/10 (Academia, `LEARNITO_INVESTIGACION.md` §4.4, ADR-158 a 160): cada sistema responde lo suyo y los Learnito se piden datos entre sí, sin un cerebro central.
- **Decisión:** motor de tablas propio (`app/services/tablas/`) con el mismo formato de plan que `TablePlan` de la Academia, de solo lectura y con exclusiones (credenciales, chats, nómina; montos solo admin y director comercial). `POST /api/external/academy/agent/ask` responde catálogo y planes; `LearnationService.agent_ask` le pregunta a la Academia.
- **Consecuencias:** un plan sirve en los dos sistemas. Work todavía no responde preguntas libres por `agent/ask` (422).

## ADR-W005: Learnito de la dirección con el motor de tablas
- **Fecha:** 2026-10-22 · **Subsistema:** Learnito · **Estado:** implementado
- **Contexto:** la dirección (admin, operaciones, director comercial) quería números de Work y de la Academia en el mismo chat.
- **Decisión:** kit por rol en `app/api/copiloto.py`: la dirección recibe `fuentes_de_datos` y `calcular_tabla` sobre `work` o `academia`, con los mismos nombres que en la Academia, y hasta 6 vueltas. Claude arma el plan y el sistema dueño del dato calcula.
- **Consecuencias:** el closer sigue con sus tres herramientas. Las sugerencias del chat siguen siendo las del closer para todos (pendiente).

## ADR-W006: Datos con regla de negocio (`s.`) y habilidades
- **Fecha:** 2026-10-22 · **Subsistema:** Learnito · **Estado:** implementado
- **Contexto:** preguntas como "¿quién debe?" dependen de reglas que no están en ninguna columna, y las preguntas frecuentes no tenían por qué pagar un plan nuevo cada vez.
- **Decisión:** el motor suma datos `s.` calculados en lote (`s.estado_pago` con `regla_estado`, la misma de la Academia; deuda, cuotas, estado de agenda). Habilidades: recetas con nombre escritas en código (`cobranza_en_riesgo`, `estado_de_pagos`, `ventas_por_periodo`, `agendas_por_estado`) que Learnito usa con `usar_habilidad`.
- **Consecuencias:** las habilidades las escribe un desarrollador; el banco de preguntas de la Academia lo llena el equipo. Son dos caminos distintos para lo mismo (ver paridad en `docs/MODELO/LEARNITO.md` §8).

## ADR-W007: Catálogo con la forma de la Academia y modelo de documentación compartido
- **Fecha:** 2026-10-23 · **Subsistema:** Learnito · **Estado:** implementado
- **Contexto:** Learnito de Work leía el catálogo de la Academia con una forma y devolvía el suyo con otra; y Work no tenía documentación de modelo como la Academia.
- **Decisión:** `agent/ask` devuelve el catálogo con la forma de la Academia. Se adopta el modelo de documentación de la Academia: `docs/MODELO/` (presente), este registro (pasado) y la bitácora (lo subido). Learnito es el primer subsistema documentado, con su tabla de paridad.
- **Consecuencias:** cada mejora de Learnito actualiza `docs/MODELO/LEARNITO.md` y suma una entrada acá en el mismo commit (`.agents/rules/modelo.md`).

## ADR-W008: Diccionario de datos y su buscador
- **Fecha:** 2026-10-23 · **Subsistema:** Learnito, motor de tablas · **Estado:** implementado
- **Contexto:** la Academia sumó un diccionario de todo su sistema de datos y un buscador por capas (sus ADR-172 y 173), porque Learnito no sabía qué significaba cada columna ni cada palabra del equipo. En Work pasaba lo mismo: cada dato decía "Columna status de appointments".
- **Decisión:** `diccionario.json`, con el mismo formato que el de la Academia: 95 tablas, 71 calculados `d.` y 216 conceptos. Lo armaron cuatro agentes por dominio leyendo el código que escribe cada valor y el perfil real de los datos. El motor lo lee en las descripciones, en los calculados y en la condición `{"concepto": clave}`. `buscar_datos` (`buscar.py`) está en Learnito y en `agent/ask`. De paso: una condición sin dato ya no deja el resultado en cero.
- **Validación:** en el servidor de prueba los 71 calculados corren y los 216 conceptos se cuentan sin errores. En 12 preguntas del equipo, el concepto correcto queda primero en 9.
- **Qué se pierde (nombrado):**
  - La búsqueda es por coincidencia de palabras: sin sinónimos que no estén escritos.
  - Varios calculados copian en SQL una regla de Python (tipo de pago, deuda por venta), con diferencias que quedan en sus notas.
  - "Agenda con venta" cruza por cliente o persona, porque `sales.appointment_id` está vacío.
  - La Academia todavía no responde `buscar_datos`.
- **Consecuencias:** Modelo vivo: `docs/MODELO/TABLAS.md` (nuevo) y `LEARNITO.md` §4 a 8. Falta la Pregunta directa (el servidor arma el plan con el concepto, como el ADR-175 de la Academia), que es el bloque siguiente.

## ADR-W009: Learnito para todo el equipo, con alcance por rol, acciones y gráficos
- **Fecha:** 2026-10-24 · **Subsistema:** Learnito, motor de tablas · **Estado:** implementado
- **Contexto:** desde la etapa 3 de la Academia (su ADR-188) la dirección le pregunta al cerebro de Learnito de la Academia; los closers seguían con un copiloto propio y el resto del equipo no tenía datos. Decisiones de Santiago del 24/10: todo el equipo (no solo los closers), cada uno con "lo suyo y el ranking", dos acciones (comentario en un cliente y aviso a alguien) y borrar el copiloto viejo al pasar. Su ADR-190.
- **Decisión:**
  1. **Alcance en el motor** (`tablas/alcance.py`, aplicado en `motor.run`): la dirección ve todo; el resto, sus filas (donde figura o de personas con las que tuvo una agenda) y las mediciones del equipo, salvo las que agrupan por un dato personal. Los clientes y expedientes del conector, igual. Los datos de la Academia, solo la dirección. La Academia por `agent/ask` es un sistema de confianza (`alcance_completo`).
  2. **El conector suma** las tres herramientas del closer, `proponer_accion` con `comentario` (`client_comments`) y `aviso` (`notifications`), y `card` (el gráfico de un plan que agrupa o mide).
  3. **El chat es uno solo**, con el cerebro, para todos los roles menos fulfillment (`copiloto_required`). Se suma `/learnito/confirmar`. La pantalla dibuja los gráficos con CSS (`Grafico.jsx`) y la tarjeta de la acción.
  4. **Se borra** el copiloto local: `/api/copiloto/mensaje` y `/uso`, el sistema y el ciclo de herramientas, el tope de `ai_usage` para Learnito, `copiloto_datos.INSTRUCCIONES` y el modo local de la pantalla.
- **Validación:** tests del alcance (un closer lista lo suyo y ve el ranking de todos; agrupar por cliente mide solo lo suyo), de las acciones (propuesta sin escribir, confirmación del autor, cliente ajeno rechazado) y del chat; suite completa (3.786) en verde salvo tres que ya fallaban antes en el último commit: `test_las_objeciones_se_leen_en_una_sola_consulta`, `test_la_confirmacion_traduce_los_slugs_a_etiquetas` y `test_las_etapas_de_confirmacion_son_las_de_la_columna`.
- **Qué se pierde (nombrado):**
  - **El tope por persona de Work** (`ai_usage`): ahora cuenta el de la Academia (US$ 8 por persona, US$ 20 para Work). Lo gastado antes en `ai_usage` queda.
  - **La referencia diaria** de la barra de uso: queda la línea del mes.
  - **Un closer ya no ve los datos de la Academia** por agentes pares (antes tampoco los veía; ahora queda escrito).
  - **El aviso** no pasa por `comment_notifications` (la campanita de comentarios de la ficha): va a `notifications`.
  - Las herramientas del closer se ofrecen a todos los roles (el cerebro guarda una sola lista por sistema); a quien no es closer le responden vacío.
- **Consecuencias:** `docs/MODELO/LEARNITO.md` reescrito y `TABLAS.md` §1b.

## ADR-W010: Tope por conversación y calificar las anteriores para abrir otra
- **Fecha:** 2026-10-24 · **Subsistema:** Learnito · **Estado:** implementado
- **Contexto:** pedido de Santiago para el motor general de Learnito (ADR-191 de la Academia): cada conversación hasta 5 centavos, una barra de uso por conversación que al llenarse traba el cuadro, y calificar las anteriores para abrir otra.
- **Decisión:** las reglas las aplica la Academia. Work pasa sus códigos (`conversacion_agotada`, `calificar_pendientes` con `pendientes`), suma `GET /api/copiloto/learnito/pendientes` y la pantalla muestra la barra de la conversación (`UsoMensual`) y la lista de pendientes con sus tres botones (`Pendientes` en `LearnitoChat`).
- **Qué se pierde (nombrado):** no se puede abrir otra conversación sin calificar las anteriores, ni para una pregunta suelta.

## ADR-W011: Los ejemplos del cerebro, de Work
- **Fecha:** 2026-10-24 · **Subsistema:** Learnito · **Estado:** implementado
- **Contexto:** el cerebro de la Academia tenía sus ejemplos escritos para la Academia (alumnos, entregas, el Pulso) y Work los recibía igual (su ADR-192).
- **Decisión:** el conector responde `examples` con `EJEMPLOS`: presentación en Work, ejemplos del repartidor con clientes, agendas, show up, señas y closers, y para el planificador los conceptos y un glosario (show up, cierre, agrupar por el nombre del closer). Sin material ni temas del programa.
- **Qué se pierde (nombrado):** si el cerebro suma una clave, Work la recibe neutra hasta que se escriba la suya.

## ADR-W012: "@" en el chat y acciones simples sin IA
- **Fecha:** 2026-10-24 · **Subsistema:** Learnito · **Estado:** implementado
- **Contexto:** el chat de Work no tenía "@" y cada comentario o aviso pasaba por la IA (ADR-194 de la Academia).
- **Decisión:** `mentions` en el conector y `GET /api/copiloto/learnito/personas` (sus clientes con el alcance de quien busca y la gente activa, quien empieza con lo escrito primero); `ACCIONES_SIMPLES` en la operación `actions` y en `GET /api/copiloto/learnito/acciones`; `propose_action` acepta `persona_id` y `equipo_id`. En la pantalla, `menciones.js` (qué se está escribiendo, qué se inserta y cómo viaja) y el redactor con la lista, "Nombrar" para un texto seleccionado y el menú "/".
- **Qué se pierde (nombrado):** un "/" al principio que coincide con una acción ya no es texto libre; las frases que reconocen las acciones son una lista fija.

## ADR-W013: Reportar una venta en 6 pantallas, con la venta nueva separada del pago
- **Fecha:** 2026-10-28 · **Subsistema:** Reporte de la llamada (ficha, `arbolResultado*.js` y `TabResultado.jsx`) · **Estado:** propuesta
- **Contexto:** reportar la venta de un alumno nuevo con cuotas lleva 20 pantallas. Cobrar una cuota usa el mismo camino que una venta nueva: «Cuota» es una opción más de «¿Cómo paga?», al lado de Completo, Parcial, Seña, Renovación y Upsell, y el closer vuelve a confirmar datos, programa y tipo de pago. Se piden datos que ya no se usan (documento, examen). Pedido de Santiago del 28/10.
- **Decisión:** mockup en `docs/mockups/reportar_venta.html`; el flujo de hoy, para comparar, en `docs/mockups/reportar_venta_hoy.html`.
  1. **Dos caminos.** En la venta directa la primera pregunta es «¿Qué estás registrando?»: una venta nueva o un pago de algo que ya compró. Desde la llamada, «Sí, cerró» es siempre una venta nueva. «Cuota» sale de «¿Cómo paga?».
  2. **Venta nueva:** confirmar datos, programa, cómo paga, la plata (precio, cobrado hoy, medio de pago y a qué cuenta si fue transferencia), plan de cuotas (solo si queda saldo: cantidad, día y cronograma juntos) y referidos (pregunta y contactos juntos). Son 6 pantallas con cuotas y 5 si paga todo.
  3. **Confirmar datos** es una sola pantalla con lo que trae la agenda. El correo va destacado porque con él se crea o renueva la suscripción de la Academia; ahí mismo están «Darle acceso» (prendido por defecto) y hasta cuándo.
  4. **Pago:** elegir la cuota pendiente (o un pago suelto del saldo) y después monto y medio de pago. Son 3 pantallas, sin repetir datos del cliente, programa ni tipo.
  5. **Lo que deja de ser pantalla:** documento y examen se sacan, porque el backend ya los acepta vacíos. «Así viene este cliente» pasa a un aviso en «¿Cómo paga?». La fecha, «en la llamada», el estado y las notas vienen puestos (hoy, sí, Completada) y se cambian en un bloque «Detalles» de la revisión.
- **Qué se pierde (nombrado):**
  - El documento de identidad y el examen dejan de cargarse en ventas nuevas.
  - La fecha y el estado ya no se confirman uno por uno: si el closer no abre «Detalles», quedan los valores por defecto.
- **Consecuencias:** al implementarlo hay que revisar el envío del pago. Hoy un pago viaja como una venta de tipo «Cuota» (`arbolResultado.payload.js`), y el camino «Pago» tiene que armar ese mismo envío sin las preguntas de venta.

## ADR-W014: Una sola forma de cargar una venta o un pago (implementa ADR-W013)
- **Fecha:** 2026-10-28 · **Subsistema:** Reporte de la llamada, Acciones, triage · **Estado:** implementado
- **Contexto:** además de las 20 pantallas del ADR-W013, había cinco formularios en uso y tres sin uso para cargar una venta o un pago. Una venta por fuera se cargaba en Resultado; un cobro de cuota, en Resultado o en Acciones (`SubVistaPago`), con dos formularios para lo mismo; el low ticket del triage tenía sus tres pantallas. Pedido de Santiago del 28/10: «vamos a unificarlo».
- **Decisión:**
  1. **El árbol de Resultado es el formulario único**, con los dos caminos del ADR-W013 (`esNueva` / `esPago` en `arbolResultado.venta.js`). Preguntas nuevas: `que_registra`, `venta_datos`, `venta_montos` (con el medio), `venta_plan`, `pago_que`, `pago_monto`. Se borran las 18 de antes (nombre, Instagram, email, teléfono, documento, closer, estado del cliente, renovación, medio, transferencia, cuota, cantidad, modo, día, fechas, examen, fecha, estado, notas, academia, acceso hasta).
  2. **`venta_detalles` es una pregunta fija** (`fija: true`): arranca contestada (`estadoInicial`), va primera en `PREGUNTAS` para que cambiar de rama no la borre, «Anterior» la saltea y se edita en la revisión con el editor en línea.
  3. **Acciones › «Registrar pago»** abre Resultado ya en el camino del pago (`irA('resultado', { vender: 'pago' })`). Se borran `SubVistaPago` y la acción `registrar_pago`.
  4. **Triage:** el low ticket se carga en una pantalla («¿Cuánto pagó y por dónde?»), con la misma forma que el pago del closer. Sigue guardando por `reportar_triage`, que también cambia el estado del triage.
  5. **«Agregar pago» del historial queda aparte:** corrige el registro sin avisos. Solo cambia su texto, que manda a cobrar en Acciones.
  6. **Se borra lo que no se usaba:** `CloserDeckPage`, `QuickSaleModal`, `NewSaleModal`, `POST /closer/sales` y `CloserService.register_sale` / `trigger_sale_automation` (guardaban por fuera de `_declarar` y de la hoja).
- **Qué se pierde (nombrado):**
  - El «Comentario del cobro» (`segundo_pago`): viaja vacío; lo que haga falta va en Notas.
  - La pantalla «Así viene este cliente»: queda como ayuda en «¿Cómo paga?» («Ya pagó X de este programa»).
  - Instagram deja de ser obligatorio en la venta (sigue frenando si es de relleno o de un closer).
  - Tests borrados por la regla de tests rotos: `arbolResultado.venta.test.js`, `arbolResultado.revision.test.js`, `TabResultado.test.jsx` y dos de `arbolResultado.test.js`.
- **Consecuencias:** el payload a `POST /ficha/<id>/venta` no cambia de forma: un pago sigue viajando como venta de tipo Cuota con `cuota_cobrada`, y el acceso a la Academia solo sale de una venta nueva.

## ADR-W015: Toda cifra se abre en la lista de lo que la suma (`VerRegistros`)
- **Fecha:** 2026-10-28 · **Subsistema:** Componentes estándar y Marketing · **Estado:** implementado (primer uso: KPIs de la tabla de anuncios)
- **Contexto:** en Marketing, Analizar y Revisar las cifras no cuadraban entre sí (agendas del mes: 150, 209 y 223) y la explicación estaba en un texto de ayuda. Pedido de Kerwin del 28/10: que el origen de cada número se vea, con la lista de registros detrás de la cifra como en Closing.
- **Decisión:** componente estándar `VerRegistros` + hook `useVerRegistros()` (`components/standard/VerRegistros.jsx`). La pantalla llama `abrir({ titulo, subtitulo, contenido })` y pone `panel` una vez; el contenido es una `ListaConfigurable`. Se abre como panel lateral o ventana central, la persona alterna y se recuerda (`localStorage` `ui_registros_modo`). `Kpi` suma `onSelect` (la tarjeta pasa a ser botón); las tarjetas de Marketing, que tienen su propio `Kpi`, ponen el ojo de Closing (`onVer`). Se monta dentro del `.dc-shell` para que la lista conserve sus clases.
- **Alcance de esta entrega:** el marco y los 4 KPIs de la tabla de anuncios, que abren las filas que los suman. Los registros a nivel persona (agendas, ventas) y el resto de las pantallas siguen en las tareas de Leadership «Vistas estándar y datos trazables».
- **Qué se pierde (nombrado):** la lista de un KPI de la tabla de anuncios muestra palabras clave (con su aporte), no todavía las personas.

## ADR-W022: Los rituales de cada workshop viven en Leadership y siguen la fecha y hora del taller
- **Fecha:** 2026-10-28 · **Subsistema:** Workshop (Próximos) y Learnation Leadership · **Estado:** implementado en local; falta configurar producción
- **Contexto:** los talleres se planifican y se mueven de día y de hora (hoy el del 26/10 quedó el 29/10), pero los rituales de Leadership son semanales y de hora fija («Preparar workshop», jue/vie/sáb 16:00): no pueden depender de la fecha de un taller. Pedido de Kerwin: mensaje al grupo 2 días antes; mensaje y broadcast 1 día antes; recordatorios desde 5 h antes el mismo día; registrar en Work lo ocurrido; y aviso en su computadora 30 y 5 min antes de cada acción.
- **Decisión:** (elegida con Kerwin entre dos opciones por pregunta)
  1. **Tareas, no rituales.** Un ritual de Leadership no tiene fecha; una tarea sí (`due_date` + `start_time`). Work crea siete tareas por taller en el proyecto «Workshops · rituales» (sin subproyectos).
  2. **Sincroniza Work, al guardar** (`leadership_rituales_service`, en un hilo para no demorar el guardado) con el token de Kerwin en variables de Railway, detrás del interruptor `LEADERSHIP_SYNC=1`. Se descartó correr la sincronización en la PC: era más simple de configurar, pero tardaba hasta el siguiente ciclo y solo corría con la PC encendida.
  3. **Sin estado propio:** cada tarea lleva `[work-ws:<id del taller>:<clave>]` en la primera línea de la descripción y la sincronización compara lo que Leadership tiene con lo que el taller pide (crear / mover / reabrir si cambió la hora / quitar las abiertas). Es idempotente: repetirla, o que se corte a medias, no duplica nada. No hay migración.
  4. **Horizonte de 10 días** más un cron diario; con 26 semanas programadas serían cientos de tareas. Una tarea cuya hora ya pasó no se crea (taller agendado con poco margen).
  5. **Avisos como notificación de Windows** (`scripts/avisos_leadership.ps1`, tarea programada cada minuto) y no la extensión de Chrome: funciona con Chrome cerrado y no toca el repo de Leadership. Lee las mismas tareas de Leadership y compara con el reloj de la PC.
- **Horas:** 2 y 1 día antes a las 10:00 (broadcast 10:30); el mismo día −5 h, −2 h y −30 min; registro +2 h. Se calculan en `LEADERSHIP_TZ` (America/Caracas) porque Leadership guarda la hora de reloj sin zona; si Kerwin viaja, se cambia esa variable y la zona de Windows.
- **Qué se pierde (nombrado):** no hay vuelta Leadership → Work (marcar «registrar datos» no depende de que Work tenga los datos); los avisos solo llegan con la PC encendida; el ritual fijo «Preparar workshop» sigue duplicando los mensajes hasta que Kerwin decida quitarlos.
- **Consecuencias:** mover un taller cambia las tareas en segundos; el token de Leadership pasa a ser un secreto de producción de Work.


## ADR-W017: La cifra sola y su cuenta en un tooltip (`CifraConCuenta`), y las listas de Workshop
- **Fecha:** 2026-10-28 · **Subsistema:** Componentes estándar, Workshop y Analizar · **Estado:** implementado
- **Contexto:** Kerwin pidió que todo porcentaje, costo y ROAS diga «N de M» como Closing, sin texto explicativo, y que cada parte abra su lista (ADR-W015). En Marketing ya existía `CifraConCuenta` dentro de una carpeta de pantalla.
- **Decisión:** `CifraConCuenta` es un componente estándar. Muestra solo la cifra; el «N de M» sale en un tooltip que se dibuja en el `.dc-shell` con `position:fixed`, y cada parte abre la lista que la suma (`onVer(metrica, titulo)`). Workshop gana `GET /workshop/registros` (mismo código que `calcular_prefill`) y el Resumen pasa a ocho tarjetas con New Cash y Cash total y sus dos ROAS del mismo peso. Los números que se cargan por taller abren una lista taller por taller.
- **Qué se pierde (nombrado):** en el Resumen, New Cash (base del ticket, con la primera cuota) puede ser mayor que Cash total (sin cuotas): los dos salen de columnas de `workshop_events` con definiciones distintas, y unificarlos pide decidir si las cuotas suman al cash del taller. En Analizar el denominador de cada tasa se lee pero no abre lista (faltan sus destinos en Revisar). Los pasos manuales del embudo (WhatsApp, asistencia a la clase, pitch, formulario) no tienen personas detrás. El simulador de Planificar son proyecciones: no tiene registros.
- **Consecuencias:** una cifra nueva con razón usa `CifraConCuenta` con `cuenta {a, b}`; el tooltip ya no es navegable con Tab (sus partes se tocan con el mouse; la cifra misma abre el numerador con teclado). `todos/CifraConCuenta.jsx` queda como re-export hasta que `TablaAnuncios.jsx` importe del estándar.

## ADR-W018: Cada vista recuerda lo último que usó la persona (`useEstadoGuardado`, `useParamsGuardados`)
- **Fecha:** 2026-10-28 · **Subsistema:** Marketing y Workshop (norma para todas las pantallas) · **Estado:** implementado en Marketing y Workshop
- **Contexto:** en Marketing los filtros vivían en `useState` y se perdían al recargar o cambiar de pestaña; cada hook de preferencias (`useModoVista`, `useColumnasVisibles`, `useVistaDeColumnas`) guardaba a su manera y por navegador, y uno escribía en `localStorage` dentro de un updater de `setState`. Pedido de Kerwin y de Gabriela del 28/10.
- **Decisión:**
  1. `useEstadoGuardado(clave, inicial, { normalizar, heredar })`: estado objeto, por usuario (la clave lleva el id de la sesión), escrito en un efecto. Lo leído se mezcla sobre `inicial` y `normalizar` limpia lo de otra versión.
  2. `useParamsGuardados(clave, claves)`: lo que ya vive en la URL (pestaña, período, vista) se restaura solo si se entra sin ninguno de esos parámetros; la URL manda. Una pantalla usa un solo hook con todas las claves de su URL.
  3. Las pantallas nuevas lo usan en vez de `useState` para filtros y vistas.
- **Qué se pierde (nombrado):** lo que ya estaba guardado por navegador (`mk_rendimiento_columnas`) se hereda una sola vez; `useModoVista` y `useColumnasVisibles` siguen por navegador hasta migrarlos. Un link sin parámetros ya no abre «lo de siempre», sino lo último que esa persona usó.
- **Consecuencias:** quedan por migrar las demás pantallas (una tarea por pantalla, tarea 845 de Leadership). En simulación cada identidad simulada tiene sus propias preferencias.

## ADR-W019: Las agendas de Marketing se cuentan por fecha de alta o de reunión, con una sola cuenta (`conteo_agendas_service`)
- **Fecha:** 2026-10-28 · **Subsistema:** Marketing y Analizar · **Estado:** implementado
- **Contexto:** octubre 01–28 daba 148 + 61 agendas en Marketing (fecha de alta), 223 en Closing/Analizar (fecha de reunión) y 150 en Revisar «Vigentes». Además Analizar mostraba dos show up distintos (63,9% en la tarjeta, 35,4% en el embudo).
- **Decisión:** selector «Contar por: fecha de alta / fecha de reunión» en las pantallas de Marketing que cuentan agendas, recordado. Una sola función en backend (`conteo_agendas_service`): alta = libro de agendas, una por persona; reunión = las filas de Closing (`ComercialService.agendas`, con descartadas), show up por lead. Cada agenda es de Setting, Workshop u Otras (pestaña nueva), así que las tres suman el total. Costos y ROAS usan siempre fecha de alta (lo que Meta gastó genera agendas al darse de alta) y lo dicen en el tooltip. El embudo de Analizar muestra el show up de la tarjeta con su cuenta.
- **Qué se pierde (nombrado):** con reunión, la tarjeta de agendas y el costo por agenda ya no comparten base (el tooltip lo dice); la tabla de palabras clave sigue contando por alta. Revisar sigue calculando el show up por llamada (79 de 123), no por lead (78 de 122).
- **Consecuencias:** la cifra y su lista salen de las mismas filas (`/registros?base=`); hay una cuarta lista (`agendas_alta`) para el denominador de los costos.

## ADR-W020: Segmentos A/B/C/D en Marketing y en los dashboards de setters y closers
- **Fecha:** 2026-10-28 · **Subsistema:** Marketing, dashboard comercial · **Estado:** implementado (sin costo por lead por segmento)
- **Contexto:** Thalamus ya calcula y guarda el segmento del lead ([plan_segmentos_triage.md](plan_segmentos_triage.md)), pero ningún tablero lo mostraba. Pedido de Gabriela (28/10): leads A por funnel, costo por lead A/B/C/D y países en Marketing; agendas del mes por segmento (setting) y show up y cierre por segmento (closing), con filtro. Las ~120 agendas de octubre del flujo viejo (Calendly/n8n) no tienen segmento.
- **Decisión:**
  1. **Una sola regla de lectura** (`segmentos_lectura.py`): segmento de la agenda más reciente de la persona; si no, el de su cliente; si no, «sin segmento». «Sin segmento» es un grupo más, así los cinco suman el total.
  2. **Reparto de las cifras que ya existían, no cuentas nuevas:** la matriz de Marketing (`segmentos_marketing_service`) parte las mismas personas, cobros y leads que `fuentes_service`; el panel del dashboard (`segmentos_comercial`) parte las mismas filas de `ComercialService`. Cada cifra abre su lista (`VerRegistros`, ADR-W015) con una columna de segmento.
  3. **Dónde vive:** vista «Segmentos» de Todos (la comparación Setting vs Workshop), panel «Segmentos» en Analizar de setters y closers, y faceta «Segmento» en Revisar. El filtro (`segmento=A,B` en la API, `seg=` en la URL del dashboard) acota los KPIs del closer, las listas y el panel.
  4. **La matriz se pide aparte** (`?segmentos=1` del tablero): suma ~3 s y solo la usa su vista.
- **Qué se pierde (nombrado):**
  - **Costo por lead por segmento:** no se calcula. Meta no conoce el segmento y repartir el gasto es una decisión de negocio abierta (Leadership 839): prorratear el gasto por la mezcla de segmentos, o gasto de la fuente ÷ leads del segmento.
  - **Leads de Workshop por segmento:** son clics anónimos al grupo de WhatsApp, no hay formulario; solo se ve el total.
  - **Países:** el pedido de Gabriela los nombra; no están en esta entrega.
  - El filtro de segmento no acota lo que sale del reporte diario del setter (viene de ManyChat, sin segmento) ni las deudas por cobrar.
- **Consecuencias:** las agendas viejas siguen en «sin segmento» hasta que Kerwin confirme el backfill (`scripts/backfill_segmentos.py`, Leadership 840). Los leads de Setting de la matriz son los de la tabla de Marketing (personas que escribieron una palabra clave); quien nunca llenó el formulario es «sin segmento», por eso ese grupo concentra casi todos esos leads.

## ADR-W021: Segmentos cortados por closer, fuente u origen, con período de comparación y filtro de segmento en las demás vistas
- **Fecha:** 2026-10-28 · **Subsistema:** Marketing, dashboard comercial · **Estado:** implementado
- **Contexto:** Kerwin (28/10): en Segmentos, en Marketing y en Closing, faltaba agrupar por closer y por fuente, comparar con otro período y personalizar la vista; y poder filtrar por segmento en las demás vistas para decidir qué grupos entran en el análisis. La matriz de ADR-W020 solo partía por fuente (Setting y Workshop) y el filtro solo vivía en Analizar.
- **Decisión:**
  1. **Hechos y una sola cuenta.** `segmentos_marketing_service` arma los hechos del período (agendas, cobros, leads, cada uno con segmento, fuente, origen y closer) y la celda, la comparación y la lista salen de `PERTENECE`: la lista suma exacto la celda. En Closing, `_clave_de(corte)` hace lo mismo con las filas de `ComercialService`. El corte y la comparación comparten `segmentos_cortes`.
  2. **Cortes:** Marketing por fuente (con Otras), origen (setter, VSL, Momentum, Referido…), closer o ninguno; Closing por closer, setter, fuente u origen. Origen de Workshop = uno solo. Se ven como una tabla por grupo o como cruce grupo × segmento de una cifra.
  3. **Comparación:** las mismas opciones del VS de Analizar (`rango_comparado`): en Closing es el VS del header; en Marketing un selector propio (`vs`, `vd`, `vh`). La diferencia (absoluta y %, en puntos para las tasas) la calcula el backend y cada «antes N» abre la lista del período comparado.
  4. **Filtro de segmento:** lo aplica siempre el backend, también al total y a las diferencias (antes lo rehacía la pantalla). Disponible en Todos (Resumen, Métrica por métrica), Otras, Analizar y Revisar, recordado por usuario con el período (`mk_todos_url`, `mk_otras_url`, `cm_segmento`). Con un segmento elegido, el tablero de Marketing cuenta por fecha de alta y pone el gasto, los costos y el ROAS en «—» (`acotar_fuentes`).
  5. **Personalización barata:** columnas visibles, cifra y orden del cruce, pestaña de fuente y corte, todo en `useEstadoGuardado` (ADR-W018).
  6. La matriz sale de su propio endpoint (`/marketing/anuncios/segmentos`) y los hechos se recuerdan 45 s: cambiar de corte o de filtro no rehace la cuenta de ~3 s. `?segmentos=1` del tablero se quitó.
- **Qué se pierde (nombrado):**
  - **No admiten el filtro y lo dicen en pantalla:** Gasto en Meta y la tabla de palabras clave de Setting (el gasto no conoce al lead), Workshop por taller (leads = clics anónimos), el reporte diario del setter (ManyChat), Comparativas y Variabilidad.
  - **Leads en el corte por closer:** un lead todavía no tiene closer, así que quedan en «—».
  - **Origen de un cobro:** es el detalle de su procedencia (el setter, En vivo/Grabación → Workshop, VSL…); no siempre coincide con el nombre libre de la fuente de la agenda del mismo cliente.
  - La matriz sigue contando solo por fecha de alta (pendiente de ADR-W020 sin decidir).
- **Consecuencias:** Marketing y Closing leen la misma forma de respuesta (`grupos`, `cuentas`, `previo`/`delta`); un corte nuevo se agrega en un solo lugar de cada servicio. Costo por lead por segmento sigue pendiente (Leadership 839).

## ADR-W016: Fulfillment en cuatro bloques: suscripción, avance, seguimiento del equipo y uso (implementa la propuesta de `fulfillment_propuesta.html`)
- **Fecha:** 2026-10-28 · **Subsistema:** Ficha del lead (pestaña Fulfillment) y Academia · **Estado:** implementado
- **Contexto:** la pestaña ponía de protagonista «lo que pagó» (el producto en la Academia) y, debajo, «comentarios del equipo». Pero lo que da el acceso es la suscripción de Work (una entidad propia, vinculada a la venta), y el equipo de la Academia no trabaja con comentarios: trabaja con objetivos, acciones con respuesta y protocolos (`../academy/docs/MODELO/SEGUIMIENTOS.md`). El closer necesita cuatro cosas: el estado de la suscripción, el avance (sobre todo las sesiones), el seguimiento del equipo y el uso.
- **Decisión:**
  1. **Suscripción:** producto, hasta cuándo (anillo de días), qué la abrió o extendió, si la Academia la tiene igual (lo que contestó hoy contra la fecha de Work) y sus acciones: Prórroga, Corregir mail, Quitar y, si la Academia no la tiene igual, **Reenviar a la Academia** (`POST /ficha/<id>/academia/reenviar`: asigna el producto con la fecha de Work, sin cambiar la suscripción). El historial queda dentro, cerrado. Se ve aunque la Academia no conteste.
  2. **Avance:** el recorrido de sesiones (hechas, próxima con su estado y fecha, Momentum que da el closer) contra los 30 días.
  3. **Seguimiento del equipo:** objetivos abiertos con ámbito, quién lo lleva, protocolo y próximo paso (pendiente, vencido o en observación); últimos registros: acciones con si respondió, observaciones y victorias. Solo lectura.
  4. **Uso:** la franja del Pulso, días activos (14 y 30), horas, entregas, la tira de 14 días y la bitácora de lo que hace, con filtros.
  - 2 a 4 salen del expediente de la Academia, que suma `recorrido`, `seguimiento` y `uso` (ADR-202 de la Academia), en un pedido aparte: `GET /ficha/seguimiento-academia`. La venta (`VentasWork`) queda debajo, al costado de la suscripción; las métricas del resumen de la Academia, la cuenta y los otros accesos, al final y cerrados.
- **Qué se pierde (nombrado):**
  - Desde Work no se registra un seguimiento ni se abre el caso en Contacto: los closers no tienen acceso a Contacto y están fuera de los protocolos. Si hace falta, es otra decisión con la Academia.
  - «Corregir la fecha» y «Agendar la renovación» del mockup no están: la fecha la mueven la venta y la prórroga, y la renovación se agenda como siempre.
  - Las métricas del resumen (pomodoros, racha, aprobación…) dejan de estar a la vista: van cerradas al final.
- **Consecuencias:** Comunicación sigue mezclando los comentarios de la Academia con las notas (`useComentariosAcademia`). Se borraron `TabFulfillment.test.jsx` y `SuscripcionWork.test.jsx`, que probaban la estructura anterior.


## ADR-W023: Eliminar un lead de prueba entero desde la ficha, solo sin plata ni suscripción

- **Estado:** implementada (28/10/2026).
- **Contexto:** la ficha solo borraba UNA agenda (Historial › Agendas, o «Eliminar lead» de Confirmación, que también es la agenda). Los leads y agendas de prueba seguían existiendo: el cliente, su persona, su fila del libro de agendas y su conversación siguen contando en Marketing, Revisar y los embudos. Kerwin: «no puedo eliminar leads y agendas de testeo».
- **Decisión:** una papelera en la cabecera de la ficha (`BorrarLead`, permiso `eliminar_lead`, solo la dirección) que llama a `DELETE /api/ficha/<agenda>/lead` (`lead_prueba_service.eliminar`). Borra todas las agendas del cliente (con su evento de Google y su registro de eventos), sus respuestas, su fila del libro (`financial_agendas`), su registro de eventos por persona, avisos, registros públicos, conversaciones de Instagram y registros de taller, el cliente y, si ningún otro cliente es suyo, la persona. Se niega, con el motivo, si el lead tiene pagos, ventas, plan de cuotas o suscripción.
- **Qué se pierde:** no hay deshacer. No hay una marca de «prueba»: la regla es «sin plata ni suscripción», así que un lead real sin cobros también se puede borrar (solo la dirección, con confirmación que dice qué se lleva). Borrar solo una agenda sigue en el Historial.
- **Consecuencias:** `permisos.eliminar_lead` entra en la lista de la ficha (`estadoFicha.PERMISOS`) para que el modo solo lectura también lo apague. Si una agenda falla a mitad, lo ya borrado de sus agendas no se deshace (cada una confirma por su cuenta); el resto se revierte.

## ADR-W024: El humo sin parpadeo: degradés baratos siempre y un modo quieto que se activa solo

- **Estado:** implementada (29/10/2026).
- **Contexto:** el humo del tablero comercial y de Tálamus eran círculos con `filter:blur` de 30 a 90 px y `mix-blend-mode`, movidos sin parar y repetidos en cada tarjeta, KPI, barra y dock. En una compu que no da, se repintaba a saltos y se veía como un parpadeo: agobia la vista y es un riesgo para quien tiene epilepsia fotosensible.
- **Decisión:** (1) siempre, cada nube es un degradé radial ya difuso, sin blur ni mezcla de capas y solo con `transform` y `opacity` (como ya hacía la reserva pública); (2) `efectos.js` pone `data-efectos="bajo"` en `<html>` si la compu tiene 2 núcleos o menos o 2 GB o menos, si pide menos movimiento, si lo elige la persona (`?efectos=bajo`) o si una medición de ~70 cuadros (a los 1,5, 8 y 20 s de cargar) da menos de ~40 por segundo (o un 20% de cuadros de más de 40 ms). Cubre las dos formas del humo: `.humo` y `.ui-aura` (las tarjetas y paneles estándar, que son casi todas las de Tálamus: la primera versión solo cubría la primera y no arregló el parpadeo); en ese modo no hay nubes que se muevan, solo un fondo suave y quieto. Lo medido se recuerda 14 días; `?efectos=normal` lo vuelve a la medición.
- **Qué se pierde:** el humo se ve un poco menos intenso y sin la mezcla de capas del tema claro; en las compus lentas es un fondo fijo. La medición corre una vez por visita sin la pestaña oculta y puede equivocarse con un pico de carga.
- **Consecuencias:** un `.humo` nuevo debe tener el contenedor `.humo` y los cuatro `<i>`; el modo bajo solo cubre `.dc-shell`, `.thalamus` y `.talent` (otras animaciones infinitas, como el fondo del ingreso, no se tocaron).


## ADR-W025: «De dónde vino lo cobrado» sale de las fuentes y el Cash total dice cuánto es de ventas anteriores

- **Estado:** implementada (29/10/2026). Leadership 850 y 869.
- **Contexto:** «De dónde vino lo cobrado» repartía el cobro por tipo de pago (procedencia de Finanzas: upsells y renovaciones a «Fulfillment») y las tarjetas por origen del cliente (`fuentes_service`). Para el mismo Workshop daba $6.164 contra $6.693 de Cash total (últimos 30 días): los $529 eran una renovación que el panel mandaba a Fulfillment. Aparte, el ROAS Total de Workshop cambiaba según el período (6,09x en octubre, 8,2x en los últimos 30 días, sin error: el período cambia qué cuotas entran) y no se veía qué parte era de ventas del período: en octubre, $2.643 de los $4.143 son de ventas anteriores, y el ROAS New Cash es 1,02x.
- **Decisión:** (1) el panel se arma con Setting, Workshop y Otras de `datos.fuentes`, así que suman el total cobrado y la fila de Workshop es el Cash total de su tarjeta; cada fila abre su lista de Cash total. (2) `cash_anterior` (cobros de clientes sin venta nueva en el período) sale en la tarjeta Cash total y en ROAS Total, con la misma regla que la lista. (3) No cambia la definición de ningún ROAS: siguen los dos, con el mismo peso (decisión del 28/10).
- **Qué se pierde:** el panel ya no abre Revisar › Ventas ni separa «Setting sin palabra clave», VSL y Fulfillment como filas (las de Otras van en el detalle). Revisar › Ventas conserva la procedencia por tipo de pago, así que su Workshop no coincide con el Cash total de Marketing. Con un segmento elegido no hay `cash_anterior`. Una seña de alguien sin venta nueva cuenta como «anterior».
- **Consecuencias:** `cobrado_fuera` salió del tablero. Kerwin decidió (29/10) dejar los dos ROAS sin titular. Queda abierto que Workshop › Resumen usa otro «ROAS Total» (cohorte del taller): ver `pendientes_santi.md`.

## ADR-W026: Workshop se entiende en un dibujo: «Del anuncio al cobro», color por origen y listas en el detalle
- **Fecha:** 2026-10-29 · **Subsistema:** Workshop (Resumen, Talleres) y `VerRegistros` · **Estado:** implementado en local
- **Contexto:** tarea 851 de Leadership (pedido de Kerwin: que la vista de Workshop se entienda gráficamente, sin leer, con la lista detrás de cada dato). El Resumen tenía ocho tarjetas y una tabla de porcentajes contra la meta, pero ningún dibujo que uniera 4.279 leads, 286 agendas y 18 ventas; el detalle de un taller dibujaba el embudo sin abrir ninguna lista; la tarjeta de un taller decía CPL, agendas, costo por agenda y CAC en una frase, y los ROAS explicaban su fórmula con texto.
- **Decisión:**
  1. **«Del anuncio al cobro»** (`resumen/RecorridoResumen.jsx`) entre las tarjetas y la salud del embudo: el `FlujoEmbudo` con los mismos nueve pasos y la misma base de cada porcentaje que la Salud del embudo y el detalle del taller (`pasosEmbudo`), así una píldora dice lo mismo que la tabla; debajo, las agendas partidas (asistieron, no asistieron, sin reporte, otras) y lo invertido contra New Cash y Cash total con su ROAS. Cada barra y cada tramo abre la lista que lo suma (`useRegistrosWorkshop`).
  2. **El color dice el origen del número** (`ORIGEN` en `talleres/formato.js`): Meta (leads e inversión), Taller (lo que carga o sincroniza el taller: WhatsApp, clase, pitch, formulario) y Personas (agendas, asistencia a la llamada, ventas, cobros). Lo usan el Resumen, las barras de cada tarjeta y el detalle.
  3. **La tarjeta de un taller** pasa de una frase a una segunda fila de cuatro cajas (CPL, agendas, CPA, CAC), cada cifra con su cuenta o su lista. Las tarjetas de ROAS del Resumen dicen el veredicto («Rentable») en el color del número, no la fórmula.
  4. **El detalle de un taller** abre la lista de ESTE taller desde cada barra del embudo y desde Inversión, Cash cobrado y CAC. `VerRegistros` se monta en el último velo abierto (`.dc-shell.scrim`) para no quedar debajo de la hoja (z-index 170 contra 95).
- **Qué se pierde (nombrado):** el Resumen pasa de entrar en una pantalla a dos (el recorrido suma ~350 px antes de la salud del embudo). Los tramos «No asistieron», «Sin reporte» y «Otras» de las agendas abren una lista más ancha que su número (Citas con resultado o todas las agendas): no hay una lista por estado en `GET /workshop/registros`. «Ganancia» del detalle no tiene lista (es una resta).
- **Consecuencias:** un paso nuevo del embudo necesita su entrada en `ORIGEN_DE_PASO` (si no, cae en «Taller»). En el Resumen, la píldora de «Asistieron» (62%) es sobre las citas con resultado y el tramo de agendas (43%) sobre todas las agendas: dos bases distintas, cada una con su tooltip.

## ADR-W027: El Cash total de un taller contiene a su New Cash, y cada ROAS dice sobre qué base se calculó

- **Estado:** implementada (29/10/2026). Leadership 934 y 935.
- **Contexto:** Workshop › Resumen con los 4 talleres de octubre daba ROAS Total 0,9x contra ROAS New Cash 1,06x, imposible porque el total contiene a la venta nueva. Causa: `cash_collected` sumaba los pagos de la cohorte (ventas nuevas y señas) y `cash_ventas` (New Cash, base del ticket) además la primera cuota de cada venta, que `ticket_service` busca en la base y `_es_venta_valida` deja fuera. Con más cuotas que señas el New Cash superaba al total (3/10: $200 contra $500; 26/9: $800 contra $1.250; 5/9: $583 contra $1.650). Aparte, «ROAS Total» de Todos (6,05x: $4.143 cobrados ÷ $685 gastados) y el de Workshop (0,9x) son cuentas distintas con el mismo nombre (ADR-W025).
- **Decisión:** (1) `cash_collected` = ventas nuevas + señas + primeras cuotas que suman a las ventas (`ticket_service.ticket_y_cuotas`, una sola búsqueda de cuotas): el Cash total es el New Cash más las señas, y su lista (`cash_total`) incluye esas cuotas; (2) las dos tarjetas de ROAS llevan un ícono de base (calendario = cobrado del período, taller = cohorte de los talleres) con su cuenta en un tooltip de una línea y la cifra abre la lista del numerador; (3) Marketing dice cuánto del cobrado es de ventas anteriores con su propia lista (`cash_anterior`); (4) un puente numérico entre los dos ROAS de Workshop (tres pasos que suman exacto) en Todos › Resumen y en Workshop › Anuncios de Meta.
- **Qué se pierde:** el «Cash total» del taller ya no es «solo lo cobrado por pagos de venta nueva y señas»: ahora trae cuotas de las ventas del taller aunque se cobren después. Los talleres ya guardados conservan la cuenta vieja hasta el recálculo (`scripts/resync_workshop_events.py`). El puente solo se arma con el período de Marketing y los talleres que caen en él (sin segmento elegido).
- **Consecuencias:** `cash_collected` cambia en todo lo que lo usa (ROAS, ganancia, Neto, correlaciones, comparativas de talleres). Las dos cuentas siguen siendo distintas (período de cobro contra cohorte): lo que se garantiza es que cada una lleva su base visible y que, dentro de cada una, Total ≥ New Cash.
