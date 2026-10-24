# Learnito en Work

> Chat con IA (API de Claude) para closers y dirección. Dos caminos:
> - **La dirección** (admin, operaciones, director comercial) habla con el **cerebro de Learnito, que vive en la Academia** (su `docs/VISION/LEARNITO_COMO_SERVICIO.md`, etapa 3). La Academia guarda la conversación, decide cómo responder (reglas sin IA, Pregunta directa, Investigación, banco de planes) y le pide los datos a Work por su **conector** (§3b).
> - **Los closers** siguen con el copiloto de acá: Haiku con tres herramientas sobre su cartera (§3).
> *Estado:* closer desde el 19/10/2026; dirección con el cerebro de la Academia desde la etapa 3 (24/10/2026). Historia en [DECISIONS.md](../DECISIONS.md) (ADR-W001 a W008). Motor y diccionario: [TABLAS.md](TABLAS.md).

## Para alguien nuevo

> Learnito está en el menú de sesión (y fijado en el dock de los closers). Abre una ventana encima de cualquier pantalla; también vive en `/copiloto`. Escribís o dictás con el micrófono.
> **Un closer** pregunta por lo suyo: "mis agendas de hoy", "¿cuánto me debe Juan?", "¿quién me debe más?", o pide que le redacte un mensaje.
> **La dirección** (admin, operaciones, director comercial) pregunta números de Work o de la Academia ("ventas por mes de AL", "¿qué cuotas vencen con alumnos en Rescate?") o por un cliente. Learnito no cuenta: arma un plan y el sistema dueño del dato lo calcula. Las respuestas vienen con formato y a veces con botones para seguir ("Por closer", "Ver la lista"); la conversación se puede calificar.
> La conversación dura hasta recargar la página (la del closer, hasta 10 mensajes). Cada persona tiene un tope de uso por mes; la barra de abajo muestra cuánto va, en porcentaje.

## 1. Piezas

| Pieza | Archivo |
|---|---|
| Puerta única a Claude y registro de uso | `app/services/claude_service.py`, `app/models/ai_usage.py`, `app/api/ai_usage.py` |
| Endpoint del chat, sistema, ciclo de herramientas y tope | `app/api/copiloto.py` (`/api/copiloto/mensaje`, `/api/copiloto/uso`) |
| La dirección con el cerebro de la Academia | `app/api/copiloto.py` (`/api/copiloto/learnito`, `/learnito/calificar`) → `LearnationService.learnito` |
| El conector de Work para el cerebro | `app/services/learnito_conector.py`, en `POST /api/external/academy/learnito/connector` (`app/api/external/learnito.py`) |
| Permiso | `copiloto_required` en `app/decorators.py`: closer, admin, operator, director comercial |
| Herramientas del closer | `app/services/copiloto_herramientas.py` |
| Herramientas de la dirección | `app/services/copiloto_datos.py` |
| Habilidades (recetas con nombre) | `app/services/habilidades.py` |
| Motor de tablas (plan por claves) y diccionario de datos | `app/services/tablas/` ([TABLAS.md](TABLAS.md)): `diccionario.json`, `buscar.py` (`buscar_datos`) y el motor |
| Agentes pares | Work → Academia: `LearnationService.agent_ask` (`app/services/learnation_service.py`). Academia → Work: `app/api/external/agent.py` |
| Pantalla | `frontend/src/pages/copiloto/` (`LearnitoChat`, `LearnitoModal`, `UsoMensual`, `useCopiloto`, `useDictado`, `Markdown`) |
| Estado global y cómo abrirlo | `frontend/src/sesion/LearnitoContext.jsx`, `frontend/src/sesion/learnito.js` (roles, `abrirLearnito`) |
| Entrada en el menú y el dock | `frontend/src/sesion/menuSesion.js`, `frontend/src/sesion/fijadas.js` (fijado de fábrica a closers) |

## 2. Pantalla

