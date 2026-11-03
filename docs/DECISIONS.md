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


## ADR-W050: La cifra sola y su cuenta en un tooltip (`CifraConCuenta`), y las listas de Workshop
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


## ADR-W033: «De dónde vino lo cobrado» sale de las fuentes y el Cash total dice cuánto es de ventas anteriores

- **Estado:** implementada (29/10/2026). Leadership 850 y 869.
- **Contexto:** «De dónde vino lo cobrado» repartía el cobro por tipo de pago (procedencia de Finanzas: upsells y renovaciones a «Fulfillment») y las tarjetas por origen del cliente (`fuentes_service`). Para el mismo Workshop daba $6.164 contra $6.693 de Cash total (últimos 30 días): los $529 eran una renovación que el panel mandaba a Fulfillment. Aparte, el ROAS Total de Workshop cambiaba según el período (6,09x en octubre, 8,2x en los últimos 30 días, sin error: el período cambia qué cuotas entran) y no se veía qué parte era de ventas del período: en octubre, $2.643 de los $4.143 son de ventas anteriores, y el ROAS New Cash es 1,02x.
- **Decisión:** (1) el panel se arma con Setting, Workshop y Otras de `datos.fuentes`, así que suman el total cobrado y la fila de Workshop es el Cash total de su tarjeta; cada fila abre su lista de Cash total. (2) `cash_anterior` (cobros de clientes sin venta nueva en el período) sale en la tarjeta Cash total y en ROAS Total, con la misma regla que la lista. (3) No cambia la definición de ningún ROAS: siguen los dos, con el mismo peso (decisión del 28/10).
- **Qué se pierde:** el panel ya no abre Revisar › Ventas ni separa «Setting sin palabra clave», VSL y Fulfillment como filas (las de Otras van en el detalle). Revisar › Ventas conserva la procedencia por tipo de pago, así que su Workshop no coincide con el Cash total de Marketing. Con un segmento elegido no hay `cash_anterior`. Una seña de alguien sin venta nueva cuenta como «anterior».
- **Consecuencias:** `cobrado_fuera` salió del tablero. Kerwin decidió (29/10) dejar los dos ROAS sin titular. Queda abierto que Workshop › Resumen usa otro «ROAS Total» (cohorte del taller): ver `pendientes_santi.md`.

## ADR-W034: Workshop se entiende en un dibujo: «Del anuncio al cobro», color por origen y listas en el detalle
- **Fecha:** 2026-10-29 · **Subsistema:** Workshop (Resumen, Talleres) y `VerRegistros` · **Estado:** implementado en local
- **Contexto:** tarea 851 de Leadership (pedido de Kerwin: que la vista de Workshop se entienda gráficamente, sin leer, con la lista detrás de cada dato). El Resumen tenía ocho tarjetas y una tabla de porcentajes contra la meta, pero ningún dibujo que uniera 4.279 leads, 286 agendas y 18 ventas; el detalle de un taller dibujaba el embudo sin abrir ninguna lista; la tarjeta de un taller decía CPL, agendas, costo por agenda y CAC en una frase, y los ROAS explicaban su fórmula con texto.
- **Decisión:**
  1. **«Del anuncio al cobro»** (`resumen/RecorridoResumen.jsx`) entre las tarjetas y la salud del embudo: el `FlujoEmbudo` con los mismos nueve pasos y la misma base de cada porcentaje que la Salud del embudo y el detalle del taller (`pasosEmbudo`), así una píldora dice lo mismo que la tabla; debajo, las agendas partidas (asistieron, no asistieron, sin reporte, otras) y lo invertido contra New Cash y Cash total con su ROAS. Cada barra y cada tramo abre la lista que lo suma (`useRegistrosWorkshop`).
  2. **El color dice el origen del número** (`ORIGEN` en `talleres/formato.js`): Meta (leads e inversión), Taller (lo que carga o sincroniza el taller: WhatsApp, clase, pitch, formulario) y Personas (agendas, asistencia a la llamada, ventas, cobros). Lo usan el Resumen, las barras de cada tarjeta y el detalle.
  3. **La tarjeta de un taller** pasa de una frase a una segunda fila de cuatro cajas (CPL, agendas, CPA, CAC), cada cifra con su cuenta o su lista. Las tarjetas de ROAS del Resumen dicen el veredicto («Rentable») en el color del número, no la fórmula.
  4. **El detalle de un taller** abre la lista de ESTE taller desde cada barra del embudo y desde Inversión, Cash cobrado y CAC. `VerRegistros` se monta en el último velo abierto (`.dc-shell.scrim`) para no quedar debajo de la hoja (z-index 170 contra 95).
- **Qué se pierde (nombrado):** el Resumen pasa de entrar en una pantalla a dos (el recorrido suma ~350 px antes de la salud del embudo). Los tramos «No asistieron», «Sin reporte» y «Otras» de las agendas abren una lista más ancha que su número (Citas con resultado o todas las agendas): no hay una lista por estado en `GET /workshop/registros`. «Ganancia» del detalle no tiene lista (es una resta).
- **Consecuencias:** un paso nuevo del embudo necesita su entrada en `ORIGEN_DE_PASO` (si no, cae en «Taller»). En el Resumen, la píldora de «Asistieron» (62%) es sobre las citas con resultado y el tramo de agendas (43%) sobre todas las agendas: dos bases distintas, cada una con su tooltip.

## ADR-W035: El Cash total de un taller contiene a su New Cash, y cada ROAS dice sobre qué base se calculó

- **Estado:** implementada (29/10/2026). Leadership 934 y 935.
- **Contexto:** Workshop › Resumen con los 4 talleres de octubre daba ROAS Total 0,9x contra ROAS New Cash 1,06x, imposible porque el total contiene a la venta nueva. Causa: `cash_collected` sumaba los pagos de la cohorte (ventas nuevas y señas) y `cash_ventas` (New Cash, base del ticket) además la primera cuota de cada venta, que `ticket_service` busca en la base y `_es_venta_valida` deja fuera. Con más cuotas que señas el New Cash superaba al total (3/10: $200 contra $500; 26/9: $800 contra $1.250; 5/9: $583 contra $1.650). Aparte, «ROAS Total» de Todos (6,05x: $4.143 cobrados ÷ $685 gastados) y el de Workshop (0,9x) son cuentas distintas con el mismo nombre (ADR-W033).
- **Decisión:** (1) `cash_collected` = ventas nuevas + señas + primeras cuotas que suman a las ventas (`ticket_service.ticket_y_cuotas`, una sola búsqueda de cuotas): el Cash total es el New Cash más las señas, y su lista (`cash_total`) incluye esas cuotas; (2) las dos tarjetas de ROAS llevan un ícono de base (calendario = cobrado del período, taller = cohorte de los talleres) con su cuenta en un tooltip de una línea y la cifra abre la lista del numerador; (3) Marketing dice cuánto del cobrado es de ventas anteriores con su propia lista (`cash_anterior`); (4) un puente numérico entre los dos ROAS de Workshop (tres pasos que suman exacto) en Todos › Resumen y en Workshop › Anuncios de Meta.
- **Qué se pierde:** el «Cash total» del taller ya no es «solo lo cobrado por pagos de venta nueva y señas»: ahora trae cuotas de las ventas del taller aunque se cobren después. Los talleres ya guardados conservan la cuenta vieja hasta el recálculo (`scripts/resync_workshop_events.py`). El puente solo se arma con el período de Marketing y los talleres que caen en él (sin segmento elegido).
- **Consecuencias:** `cash_collected` cambia en todo lo que lo usa (ROAS, ganancia, Neto, correlaciones, comparativas de talleres). Las dos cuentas siguen siendo distintas (período de cobro contra cohorte): lo que se garantiza es que cada una lleva su base visible y que, dentro de cada una, Total ≥ New Cash.

## ADR-W037: Una sola definición de lead y de gasto en Marketing, con las cuentas escritas una vez

- **Estado:** implementada en local (29/10/2026). Leadership 868, 831, 832, 866 y 834.
- **Contexto:** el mismo período de 30 días daba 2.448 / 2.397 / 2.647 leads según la pestaña y $3.366 / $3.342 / $4.279 / $4.270 de gasto; en Workshop «lead» es un clic al grupo de WhatsApp (Todos) o la columna Leads de Meta (Resumen), en Setting una entrada por palabra clave. Además las cuentas estaban escritas tres veces (`anuncios_service.metricas`, `fuentes_service.metricas_de_fuente`, `metricas.js` y las razones de `comparacion.js`).
- **Decisión:** (1) `marketing_formulas.FORMULAS`: cada cuenta (porcentajes, costos, ROAS, ticket, CAC) es un renglón; el backend lo aplica y la API lo manda en `tablero.formulas` para que la pantalla sume con la misma (`formulas.js`). (2) El gasto de una palabra clave es solo el de anuncios del embudo Setting: tabla = tarjeta Setting = `gasto_por_embudo`; lo de otros embudos con una palabra clave en el nombre va a «sin atribuir». (3) Entrantes muestra el lead de Marketing (entradas) y cuántas personas son, con una columna que dice cuánto aporta cada una. (4) Un ícono (`MarcaDeBase`: entradas, clics, Leads de Meta) dice qué es el lead en cada cifra donde Setting y Workshop se ponen lado a lado. (5) Se separan costo por venta (÷ pagos) y CAC (÷ personas que compraron), y se suma el ingreso por venta (New Cash ÷ pagos).
- **Qué se pierde:** el Ventas de Palabras clave ya no muestra «cobrado» debajo (sigue en la columna y en el ROAS); un anuncio de Contratación con una palabra clave en el nombre ($23,69 en el período) deja de sumarse a esa palabra. El CAC por personas todavía no coincide con el «CAC» de Workshop › Resumen cuando una persona paga dos veces el mismo mes (ahí las ventas ya son personas).
- **Consecuencias:** `metricas.test.js` carga sus cuentas con `usarFormulas`; cualquier lugar nuevo que calcule un costo debe agregar un renglón a `FORMULAS` en vez de dividir. Quedan distintas, y rotuladas: lead (3 cosas), inversión por taller contra gasto del período, y el cobrado de la tabla de palabras clave contra el Cash total de la tarjeta.

