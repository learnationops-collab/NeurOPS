# Learnito en Work

> El chat con IA de todo el equipo de Work. Las respuestas las da el **cerebro de Learnito, que vive en la Academia** (su `docs/VISION/LEARNITO_COMO_SERVICIO.md`): el mismo que usan el equipo de la Academia y Leadership. La Academia guarda la conversación, decide cómo responder (reglas sin IA, Pregunta directa, Investigación, banco de planes) y le pide los datos y las acciones a Work por su **conector** (§3).
> *Estado:* closers con un copiloto propio desde el 19/10/2026; dirección con el cerebro desde el 24/10 (etapa 3); todo el equipo con el cerebro, con alcance por rol, acciones y gráficos desde el 24/10 (ADR-W009). Motor y diccionario: [TABLAS.md](TABLAS.md).

## Para alguien nuevo

> Learnito está en el menú de sesión (y fijado en el dock de los closers). Abre una ventana encima de cualquier pantalla; también vive en `/copiloto`. Escribís o dictás con el micrófono.
> **La dirección** (admin, operaciones, director comercial) ve todo: números de Work o de la Academia ("ventas por mes de AL", "¿qué cuotas vencen con alumnos en Rescate?") y cualquier cliente.
> **El resto del equipo** (closers, setters, triage, marketing, hiring) ve **lo suyo y el ranking**: sus agendas, sus clientes y quién le debe, y los números de todo el equipo (show up por closer, ventas por programa), sin nombres de clientes ajenos ni datos de la Academia.
> Learnito no cuenta: arma un plan y el motor lo calcula. Un cálculo que agrupa o mide viene con su gráfico. Las respuestas traen a veces botones para seguir ("Por closer", "Ver la lista").
> Learnito puede dejar un **comentario en la ficha de un cliente** o **avisarle algo a alguien del equipo**: aparece una tarjeta, se puede editar el texto y no se hace nada hasta tocar **Confirmar**.
> La conversación se califica y dura hasta recargar la página. Cada conversación tiene un tope (5 centavos): la barra de abajo muestra cuánto va y, al llenarse, no se sigue escribiendo. Para empezar otra hay que calificar las anteriores, que aparecen ahí mismo. Cada persona tiene además un tope por mes, en porcentaje.

## 1. Piezas

| Pieza | Archivo |
|---|---|
| El chat (pregunta, confirmar, calificar) | `app/api/copiloto.py` (`/api/copiloto/learnito`, `/learnito/confirmar`, `/learnito/calificar`) → `LearnationService.learnito` |
| El conector de Work para el cerebro | `app/services/learnito_conector.py`, en `POST /api/external/academy/learnito/connector` (`app/api/external/learnito.py`) |
| Lo suyo y el ranking | `app/services/tablas/alcance.py` (lo aplica `motor.run`) |
| Permiso | `copiloto_required` en `app/decorators.py`: todos los roles menos fulfillment |
| Herramientas del closer | `app/services/copiloto_herramientas.py` |
| Herramientas de datos | `app/services/copiloto_datos.py` |
| Habilidades (recetas con nombre) | `app/services/habilidades.py` |
| Motor de tablas (plan por claves) y diccionario de datos | `app/services/tablas/` ([TABLAS.md](TABLAS.md)) |
| Agentes pares | Work → Academia: `LearnationService.agent_ask`. Academia → Work: `app/api/external/agent.py` |
| Pantalla | `frontend/src/pages/copiloto/` (`LearnitoChat`, `Grafico`, `LearnitoModal`, `UsoMensual`, `useCopiloto`, `useDictado`, `Markdown`) |
| Estado global y cómo abrirlo | `frontend/src/sesion/LearnitoContext.jsx`, `frontend/src/sesion/learnito.js` (roles, `abrirLearnito`) |
| Entrada en el menú y el dock | `frontend/src/sesion/menuSesion.js`, `frontend/src/sesion/fijadas.js` (fijado de fábrica a closers) |

## 2. Pantalla