- Modal global (`LearnitoProvider` en `App.jsx`): cerrar el modal o cambiar de sección no borra la conversación; recargar, sí. `/copiloto` muestra la misma conversación.
- Siempre con el tema Learnation Modern, en el modo claro u oscuro de cada uno (`.thalamus`, `data-tema="modern"`).
- Vacío: tres sugerencias por camino (las del closer; las de la dirección, de números).
- Closer: mensajes en **texto plano** (el sistema le prohíbe markdown al modelo). Dirección: el texto del cerebro viene en markdown y `Markdown.jsx` lo dibuja con elementos de React (títulos, viñetas, negritas, tablas, "> Ojo:"), sin HTML crudo. Cada respuesta se puede copiar.
- Dirección: los botones y opciones de la última respuesta van debajo (tocarlos manda `boton` al cerebro) y, desde la primera respuesta, la calificación de la conversación (insatisfactoria, regular, satisfactoria).
- **Dictado**: Web Speech API del navegador (Chrome y Edge; Safari a medias; Firefox no). El audio no pasa por Work. Enter envía, Shift+Enter salta de línea.
- **Uso**: barra con lo gastado hoy contra el tope del mes repartido en sus días (referencia, no corta) y la línea del mes. Solo porcentajes, nunca montos. Ámbar desde 80 %, roja en el tope. Con el cerebro llega solo la línea del mes (la cuenta la Academia).
- "Nueva conversación" en el encabezado del modal.

## 3. El ciclo (`app/api/copiloto.py`)

- La pantalla manda el historial entero en cada turno, **solo el texto**: los resultados de herramientas de turnos anteriores no se reenvían.
- Validación al entrar: hasta 10 mensajes (`MAX_MENSAJES`), alternando persona y Learnito, cada uno de hasta 4.000 caracteres.
- Modelo: siempre Haiku 5.5 (`MODELO_POR_DEFECTO`), esfuerzo `low`, 1.024 tokens de salida por llamada. Sin caché de prompt.
- Sistema: quién es Learnito, el tono (rioplatense, corto, sin markdown), "los datos salen solo de tus herramientas, nunca inventes" y la fecha de hoy en la zona del usuario. Con la dirección suma `DIRECCION` y `copiloto_datos.INSTRUCCIONES`.
- **Kit por rol** (`_kit`): closer → 3 herramientas y 4 vueltas; dirección → 4 herramientas y 6 vueltas; otro rol con permiso → sin herramientas (dice que no ve datos).
- Una vuelta: Claude pide una herramienta, Work la ejecuta con la sesión de quien pregunta y devuelve **texto corto** (no JSON), que es lo que más pesa en la llamada siguiente. Un error de herramienta vuelve como `is_error` y la charla sigue.
- Errores: sin clave → 503; Claude falla → 502/504; sin texto o rechazo → 502 "Learnito no pudo responder eso".

## 3b. La dirección con el cerebro de la Academia

- **La pregunta** (`POST /api/copiloto/learnito`): `{pregunta | boton: {mensaje, tipo: boton | opcion, indice}, conversacion_id?}`. Work la pasa a la Academia (`POST /api/v1/learnito/ask`, con `ACADEMY_API_TOKEN`) con `sistema: work` y `quien` = `{id, nombre, email, rol, zona}` de la sesión. Devuelve `{conversacion_id, mensaje_indice, mensaje, uso}`; un error de la Academia (tope, ocupado) vuelve con su mensaje y su estado. `GET /api/copiloto/uso` responde `{modo: "cerebro"}` y la pantalla cambia de camino.
- **La conversación** la guarda la Academia (`learnito_conversations`, con `system = work` y `asker`); Work solo recuerda su id hasta recargar. Sin tope de mensajes: la Academia resume las largas.
- **El gasto** lo lleva la Academia: un solo presupuesto, con tope de Work (US$ 20) y por persona (US$ 8). El `ai_usage` de Work no lo registra.
- **El conector** (`learnito_conector.py`): la Academia le pide a Work cada dato con `POST {op, args, quien}` y el token `ACADEMY_INBOUND_API_TOKEN`. Las operaciones son las del contrato (su API.md §2.15): perfil (la guía de Work, las fuentes principales, quién pregunta), herramientas, diccionario y motor (`find`, `normalize`, `rows`, `measure`…), clientes (`findPeople`, `dossier`) y equipo. Los datos se leen con los permisos de quien pregunta (montos, tablas de admin), como en Tablas.
  - **Herramientas**: las de la dirección (§4) más `buscar_cliente` y `expediente_cliente` (la ficha del lead desde su agenda más reciente, sin la cobranza si no ve montos; el completo, o un cliente sin agendas, suma la bitácora del lead con lo de la Academia).
  - **Todavía no**: acciones (`actionLabel` null: el cerebro no arma tareas por reglas), gráficos (`card` null) y material.