## ADR-W036: Todos › Métrica por métrica y Segmentos: desplegables para el detalle, pestañas solo para cambiar de tema
- **Fecha:** 2026-10-29 · **Subsistema:** Marketing › Todos (`MetricaPorMetrica`, `SegmentosVista`) y componentes estándar · **Estado:** implementado en local. Leadership 936 y 937.
- **Contexto:** Kerwin probó la versión integrada: los cuadritos rosa y azul sueltos en la cabecera de «Métrica por métrica» no decían nada (ahí van los nombres), el color estaba en filas, cifras y barras, y las dos vistas pedían mucho scroll (la primera con una pestaña por grupo; Segmentos con cuatro grupos de pestañas, dos filas de chips y una tabla de 560 px por grupo).
- **Decisión:**
  1. **`Accordion` estándar** (`components/standard/Accordion.jsx`): lista de items `{ key, title, meta, color, children, open }`; con el item cerrado, `meta` deja ver sus cifras; lo abierto lo recuerda la pantalla (`useEstadoGuardado`).
  2. **Métrica por métrica:** Embudo, Plata y Costos son desplegables (cerrados dicen cuántas filas gana cada fuente); la cabecera de columna escribe «Setting» y «Workshop» en su color; las cifras van neutras y solo la que gana toma el color de su fuente; filas de una línea (la pista de 4 px al lado de la cifra, la aclaración en un tooltip). El sistema «cifra con color y nombre en tooltip» queda para las tarjetas KPI.
  3. **Segmentos:** los bloques son una lista (`todos/bloquesSegmentos.jsx`, `BLOQUES`): sumar o sacar una función agrega o quita un desplegable. Hoy: Qué mostrar (columnas y grupos), Cruce y una tabla por grupo (con más de 4 grupos, juntas en «Tabla por grupo»). «Agrupar por» pasa de pestañas a `Select` y «Ver como» desaparece: cruce y tablas conviven. Las pestañas quedan para la fuente.
- **Qué se pierde (nombrado):** la tabla de cada grupo ya no está a la vista al entrar (primero el cruce; un clic abre la tabla). El estado guardado `disposicion` deja de usarse. Los filtros «Todo/Embudo/Plata/Costos» no existen: se cierran los grupos que no interesan. «Volumen» ya no se escribe en las filas sin ganador.
- **Consecuencias:** `TodosPage.test.jsx` («Métrica por métrica corona…») busca el texto «Volumen» y la pestaña «Costos»: hay que actualizarlo. Los desplegables de Segmentos de Analizar (Closing) no se tocaron.

## ADR-W038: El puente entre los dos ROAS se lee sin tooltips y vive en un desplegable cerrado
- **Fecha:** 2026-10-29 · **Subsistema:** Marketing › Todos y Workshop › Anuncios de Meta (`PuenteRoas`) · **Estado:** implementado en local. Leadership 942.
- **Contexto:** Kerwin no entendió la franja «5,37x → −3,42x ventas anteriores → −0,84x solo talleres → −0,20x más inversión → 0,90x» ni leyendo los tooltips: los extremos no tenían nombre y cada paso era una etiqueta de dos palabras. Ocupaba el centro del Resumen y mezclaba una cuenta con dos significados de «ROAS».
- **Decisión:** el puente pasa a un `Accordion` cerrado, «¿Por qué difieren los dos ROAS?», que cerrado deja ver sus dos cifras. Abierto, una cuenta de renglones (cifra · qué es · de cuánto): «Todos · cobrado del período ÷ gasto del período», «cuotas de meses anteriores», «cobrado fuera de estos talleres», «gasto de los talleres» y «= Workshop · N talleres». Restas en rojo con «−», sumas en verde con «+». Cada cifra mostrada es el ROAS redondeado de su tramo y cada resta es la diferencia de los redondeados, para que la suma se vea exacta.
- **Qué se pierde:** una resta mostrada puede diferir en 0,01x de la exacta (−3,43x en vez de −3,42x). Se pierden las marcas de base de los extremos (los nombres ya están escritos) y el tooltip de cada paso (su cuenta está en el renglón).
- **Consecuencias:** `calculoPuente.js` no cambia. Si en el futuro el puente sigue sin leerse en pocas palabras, se saca del Resumen y queda solo en el tooltip del ROAS Total.

## ADR-W039: El puente entre los dos ROAS sale del Resumen de Todos y queda en el tooltip del ROAS Total
- **Fecha:** 2026-10-29 · **Subsistema:** Marketing › Todos (`ResumenTodos`, `PuenteRoas`) y `CifraConCuenta` · **Estado:** implementado en local. Leadership 942 (seguimiento). Reemplaza el lugar de ADR-W038.
- **Contexto:** con el puente ya legible en un desplegable, Kerwin pidió sacar la tarjeta del Resumen y mostrar la cuenta en el tooltip de la cifra.
- **Decisión:** `CifraConCuenta` suma `detalle` (un nodo bajo la cuenta, separado por una línea). La cifra Workshop del ROAS Total lo usa con `CuentaDelPuente` en versión compacta. El rótulo del primer paso pasa de «cuotas de meses anteriores» a «cobros de ventas anteriores», porque `cash_anterior` incluye cuotas, upsells, renovaciones y señas de clientes sin venta nueva en el período. Workshop › Anuncios de Meta conserva el desplegable.
- **Qué se pierde:** la cuenta ya no está a la vista: hay que pasar el mouse por el 5.37x. En pantallas táctiles el tooltip depende del foco.
- **Consecuencias:** `usePuente` y `CuentaDelPuente` se exportan de `PuenteRoas.jsx`; el catálogo de `ui-builder` documenta `detalle`.

## ADR-W040: Se retira el puente entre los dos ROAS
- **Fecha:** 2026-10-29 · **Subsistema:** Marketing › Todos y Workshop › Anuncios de Meta · **Estado:** implementado en local. Leadership 942 (cierre). Reemplaza ADR-W038 y W031 en lo que dicen del puente.
- **Contexto:** Kerwin no necesitaba el puente: le bastaba entender qué mide cada ROAS. El de Todos es lo cobrado del período ÷ el gasto del período (caja del mes, 64% de ventas anteriores en la copia local); el de cada taller, lo que cobraron sus agendas ÷ su gasto. Lo explicará él en la reunión.
- **Decisión:** se borran `PuenteRoas.jsx`, `calculoPuente.js`, su CSS y la prop `detalle` de `CifraConCuenta` (sin otros usos). El rótulo de la marca de base y los tooltips de cada ROAS siguen diciendo sobre qué base se calculó.
- **Qué se pierde:** la cuenta paso a paso entre 5.37x y 1.21x. Queda sin unificar la definición de New Cash (Todos: pago de la venta nueva; Workshop: venta + primera cuota a menos de un mes).
- **Consecuencias:** el pendiente de unificar New Cash o de renombrar el ROAS de Todos como «caja del mes» queda como decisión de Kerwin.

## ADR-W025: El dinero decide el par de segmentos (A/B o C/D) y el ruteo es solo por dinero

- **Estado:** implementada (29/10/2026).
- **Contexto:** con los puntos de §8.10 (`plan_segmentos_triage.md`), quien no invierte llegaba como mucho a C, pero quien invierte podía caer en C o D por el resto de las respuestas (residente, ENARM, necesita apoyo). Para el workshop del 29/10, Santi simplificó el embudo: el que tiene dinero va a closers y el que no, al triage. No se descarta a nadie salvo el estudiante que no invierte (`mk-academy`, página de gracias).
- **Decisión:** `segmento.dinero` (`{q, ops}`: la pregunta de inversión y las opciones de $200 o más) en el formulario `dg6gukz9emx`. Con dinero el segmento es A (puntos ≥ a) o B; sin dinero, C (puntos ≥ c) o D. Sin respuesta de inversión se usan los cortes de siempre. El ruteo pasa a dos reglas por la inversión: `con-dinero` → «Segmentos A y B» (Jean Carlo y Marlon, máxima disponibilidad) y `sin-dinero` → Triage con la Sesión diagnóstica. Versión `2026-12.2`.
- **Qué se pierde:** el corte B/C por puntos deja de existir: un inversor con todo lo demás en contra queda B, y un no inversor con todo a favor queda C. Los A/B históricos (versiones anteriores) no se recalculan solos.
- **Consecuencias:** el segmento que se ve en la ficha y en Discord coincide con a dónde fue el lead. Python (`nucleo/segmento.py`, `normalizar.py`) y JS (`core/segmento.js`, `core/normalizar.js`) quedan iguales.

## ADR-W026: Aviso a Discord del lead que no terminó de agendar, a los 5 minutos

- **Estado:** implementada (29/10/2026).
- **Contexto:** los leads que dejan sus datos en un link de Tálamus y no agendan quedaban en `sched_intentos` (Stats) sin que nadie se enterara a tiempo. Santi pidió que a los 5 minutos llegue a Discord y etiquete al setter, para que lo rescate.
- **Decisión:** un job del scheduler (`abandonos.avisar_abandonos`, cada minuto, solo el líder) busca intentos `incompleta` sin moverse hace 5 minutos (y no más de 2 horas) y sin `avisado_en`. Manda la tarjeta de siempre con el tipo «No terminó de agendar»: nombre, WhatsApp, respuestas, segmento y hasta dónde llegó, y etiqueta al setter del link. Sin setter no etiqueta a nadie, y con un setter sin ID de Discord va @everyone, como el resto de los avisos. Un solo aviso por intento. Webhook `DISCORD_ABANDONOS_WEBHOOK`; sin esa variable, el de agendas. `sched_intentos` suma `pais` (para el WhatsApp con su prefijo) y `avisado_en`.
- **Qué se pierde:** si el lead vuelve y abandona de nuevo, no hay segundo aviso. Si Discord falla, ese aviso no se reintenta (se marca antes de mandar, para no repetirlo cada minuto). Los intentos anteriores al deploy no tienen país: el WhatsApp sale con el prefijo de Bolivia.
- **Consecuencias:** los avisos salen aunque el lead agende a los 6 minutos. Para ese entonces el setter ya lo vio, y la agenda nueva llega con su propio aviso.