- Modal global (`LearnitoProvider` en `App.jsx`): cerrar el modal o cambiar de sección no borra la conversación; recargar, sí. `/copiloto` muestra la misma conversación.
- Siempre con el tema Learnation Modern, en el modo claro u oscuro de cada uno (`.thalamus`, `data-tema="modern"`).
- Vacío: tres sugerencias (mis agendas de hoy, quién me debe más, show up por closer).
- El texto del cerebro viene en markdown y `Markdown.jsx` lo dibuja con elementos de React (títulos, viñetas, negritas, tablas, "> Ojo:"), sin HTML crudo. Cada respuesta se puede copiar.
- **Gráficos** (`Grafico.jsx`): la respuesta trae `adjuntos` ({A: {tipo: grafico, titulo, w, data}}) y el texto los ubica con su marcador (`[[A]]`); los que el texto no ubicó van al final. Se dibujan con CSS y los tokens del tema: un número, un anillo (porcentaje), barras (por valor, con el intervalo en el tooltip) o columnas (por período).
- **Acción** (`Accion` en `LearnitoChat.jsx`): la tarjeta de la acción propuesta, con el texto editable, Confirmar y Descartar. Después queda su resultado ("Comentario guardado en la ficha de…").
- Los botones y opciones de la última respuesta van debajo (tocarlos manda `boton` al cerebro) y, desde la primera respuesta, la calificación de la conversación (insatisfactoria, regular, satisfactoria).
- **Dictado**: Web Speech API del navegador (Chrome y Edge; Safari a medias; Firefox no). El audio no pasa por Work. Enter envía, Shift+Enter salta de línea.
- **Uso** (`UsoMensual`): la barra de la conversación contra su tope (`uso.conversacion`) y la línea del mes, en porcentaje (nunca montos). Ámbar desde 80 %, roja en el tope. Con la conversación agotada, el cuadro y los botones quedan trabados.
- **Pendientes**: sin conversación abierta (al abrir o con "Nueva conversación"), `GET /api/copiloto/learnito/pendientes` trae las anteriores sin calificar; hasta calificarlas (tres botones por conversación) el cuadro queda trabado.
- "Nueva conversación" en el encabezado del modal.

## 3. Cómo viaja una pregunta

- **La pregunta** (`POST /api/copiloto/learnito`): `{pregunta | boton: {mensaje, tipo: boton | opcion, indice}, conversacion_id?}`. Work la pasa a la Academia (`POST /api/v1/learnito/ask`, con `ACADEMY_API_TOKEN`) con `sistema: work` y `quien` = `{id, nombre, email, rol, zona}` de la sesión. Devuelve `{conversacion_id, mensaje_indice, mensaje, uso}`; un error de la Academia (tope, ocupado) vuelve con su mensaje y su estado.
- **Confirmar** (`POST /api/copiloto/learnito/confirmar`): `{conversacion_id, mensaje, texto? | descartar?}` → `POST /api/v1/learnito/confirm`. La Academia le pide a Work `executeAction`; si Work la rechaza, el motivo vuelve como `error`.
- **Ejemplos** (`examples`, su ADR-192): `EJEMPLOS` en el conector son las frases con que el cerebro habla de Work: la presentación, los ejemplos del repartidor (clientes, agendas, show up, señas, closers) y los del planificador (conceptos y glosario de show up y cierre). Las reglas siguen en la Academia; una clave que falta va neutra.
- **Reglas de la Academia** (su ADR-191): una conversación que llegó a su tope responde `conversacion_agotada`; una pregunta sin `conversacion_id` con conversaciones sin calificar responde `calificar_pendientes` con `pendientes`. Work pasa los dos tal cual y la pantalla traba el cuadro.
- **La conversación** la guarda la Academia (`learnito_conversations`, con `system = work` y `asker`); Work solo recuerda su id hasta recargar. Sin tope de mensajes: la Academia resume las largas.
- **El gasto** lo lleva la Academia: un solo presupuesto, con tope de Work (US$ 20 por mes) y por persona (US$ 8). El `ai_usage` de Work no lo registra.

### El conector (`learnito_conector.py`)