## 4. Herramientas

### Closer (`copiloto_herramientas.py`)

Siempre sobre el closer logueado, con los mismos servicios que sus pantallas:

- `mis_agendas(fecha)`: las agendas de un día en su hora, hasta 15 (`CloserAgendasService.get_ledger`).
- `deuda_de(nombre)`: saldo y próxima cuota de un cliente suyo, hasta 3 coincidencias (`CloserFollowUpService._cartera_items`).
- `los_que_mas_deben(cantidad)`: hasta 10, con el total.

### Dirección (`copiloto_datos.py`)

- `usar_habilidad(nombre, parametros)`: una pregunta frecuente ya resuelta (§5). Se prefiere antes que armar un plan.
- `buscar_datos(sistema, pregunta, palabras_clave, area)` (ADR-W008): el buscador del diccionario. Una llamada devuelve fuentes, conceptos, datos y trampas. El sistema le pide empezar por acá y usar los conceptos como condición (`{"concepto": clave}`). Para `academia` lo pide por `agent/ask`; la Academia todavía no lo expone y la herramienta le dice que use `fuentes_de_datos`.
- `fuentes_de_datos(sistema, fuente, buscar)`: las fuentes de `work` o `academia`, o los datos (claves), conceptos y trampas de una fuente, si `buscar_datos` no alcanzó. Hasta 40 fuentes y 60 datos.
- `calcular_tabla(sistema, plan)`: corre un plan por claves. En Work, `motor.run`; en la Academia, `agent_ask(plan=…)`. Devuelve total, grupos, avisos y hasta 15 filas.

**Regla que comparte con la Academia: el modelo nunca cuenta ni escribe SQL.** Arma un plan y el motor del sistema dueño del dato lo calcula.

## 5. Motor de tablas y habilidades

- **Plan por claves** (`tablas/plan.py`): el mismo formato que `TablePlan` de la Academia (fuente, condiciones con datos o conceptos, columnas, orden, agrupar, período, medir). Métricas en Work: `count`, `avg`, `sum`, `min`, `max`, `pct`.
- **Diccionario de datos** ([TABLAS.md](TABLAS.md) §3): significados, valores, trampas, 71 calculados `d.` y 216 conceptos. Si la pregunta no dice período, Learnito acota los hechos a los últimos 30 días por su fecha y lo dice.
- **Lo que nunca se ve** (`tablas/exclusion.py`): credenciales, chats, postulantes y `ai_usage`. Nómina, gastos y comisiones, solo admin. Montos, solo admin y director comercial. Solo lectura, con tiempo máximo por consulta.
- **Datos del sistema `s.`** (`tablas/sistema.py`): reglas de negocio calculadas en lote: `s.estado_pago` (`regla_estado`, la misma que usa la Academia), `s.deuda`, `s.proxima_cuota`, `s.dias_para_vencer`, `s.cuotas_vencidas`, `s.monto_vencido`, `s.estado_agenda`.
- **Habilidades** (`habilidades.py`): recetas escritas en código, con sus planes ya validados. Learnito elige cuál y con qué parámetros.
  - `cobranza_en_riesgo(dias)`: cuotas que vencen pronto cruzadas por `alumno_id` con el Pulso de la Academia.
  - `estado_de_pagos`, `ventas_por_periodo(periodo, dias, programa)`, `agendas_por_estado(dias)`.
  - Para sumar una: función `(user, **parametros) -> texto` y su entrada en `HABILIDADES`.