## ADR-W028: Los leads y la inversión de Meta de cada taller, por hora (del fin del anterior al fin de este)

- **Estado:** implementada (29/10/2026), sin probar contra la cuenta real de Meta.
- **Contexto:** el taller de hoy mostraba «181 de 111 leads» (WhatsApp sobre Leads de Meta). La ventana era por día (del día siguiente al taller anterior hasta el día de este, completos), pero el link del grupo de WhatsApp cambia al terminar cada taller: lo que llega esa noche ya es del siguiente, y lo que llega después de este taller también. La ventana por día perdía la noche del anterior y contaba de más la de este.
- **Decisión:** `MetaGastoHorario` (`meta_gastos_horarios`) guarda el gasto, impresiones, clics y leads por anuncio y hora (UTC), solo de las campañas con anuncios de embudo `workshop`, con el desglose `hourly_stats_aggregated_by_advertiser_time_zone` (`meta_ads_horas`, después de cada sincronización diaria). `workshop_meta_service.franjas` da a cada taller `[fin del anterior, su fin)` con fin = inicio + `DURACION_HORAS` (2), a la hora más cercana. Aplica a leads, inversión, CPM y CPC (`meta_*` del evento) y al desglose de anuncios. Solo si el taller y el anterior tienen `inicio_at` y todo el gasto diario de los anuncios de workshop de esa franja tiene sus horas (`meta_ads_horas.cubre`); si no, sigue la ventana por día.
- **Qué se pierde:** el corte es de 2 h fijas, no la hora real en que se cambió el link. La franja termina 2 h después de empezar este taller (y no al empezar) para que las 2 horas del vivo no queden sin taller; Kerwin había hablado de cortar al inicio. Los talleres sin hora cargada o sin horas traídas siguen por día, así que el historial mezcla los dos criterios, y la inversión de cada taller cambia respecto de lo cargado a mano. Falta traer las horas de los talleres viejos (Sincronizar 180 días).
- **Consecuencias:** cambiar la hora de un taller recalcula la inversión de Meta de él y de sus vecinos. Un fallo del pedido por hora se registra y no tumba la sincronización diaria. No cierra la diferencia con el grupo: orgánico, DMs, anuncios de otro embudo y personas sin píxel siguen fuera de «Leads de Meta».

## ADR-W027: La ventana «N días» cuenta solo días con lugar, y se abren días antes de desbordar a otro grupo

- **Estado:** implementada (29/10/2026).
- **Contexto:** con la agendada masiva del workshop, Jean Carlo y Marlon se llenaron hasta el sábado. Un evento de «4 días» terminaba ofreciendo solo los 6 horarios del lunes, o directamente desbordaba al Grupo 4 (Mario), que Santi no quería para A/B. Santi: «un día lleno no debería contar para el límite de días, y uno con 1 o 2 espacios está virtualmente lleno».
- **Decisión:** `asignacion` (Python y JS) cuenta la ventana en días con `MIN_HORARIOS_DIA` (3) o más horarios del grupo del lead, en la zona del equipo. Si tiene menos de N, abre un día más por vez (hasta `DIAS_EXTRA_MAX`, 14) **sin desbordar** (`sin_desborde`). Recién si el grupo no tiene ningún horario en todos esos días, desborda como antes y, si tampoco hay nadie, sigue abriendo días. Los días con 1 o 2 horarios se siguen ofreciendo, solo que no cuentan.
- **Qué se pierde:** el lead puede ver horarios más lejos en lugar de uno más cercano con un closer de otro grupo. En Setting, un A/B que antes caía en Mario el viernes ahora ve a Jean Carlo desde el lunes. Cada asignación calcula hasta 15 veces más (sin consultas nuevas a Google).
- **Consecuencias:** el desborde a otro grupo queda como último recurso. Los eventos en modo «rango» o «siempre» no cambian.

## ADR-W029: En la venta nueva, los datos que ya tenemos se confirman de un vistazo

- **Estado:** implementada (30/10/2026).
- **Contexto:** muchos errores del reporte de venta venían de closers que volvían a cargar datos que ya teníamos (nombre, correo, Instagram, teléfono). Tarea de Santi en Leadership: «Confirmar en una sola pregunta los datos que ya tenemos».
- **Decisión:** en «Confirmá sus datos» (`venta_datos`), los campos marcados `confirmar` que llegan precargados de la agenda y siguen igual se muestran en una tarjeta (`ConfirmarDatos.jsx`) con lo que trae la agenda y el aviso del correo del acceso. «Corregir» abre los campos. Si falta un dato, o el correo no es válido, ese campo se pide como antes. La fecha de inicio, el acceso a la Academia y la comisión siguen en la misma pantalla.
- **Qué se pierde:** el closer ya no ve cada campo como input: para cambiar algo tiene que tocar «Corregir». Un dato precargado mal escrito puede pasar si no lo lee.
- **Consecuencias:** sin cambios en el payload ni en el backend; la revisión final sigue mostrando todos los datos.

## ADR-W041: El corte de A baja a 3 puntos (segmentación 2026-12.3)

- **Fecha:** 2026-10-30 · **Subsistema:** Segmentos A/B/C/D (formulario `dg6gukz9emx`) · **Estado:** implementado en producción.
- **Contexto:** en Marketing › Segmentos de octubre, A no vendía y B parecía vender más. Con jun–oct (421 leads con dinero, 58 compras a 60 días, `scripts/ajuste_segmentos.py`), A compraba 20,4% y B 11,5%: A funcionaba, pero B mezclaba los de 2 y 3 puntos (compran ~16%, casi como A) con los de 1 o menos (6%).
- **Decisión:** `segmento.a` de 4 a 3 en el formulario vivo (solo ese campo, con `guardar_doc(parcial=True)`), versión `2026-12.3`, y `backfill_segmentos.py --apply --force` sobre todas las agendas y clientes. Con los mismos datos: A 207 leads, 18,4% de compra, $169 por lead; B 214, 9,3%, $67 (antes 1,8 veces, ahora 2).
- **Qué se pierde:** A deja de ser el ~25% de los que invierten y pasa a ser la mitad; cae un poco su tasa (20,4% → 18,4%). El ruteo no cambia: A y B van al mismo grupo desde ADR-W025.
- **Consecuencias:** `scripts/segmentos_formulario.py` queda con el corte nuevo y avisa que su ruteo por segmento está viejo (no correrlo con --apply sin actualizarlo). En el Setting de octubre casi no se nota (A pasa de 16 a 17 agendas): sus compradores de B tienen pocos puntos. Pendiente aparte: el cierre de Segmentos divide pagos del período por asistencias de las agendas del período (poblaciones distintas).

## ADR-W042: Dirección ve el triage en su propia sección, con las cifras clicables

- **Fecha:** 2026-10-30 · **Subsistema:** Triage (Dirección Comercial) · **Estado:** implementada en local, sin desplegar.
- **Contexto:** el triage ya reporta con la forma del closer y `GET /api/triage/metricas` ya servía a la dirección (`triage_metricas_required`), pero ninguna pantalla de Dirección lo mostraba: solo lo veía cada triage en su espacio. Kerwin no podía ver las métricas de Dari y Juliana. Tarea de Leadership 1013.
- **Decisión:** sección «Triage» en el dock de Dirección Comercial (`TriageDireccion.jsx`, solo para quien puede reportar), con su propio período (hoy, 7, 30 días), selector de persona y comparación por persona. Reutiliza `embudo`, `lowTicket` y `Reporte` de `TriageMetricas.jsx`. Cada tarjeta y cada barra filtra la lista de leads que compone el número (criterios en `triageFiltros.js`) y cada lead abre su ficha. El backend suma `confirmada` a cada lead para que «Confirmadas» también abra su lista, con el mismo criterio que la cuenta (`_confirmada`).
- **Qué se pierde:** el período de la sección no sigue al selector del tablero (es propio, como Simulador y Finanzas); `DashboardComercial.jsx` ya pasaba de 500 líneas y sigue creciendo en 5.
- **Consecuencias:** los criterios de `triageFiltros.js` y los de `triage_service._sumar` tienen que dar el mismo número; si uno cambia, el otro también. Pendiente: corte día por día (Leadership 1019).

## ADR-W043: Los abandonos del formulario son del triage, no del setter

- **Fecha:** 2026-10-30 · **Subsistema:** Agendas 2.0 / Triage · **Estado:** implementada en local, sin desplegar.
- **Contexto:** quien no termina de agendar queda en `sched_intentos` sin agenda (el triage trabaja con agendas) y, desde ADR-W026, a los 5 minutos avisa a Discord y etiqueta a su setter. Kerwin (30/10) quiere que el triage los contacte primero. Son menos de 2 por día (29 en 18 días en la copia local). Leadership 1018.
- **Decisión:** (1) el aviso de abandono etiqueta a las triage activas (`ETIQUETA['abandono'] = ('triage',)`); las que no tienen ID de Discord se saltean y solo si ninguna lo tiene va `@everyone`; el setter sigue en la tarjeta como origen. (2) Sección «Abandonos» en el dock del triage: los incompletos de las últimas 48 h con WhatsApp y los estados `contactado` / `no_contesta` (`sched_intentos.contacto_estado`, `contacto_por_id`, `contacto_en`; migración `a6c8e0b2d4f6`). Marcar un contacto no mueve `actualizado_en`. Cuando el lead agenda, su intento se borra y sale de la lista. (3) Un panel «Abandonos del formulario» en las métricas del triage y en la sección de Dirección, por fecha en que dejó sus datos.
- **Qué se pierde:** el setter ya no recibe la etiqueta del abandono de su link. Los abandonos que agendan después desaparecen de las métricas (su intento se borra), así que el panel cuenta los que siguen sin agendar. No hay un lead en el mazo del triage: sin agenda no hay ficha.
- **Consecuencias:** sin `discord_id` cargado en Dari y Juliana el aviso sale con `@everyone`. El ruteo C/D al triage no cambia (ADR-W025).

