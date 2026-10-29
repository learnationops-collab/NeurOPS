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

## ADR-W016: Los rituales de cada workshop viven en Leadership y siguen la fecha y hora del taller
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