## 6. Agentes pares con la Academia

- **Work pregunta** (`LearnationService.agent_ask`): catálogo, plan, expediente de un alumno o una pregunta libre a su Learnito (con costo del lado de la Academia). Viaja `quien` = `{email, rol}` con el rol de Work tal cual. Hoy Learnito usa catálogo y plan; el expediente y la pregunta libre todavía no.
- **Work responde** (`POST /api/external/academy/agent/ask`, token `ACADEMY_INBOUND_API_TOKEN`): catálogo (con la forma del de la Academia, más `que_es`, `conceptos` y `trampas`), planes y `buscar_datos`. Una `pregunta` sola devuelve 422: Work todavía no tiene un Learnito que responda texto libre a otro sistema. La Academia ve como alguien sin rol: sin montos, nómina ni gastos.
- Un solo salto: quien responde no le pregunta a un tercero.
- Cruce de personas: cada fila lleva `persona` (people.uuid) y `alumno_id` (el id de la Academia).

## 7. Costo y tope

- Toda llamada pasa por `ClaudeService.create_message(feature, user_id, …)` y deja una fila en `ai_usage` (también las que fallan): usuario, función, modelo, tokens, costo en USD, request-id, duración. No guarda el texto.
- `GET /api/ai-usage/resumen` y `/llamadas`: solo admin y operator.
- **Tope por persona**: US$ 8 por mes (`TOPE_MENSUAL_USD`), sumando todo su uso de IA. Al llegar, 429 sin llamar.

## 8. Paridad con la Academia

Comparado con `LEARNITO_EQUIPO.md` de la Academia al 23/10/2026. "Igual" = mismo contrato; "distinto" = decisión propia de Work; "falta" = no existe en Work todavía.