La Academia le pide a Work cada dato con `POST {op, args, quien}` y el token `ACADEMY_INBOUND_API_TOKEN`. Las operaciones son las del contrato (API.md §2.15 de la Academia): perfil, herramientas, diccionario y motor (`find`, `normalize`, `rows`, `measure`, `card`…), clientes (`findPeople`, `person`, `dossier`), equipo y acciones. Quien pregunta es el usuario de Work de `quien.id`.

- **Perfil**: la guía de Work (igual para todos), las fuentes principales y la nota de quién pregunta, con lo que ve según su rol.
- **Herramientas**: las de datos (§4), las del closer (§4), `buscar_cliente`, `expediente_cliente` y `proponer_accion`.
- **Alcance** (`tablas/alcance.py`, también en [TABLAS.md](TABLAS.md) §1b): la dirección ve todo. El resto:
  - Filas y su total: solo las suyas (donde figura como closer, setter, autor o con el email del closer, o de una persona con la que tuvo una agenda).
  - Mediciones: de todo el equipo, salvo que agrupen por un dato personal (email, nombre, id de un cliente): esas, sobre sus filas. El paquete trae `alcance` y Learnito lo lee.
  - Clientes (`buscar_cliente`, `findPeople`, `person`, `peopleNamed`) y expedientes: solo los suyos (con los que tuvo una agenda).
  - Datos de la Academia (`sistema: academia`): solo la dirección.
  - Montos: como siempre, solo admin y director comercial (`exclusion.py`). Las herramientas del closer muestran la deuda de sus clientes, como su cartera.
- **Acciones** (`proposeAction`, `executeAction`, `actionLabel`): `comentario` (una fila en `client_comments`, como el comentario de la ficha del lead) y `aviso` (una fila en `notifications` para una persona, con el cliente asociado si lo hay). La propuesta no escribe nada; la hace quien la propuso, sobre un cliente que puede ver, al confirmar.
- **Gráfico** (`card`): de un plan que agrupa o mide, `{title, w: {tipo, pct}, data, error}`. Respeta el alcance.
- **Material**: Work no tiene (`findMaterial` vacío).

## 4. Herramientas

### Del closer (`copiloto_herramientas.py`)

Sobre quien pregunta, con los mismos servicios que sus pantallas. Están para todos; a quien no es closer le responden vacío.

- `mis_agendas(fecha)`: las agendas de un día en su hora, hasta 15 (`CloserAgendasService.get_ledger`).
- `deuda_de(nombre)`: saldo y próxima cuota de un cliente suyo, hasta 3 coincidencias (`CloserFollowUpService._cartera_items`).
- `los_que_mas_deben(cantidad)`: hasta 10, con el total.

### De datos (`copiloto_datos.py`)

- `usar_habilidad(nombre, parametros)`: una pregunta frecuente ya resuelta (§5). Se prefiere antes que armar un plan.
- `buscar_datos(sistema, pregunta, palabras_clave, area)` (ADR-W008): el buscador del diccionario. Una llamada devuelve fuentes, conceptos, datos y trampas.
- `fuentes_de_datos(sistema, fuente, buscar)`: las fuentes de `work` o `academia`, o los datos (claves), conceptos y trampas de una fuente, si `buscar_datos` no alcanzó.
- `calcular_tabla(sistema, plan)`: corre un plan por claves. En Work, `motor.run` (con el alcance de quien pregunta); en la Academia, `agent_ask(plan=…)`. Devuelve total, grupos, avisos, el alcance y hasta 15 filas.

**Regla que comparte con la Academia: el modelo nunca cuenta ni escribe SQL.** Arma un plan y el motor del sistema dueño del dato lo calcula.

## 5. Motor de tablas y habilidades