## ADR-W044: Las métricas del triage se cortan día por día, en la zona de quien mira

- **Fecha:** 2026-10-30 · **Subsistema:** Triage (métricas) · **Estado:** implementada en local, sin desplegar. Completa la ADR-W042 (Leadership 1019).
- **Contexto:** `triage_service.metricas` solo daba el total del período y Kerwin pidió ver agendas y confirmaciones por día.
- **Decisión:** la respuesta suma `por_dia`: un renglón por día y por persona con las mismas cuentas de `_sumar`. El día se corta con la zona de quien mira (`zona_del_usuario`), no la del servidor. La pantalla (`diasDe`, `PorDia` en `TriageMetricas.jsx`) suma los renglones de todas o se queda con una persona, y solo se muestra con más de un día.
- **Qué se pierde:** los días sin agendas no salen como fila. Cada día cuenta las llamadas que caen en él por su hora, no las que se agendaron ese día.
- **Consecuencias:** `por_dia` y `por_persona` suman lo mismo que `total`; si `_sumar` cambia, cambian los tres.

## ADR-W045: El chat de la ficha avisa escribiendo «@» y eligiendo a la persona

- **Fecha:** 2026-10-30 · **Subsistema:** Ficha del lead (Comunicación) · **Estado:** implementada en local, sin desplegar. Leadership 1014.
- **Contexto:** para avisar a alguien de una nota había una fila de botones con todo el equipo («Notificar a»), lejos de lo que se escribe. Kerwin pidió mencionar con `@` y elegir a la persona, para que el chat por lead sirva para compartir leads.
- **Decisión:** `CampoConMenciones.jsx`: al escribir `@` se abre la lista del equipo (la de `comunicacion.equipo`), se filtra con lo que sigue y se elige con ↑ ↓ Enter/Tab o con el mouse; queda «@Nombre» en el texto. Al enviar, `notificar` lleva a quienes sigan nombrados. La lista va en el flujo, no flotando, porque el cuerpo de la ficha recorta lo que sobresale. Las menciones se resaltan en el hilo con los «notificados» que ya devolvía el backend. Reusa `disparador`/`insertar`/`plano` del `@` de Learnito (`pages/copiloto/menciones.js`).
- **Qué se pierde:** la fila «Notificar a»: ya no se avisa a alguien sin nombrarlo en el texto. Un nombre repetido o con la misma raíz se elige de la lista.
- **Consecuencias:** sin cambios en el backend (`notificar` ya existía). Base de «Compartidos conmigo» (Leadership 1015).

## ADR-W046: Reprogramar elige a la persona y solo ofrece horarios libres, en la hora de quien reprograma y la del lead

- **Fecha:** 2026-10-30 · **Subsistema:** Agendas 2.0 / Ficha (Confirmación › Reprogramar) · **Estado:** implementada en local, sin desplegar. Leadership 986 a 989.
- **Contexto:** `SubReprogramar` pedía una fecha y una hora de una lista fija, sin mirar la disponibilidad, y no dejaba pasar la llamada a otra persona (de triage a closer o entre closers). El lead se veía solo en la zona de quien reprograma. Los choques se descubrían al guardar. Kerwin pidió ver el calendario de la persona, las dos zonas y poder cambiar de persona.
- **Decisión:** `GET /ficha/<id>/reprogramar/opciones?persona_id=` devuelve las personas que atienden (closers y triage con horario en Team), sus horarios libres de 14 días (`a_triage.horarios_de`: horario de Team, agendas y Google; la duración es la sesión de su rol: diagnóstica o de closing), la zona del lead (por su teléfono) y las zonas a elegir. `POST /ficha/<id>/reprogramar` con `inicio` (ISO con zona), `persona_id` y `motivo` obligatorio sigue el camino de «Reagendado» (`process_agenda`): la vieja queda cerrada con quien la tenía y la nueva nace con quien la recibe, con su duración y su margen (`closer_destino_id`), y el horario se vuelve a comprobar al guardar. La pantalla muestra los horarios en la zona de quien reprograma y, al elegir, también en la del lead (editable). Sin `inicio` sigue el camino viejo (`fecha`).
- **Qué se pierde:** ya no se escribe una hora a mano: solo se ofrecen horarios libres. Si no hay horarios en 14 días hay que elegir a otra persona.
- **Consecuencias:** la agenda nueva cuenta para quien la recibe (embudo, `reagenda_de`), no para quien la tenía. El evento de Google se mueve por el camino de siempre (se borra el viejo y se crea el nuevo): falta probarlo en staging.

## ADR-W047: «Compartidos»: el lead en el que te nombran con @ te aparece en tu dock

- **Fecha:** 2026-10-30 · **Subsistema:** Avisos / Ficha (Comunicación) · **Estado:** implementada en local, sin desplegar. Completa la ADR-W045 (Leadership 1015).
- **Contexto:** Kerwin quiere que, si escribe a alguien sobre un lead en su chat, ese lead le aparezca a la persona en su dashboard aunque no sea suyo, para que conteste.
- **Decisión:** `GET /api/avisos/compartidos` (`avisos_service.compartidos`): los avisos `nota` dirigidos a un grupo (los que crea la mención con `@`; los automáticos al setter o al rol no cuentan), una fila por lead, con quién escribió, el texto, la fecha y si hay algo sin leer. `CompartidosConmigo.jsx` los lista en una sección «Compartidos» del dock del closer, del triage (`CloserWorkflowPage`) y del setter (`SetterEspacioPage`); el punto del dock cuenta los nuevos. Un lead abre su ficha con `soloLectura` en la pestaña Comunicación: la única acción es la nota, y abrirla marca el aviso como leído.
- **Qué se pierde:** quien es nombrado ve el lead entero (formulario, historial) aunque no sea suyo. Solo cuentan las menciones de los últimos 90 días (la ventana de los avisos). No está en el dock de Dirección Comercial.
- **Consecuencias:** sin tablas ni columnas nuevas.

## ADR-W048: Triage es el tercer interruptor de Dirección y su tablero sigue el diseño de Claude Design

- **Fecha:** 2026-10-30 · **Subsistema:** Triage (Dirección Comercial) · **Estado:** implementada en local, sin desplegar. Reemplaza la ubicación y la presentación de la ADR-W042.
- **Contexto:** la sección «Triage» del dock se mezclaba con Analizar, Revisar, Simulador y Reportar como una más, y Kerwin la quería como un grupo aparte, igual que Closers y Setters, con el diseño «Triage Dashboard» (Claude Design, carpeta `Colores de segmentos A B C D`).
- **Decisión:** el interruptor del dock pasa a Closers · Setters · Triage. Con Triage elegido, Analizar muestra `TriageDireccion` (sin pestañas, período, comparación ni barra de segmento del tablero comercial; el título pasa a «Triage»). `?s=triage` abre ese estado (`SECCION_ALIAS`). El tablero: cuatro tarjetas, Estados (dona), Embudo con su cuello de botella (la etapa que menos pasa de la anterior), Low ticket, Abandonos, Por persona, Día por día y el Reporte con chips por estado, «Ver nota» y «Ver ficha». Cada cifra abre su lista (criterios en `triageFiltros.js`). Los datos son los de `GET /api/triage/metricas`; los estados suman las agendas (lo no reportado y las reagendas cuentan como «Sin reportar»). Archivos en `pages/comercial/components/triage/`, estilos con los tokens del tablero, sin CSS nuevo.
- **Qué se pierde:** «Triage» no es un rol de datos: con él elegido, Revisar, Simulador y Reportar siguen mostrando los closers (`rol` cae a `closers`). El «Ver ficha» del diseño, que era un resumen escrito a mano, pasa a abrir la ficha real y la nota para el closer en bruto.
- **Consecuencias:** `DashboardComercial.jsx` suma unas líneas (ya pasaba de 500). El período del tablero es propio (hoy, 7 y 30 días).

## ADR-W049: La tarjeta de Discord lleva el color de su segmento

- **Fecha:** 2026-10-30 · **Subsistema:** Agendas 2.0 / Discord · **Estado:** implementada en local, sin desplegar. Leadership 982 y 983.
- **Contexto:** la tarjeta de agenda era igual para todos y mostraba las respuestas del formulario como un muro de tarjetas. Kerwin pidió una más sintética, con el segmento a la vista y los datos clave (decisor, trabajo, inversión, etapa). Diseño «Agenda Segmentos» de Claude Design.
- **Decisión:** `agenda_v2.html` rehecha: el color de toda la tarjeta (fondo, borde y barra de arriba) es el del segmento (A verde, B azul, C amarillo, D rojo; gris sin segmento); aro con los puntos y la confianza; chips de teléfono, día y hora con la de Bolivia; cajas de Closer (o del motivo) y Origen; y hasta 7 fichas de respuestas con ícono, el examen, la inversión, la etapa, el trabajo y quién decide primero (`_tiles`). Una respuesta con versión corta usa la corta de título y la larga de detalle; una larga sin corta pasa a detalle y el título es la pregunta. `_segmento_visual` arma el aro. El alto de la imagen se calcula con las fichas, dos por fila.
- **Qué se pierde:** desaparece la «Nota /10» de la cabecera y los colores por respuesta (verde/amarillo/rojo según sus puntos): el color ahora es solo el del segmento.
- **Consecuencias:** sin cambios en los datos que guarda la agenda (`segmento_lead` y `respuestas` ya estaban). Si el formulario no segmenta, la tarjeta sale gris sin aro. Falta verla pasar por el servicio real de imágenes en staging.
## ADR-W051: El closer borra desde su tablero la agenda de quien agendó por otra cosa
- **Fecha:** 2026-10-30 · **Subsistema:** Closer Workspace (tablero de Reportar) · **Estado:** implementado
- **Contexto:** hay personas que agendan por otra cosa (no es una llamada de venta) y cuentan en la asistencia, la comisión y las métricas del closer. El backend ya tenía el borrado del mazo (`DELETE /closer/deck/<id>`), pero ninguna pantalla lo usaba.
- **Decisión:** papelera en cada tarjeta del tablero (`EliminarLead`), con `ConfirmDelete` dentro de la tarjeta, que llama a ese endpoint. Se borra (no se marca «No Lead»): «No Lead» cuenta como descalificada en los números de dirección, y esto no tiene que contar en ninguno.
- **Qué se pierde (nombrado):** el borrado no se deshace, y `eliminar_agenda` borra también el evento de Google Calendar del closer. Si la reunión por la otra cosa igual ocurre, desaparece del calendario.
- **Consecuencias:** la regla de qué se conserva (respuestas del formulario, plan de cuotas) sigue siendo la de `BookingService.eliminar_agenda`, compartida con la dirección comercial.

