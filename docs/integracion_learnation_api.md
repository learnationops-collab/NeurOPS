# Integración NeurOPS ↔ Academia (Learnation)

> **Estado**: Fase 1 en implementación (ver [§5](#5-fase-1-vinculación-de-productos-auto-login-y-vencimiento-automático)) — arranca 2026-09-04.
> **Origen**: especificación entregada por el desarrollador de la plataforma de estudiantes (`academy.thelearnation.com`), compartida por Kerwin Quintero el 4 de septiembre de 2026 y ampliada el mismo día con la doc pública (`academy.thelearnation.com/api/docs`).
> **Objetivo de negocio**: que un closer, sin salir de NeurOPS, pueda darle de alta a un cliente recién cerrado en la Academia (crear su usuario si no existe, asignarle el producto/programa que compró y fijar su vencimiento) sin tener que entrar manualmente a la otra plataforma — y que, en la otra dirección, la Academia pueda consultar desde NeurOPS los pagos y las respuestas de formulario de un alumno.

Este documento tiene cinco partes:
1. La especificación técnica de la API externa de la Academia (referencia, consumida por NeurOPS).
2. El plan original de integración "closer → Academia" (alta simple, ver [§3](#3-plan-de-integración-dentro-de-neurops-alta-simple)).
3. El diseño de la API pública de NeurOPS que la Academia consumirá para leer pagos y respuestas de formulario ([§4](#4-api-pública-de-neurops-para-academia-pagos-y-formulario)).
4. El diseño de la Fase 1 real a implementar: vinculación de productos, auto-login en la venta y vencimiento automático por tipo de pago/cuotas ([§5](#5-fase-1-vinculación-de-productos-auto-login-y-vencimiento-automático)).
5. Lo que le falta a la API de la Academia para la pestaña Fulfillment y los filtros del dashboard, listo para reenviarle al desarrollador ([§6](#6-pedidos-a-la-academia)).

---

## 1. Contexto: dos plataformas separadas

- **NeurOPS** (este repo, `work.thelearnation.com`): herramienta interna para el equipo — closers, setters, triage, marketing, finanzas. Ver [docs/arquitectura_y_funcionamiento.md](arquitectura_y_funcionamiento.md).
- **Academia** (`academy.thelearnation.com`, repo aparte, mantenido por otro desarrollador): plataforma donde los **estudiantes** cursan, entregan ejercicios, ven simuladores, etc.

Hoy no hay ningún puente entre las dos. Cuando un closer cierra una venta, el alta del alumno en la Academia se hace por fuera de NeurOPS (manual, o por otro medio). La API que documentamos acá es el puente: permite que un sistema externo con un token válido cree/actualice usuarios en la Academia y les asigne productos, usando **el email como clave de cruce** entre ambos sistemas.

---

## 2. Especificación de la API externa (Learnation V1)

- **Base URL producción**: `https://academy.thelearnation.com/api/v1`
- **Documentación oficial**: `https://academy.thelearnation.com/api/docs`
- **Autenticación**: header `Authorization: Bearer <TU_API_TOKEN>` en todas las peticiones, más `Content-Type: application/json` y `Accept: application/json`.
- **Scope del token**: el token debe generarse con `service: ventas` o `service: all` — un token con otro scope devuelve `401`.
- **Rate limit**: 60 peticiones/minuto por token/IP. Si se excede, `429 Too Many Requests` con header `Retry-After` — `LearnationService` debe respetarlo (no reintentar en loop ciego).
- **Protección de cuentas de staff**: la API devuelve `403` ante cualquier intento de crear/modificar/asignar producto a una cuenta con rol de staff (`admin`, `operator`, `consultor`, `ces`, `engagement`, `rendimiento`) — no es un caso de error a "arreglar", es un guardrail intencional de la Academia.
- **Gestión de tokens**: se generan y revocan del lado de la Academia, en su Dock de Operador (`/operator/apis`). NeurOPS no los genera — solo los **consume**. Si el token se revoca allá, toda petición desde acá empieza a devolver `401` inmediatamente.

### 2.1 `GET /products` — Catálogo de productos
Lista los productos/programas disponibles para asignar. Cada producto trae `id`, `slug`, `name`, `description`, `is_default_on_registration` y, si aplica, el `program` asociado (con `duration_days`, usado como base del cálculo automático de vencimiento en modalidad `total`).

**Comprobado contra la API real (30/09/2026)** — el catálogo tiene 4 productos:

| `slug` | `name` | `is_default_on_registration` | `program.name` |
|---|---|---|---|
| `ace-learners` | Ace Learners | `false` | Bootcamp |
| `residency-roadmap` | Residency Roadmap | `false` | Bootcamp |
| `residency-roadmap-for-steps` | Specialist Iniciative | `false` | Bootcamp |
| `learnation-course` | Learnation Course | **`true`** | Learnation Course |

Dos cosas que importan para leer los productos de un alumno: `learnation-course` se le asigna **a todo alumno nuevo** al registrarse (no es algo que haya comprado), y los tres productos pagos comparten el mismo `program` interno ("Bootcamp"), así que `program_name` no sirve para distinguirlos. `program.duration_days` viene en `null` en los cuatro (la modalidad `total` no tendría de dónde calcular; NeurOPS igual manda siempre `expires_at`). El vínculo con los programas de NeurOPS es el mapeo de §5.1: `AL → ace-learners`, `RR → residency-roadmap`, `SI → residency-roadmap-for-steps`.

### 2.2 `GET /users/check?email=...` — Verificar si un usuario existe
Devuelve `exists: true/false` y, si existe, los datos básicos del usuario (`id`, `name`, `email`, `phone`, `role`, `created_at`).

### 2.3 `POST /users/upsert` — Crear o actualizar usuario
Body: `email` (obligatorio), `name` (obligatorio), `phone` (opcional).
- Si el email no existía: crea el usuario con contraseña `null` (`201 Created`, `action: "created"`). La Academia le manda un link de activación de contraseña la primera vez que intenta entrar (auto-activación por email, sin que NeurOPS tenga que mandar nada).
- Si ya existía: actualiza nombre/teléfono (`200 OK`, `action: "updated"`).
- Siempre devuelve el `id` del usuario en la Academia — ese id es el que se usa en los endpoints siguientes.
- **Reversibilidad**: cada llamada queda auditada del lado de la Academia con snapshot previo (permite rollback si algo sale mal, no es responsabilidad de NeurOPS implementarlo).

### 2.4 `POST /users/{id}/products` — Asignar producto a un alumno
Body: `product_slug` (o `product_id`) + **una** de estas cuatro modalidades de vencimiento:

| Modalidad | Payload | Comportamiento |
|---|---|---|
| **Total** (pago completo) | `{"payment_type": "total"}` | Usa la duración completa configurada en el producto (`duration_days` del programa, ej. 365 días) |
| **Cuota** (mensual) | `{"payment_type": "cuota", "duration_days": 30}` | Vigencia corta y renovable; `duration_days` default 30, pisable |
| **Seña/Reserva** | `{"payment_type": "seña"}` | `is_deposit: true`, 7 días de cortesía |
| **Fecha exacta manual** | `{"expires_at": "2027-03-31"}` | Ignora el cálculo automático — **esta es la modalidad que usa NeurOPS** para fijar el vencimiento que calcula su propia lógica de negocio (ver [§5.3](#53-cálculo-automático-de-vencimiento)), en vez de delegarle el cálculo a la Academia |

Archiva productos previos sin perder historial e inicializa los caminos de aprendizaje del alumno.

> Nota de compatibilidad: la primera versión de esta spec (compartida antes de revisar `api/docs`) documentaba un booleano `is_deposit` en vez de `payment_type`. La API real usa `payment_type` (`total`/`cuota`/`seña`) + `expires_at` opcional — esta sección ya refleja la versión vigente.

### 2.5 `GET /users/{id}/products` — Consultar productos y vencimientos del alumno
Útil para auditar accesos: estado (`active`/expirado), `days_remaining`, `expires_at`, `is_deposit`, etc.

**Forma real (30/09/2026)**: `{success, user: {id, name, email}, products: [...]}`, y cada producto trae `assignment_id` (int, no figura en la doc pública), `product_id` (int), `product_name`, `product_slug`, `program_name` (str, el programa interno: "Bootcamp" para los tres pagos), `status` (`"active"`…), `is_active` (bool), `is_deposit` (bool), `expires_at` (ISO 8601 con zona; NeurOPS lo fija a las `00:00+00:00` del día elegido, así que hay que leerlo como día de calendario y no pasarlo por el huso de quien mira), `days_remaining` (int) y `assigned_at` (ISO). No trae el `payment_type` con el que se asignó. En los alumnos consultados vino una sola asignación: no está confirmado si las archivadas aparecen (ver §6).

Cómo lo usa la ficha: la pestaña Fulfillment separa de esta lista el producto que el cliente **pagó** (el programa de Acciones traducido con el mapeo de §5.1) del resto, que se muestra aparte como "otros accesos en la Academia" — ver `resolver_producto` en [app/services/ficha_fulfillment_service.py](../app/services/ficha_fulfillment_service.py).

### 2.6 `GET /users/{id}/summary` — Ficha integral del estudiante
Dashboard comercial: producto activo + métricas de desempeño (racha de días, horas de estudio, % de progreso, lecciones completadas, tasa de aprobación, tickets de soporte abiertos, sesiones grupales/individuales asistidas). Pensado para que un closer vea de un vistazo cómo le está yendo a su alumno sin entrar a la Academia.

**Forma real (30/09/2026)**: `{success, student: {id, name, email, phone, role, active_product: {id, name, slug}}, performance: {...}}`. `performance` trae exactamente estos 12 campos, todos numéricos (en los alumnos consultados vinieron **enteros**, aunque la doc pública muestra decimales como `42.5`):

| Campo | Qué es | Dónde se muestra en la ficha |
|---|---|---|
| `total_study_hours` | horas de estudio acumuladas | Actividad |
| `pomodoro_sessions` | bloques de estudio cronometrados completados | Actividad |
| `streak_days` | días seguidos de estudio hasta hoy | Actividad |
| `lesson_views` | aperturas de lecciones (cuenta repeticiones) | Actividad |
| `completed_lessons` / `total_lessons` | lecciones terminadas sobre el total del programa | Avance (con barra) |
| `progress_percentage` | % de avance que calcula la Academia | Avance |
| `submitted_executions` | ejecuciones (ejercicios prácticos) entregadas | Ejecuciones |
| `approval_rate` | % de ejecuciones aprobadas | Ejecuciones |
| `group_sessions_attended` / `individual_sessions_attended` | sesiones en vivo asistidas | Acompañamiento |
| `open_support_tickets` | tickets de soporte sin resolver | Acompañamiento |

**No trae ninguna fecha**: ni último ingreso, ni última actividad, ni cuándo activó la cuenta. Todo es acumulado desde que existe el usuario. Tampoco hay avance por módulo. Y dos números no se pueden leer solos: `progress_percentage` vino en `0` con `12 de 12` lecciones completadas, y `approval_rate` vino en `0` con 8 ejecuciones entregadas (¿desaprobó todas o no le corrigieron ninguna?). Todo eso está pedido en §6.

### Códigos de error a manejar

| Código | Causa | Cómo debería reaccionar NeurOPS |
|---|---|---|
| `401` | Token ausente, revocado, o con scope incompatible | Marcar la integración como "token inválido" y avisar a un admin/operator — no reintentar en loop |
| `403` | Se intentó operar sobre una cuenta de staff | No es un error a reintentar — bloquear la acción y avisar (probablemente un email mal ingresado) |
| `404` | Usuario o producto no existe en la Academia | Mostrarle al closer un error claro, no un 500 genérico |
| `422` | Falta un campo obligatorio o formato inválido | Igual: mapear `errors.<campo>` al mensaje que ve el closer en el formulario |
| `429` | Se excedió el rate limit (60/min) | Esperar los segundos de `Retry-After` antes de reintentar; si el disparador es un job en lote, encolar y reintentar más tarde, no perder la operación |
| `500` | Error del lado de la Academia | Reintentar manualmente, no en automático (evitar duplicar altas) |

---

## 3. Plan de integración dentro de NeurOPS (alta simple)

Esto es diseño, todavía no código. Se apoya en patrones que **ya existen** en este repo para integraciones externas por token (mismo esquema que usan 2Chat/Whatchimp hoy), así que no hace falta inventar infraestructura nueva.

### 3.1 Dónde vive la configuración del token

**Ya resuelto**: el token ya está cargado como variable de entorno `ACADEMY_API_TOKEN` en `.env` (confirmado por Kerwin, 2026-09-04). Esto simplifica la propuesta original — en vez del patrón `Integration` (DB) usado por 2Chat, se sigue el patrón de [`WhatchimpService`](../app/services/whatchimp_service.py): `os.environ.get('ACADEMY_API_TOKEN')`, leído server-side únicamente, nunca expuesto al frontend. La base URL (`https://academy.thelearnation.com/api/v1`) se hardcodea como constante del servicio, igual que `TwoChatService.BASE_URL`.

El mapeo de productos (§5.1) sí sigue viviendo en una fila `Integration` (es config editable por un admin sin tocar variables de entorno, no un secreto).

### 3.2 Servicio nuevo: `LearnationService`
Un servicio nuevo en `app/services/` (ej. `learnation_service.py`), siguiendo la forma de `TwoChatService`, con métodos que envuelven cada endpoint:
- `get_products()`
- `check_user(email)`
- `upsert_user(email, name, phone)`
- `assign_product(learnation_user_id, product_slug, payment_type=None, duration_days=None, expires_at=None)`
- `get_student_products(learnation_user_id)`
- `get_student_summary(learnation_user_id)`

Centraliza el manejo de headers, base URL según `active_env`, y traducción de errores (401/404/422/500) a algo que el resto de la app pueda mostrarle al usuario sin exponer trazas crudas.

### 3.3 Dato que falta guardar: el id de usuario en la Academia
El modelo [`Client`](../app/models/client.py) de NeurOPS no tiene hoy ningún campo que lo vincule con su cuenta en la Academia. Como el cruce es por email y `Client.email` ya es único, conviene agregar una columna nueva (ej. `Client.learnation_user_id`, nullable) para no tener que llamar `GET /users/check` cada vez que se quiera consultar el resumen o asignar otro producto — se resuelve una sola vez en el primer alta y se cachea local. Esto sí requeriría una migración de Alembic cuando se implemente.

### 3.4 Flujo propuesto para el closer (UI)
El lugar natural es la ficha del cliente que ya usa el closer — [`ClientHistoryModal.jsx`](../frontend/src/components/shared/ClientHistoryModal.jsx), donde hoy ve historial y notas del cliente (`GET /clients/<id>/full-history`, [app/api/closer.py:2578](../app/api/closer.py)).

Ahí se agregaría una acción **"Dar acceso a la Academia"** con este flujo:
1. Closer elige el producto de un combo (poblado con `GET /products`, cacheado un rato para no pegarle a la API externa en cada apertura del modal).
2. Backend de NeurOPS (endpoint nuevo, ej. `POST /api/clients/<id>/academy-access`):
   - Si `Client.learnation_user_id` ya está seteado, lo usa directo.
   - Si no: `check_user(email)` → si existe, guarda el id que devuelve; si no, `upsert_user(...)` con los datos del `Client` (`full_name`, `email`, `phone`) y guarda el id creado.
   - Llama `assign_product(...)` con el producto elegido.
   - Persiste `learnation_user_id` en el `Client` y devuelve el resultado (incluyendo si el usuario era nuevo, para poder avisarle al closer "se le mandó un mail para que active su contraseña").
3. Frontend muestra el resultado (éxito/expiración calculada/errores de validación) sin salir de NeurOPS.

**Fase 2 (opcional, no bloqueante)**: mostrar el resumen de `GET /users/{id}/summary` directamente en la ficha del cliente (racha, % de avance, tickets abiertos) para que el closer haga seguimiento post-venta sin cambiar de plataforma. *Hecho: es la pestaña Fulfillment de la ficha del lead (`GET /api/ficha/<appt>/fulfillment`); qué muestra y de dónde sale cada dato, en §2.5 y §2.6.*

### 3.5 Permisos
Por pedido explícito, el disparador principal es el rol `closer` (ROLE_CLOSER, [app/models/user.py](../app/models/user.py)). A confirmar si `admin`/`operator` también deberían poder hacerlo manualmente (por ejemplo para soporte o correcciones) — el patrón de decorador ya existe (`role_required`, `admin_required`, `operator_required` en [app/decorators.py](../app/decorators.py)) así que ampliar el acceso más adelante no es un cambio grande.

### 3.6 Piezas a construir (resumen)
1. Migración: columna `learnation_user_id` en `Client`.
2. `app/services/learnation_service.py` (wrapper de los 5 endpoints + manejo de errores).
3. Endpoint(s) nuevos en `app/api/closer.py` (o un blueprint propio) protegidos con `@role_required('closer')`.
4. Fila `Integration` (`key='learnation_academy'`) configurada desde el admin existente — sin tocar `IntegrationsManager.jsx` si el `payload_config` genérico alcanza (ya soporta pares clave/valor libres vía `PayloadConfigModal`).
5. UI: botón/acción "Dar acceso a la Academia" + selector de producto dentro de `ClientHistoryModal.jsx`.
6. (Fase 2, opcional) Widget de resumen del alumno en la misma ficha.

### 3.7 Cosas a confirmar antes de implementar
- ¿El token de producción ya existe, o hay que pedírselo al otro desarrollador primero?
- ¿Existe un entorno de pruebas/sandbox de la Academia, o hay que probar directo contra producción con cuidado?
- ¿Qué producto(s) deberían quedar disponibles para asignar desde NeurOPS — todo el catálogo o un subconjunto curado?
- ¿`admin`/`operator` necesitan la misma acción, o queda closer-only por ahora?

---

## 4. API pública de NeurOPS para Academia (pagos y formulario)

> **Estado**: Implementado (2026-09-07). Documentación para el desarrollador de la Academia en [docs/academy_consulta_ventas.md](academy_consulta_ventas.md) — es ese archivo el que hay que compartirle, no este.
> **Dirección**: inversa a las secciones 2-3 — acá es la **Academia la que consulta a NeurOPS**, no al revés.
> **Objetivo**: que el desarrollador de la Academia pueda, dado el email de un alumno, consultar (a) su historial de pagos y (b) sus respuestas al formulario de calificación/triage, sin acceso directo a la base de datos de NeurOPS.

### 4.1 De dónde sale cada dato en NeurOPS

- **Pagos**: la fuente real hoy es [`FinancialSale`](../app/models/financial.py) (tabla `financial_sales`) — cada fila es un pago individual (seña/completo/parcial/cuota/renovación/upsell) sincronizado desde una Hoja de Cálculo vía Apps Script hacia `POST /api/public/financial-sales` ([app/api/public/financial_sales.py:121](../app/api/public/financial_sales.py)). *No* es el modelo `Enrollment`/`Payment` (legado, sin datos recientes — ver nota en [`InstallmentPlan`](../app/models/installment.py)). El cruce con el `Client` es por email/instagram normalizados.
- **Respuestas de formulario**: [`SurveyAnswer`](../app/models/booking.py) (tabla `survey_answers`) enlazada a [`SurveyQuestion`](../app/models/booking.py) — las respuestas de calificación/triage que el prospecto llena antes o durante el proceso de venta, ligadas a `client_id`.

### 4.2 Autenticación (implementada)

Ningún endpoint bajo `app/api/public/*` valida token — están abiertos por oscuridad de URL, pensados para consumo interno (n8n, Apps Script) en una red donde no importaba. Exponer pagos y respuestas de formulario a un tercero externo sí necesitaba autenticación real, así que esto vive aparte:
- Blueprint nuevo [`app/api/external/academy.py`](../app/api/external/academy.py), montado en `/api/external/academy` ([app/__init__.py](../app/__init__.py) — buscar `external_academy_api_bp`), exento de CSRF (se autentica con Bearer token, no con sesión de `flask_login`).
- Token propio de NeurOPS para la Academia, vía variable de entorno `ACADEMY_INBOUND_API_TOKEN` (mismo patrón que [`WhatchimpService`](../app/services/whatchimp_service.py) y que `ACADEMY_API_TOKEN` de la sección 3.1, pero en dirección inversa — no confundir los dos). Rotarlo implica cambiar la variable en Railway y redeployar.
- Verificación con el decorador [`require_academy_token`](../app/decorators.py) — valida `Authorization: Bearer <token>` contra `ACADEMY_INBOUND_API_TOKEN` con `hmac.compare_digest` (comparación a tiempo constante).

### 4.3 Endpoints implementados

**`GET /api/external/academy/students/<email>`** — ficha consolidada (recomendado, un solo request):
```json
{
  "success": true,
  "client": { "id": 89, "full_name": "Martín Rodríguez", "email": "...", "phone": "..." },
  "payments": [
    { "fecha": "2026-08-01T00:00:00", "monto": 500.0, "tipo_pago": "AL - Completo", "metodo_pago": "Stripe", "estado": "Completada" }
  ],
  "survey_answers": [
    { "question": "¿Cuál es tu especialidad?", "answer": "Cardiología" }
  ]
}
```
- `404` si el email no corresponde a ningún `Client`.
- El cruce de pagos es por `FinancialSale.mail_cliente` (no por `FinancialSale.client_id`, que hoy nunca se completa al recibir el webhook de la Hoja de Cálculo — ver [app/api/public/financial_sales.py](../app/api/public/financial_sales.py)) — mismo patrón de matching por email que ya usa [`new_clients.py`](../app/api/public/new_clients.py).
- Pensado como espejo funcional de `GET /users/{id}/summary` que la propia Academia ya expone (§2.6) — misma idea, dirección opuesta.

**`GET /api/external/academy/students/<email>/payments`** y **`GET /api/external/academy/students/<email>/survey`** — variantes separadas ya implementadas, por si la Academia prefiere pedir cada cosa por separado en vez de la ficha completa.

Documentación completa para compartir con el desarrollador de la Academia: [docs/academy_consulta_ventas.md](academy_consulta_ventas.md) (no incluye el valor del token — se comparte aparte, por un canal seguro).

### 4.3.1 Extensión (2026-09-07): masivo, búsqueda flexible y edición

A pedido del desarrollador de la Academia (necesitaba cruzar manualmente su base contra la de NeurOPS mientras no tenía un id propio de referencia — ya agregó un campo `work_id` en su lado para dejar de necesitar esto a futuro), se agregaron 11 endpoints más sobre los mismos 3 recursos, siguiendo el mismo blueprint y decorador:

- **`GET /clients`**, **`GET /sales`**, **`GET /forms`** — volcado paginado (`page`/`limit`, máx. 500) de `Client`, `FinancialSale` y `SurveyAnswer` completos.
- **`GET /clients/<identificador>`**, **`GET /sales/<identificador>`**, **`GET /forms/<identificador>`** — resuelven el identificador como id numérico, email exacto, o nombre parcial (`LIKE`, máx. 50 resultados), en ese orden.
- **`PATCH /clients/<id>`** — corrige `full_name`/`email`/`phone`/`instagram` del `Client` maestro. Requiere id numérico (no acepta email/nombre, para no editar por un match difuso). Chequea unicidad de email (`409` si ya existe).
- **`PATCH /sales/<id>`** — corrige `nombre_cliente`/`mail_cliente`/`telefono`/`instagram` de una venta puntual (no toca el `Client`). Si la venta tiene `marca_temporal`, la corrección se propaga a la Hoja de Cálculo vía `SheetsService.update_in_sheets` — mismo mecanismo que ya usa `update_financial_sale` en [app/api/public/financial_sales.py:250](../app/api/public/financial_sales.py) — para que el próximo resync automático no la revierta.

No hay `PATCH` para `SurveyAnswer` (no tiene sentido corregir la respuesta que dio un alumno). Todo el detalle de request/respuesta está en [docs/academy_consulta_ventas.md](academy_consulta_ventas.md).

### 4.4 Privacidad — qué NO exponer
`FinancialSale` y `Client` tienen columnas internas de operación (comisiones, notas de triage, objeciones, observaciones del closer) que no le competen a la Academia. El `to_dict()` de esta API debe ser una lista blanca explícita de campos (fecha, monto, tipo de pago, método, estado) — nunca un `to_dict()` genérico reusado de otra pantalla interna, para no filtrar de más por accidente el día que alguien le agregue un campo nuevo a `Client` o `FinancialSale`.

---

## 5. Fase 1: vinculación de productos, auto-login y vencimiento automático

> **Estado**: Diseño confirmado, en implementación — este es el trabajo que arranca inmediatamente después de este commit.
> **Pedido original (Kerwin, 2026-09-04)**: *"Lo primero que debemos integrar es una forma de vincular nuestros productos con los productos en academy, para que cuando el closer haga la venta/inscripcion automaticamente el cliente pueda iniciar sesion en academy con ese correo de la venta. También debemos permitirle al closer especificar el tiempo de vencimiento del programa [...] una seña debería vencer en 7 días y aumentar a 4 meses al hacer un pago completo o parcial [...] el closer lo pueda modificar de forma manual. Si hace un pago parcial y no paga una cuota, su tiempo de vencimiento debe reducirse hasta que pague la cuota correspondiente."*

### 5.1 Los "productos" de NeurOPS hoy

NeurOPS no tiene hoy un catálogo de productos formal y activo — lo que existe es un **código de programa** de 3 letras (`AL`, `RR`, `SI`) usado como string suelto en todo el flujo comercial: `InstallmentPlan.programa_code`, `FinancialSale.tipo_pago` (formato `"{CODIGO} - {tipo de pago}"`), y `SalesConsistencyService.PROGRAM_DEFAULT_TOTALS` (`{'AL': 1000.0, 'RR': 1500.0, 'SI': 2000.0}`, [app/services/sales_consistency_service.py:26](../app/services/sales_consistency_service.py)). El modelo `Program` ([app/models/funnel.py:42](../app/models/funnel.py)) es de un sistema de `Enrollment` distinto y legado — **no** es la fuente de verdad de estos 3 códigos.

**Vinculación propuesta**: un mapeo simple `{AL, RR, SI} → product_slug de la Academia`, guardado en `payload_config` de una fila `Integration` nueva (`key='learnation_academy'`) — sin tabla ni migración nueva para esto, es config, no dato transaccional ni secreto (el token va aparte, por variable de entorno, ver §3.1):
```json
{
  "product_mapping": {
    "AL": "ace-learners",
    "RR": "residencias-medicas",
    "SI": "specialist-iniciative"
  }
}
```
Editable desde una pequeña sección nueva en el admin (extiende `IntegrationsManager.jsx`, o una pantalla dedicada si el mapeo crece). Si un `programa_code` no tiene mapeo configurado, la sincronización con la Academia se omite silenciosamente para esa venta (se loguea, no se le muestra un error críptico al closer) hasta que un admin lo complete.

### 5.2 Disparador: ¿cuándo se sincroniza con la Academia?

Hay dos puntos de entrada reales donde "se hace la venta" en NeurOPS, y ninguno es un formulario nativo de alta:
1. **`POST /api/public/financial-sales`** ([app/api/public/financial_sales.py:121](../app/api/public/financial_sales.py)): webhook que recibe cada pago individual desde la Hoja de Cálculo (vía Apps Script) — cubre Completo, Seña, Parcial, Cuota, Renovación, Upsell. Ya tiene un hook post-commit (`CloserService.check_and_notify_down_payment_conversion`) que sirve de precedente para enganchar lógica adicional sin romper el flujo existente si falla (está en su propio `try/except`, no bloquea el guardado de la venta).
2. **`POST /api/closer/installments`** ([app/api/closer_installments.py:15](../app/api/closer_installments.py)): cuando el closer declara el plan de cuotas de una venta con seña/parcial — acá sí hay una pantalla nativa de NeurOPS donde el closer ya interactúa.

### 5.3 Cálculo automático de vencimiento

Regla pedida, implementada en NeurOPS (no delegada al `payment_type` de la Academia — se le manda siempre `expires_at` explícito, modalidad "Fecha exacta manual" de §2.4, porque quien sabe si el cliente está al día con sus cuotas es NeurOPS, no la Academia):

| Situación | Vencimiento por defecto | Ajustable por el closer |
|---|---|---|
| Seña / reserva | hoy + 7 días | Sí |
| Pago completo | hoy + 4 meses | Sí |
| Pago parcial (primer pago + cuotas) | hoy + 4 meses **mientras las cuotas estén al día** | Sí |
| Pago parcial con una cuota vencida sin pagar | se reduce (ver abajo) | Sí, pero se vuelve a recalcular en el próximo tick automático si la cuota sigue sin pagarse |

**"Se reduce hasta que pague la cuota correspondiente"** — la interpretación operativa: cuando una cuota de [`InstallmentPlan`](../app/models/installment.py) pasa su `fecha_vencimiento` en estado `pendiente`, el acceso en la Academia deja de tener el colchón de 4 meses y pasa a un vencimiento corto (propuesta: la `fecha_vencimiento` de esa cuota + un margen de gracia corto, ej. 3-5 días — a confirmar el número exacto) hasta que el closer marque la cuota como pagada (`PATCH /api/closer/installments/cuota/<id>`, ya existe), momento en el que se vuelve a extender.

Esto necesita un chequeo periódico, no solo reaccionar a eventos: una cuota "se vence" por el simple paso del tiempo, sin que nadie llame a la API ese día. NeurOPS ya tiene el patrón para esto — [`reminder_scheduler.py`](../app/services/reminder_scheduler.py) usa `APScheduler` (`BackgroundScheduler`, tick por intervalo) para otro propósito (recordatorios de seguimiento); se sumaría un tick análogo que recorra `InstallmentPlan` con cuotas vencidas sin pagar y sincronice el vencimiento reducido en la Academia para el `Client` correspondiente.

### 5.4 Override manual del closer

El closer puede fijar el vencimiment manualmente en cualquier momento — tanto al declarar la venta como después (ej. le da un plazo extra a un alumno). Vive como una acción explícita en la ficha del cliente ([`ClientHistoryModal.jsx`](../frontend/src/components/shared/ClientHistoryModal.jsx), mismo lugar propuesto en §3.4), con un campo de fecha editable. **Una vez que el closer lo fija a mano, el tick automático de §5.3 no debe volver a pisarlo** sin que quede claro que fue manual — necesita un flag (ej. `expiration_override_at` o similar) para que el ajuste automático por cuota vencida no le gane silenciosamente a una decisión explícita del closer.

### 5.5 Piezas a construir (Fase 1)
1. `app/services/learnation_service.py` — wrapper de la API externa (§3.2), con `assign_product` aceptando `expires_at` explícito.
2. Migración: `Client.learnation_user_id` (§3.3) + columna para registrar si el vencimiento actual fue fijado a mano por un closer.
3. Mapeo de productos en `Integration.payload_config` (§5.1) + UI mínima para editarlo.
4. Lógica de cálculo de vencimiento (§5.3) como función pura y testeable, separada de dónde se dispara.
5. Hook en `receive_financial_sales` (§5.2.1) y en el alta/edición de `InstallmentPlan` (§5.2.2) para disparar upsert + assign con el vencimiento calculado.
6. Tick periódico (§5.3) para cuotas vencidas — reduce vencimiento en la Academia sin intervención del closer.
7. UI: selector/override de vencimiento en `ClientHistoryModal.jsx` (§5.4).

---

## 6. Pedidos a la Academia

> **Estado**: pendiente de enviar (30/09/2026).
> **De dónde sale**: el inventario de §2.1, §2.5 y §2.6, hecho contra la API real con cinco lecturas (`/products` y `summary` + `products` de dos alumnos). Solo se pide lo que de verdad falta: el cruce por email, los vencimientos y las métricas acumuladas ya llegan bien y la ficha los usa.
> **Para qué**: la pestaña Fulfillment de la ficha (qué hace cada cliente dentro de la Academia) y los filtros por desempeño de las tablas Clientes/Ventas del dashboard comercial, que necesitan las métricas de muchos alumnos a la vez.

Mientras tanto, la ficha avisa en pantalla los dos números ambiguos (puntos 3 y 4): «Puede que todavía no estén corregidas» junto a una tasa de aprobación de 0% con entregas, y «No acompaña a las lecciones hechas» junto a un progreso de 0% con lecciones completadas.

### Texto para reenviar al desarrollador

> Hola! Desde NeurOPS ya mostramos en la ficha de cada cliente lo que devuelven `GET /users/{id}/summary` y `GET /users/{id}/products`, y funciona bien. Para que el equipo comercial pueda hacer un seguimiento real nos faltan estas cosas, en orden de prioridad:
>
> **1. Fechas de actividad en `/users/{id}/summary`** (lo más importante).
> Hoy todas las métricas son acumuladas y no viene ninguna fecha: un alumno con 40 horas que dejó hace dos meses se ve igual que uno que estudió ayer. Pedimos, en `student` o en `performance`:
> - `last_login_at`: último ingreso a la plataforma (ISO 8601, `null` si nunca entró).
> - `last_activity_at`: última actividad de estudio (lección, pomodoro o ejecución).
> - `activated_at` (o al menos `has_password`): si ya activó la cuenta después del alta sin contraseña. Hoy no sabemos si el alumno al que le dimos acceso llegó a entrar alguna vez.
>
> **2. Actividad reciente, además del total.**
> Las métricas de actividad (horas de estudio, pomodoros, lecciones completadas, ejecuciones entregadas) de los últimos 7 y 30 días, por ejemplo en `performance.last_7_days` y `performance.last_30_days`, o con un parámetro `?since=YYYY-MM-DD`. Es lo que nos dice si viene subiendo o bajando.
>
> **3. Desglose de las ejecuciones.**
> `approval_rate: 0` con `submitted_executions: 8` no se puede leer: ¿desaprobó todas o no le corrigieron ninguna? Pedimos `executions_reviewed`, `executions_approved` y `executions_pending_review`, y que `approval_rate` venga en `null` cuando no hay ninguna corregida. Si se puede, también la fecha de la última ejecución entregada.
>
> **4. Qué mide `progress_percentage`.**
> Vimos `progress_percentage: 0` con `completed_lessons: 12` de `total_lessons: 12`. ¿Sobre qué se calcula? Si es un error, corregirlo; si mide otra cosa (un camino de aprendizaje, por ejemplo), contanos qué para explicarlo bien en la ficha. De paso: la doc muestra decimales (`42.5`, `58.2`) y en la práctica llegan enteros; ¿se redondean?
>
> **5. Avance por módulo.**
> Los módulos del producto activo con cuánto lleva en cada uno, por ejemplo `modules: [{name, completed_lessons, total_lessons}]`, para saber dónde se trabó.
>
> **6. Un endpoint masivo (o un webhook) de desempeño.**
> Para filtrar y ordenar la lista de clientes por su actividad necesitamos las métricas de muchos alumnos a la vez. Hoy son 2 llamadas por alumno con un límite de 60 por minuto, que además comparten las altas de acceso que se hacen al vender: 300 alumnos son más de 10 minutos de consultas, y en ese rato no se podría dar ningún acceso. Nos sirve cualquiera de estas:
> - `GET /users/summary?ids=1,2,3` (hasta 100 por llamada), con el mismo formato que `/summary`;
> - `GET /students/performance?updated_since=...` paginado, solo con los que cambiaron desde una fecha;
> - un webhook que nos avise cuando cambia el desempeño o un acceso de un alumno.
>
> **7. Buscar alumnos por algo más que el email.**
> `/users/check` solo acepta `email` (con `phone` responde 422) y muchos clientes pagan con un correo y se registran con otro. Pedimos aceptar `?phone=` (comparando los últimos 8 dígitos) y, ya que agregaron el campo `work_id`, aceptar `?work_id=<id del cliente en NeurOPS>` y devolverlo en `check`, `summary` y `products`.
>
> **8. Que cada producto diga a qué programa de NeurOPS corresponde.**
> Los tres productos pagos traen el mismo `program_name` ("Bootcamp") y el vínculo con nuestros programas (AL, RR, SI) hoy lo mantenemos a mano de este lado. Un campo como `external_code` (`AL`/`RR`/`SI`) en `/products` y en cada producto de `/users/{id}/products` haría que un cambio de slug no rompa el vínculo sin que nadie se entere. En `/users/{id}/products`, marcar también la asignación automática de bienvenida (`learnation-course`), para no confundirla con algo que compró.
>
> **9. Historial completo de accesos.**
> La doc dice que `/users/{id}/products` es el historial de membresías, pero en los alumnos que consultamos vino una sola asignación. ¿Aparecen las archivadas? Si no, pedimos incluirlas con `archived_at`, y en cada una el `payment_type` con el que se asignó (total, cuota o seña), que hoy solo vuelve en la respuesta del POST.
>
> **10. Poder quitar un acceso.**
> Desde la ficha de NeurOPS ya se puede dar, renovar y quitar el acceso de un alumno. Para quitarlo, como la API no tiene cómo, le reasignamos el producto con `expires_at` = hoy. Nos serviría un endpoint explícito, por ejemplo `DELETE /users/{id}/products/{assignment_id}` o `POST /users/{id}/products/{assignment_id}/revoke`, que corte el acceso en el momento y deje la asignación en el historial marcada como revocada (con fecha y motivo). También confirmar qué pasa hoy con un `expires_at` de hoy: ¿vence en el acto o al terminar el día?
>
> ¡Gracias!

### Dar, renovar y quitar desde la ficha (30/09/2026)

La pestaña Fulfillment tiene los botones «Dar acceso», «Renovar acceso» y «Quitar acceso» (`app/services/ficha_academia.py`, permiso `cobrar`). Los tres usan la única escritura que tiene la Academia, `POST /users/{id}/products` con `expires_at`: dar crea la cuenta si no existe (el mismo camino de alta que la venta, `grant_access`), renovar la reasigna por el id del alumno sin tocar su correo, y **quitar la reasigna con vencimiento hoy** porque no hay un endpoint para revocar (pedido 10). Cada cambio queda en el historial del lead y en el hilo del cliente.