| Tema | Academia (`StaffAssistant`) | Work | Estado |
|---|---|---|---|
| Quién lo usa | Todo el staff | Closer, admin, operator, director comercial | Distinto |
| Dónde vive | Pantalla Herramientas › Learnito y botón desde la bitácora del alumno | Modal global desde el menú y el dock, y `/copiloto` | Distinto |
| Formato del plan | `TablePlan` | `tablas/plan.py`, el mismo | Igual |
| Nombres de herramientas de datos | `buscar_datos`, `fuentes_de_datos`, `calcular_tabla` | Los mismos | Igual |
| Diccionario de datos | `table_dictionary.json`: significados, calculados `d.`, conceptos, capas | `diccionario.json`, el mismo formato | Igual |
| Conceptos en el plan | `{"concepto": clave}` | El mismo | Igual |
| "El modelo nunca cuenta" | Sí | Sí | Igual |
| Agentes pares (`agent/ask`) | Responde catálogo, plan, expediente y pregunta con IA | Responde catálogo, plan y `buscar_datos` | Falta en Work: expediente y pregunta. Falta en la Academia: `buscar_datos` |
| Conversaciones guardadas | `learnito_conversations`, privadas, con lista | Dirección: en la Academia, sin lista en Work. Closer: en el navegador | Dirección igual |
| Largo de la conversación | Sin tope; resume los turnos viejos después de 8 | Dirección: igual. Closer: hasta 10 mensajes | Dirección igual |
| Modos | Repartidor automático: Pregunta (con Pregunta directa, ADR-175), Investigación, Acción | Dirección: los mismos (es el mismo cerebro). Closer: ciclo de herramientas | Dirección igual |
| Potencias | Haiku, Sonnet y Opus con perfiles de gasto | Dirección: las del cerebro. Closer: Haiku 5.5, esfuerzo bajo | Dirección igual |
| Caché de prompt | Sistema, herramientas y expediente | Dirección: la del cerebro. Closer: no | Dirección igual |
| Preguntas frecuentes | Banco que llena el equipo ("Estuvo bien: guardar"), responde sin IA | Habilidades escritas en código | Distinto |
| Acciones con confirmación | Observación, seguimiento, tarea, agendar, victoria | Ninguna (solo lectura) | Falta |
| Datos de un alumno | Expediente y ficha corta, `buscar_bitacora` | El closer no ve el avance del alumno | Falta |
| Contexto del equipo | Recurso `learnito-contexto` de Resources | Sistema fijo en el código | Falta |
| Quién pregunta, en el sistema | Nombre, email y rol ("mis alumnos") | Solo decide el kit; el closer queda acotado por sesión | Distinto |
| Presupuesto | Del equipo (US$ 60), ahorro al 80 %, el admin suma US$ 20 | Dirección: el de la Academia, con tope de Work (US$ 20) y por persona (US$ 8). Closer: por persona (US$ 8) en `ai_usage` | Dirección igual |
| Formato de respuesta | Markdown, tarjeta por categoría, gráficos adjuntos | Dirección: markdown y botones, sin tarjeta ni gráficos. Closer: texto plano | Falta: gráficos |
| Voz | Dictado y lectura en voz alta | Dictado | Falta: lectura |
| Calificar respuestas | Calificación de la conversación | Dirección: la misma. Closer: no | Dirección igual |
| Métricas del motor | Más: mediana, correlación, comparar grupos, porcentaje con intervalo | `count`, `avg`, `sum`, `min`, `max`, `pct` | Falta |
| Material académico | `buscar_material`, `leer_recurso` | No (no le toca a Work) | Distinto |

### Reglas de coherencia

1. Lo que cruza sistemas usa **el mismo contrato**: formato de plan, paquete de `agent/ask`, nombres de herramientas de datos. Un cambio de contrato se hace en los dos lados.
2. Una herramienta que existe en los dos Learnito se llama igual y recibe los mismos parámetros.
3. Lo que es de un solo sistema lo responde ese sistema (agentes pares): Work no copia datos de la Academia para contestar, los pide.
4. Donde Work decide distinto (tope por persona, texto plano, habilidades en código), queda en la columna "Distinto" con su porqué en `DECISIONS.md`.

## 9. Pendientes

Sin orden comprometido; la prioridad la decide el usuario.

- Pasar a los closers al cerebro (decisión 5 de la Visión de la Academia): sus tres herramientas como herramientas del conector, acotadas a su cartera.
- Con la dirección validada en el cerebro: borrar su camino local (el kit de la dirección en `copiloto.py`, `DIRECCION` e `INSTRUCCIONES`), que queda sin uso.
- Gráficos (`card` del conector) y acciones con confirmación por el conector (`proposeAction` y `executeAction`).
- Datos del alumno para el closer: usar `agent_ask(expediente=…)`, que la Academia ya responde (su ADR-168).
- Responder `pregunta` en `agent/ask` (hoy 422).
- Conversaciones guardadas y sin tope de 10 mensajes (resumen de turnos viejos, como la Academia).
- Caché de prompt en sistema y herramientas.
- Acciones con confirmación (registrar un pago por voz, delegar una tarea a Dari): siempre por el mismo camino que la ficha y con confirmación del closer.
- Investigación (plan de varios pasos) y repartidor de modos.
- El closer en el motor de tablas cuando el motor filtre su cartera (`tablas_required` todavía no lo deja).
- Learnito de Cortex («Buscador con IA» sobre las transcripciones del Playbook): sigue «Pronto»; es otra pieza.