## ADR-W052: Cada formulario de Hiring tiene su propio link y puede haber varios activos

- **Fecha:** 2026-11-01 · **Subsistema:** Hiring (Talent › Forms) e institute-site · **Estado:** implementado en local, sin desplegar.
- **Contexto:** el formulario de Asistente vivía en un solo link fijo (`/vacante-assistant/`) y solo un formulario podía estar activo. Mario quiere copiar el link desde la tarjeta del formulario y elegir cómo se llama.
- **Decisión:** columna `hiring_forms.slug` (única). Cada formulario se publica en `institute.thelearnation.com/vacante/<slug>/` (página de la vacante) y `/vacante/<slug>/formulario/`; el `.htaccess` de institute-site sirve ahí los mismos archivos de `vacante-assistant/`, que leen el slug de la URL y piden `GET /api/public/assistant-form?slug=`. Activar ya no apaga a los demás. El slug se edita en la tarjeta y en el editor (`LinkFormulario`, se guarda al confirmar; 409 si otro lo usa). Los nuevos y las copias lo sacan del nombre. La migración deja `assistant` al activo más antiguo.
- **Qué se pierde:** el link viejo `/vacante-assistant/` sigue andando pero muestra el activo más antiguo, no uno elegido. Los filtros del Inbox siguen tomando las preguntas de ese mismo formulario. Cambiar un slug rompe los links ya compartidos con el anterior (muestran la búsqueda cerrada). La página de la vacante es la misma para todos los links (el texto del puesto no cambia por formulario).
- **Consecuencias:** el avance guardado en el navegador de la postulante va aparte por slug. Los assets de la página de la vacante pasan a rutas absolutas.

## ADR-W053: Las vistas de la dirección comercial recuerdan lo ya cargado (extiende `cacheDeVistas` más allá de Marketing y Workshop)

- **Fecha:** 2026-11-02 · **Subsistema:** Frontend / Dirección comercial · **Estado:** implementada en local, sin desplegar. Pedido de Kerwin: «si ya se cargó, tiene que quedarse ahí».
- **Contexto:** `cacheDeVistas` (19/10) solo lo usaban Marketing y Workshop. En Dirección comercial cada cambio de sección o de pestaña volvía a pedir todo, porque los efectos dependían de la sección y las pantallas hijas (Triage, Finanzas, Payroll, Segmentos) pedían al montarse.
- **Decisión:** se usa el mismo recuerdo en memoria (5 minutos de vigencia): `usePedidos.pedirCacheado` para el dashboard (contexto, KPIs, Comparativas, Variabilidad, tablas), `useDatosCacheados` para Triage, Segmentos y las métricas del triage, y el hook de Finanzas con clave por vista y período. Fresco: se muestra y no se pide; viejo: se muestra y se actualiza en silencio. Reintentar y lo que sigue a un guardado piden siempre (`forzar`). El interceptor de `api.js` vacía todo el recuerdo en cualquier respuesta exitosa que no sea GET.
- **Qué se pierde:** hasta 5 minutos, lo que cambie en el servidor por otra persona no se ve al volver a una pestaña ya cargada (sí se ve al recargar la página, al guardar algo o al cambiar de período). Un guardado vacía el recuerdo de todas las vistas, no solo de la que cambió.
- **Consecuencias:** quedan fuera, por ahora, las pantallas con su propio patrón de carga (espacio del setter, mazo del closer, espacio del operador, contratación). Las que se refrescan solas (avisos, comentarios, Agendas 2.0, conversaciones) no usan este recuerdo.
## ADR-W054: El triage trabaja el lead como un closer, sin cobrar ni borrar

- **Fecha:** 2026-11-02 · **Subsistema:** Ficha del lead / Triage · **Estado:** implementada en local, sin desplegar. Pedido de Kerwin tras el reporte de Juliana (no podía registrar seguimientos).
- **Contexto:** `permisos_de` daba a `triage` solo «confirmar» (y «triar» en su propia agenda). El historial, los seguimientos, los eventos, las objeciones y los datos exigen `reportar` o `editar_datos`, de closer y dirección; Confirmación desaparecía con la llamada pasada.
- **Decisión:** `triage` recibe `reportar` y `editar_datos` (los permisos que ya gobiernan el historial y el estado de la agenda) y `triar` en cualquier agenda de triage, no solo la suya; entra como rol sin alcance en `_process_agenda`. En Resultado el progreso pasa a ser la navegación del lead (triage y closer): cada etapa se abre en cualquier momento (Confirmado con la confirmación dentro del panel, Resultado, Calificación y Seguimiento con «¿Qué pasó con este contacto?», el reporte del closer), así la pestaña Confirmación no hace falta cuando la llamada pasó. «Siguiente paso» pasa a «Seguimiento» en el triage.
- **Qué se pierde:** el triage puede ahora reportar (árbol del closer) y declarar una venta por la API en cualquier agenda; la pantalla solo se lo ofrece donde corresponde. Una llamada ya pasada al closer no se puede volver a pasar desde el triage.
- **Consecuencias:** `cobrar`, `eliminar` y `reasignar` siguen siendo de closer y dirección.

## ADR-W055: Lo ya cargado se queda en todos los roles: datos recordados donde hay listas de trabajo y paneles conservados donde cada panel carga solo (continúa ADR-W053)

- **Fecha:** 2026-11-02 · **Subsistema:** Frontend · **Estado:** implementada en local, sin desplegar. Pedido de Kerwin: «hay que hacerlo en todos lados para que no esté cargando cada rato».
- **Contexto:** ADR-W053 dejó el recuerdo de vistas solo en Dirección comercial. El mazo del closer y del triage, el espacio del setter, el del operador y contratación seguían mostrando el esqueleto al volver a una pestaña ya vista.
- **Decisión:** dos mecanismos. (1) Donde hay una lista de trabajo (mazo por pestaña y día, seguimientos, compartidos, abandonos, mis agendas) se muestra lo último que se vio y se pide siempre por detrás, porque entran leads nuevos solos. Donde es un tablero (métricas, historial de reportes) rige la vigencia de 5 minutos. (2) Donde cada panel carga solo al montarse y son muchos (operador, formularios de contratación) se usa `PanelesConservados`: el panel que se abrió queda montado y escondido.
- **Qué se pierde:** un panel conservado no se actualiza hasta recargar la página. Las listas de trabajo siguen pidiendo en segundo plano al volver, aunque ya no se vea el esqueleto.
- **Consecuencias:** no se tocaron los formularios (reporte diario del setter, venta) ni las pantallas que se refrescan solas (Agendas 2.0, conversaciones).

## ADR-W057: Una persona suma una sola agenda, aunque reagende o quede dos veces en el mismo horario

- **Fecha:** 2026-11-02 · **Subsistema:** Dirección comercial (Closing y Triage) / Revisar · **Estado:** implementada en local, sin desplegar. Pedido de Kerwin: la gente aparece repetida cuando se reagenda y eso cambia sus números; en Revisar › Agendas hay varias filas de la misma persona y algunas con la misma fecha y hora.
- **Contexto:** reagendar desde NeurOPS deja dos filas (la vieja cerrada como `Reagendado`, la nueva con `is_rescheduled`; `agendas_v2/manual.py`) y de ahí salen el roadmap, la cola «reagendar» y el embudo del mazo. Pero `ComercialService.agendas` (la única puerta a los números de Closing, Analizar, reportes, simulador y Marketing «por reunión») y `triage_service.metricas` contaban cada fila: la persona sumaba dos agendas y la vieja quedaba sin ningún estado de embudo en el triage. Dos filas de la misma persona a la misma hora (carga repetida) sumaban dos.
- **Decisión:** `agendas_vigentes.py` define qué agenda cuenta: se descarta (1) la `Reagendado` que ya tiene una agenda posterior de la misma persona y (2) la repetida en el mismo minuto (queda la que ya tiene resultado, o la primera). `ComercialService.agendas(vigentes=True)` la aplica por defecto, y por tanto todas las cifras de Closing; solo el calendario pide todas (`vigentes=False`) porque dibuja cada evento. El triage, además, cuenta una agenda por persona (la calificada o la más reciente). Revisar › Agendas suma «Agrupar por Persona» (grupos abiertos): todas las llamadas de un lead juntas.
- **Qué se pierde:** las filas no se borran ni se marcan, solo dejan de contar: el chip «Reagendó» y el estado `reagendada` ya no aparecen en las listas ni en el panel Estados de Dirección (la vieja de una reagenda con sucesora). Una persona con dos llamadas distintas en el período suma dos en Closing (primera y segunda llamada se siguen midiendo aparte) pero una en el triage.
- **Consecuencias:** la reagenda de quien la recibe cuenta para quien la recibe (ADR-W046). Sigue abierta la decisión de dejar de crear la fila nueva al reagendar (moverla como hace el triage y el link de Thalamus), que cambiaría el embudo del mazo; ver `pendientes_santi.md`.

## ADR-W056: Segmento Alfa y reglas por etapa y decisión en «Sesión de Aceleración»