- **Plan por claves** (`tablas/plan.py`): el mismo formato que `TablePlan` de la Academia. Métricas en Work: `count`, `avg`, `sum`, `min`, `max`, `pct` (con intervalo de Wilson por grupo).
- **Diccionario de datos** ([TABLAS.md](TABLAS.md) §3): significados, valores, trampas, calculados `d.` y conceptos. Si la pregunta no dice período, Learnito acota los hechos a los últimos 30 días por su fecha y lo dice.
- **Lo que nunca se ve** (`tablas/exclusion.py`): credenciales, chats, postulantes y `ai_usage`. Nómina, gastos y comisiones, solo admin. Montos, solo admin y director comercial. Solo lectura, con tiempo máximo por consulta.
- **Datos del sistema `s.`** (`tablas/sistema.py`): `s.estado_pago`, `s.deuda`, `s.proxima_cuota`, `s.dias_para_vencer`, `s.cuotas_vencidas`, `s.monto_vencido`, `s.estado_agenda` y `s.asistio` (el show up rate es `pct` de `si`). Un concepto con `actual: true` es un estado de ahora en una fuente de hechos: el cerebro no lo acota a un período por defecto ni a "hoy".
- **Habilidades** (`habilidades.py`): `cobranza_en_riesgo(dias)`, `estado_de_pagos`, `ventas_por_periodo(periodo, dias, programa)`, `agendas_por_estado(dias)`. Corren por el motor, así que respetan el alcance.

## 6. Agentes pares con la Academia

- **Work pregunta** (`LearnationService.agent_ask`): catálogo y plan (la dirección; el resto no ve datos de la Academia).
- **Work responde** (`POST /api/external/academy/agent/ask`, token `ACADEMY_INBOUND_API_TOKEN`): catálogo, planes y `buscar_datos`, como sistema de confianza (`alcance_completo`): todas las filas, sin montos, nómina ni gastos. Una `pregunta` sola devuelve 422.
- Un solo salto: quien responde no le pregunta a un tercero.
- Cruce de personas: cada fila lleva `persona` (people.uuid) y `alumno_id` (el id de la Academia).

## 7. Paridad con la Academia

| Tema | Academia (`StaffAssistant`) | Work | Estado |
|---|---|---|---|
| Quién lo usa | Todo el staff | Todo el equipo menos fulfillment | Igual |
| Cerebro | `StaffAssistant` | El mismo, por el conector | Igual |
| Formato del plan, herramientas de datos, diccionario, conceptos | `TablePlan`, `table_dictionary.json` | Los mismos | Igual |
| Qué ve cada uno | Todo el staff ve todo, con permisos por pantalla | Dirección todo; el resto, lo suyo y el ranking (`alcance.py`) | Distinto |
| Acciones con confirmación | Observación, seguimiento, tarea, agendar, victoria | Comentario en un cliente, aviso a alguien | Distinto |
| Gráficos adjuntos | Tarjeta del Board | `card` del conector, dibujado con CSS | Igual |
| Preguntas frecuentes | Banco que llena el equipo | Banco del cerebro y habilidades en código | Distinto |
| Datos de un alumno | Expediente y ficha corta | Solo la dirección (agentes pares) | Distinto |
| Voz | Dictado y lectura en voz alta | Dictado | Falta: lectura |
| Métricas del motor | Más: mediana, correlación, comparar grupos | `count`, `avg`, `sum`, `min`, `max`, `pct` | Falta |
| Material académico | `buscar_material`, `leer_recurso` | No (no le toca a Work) | Distinto |

### Reglas de coherencia

1. Lo que cruza sistemas usa **el mismo contrato**: formato de plan, paquete de `agent/ask`, operaciones del conector. Un cambio de contrato se hace en los dos lados.
2. Una herramienta que existe en los dos Learnito se llama igual y recibe los mismos parámetros.
3. Lo que es de un solo sistema lo responde ese sistema: Work no copia datos de la Academia para contestar, los pide.
4. Donde Work decide distinto, queda en la columna "Distinto" con su porqué en `DECISIONS.md`.

## 8. Pendientes

Sin orden comprometido; la prioridad la decide el usuario.

- Datos del alumno para el closer: hoy solo la dirección ve la Academia. Se podría abrir el expediente de los alumnos que son clientes suyos (`agent_ask(expediente=…)`).
- Responder `pregunta` en `agent/ask` (hoy 422).
- Más acciones (registrar un pago, delegar una tarea), siempre por el mismo camino que la ficha y con confirmación.
- El closer en `/tablas` ahora que el motor filtra lo suyo (`tablas_required` todavía no lo deja).
- Learnito de Cortex («Buscador con IA» sobre las transcripciones del Playbook): sigue «Pronto»; es otra pieza.