- **Fecha:** 2026-11-02 · **Subsistema:** Thalamus (formulario `dg6gukz9emx`, estrategias de Team) · **Estado:** aplicado en producción el 02/11 (`scripts/segmentacion_alfa.py --apply` y `backfill_segmentos.py --apply --force`).
- **Contexto:** Mario quiere que el ruteo de quien puede invertir dependa de la etapa, el país y quién decide, no solo de la suma de puntos; un lead «perfecto» aparte (Alfa); que nadie se descarte (sale `mk-academy`); y que ninguna regla se pise con otra. Lo armó en el Simulador de Segmentación. Thalamus guarda hasta 20 reglas por formulario (`normal_reglas`): escritas solo con respuestas, sin choques, eran 27.
- **Decisión:** Examen: Colombia y Perú +2, el resto +1, sin examen −1, ENARM −2 (versión `2026-12.4`). Once reglas que no se pisan, usando «Segmento del lead» donde coincide con lo pedido: Alfa = puede invertir + médico general o Rural + Colombia o Perú + decide solo → «Segmento Alfa» (Máxima disponibilidad: Marlon › Jean Carlo › Mario). A = médico general o Rural con segmento A por puntos (sin ser Alfa); residente o especialista que decide solo; estudiante que decide solo y rinde Colombia o Perú → «Segmento A». B = el resto de quien puede invertir → «Segmento B» (las dos con Llenar agenda: Jean Carlo › Marlon). C y D por puntos → «Triage · Segmento C» y «Triage · Segmento D» (Máxima disponibilidad: Juliana › Dari) con la Sesión diagnóstica. «Todo lo demás» → Triage · Segmento D. El script prueba cada combinación con `grupo_por_reglas` antes de guardar y frena si alguna cumple dos reglas o va a otro grupo.
- **Qué se pierde:** el segmento que se guarda en la agenda y en el cliente sigue saliendo de los puntos (A/B/C/D): Alfa se ve como A, y algunos casos llevan una letra distinta de su grupo (especialista con apoyo que suma 3 o más: dice A y va a Segmento B; residente o estudiante que decide solo con pocos puntos: dice B y va a Segmento A). El estudiante que no puede invertir ya no va a la página de gracias: agenda con el triage. Las estrategias viejas («Segmentos A y B», «Triage», grupos 1–5) quedan en Team sin usar por este formulario.
- **Consecuencias:** después de aplicar, `backfill_segmentos.py --apply --force` recalcula los segmentos con el examen nuevo. Mostrar Alfa como segmento propio (chip, Discord, Marketing › Segmentos) y que la letra salga de la regla y no de los puntos necesita código: queda para otro ADR.

## ADR-W058: La segmentación se escribe solo con respuestas: sin «Segmento del lead» en las reglas y hasta 40 reglas

- **Fecha:** 2026-11-02 · **Subsistema:** Thalamus (Forms › Segmentación, Team › Estrategias) · **Estado:** implementado.
- **Contexto:** con ADR-W056 las reglas de «Sesión de Aceleración» usaban «Segmento del lead». El editor (`revisarSegmentacion`) recorre esa pregunta como si fuera independiente de las respuestas, así que avisaba choques y 328 combinaciones sin regla que en la realidad no existen (p. ej. «no puede invertir + Segmento A»). Mario quiere que el segmento se decida a mano en las reglas, no por otra vía, y que Team tenga solo las estrategias de los segmentos.
- **Decisión:** las reglas se escriben solo con respuestas: una por grupo de combinaciones, ninguna se pisa y todas quedan cubiertas (27 en «Sesión de Aceleración»). El tope de reglas por formulario sube de 20 a 40 (`normal_reglas` y `normalReglas`). El editor deja de ofrecer «Segmento del lead» (`preguntasRuteo`); el ruteo sigue entendiendo las reglas viejas que lo usan. Team queda con Segmento Alfa, A, B, Triage · Segmento C y Triage · Segmento D; las demás estrategias se borran salvo que otro formulario las use.
- **Qué se pierde:** una regla ya no puede decir «Segmento es A»: si cambian los puntos, las reglas no se acomodan solas (se rehacen con `scripts/segmentacion_alfa.py`). Sin `ws-triage`, los descalificados de `con_triage` van al primer grupo cuyo nombre dice «triage».
- **Consecuencias:** la letra guardada en la agenda (`segmento`) sigue saliendo de los puntos; que salga de la regla (y que exista «Alfa» como letra) queda para otro cambio.

## ADR-W059: Segmentación con «Probar un lead», sin «No califica» y con doble confirmación para borrar un formulario

- **Fecha:** 2026-11-02 · **Subsistema:** Thalamus (Forms › editor) · **Estado:** implementado.
- **Contexto:** Mario quiere probar a dónde va un lead sin salir de Segmentación (lo venía haciendo en un simulador aparte), ya no descarta a nadie y teme borrar un formulario sin querer. «La del formulario» como sesión de una regla no se entendía, y dos eventos se llaman «Sesión de Aceleración».
- **Decisión:** tercera vista en Segmentación, «Probar un lead» (`RuteoSimulador.jsx`): se eligen las respuestas de las preguntas que usan las reglas y se ve la regla que se cumple, la estrategia con sus closers y cómo reparte, la sesión y los puntos. Usa `grupoPorReglas`, el mismo ruteo de la reserva. Sale el botón «No califica» de la barra y la opción «No califica» de los destinos (se sigue mostrando si un destino viejo la tiene). Eliminar un formulario pide dos confirmaciones. La sesión «La del formulario» pasa a decir «La del link por el que agendó», y dos eventos con el mismo nombre se distinguen por su embudo.
- **Qué se pierde:** desde el editor ya no se configura la pantalla del que no califica (`fin`); queda lo que tenía cada formulario.
- **Consecuencias:** `scripts/segmentacion_alfa.py --revisar` verifica en solo lectura las reglas guardadas.

## ADR-W060: Un formulario puede no tener segmentación: cada link va a la persona de su evento

- **Fecha:** 2026-11-02 · **Subsistema:** Thalamus (Forms › Segmentación) · **Estado:** implementado.
- **Contexto:** los formularios simples (Hiring, Momentum, Consultoría…) agendan con una persona fija y no necesitan reglas ni estrategias, pero Segmentación les marcaba en rojo «Todos los leads quedan sin estrategia». El evento con `persona` ya saltea el ruteo (`_contexto`, `sesion_del_lead`, `asignacion`).
- **Decisión:** interruptor «Con / Sin segmentación» en Segmentación (`sinSegmentacion` en el formulario; solo se guarda si es `true`, así lo publicado antes queda igual). Sin segmentación se esconden reglas, revisión y Simular, y se listan los links que usan el formulario con su persona; un link sin persona se marca en rojo porque no ofrecería horarios. Cada link se abre en Eventos.
- **Qué se pierde:** nada en el ruteo: es una marca de la pantalla. Un link sin persona de un formulario sin segmentación sigue sin horarios hasta que se le elija una.
- **Consecuencias:** con estos formularios marcados así, el Grupo 3 se puede borrar sin dejar links sin destino, si sus eventos tienen persona.

## ADR-W061: La comisión de una plataforma se calcula con las comisiones reales, y Cobrado y ROAS de Marketing y Workshop van en neto

- **Fecha:** 2026-11-02 · **Subsistema:** Finanzas / Marketing / Workshop · **Estado:** implementada en local, sin desplegar. Leadership: «Definir la comisión promedio por plataforma para ventas sin comisión conocida» y «Reporte de ventas en neto: comisión real o promedio de la plataforma».
- **Contexto:** `COMISION_PASARELA` fijaba 4,4 % y 8,2 % a mano. El cash neto de Finanzas ya usaba la comisión real de los pagos verificados, pero «Cobrado», New Cash, Cash total y los ROAS de Marketing y Workshop salían en bruto, lo que inflaba el retorno entre 5 y 7 % frente a lo que entra a caja.
- **Decisión:** (1) la comisión de un pago es la suya si está verificada (`transaction_amount`) y, si no, el promedio ponderado de su plataforma (comisión total ÷ bruto total) calculado con los pagos verificados (mínimo 10, comisión de 0 a 30 %), luego los CSV de conciliación y, de último recurso, el valor fijo anterior. Hoy: Stripe 4,30 % y Hotmart 9,04 %. Un solo lugar: `comision_plataforma_service`. (2) Cobrado, New Cash, Cash total y los ROAS de Marketing, y el cash de cada taller (con sus primeras cuotas), usan `commission_service.cash_neto`. (3) Las listas de New Cash y Cash total muestran Neto y, ocultas, Bruto y Comisión usada. (4) Diferencias estima la comisión con el promedio. (5) El valor fijo de respaldo de Hotmart sube de 8,2 % a 8,8 % (Kerwin, 02/11/2026).
- **Qué se pierde:** el ticket de Workshop y el «ingreso por venta» de Marketing pasan a ser netos y dejan de ser el precio, mientras que el ticket de Closing sigue en bruto. Las ventas sin comisión conocida (578 anteriores a 2026, más transferencias) siguen sin descuento. El promedio de Hotmart depende de 40 pagos y de tres cobros de ~22 %. Los talleres guardados siguen en bruto hasta el resync.
- **Consecuencias:** el Cobrado y el ROAS bajan de 5 a 7 %, y el comercial en bruto no cuadra con Marketing por construcción. A futuro la comisión exacta saldrá del comprobante al reportar la venta; entonces el promedio solo cubrirá lo que no tenga comprobante.

## ADR-W062: Las Comparativas de closers cuentan al triage y no cuentan a Mario, Santiago ni a los Gabriel

- **Fecha:** 2026-11-02 · **Subsistema:** Dirección comercial · **Estado:** implementada en local, sin desplegar. Pedido de Kerwin tras la validación de datos (el ranking sumaba 211 agendas y la fila Equipo 247).
- **Contexto:** el ranking de Closers listaba a los usuarios con rol `closer` activos y la fila «Equipo» sumaba todas las agendas, incluidas las del triage (23), de Mario (6), de Gabriel Hernandez (5) y de Santiago. Las dos cifras no cerraban.
- **Decisión:** `ComercialService.miembros_comparativas` suma al ranking de Closers a las personas de triage activas y quita a quien está en `EXCLUIDOS_DE_COMPARATIVAS` (Mario Bühler y su cuenta vieja Mario Cierra, Gabriel Hernandez, Gabriel Cardozo y Santiago). La fila Equipo se calcula con `sin_excluidos=True`: todas las agendas y ventas menos las de esas personas. El triage se compara con los closers porque hace una parte del embudo.
- **Qué se pierde:** las agendas y ventas de los excluidos siguen existiendo en Revisar y en los totales de Analizar, pero no en Comparativas. La lista de excluidos es por nombre, no por permiso: una persona nueva con ese nombre queda fuera.
- **Consecuencias:** la fila Equipo cierra con el ranking. En el ranking el triage aparece como una fila más; tocarla no abre su tablero personal.

## ADR-W063: Lo ya cargado se queda también en el triage viejo, Inbox, Estadísticas, Postulaciones, Workshop y el dashboard de admin (continúa ADR-W053 y ADR-W055)

- **Fecha:** 2026-11-02 · **Subsistema:** Frontend · **Estado:** implementada en local, sin desplegar. Pedido de Kerwin: «en todas las vistas».
- **Contexto:** W053 y W055 cubrieron Dirección comercial, el mazo, el espacio del setter, el operador y contratación. Quedaban la página vieja de confirmaciones del triage, Inbox, las estadísticas de closers y setters, Postulaciones, partes de Workshop y los números del dashboard de admin.
- **Decisión:** los mismos mecanismos. (1) Listas de trabajo (confirmaciones del día por fecha, Flujos, Campañas, Conversaciones/Embudo, chat abierto, etiquetas, mis tareas): se muestra lo último visto sin esqueleto y se pide siempre por detrás (`inbox/recuerdo.js` sobre `cacheDeVistas`). (2) Tableros (estadísticas por filtros, dashboard de performance del closer, tarjetas del dashboard de admin, Correlaciones, Agendas de Revisar y Landing de Workshop, Leads sin atribuir): vigencia de 5 minutos. (3) Paneles que cargan solos: `PanelesConservados` (pestañas de Postulaciones, sub-pestañas de Closers y Setters, secciones del hub de ventas). El interceptor de `api.js` acepta `conservarCache: true` por pedido, para que marcar un chat como leído no vacíe el recuerdo de todas las vistas.
- **Qué se pierde:** un panel conservado no se actualiza hasta recargar la página; Closers de Talent queda montada y escondida; las pestañas de Postulaciones pierden el fundido de entrada al volver.
- **Consecuencias:** quedan fuera Conversaciones y Agendas 2.0 (se refrescan por intervalo), los editores (flujo, mensajes, campaña), los formularios y modales, y las pantallas sueltas sin pestañas.
## ADR-W064: Cada pago es de su closer: el vendedor de una venta sigue al closer de la agenda y se corrige por pago

- **Fecha:** 2026-11-02 · **Subsistema:** Ficha / Ventas · **Estado:** implementada en local, sin desplegar. Pedido de Kerwin tras el reclamo de Jean Carlo por el pago de David Hernandez.
- **Contexto:** al registrar una venta o un pago desde el árbol de Resultado, «La comisión va a» (`vendedor_id`) viene puesto con el closer de la agenda y de ahí salen `email_vendedor`, la comisión, la nómina y el aviso de Wins. Ese valor se calculaba una sola vez al abrir la pestaña: si el lead se reasignaba desde la cabecera con la pestaña abierta, el pago salía a nombre del closer anterior. Además no había forma de corregir de quién es un pago ya cargado.
- **Decisión:** (1) el closer de la venta sigue al de la agenda mientras nadie elija a otro: si cambia con la pestaña abierta y el vendedor seguía siendo el anterior (o no había), pasa al nuevo. (2) Cada pago muestra su closer en el historial y se corrige con `corregir_pago` (`vendedor_id`, mismo permiso `cobrar`, queda en la bitácora). (3) Un lead puede tener pagos de distintos closers: reasignar un lead no mueve los pagos que ya tiene; los siguientes salen a nombre de quien lo tenga cuando se registran.
- **Qué se pierde:** si alguien elige a mano otro closer y después se reasigna el lead, se respeta su elección. El pago ya mal cargado no se corrige solo: se arregla con el editor.
- **Consecuencias:** el aviso de Wins y la nómina leen el vendedor corregido; el pago 57752 (David Hernandez) queda por corregir en producción con el editor nuevo o con una actualización autorizada.

## ADR-W065: El triage deja de medir confirmaciones y mide lo que pasa al closing, por closer

- **Fecha:** 2026-11-02 · **Subsistema:** Dirección comercial / Triage · **Estado:** implementada en local, sin desplegar. Pedido del director comercial.
- **Contexto:** el embudo del triage iba agendas → confirmadas → asistieron → calificados, y la asistencia salía de las confirmadas. La confirmación es un proceso del mazo y la ficha, no un resultado del triage. Y no había forma de ver qué pasaba con los leads que el triage calificaba y pasaba al closing: solo «ya asistieron con él».
- **Decisión:** (1) fuera `confirmadas` del embudo, las tarjetas, Por persona, Día por día y el JSON; la asistencia es asistieron ÷ agendas. (2) `triage_pases.pases_de` resuelve el pase de cada agenda de triage (agenda de closing con `agenda_triage_id`): asistió = `closer_result` Show up, cerró = venta de pago completo o split pay con la misma fila de `ComercialService.filas_de_citas` (`REAL_SALE_TIPOS`, la seña no es cierre). Si el closer reagendó el pase, se sigue la cadena (mismo cliente, `is_rescheduled`, id posterior, no del triage) hasta la agenda en pie. (3) El JSON suma `pasaron`, `closer_asistieron`, `closer_cerraron` en `total`, `por_persona` y `por_dia`; `por_closer` (un renglón por triage y closer) y `closing` en cada lead. % de asistencia = asistieron ÷ pasaron; % de conversión = cerraron ÷ asistieron. (4) El cuello de botella solo mira las etapas del triage.
- **Qué se pierde:** los pases manuales desde la ficha no llevan `agenda_triage_id` y no cuentan. `pasaron` incluye las llamadas que todavía no ocurrieron, así que el % de asistencia es bajo hasta que pasen. La cadena de reagendas se reconstruye por cliente (no hay enlace directo) y puede errar si el lead tiene varias reagendas cruzadas. Quien miraba la tarjeta de asistencia como «sin contar cancelaciones» ve otro número.
- **Consecuencias:** el embudo de Closing en dos colores (directas y desde triage) puede reusar `triage_pases.pases_de`. Los pases se cuentan por la fecha de la llamada de triage, no por la del closing.


## ADR-W067: El embudo de Closing se parte en agendas directas y agendas desde triage, con su close rate cada una

- **Fecha:** 2026-11-02 · **Subsistema:** Dirección comercial / Analizar › Closers · **Estado:** implementada en local, sin desplegar. Pedido del director comercial. 
- **Contexto:** el embudo de Closing (Agendas → Asistieron → Presentaciones → Ventas) mezclaba las llamadas que llegan directo al closer con las que pasó el triage (ADR-W065), y el close rate real era uno solo. No se podía saber si el triage entrega leads que cierran más o menos que los directos.
- **Decisión:** (1) cada fila de agenda lleva su `canal` (`triage_pases.origen_de`): `triage` si tiene `agenda_triage_id` o es una reagenda de un pase (la fila nueva de una reagenda no lleva el enlace; se camina hacia atrás por las reagendadas del mismo cliente, la inversa de `_en_pie`); `directa` todo lo demás. (2) Cada etapa del `funnel` suma `por_canal` `{directa, triage}`, que suman `n`, sobre las mismas filas ya filtradas por período, persona/closer y segmento. (3) El close rate real (`cierres_reales`) suma `por_canal`: la misma cuenta que el total (cierres cobrados completo + split, nunca la seña, ÷ asistieron + cierres de llamadas anteriores), con las llamadas y los cierres de cada canal; el canal de un cobro es el de la llamada de la que salió, y cada cobro de `filas` lo trae. Los cobros sin llamada no tienen canal y quedan fuera, como ya quedaban de la tasa. (4) Pantalla: barras en dos colores con leyenda, cada parte abre la lista de agendas (faceta nueva «Origen» en Agendas) y cada close rate abre sus cobros (modal del close rate real) y sus asistieron (Agendas).
- **Qué se pierde:** las agendas de las propias personas de triage cuentan como directas (no tienen pase); el pase manual desde la ficha no lleva `agenda_triage_id` y cuenta como directo; la cadena de reagendas se reconstruye por cliente y puede errar con reagendas cruzadas. La base de cada canal puede no sumar exacto la del total (`max(asistieron, del período) + anteriores` se calcula por canal). La lista de los asistieron no incluye las llamadas anteriores que suman a la base: se ven en el modal de cobros.
- **Consecuencias:** `Appointment` no cambia ni hay migración. `agendas()` y `filas_de_citas` pagan una consulta extra solo cuando hay reagendas sin enlace. Si el triage deja de pasar por `agenda_triage_id`, `origen_de` es el único lugar a tocar.

## ADR-W066: Reagendar, no asistir y cancelar piden un motivo escrito, y queda en el hilo del lead

- **Fecha:** 2026-11-02 · **Subsistema:** Ficha / Agendas · **Estado:** implementada en local, sin desplegar. Pedido del director comercial.
- **Contexto:** «Reagendado», «No Show» y «Cancelado» se marcaban sin explicar nada (el árbol de Resultado tenía un motivo de lista y un detalle opcional; el reporte del triage, una nota opcional; la corrección de estado del historial y del modal del dashboard comercial, ninguno). Kerwin no podía leer en la comunicación del lead qué había pasado.
- **Decisión:** (1) al marcar a mano uno de los tres estados el motivo es obligatorio: texto libre de 10 caracteres o más sin espacios sobrantes («¿Por qué se reagenda?», «¿Por qué no asistió?», «¿Por qué se canceló?»), con el botón de guardar apagado hasta que alcance. (2) El backend lo exige en cada puerta, antes de escribir nada (`motivo_estado_service`; `CloserService.process_agenda`, el árbol de la ficha, el reporte de triage, reprogramar, cancelar, la corrección de estado, el Tablero de Agendas, el write del mazo, el lote y el resultado previo del closer) y responde 400 con el mensaje. (3) Queda como una nota del hilo de la persona (`lead_event_logs`, `action_type='nota'`, `payload={'motivo_estado': clave}`) con quién la escribió y el estado; Cancelado y Reagendado conservan el texto que ya tenían sus notas («Cancelado por X: …», «Reagendado por X. Razón: …») y el No Show suma «No Show marcado por X. Motivo: …». El árbol del closer manda el motivo como `motivo_estado` y reemplaza el detalle opcional: no se duplica la nota. (4) Corregir el estado desde el historial o el modal del dashboard pide el motivo solo si el estado nuevo es uno de los tres y distinto del actual.
- **Qué se pierde:** el detalle opcional («Qué pasó exactamente») de No asistió y Canceló en el árbol deja de existir como campo aparte; el motivo de lista se conserva. Las cancelaciones y reagendas automáticas (Google Calendar, link del lead, duplicadas, «Nueva agenda» sobre una agenda existente) no piden motivo: usan su nota propia, que cumple el mínimo. El lote del closer y del setter rechaza estos estados (no hay un motivo por agenda). Los tests viejos que marcan estos estados sin motivo quedan por ajustar.
- **Consecuencias:** el hilo de Comunicación y la bitácora leen el motivo del `payload`; quien quiera analizar motivos filtra `payload.motivo_estado`. Código muerto que no pide motivo y sigue en el repo: el modal de motivo y las acciones rápidas de `CloserWorkflowPage` (nada los abre) y `PATCH /closer/appointments/<id>/outcome` (ninguna pantalla lo llama; el backend igual lo exige).

## ADR-W068: El Triage de Dirección usa los filtros del dashboard comercial y colorea el closer de cada pase

- **Fecha:** 2026-11-02 · **Subsistema:** Dirección comercial / Triage · **Estado:** implementada en local, sin desplegar. Pedido del director comercial tras probar ADR-W065 y ADR-W067.
- **Contexto:** Triage tenía sus propias pastillas (Hoy, 7 y 30 días; una persona) y ningún filtro de segmento, distinto de Closers y Setters. El embudo repetía «Pasaron» (que es igual a los calificados) y no decía de qué closer era cada asistencia o cierre. Seis tarjetas dejaban dos sueltas en una segunda fila.
- **Decisión:** (1) Triage reutiliza la barra de arriba del dashboard (período, equipo y segmentos): `rangoDePeriodo` lleva el id del período a `desde`/`hasta` y `miembros_por_rol.triage` trae las personas. (2) `GET /api/triage/metricas?segmento=` filtra las agendas con la lectura de segmento del dashboard (`segmentos_lectura.de_filas`). (3) Se quita «Pasaron» del embudo; «Asistieron» y «Cerraron» del closer se parten por closer con un color estable por id. (4) Tarjetas 4 + 2 (las del closer del doble de ancho). (5) El embudo de Closing con canales usa barras redondeadas sin cuello, como el de Triage.
- **Qué se pierde:** la elección de período propia de Triage (ahora el valor por defecto es «Este mes»). Si lo calificado y lo pasado a closing difieren (pases manuales), el embudo ya no lo muestra; sigue en «Por closer» y en la tarjeta de asistencia.
- **Consecuencias:** sin migración. El segmento de una llamada de triage es el de la persona o el cliente (igual que en Closers). El color de cada closer sale de su orden entre los closers del período.

## ADR-W069: Las preguntas originales del formulario de Hiring se pueden borrar y el WhatsApp pide el código de país

- **Fecha:** 2026-11-03 · **Subsistema:** Hiring (Talent › Forms) · **Estado:** implementado.
- **Contexto:** Mario quiere acortar el formulario de Asistente: mover preguntas con libertad y borrar las que no usa (la bienvenida, el país), no solo apagarlas. Sin la pregunta de país, el WhatsApp no tenía de dónde sacar el código.
- **Decisión:** `validar_preguntas` ya no exige las 35 originales; solo el nombre (presente, prendido y obligatoria). Para el score, una original borrada cuenta como apagada (`HiringForm._derivados`). El editor arrastra preguntas desde un asa (cambian al bloque donde caen), borra cualquier pregunta menos el nombre y las que tienen una condicional que depende de ellas, y lista al final las originales borradas para recuperarlas (`form_dict` manda `originales`). En institute-site, el WhatsApp tiene un selector de código (22 países y «Otro») que arranca en el país contestado o en el detectado por la zona horaria, y se guarda con el código (`+54 11…`). Sin país contestado, el backend lo deduce del código (`pais_de_whatsapp`).
- **Qué se pierde:** una original borrada pierde sus textos editados (vuelve con los de fábrica). La detección por zona horaria falla con VPN o navegador mal configurado; la postulante lo corrige en el selector. Un código fuera de la lista («Otro») deja el país vacío si no se pregunta.
- **Consecuencias:** los WhatsApp nuevos llegan con «+», que `whatsapp_completo` ya respetaba. Sin la pregunta de país, la lista de provincias usa el país del teléfono o el detectado.

## ADR-W070: Una pregunta original de Hiring puede cambiar de tipo y pasa a ser nueva

- **Fecha:** 2026-11-03 · **Subsistema:** Hiring (Talent › Forms) · **Estado:** implementado.
- **Contexto:** el tipo de las originales estaba bloqueado porque el panel y el score leen su respuesta por id, en columnas con largo fijo y comparando el texto de las opciones. Mario quiere pasar cualquiera a varias opciones, texto o párrafo.
- **Decisión:** el selector de tipo queda libre para todas menos el nombre. Al cambiarle el tipo a una original (`cambiarTipo` en lib/formularios.js) se convierte en nueva: id `<id>_xxxxxx`, `base: false`, respuestas en `respuestas_extra`; las condicionales que la nombraban pasan al id nuevo. Al cambiar de tipo se sacan las claves de otros tipos (`mail`, `unidad`, `largo`, `puntua`…).
- **Qué se pierde:** esa pregunta deja de sumar al score y de llenar su columna (la original cuenta como borrada). Volver al tipo anterior no la vuelve original: para eso se recupera la original desde el final de la lista.
- **Consecuencias:** sin migración ni cambios en el backend ni en el formulario público, que ya dibujan cualquier tipo.

## ADR-W071: El editor de preguntas de Hiring va en dos columnas: lista a la izquierda, configuración a la derecha

- **Fecha:** 2026-11-03 · **Subsistema:** Hiring (Talent › Forms) · **Estado:** implementado.
- **Contexto:** cada pregunta se abría en su lugar y ocupaba todo el ancho: con 35 preguntas no se veía el formulario entero mientras se editaba una. Además el editor seguía diciendo «Pregunta original», un concepto que ya no le sirve a quien edita.
- **Decisión:** `EditorPreguntas` muestra a la izquierda la lista compacta por bloque (arrastrar para ordenar, interruptor para prender o apagar, marcas de excluyente y condicional) y a la derecha un panel fijo (`PanelPregunta`) con la pregunta elegida: número, bloque, acciones (subir, bajar, duplicar, eliminar), Activa y Obligatoria, el tipo como fichas con ícono, texto, ayuda y opciones. Debajo de 1000 px va en una columna y al elegir baja al panel. Se sacan la nota «Pregunta original» y el chip «Nueva»; las borradas se recuperan en «Eliminadas». El botón de excluyente aparece también en las de varias opciones (el formulario público ya lo respetaba).
- **Qué se pierde:** abrir varias preguntas a la vez; ahora se edita una por vez.
- **Consecuencias:** estilos nuevos en `components/forms/editorPreguntas.css`; se borran las clases `tl-pq*` de talent.css.

## ADR-W072: Una pregunta numérica de Hiring puede descartar por rango (ko_min / ko_max)

- **Fecha:** 2026-11-03 · **Subsistema:** Hiring (Talent › Forms) · **Estado:** implementado.
- **Contexto:** Mario quiere que la expectativa salarial (u otro número) descarte a quien pide fuera del presupuesto, con el límite configurable desde el editor. Hasta ahora solo las opciones podían ser excluyentes; `min`/`max` solo validan (piden corregir el número).
- **Decisión:** claves `ko_min` y `ko_max` (enteros, opcionales) en las preguntas de tipo número. El editor las muestra como «Descarta si es menor a / mayor a». El formulario público, fuera del rango, va a la pantalla de descarte con la respuesta como `motivo_descarte`. El backend lo reconoce como corte del formulario (`HiringForm.rangos_excluyentes`, `AssistantApplication._fuera_de_rango` en `auto_ko` y `descarte_vigente`) y la cuenta de excluyentes lo incluye. `validar_preguntas` exige enteros sin signo y mínimo ≤ máximo.
- **Qué se pierde:** el rango no reemplaza al presupuesto de Configuración (`presupuesto_min`/`max`): son datos aparte y hay que cargar los dos si se quiere lo mismo.
- **Consecuencias:** cambiar el límite recalcula quién queda cortado (como sacarle la marca a una opción). Sin migración.

## ADR-W073: Tipos «Correo electrónico» y «Dinero» en el editor de Hiring, y el tipo como desplegable

- **Fecha:** 2026-11-03 · **Subsistema:** Hiring (Talent › Forms) · **Estado:** implementado.
- **Contexto:** Mario quiere reconocer de un vistazo las preguntas de correo y de plata; las fichas de tipo ocupaban mucho y se cortaban («Lista con b…»).
- **Decisión:** el editor ofrece `email` y `dinero` como tipos visibles, pero se guardan como `texto` + `mail: true` y `numero` + `dinero: true` (`tipoVisible`, `cambiarTipo` en lib/formularios.js); `ref: 'brl'` también se lee como dinero. Pasar de texto a correo o de número a dinero no cambia el tipo guardado, así que una original no pierde su columna. El tipo se elige con el `Select` estándar (con íconos); los interruptores pasan a `Switch` estándar y el panel usa `Aura`.
- **Qué se pierde:** nada en el formulario público ni en el backend, que siguen viendo texto y número.
- **Consecuencias:** sin migración. Un tipo nuevo que necesite otro dibujo en el formulario público sí tiene que sumarse en institute-site y en `TIPOS` del backend.
