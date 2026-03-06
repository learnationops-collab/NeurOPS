# Sistema de Agendas (Booking System) — Referencia Técnica Completa

Este documento describe el funcionamiento interno completo del sistema de agendamiento, incluyendo la generación de links, el flujo público de reserva, las integraciones y la gestión interna por parte de Closers y Admins.

---

## 1. Modelos de Datos

### 1.1 Eventos y Grupos — `app/models/funnel.py`

| Modelo | Tabla | Descripción |
|--------|-------|-------------|
| `EventGroup` | `event_groups` | Agrupa eventos comerciales (ej. "Free Consultations", "Paid Coaching"). |
| `Event` | `events` | Representa un tipo de cita agendable. |

**Campos clave de `Event`:**
- `utm_source` (String, unique): **Slug del evento**. Es la pieza central de los links (ej. `consulta-gratis`).
- `is_active` (Bool): Solo eventos activos aparecen en los links.
- `duration_minutes` / `buffer_minutes`: Configuración de la cita.
- `group_id` (FK → `event_groups`): Agrupa el evento para la UI del modal de links.
- `min_score` (Int): Puntaje mínimo de la encuesta para calificar como lead.
- `redirect_url_success` / `redirect_url_fail`: URLs de redirección post-booking según calificación.
- `setter_id` (FK → `users`): Setter por defecto asignado al evento.
- `closers` (M2M via `event_closers`): Closers asignados a este evento. Determina qué horarios se muestran.

### 1.2 Disponibilidad — `app/models/booking.py`

| Modelo | Tabla | Descripción |
|--------|-------|-------------|
| `WeeklyAvailability` | `weekly_availability` | Horario recurrente semanal por Closer (día de semana + hora inicio/fin). |
| `Availability` | `availability` | Override puntual para una fecha específica (tiene prioridad sobre el semanal). |

**Lógica de prioridad**: Si existen registros en `Availability` para una fecha, se usan esos. Si no, se usa `WeeklyAvailability`.

### 1.3 Citas — `app/models/booking.py`

| Modelo | Tabla | Descripción |
|--------|-------|-------------|
| `Appointment` | `appointments` | Cita agendada entre un Client y un Closer. |

**Campos clave:**
- `closer_id` / `setter_id` / `client_id`: Relaciones al Closer, Setter (opcional) y Cliente.
- `start_time` (DateTime): **Siempre en UTC.**
- `origin` (String): Fuente de la cita (ej. `"Funnel: Consulta Gratis"`, `"direct"`).
- `last_stage` (String): Estado en el Kanban (ej. `"Nueva"`, `"Asistencia Confirmada"`).
- `result` (String): Resultado final (ej. `"Terminada"`, `"No Show"`, `"Cancelada"`, `"Reprogramada"`).
- `google_event_id`: ID del evento en Google Calendar (si fue sincronizado).

### 1.4 Encuestas — `app/models/booking.py`

| Modelo | Tabla | Descripción |
|--------|-------|-------------|
| `SurveyQuestion` | `survey_questions` | Pregunta de encuesta con opciones y puntaje. |
| `SurveyAnswer` | `survey_answers` | Respuesta del cliente a una pregunta. |

**Jerarquía de preguntas**: `is_global` (todas las encuestas) → `group_id` (por grupo de evento) → `event_id` (específicas del evento). Se fusionan y ordenan por `order`.

---

## 2. Sistema de Links

### 2.1 Generación de Links — `app/api/closer.py` → `get_booking_links()`

**Endpoint**: `GET /api/closer/booking-link` (autenticado)

Genera la estructura jerárquica **EventGroup → Events** con URLs completas:
```
[
  {
    "id": 1,
    "name": "Consultoría",
    "links": [
      { "id": 10, "name": "Sesión Gratis", "url": "https://domain.com/book/consulta-gratis", "slug": "consulta-gratis" },
      { "id": 11, "name": "Sesión Premium", "url": "https://domain.com/book/premium", "slug": "premium" }
    ]
  }
]
```

Solo se incluyen grupos con al menos un evento activo (`is_active=True`).

### 2.2 Tipos de Links

Hay **dos formatos** de URL que el sistema soporta:

| Tipo | Formato URL | Ejemplo |
|------|------------|---------|
| **Link General** (de evento) | `/book/{utm_source}` | `/book/consulta-gratis` |
| **Link Personal** (de closer) | `/book/{utm_source}-{username}` | `/book/consulta-gratis-juancarlos` |

El link personal asigna las citas directamente al closer especificado, mostrando solo sus horarios disponibles.

### 2.3 Parámetros URL Opcionales (Query Params)

El sistema acepta estos parámetros en la URL para pre-llenar datos:

| Parámetro | Ejemplo | Uso |
|-----------|---------|-----|
| `email` | `?email=test@mail.com` | Pre-llena el email del cliente |
| `name` | `?name=Juan` | Pre-llena el nombre |
| `phone` | `?phone=+541234567` | Pre-llena el teléfono |
| `instagram` / `insta` | `?insta=@juanito` | Pre-llena el Instagram |
| `setter` / `ref` | `?setter=maria` | Asigna un setter por username |
| `utm_source`, `utm_medium`, `utm_campaign` | Estándar UTM | Tracking de marketing |

### 2.4 Ruta con Setter ID

También existe la ruta `/book/:setter_id/:event_slug` que permite pasar el setter directamente como parte de la URL.

### 2.5 UI del Modal de Links — `BookingLinkModal.jsx`

El modal se abre desde el dashboard del Closer/Setter (hotkey `L`). Muestra:
1. **Selector de Evento Comercial** (dropdown con `EventGroup`).
2. **Selector de Variante/Link** (dropdown con `Event`s dentro del grupo).
3. **Preview del link** y botón **Copiar Link** al portapapeles.

---

## 3. Resolución del Link (Backend) — `public.py` → `get_funnel_by_source()`

**Endpoint**: `GET /api/public/funnel/{utm_source}`

Flujo de resolución:

```
1. Buscar Event por Event.utm_source == utm_source (match exacto)
2. Si no existe:
   a. Separar utm_source por último guión → (slug_parte, user_parte)
   b. Verificar que user_parte sea un User con role='closer'
   c. Verificar que slug_parte sea un Event activo
   d. Si ambos existen → usar ese Event + asignar closer preferido
3. Si no se resuelve → 404
```

**Respuesta exitosa** contiene:
- `event`: Info del evento (id, name, duration, min_score, redirect URLs).
- `questions`: Preguntas fusionadas (global + grupo + evento), ordenadas por `order`.
- `availability`: Lista de slots disponibles en UTC con `closer_id`, `closer_name`, `utc_iso`, `ts`, `date`, `start`.
- `closer_name`: Nombre del closer (si es 1) o `"Equipo NeurOPS"` (si son varios).

---

## 4. Flujo Público de Reserva (Frontend) — `BookingPage.jsx`

Wizard de 4 pasos:

### Paso 1: Lookup (`LookupStep.jsx`)
- El usuario ingresa email o Instagram.
- Llama a `POST /api/public/clients/check` para buscar si el cliente ya existe.
- **Cliente existente**: Pre-llena datos de contacto y respuestas de encuesta previas.
- **Cliente nuevo**: Avanza al paso 2 sin datos.

### Paso 2: Datos de Contacto (`ContactStep.jsx`)
- Formulario: nombre, email, teléfono (con selector de código país), Instagram.
- Al avanzar, llama a `POST /api/public/submit-lead` → crea o actualiza `Client` en la BD.
- Si no hay preguntas de encuesta configuradas, salta directo al paso 4.

### Paso 3: Encuesta (`SurveyStep.jsx`)
- Renderiza las preguntas dinámicas del evento.
- Al avanzar, llama a `POST /api/public/submit-survey` → guarda respuestas en `SurveyAnswer`.

### Paso 4: Calendario (`CalendarStep.jsx`)
- Muestra los slots disponibles agrupados por fecha (convertidos a zona horaria local del navegador).
- El usuario selecciona fecha y horario.
- Botón **"Confirmar Agenda"** → llama a `POST /api/public/book`.

---

## 5. Flujo de Booking (Backend) — `public.py` → `book_appointment()`

**Endpoint**: `POST /api/public/book`

Secuencia completa cuando se confirma una reserva:

```
1. CREAR/ACTUALIZAR CLIENTE → BookingService.create_or_update_client()
   - Busca por client_id o email existente
   - Crea nuevo o actualiza datos

2. VALIDAR EVENTO → Event.query.get(event_id)

3. RESOLVER SETTER
   - Prioridad: setter_id del body → setter username del body → event.setter_id (default)

4. RESOLVER CLOSER
   - Si viene closer_id en el body → usa ese directamente
   - Si no → itera closers del evento (o todos los closers) hasta encontrar uno sin conflicto

5. CREAR APPOINTMENT → BookingService.create_appointment()
   - Verifica conflicto de horario para el closer (ignora Canceladas/Reprogramadas)
   - Crea Appointment con last_stage='Nueva'
   - Crea Notification consolidada para Closer + Admins
   - SYNC LEAD: Crea/actualiza un Lead en el pipeline de marketing

6. GUARDAR ENCUESTA → BookingService.save_survey_answers()
   - Calcula puntaje total comparando respuestas con opciones y sus puntos

7. CALIFICAR LEAD
   - Si total_score < event.min_score → NO calificado → redirect_url_fail
   - Si total_score >= event.min_score → calificado → redirect_url_success

8. TRIGGER WEBHOOK → BookingService.trigger_agenda_webhook()
   - Busca Integration 'Agenda' en BD
   - Si es Discord: genera imagen (card) vía ImageService y la envía como embed
   - Si es otro webhook: envía JSON payload
   - Envía confirmación WhatsApp via 2Chat al cliente

9. SYNC GOOGLE CALENDAR → GoogleService.create_event()
   - Crea evento en el Google Calendar del Closer
   - Guarda google_event_id en el Appointment

10. RESPUESTA → { id, total_score, is_qualified, redirect_url, closer_name }
```

---

## 6. Cálculo de Disponibilidad — `BookingService`

### `get_available_slots_utc(start_date, end_date, preferred_closer_id=None)`

```
Para cada día en el rango:
  1. ¿Hay overrides en tabla Availability para esta fecha? → Usar esos horarios
  2. Si no → Usar WeeklyAvailability (por day_of_week)
  3. Para cada slot:
     a. Convertir hora local del Closer → UTC (usando closer.timezone, default 'America/La_Paz')
     b. Descartar si es pasado (con buffer de 5 min)
     c. Descartar si está ocupado (ya hay Appointment activo en ese horario para ese Closer)
     d. Agregar a la lista (dedup por timestamp UTC)
```

**Output**: Lista de slots `{ utc_iso, closer_id, ts (unix), date, start }` ordenados cronológicamente.

---

## 7. Gestión Interna de Agendas

### 7.1 Agregar Agenda Manual — `AddAgendaModal.jsx`
- El Closer puede crear agendas manualmente buscando leads existentes o creando un cliente nuevo.
- Usa la misma lógica del `BookingService.create_appointment()`.

### 7.2 Gestión de Agenda — `AgendaManagerModal.jsx`
- Modal completo para gestionar una agenda individual.
- Permite avanzar etapas (`last_stage`), reprogramar (buscar nuevo slot) y procesar resultado (`result`).
- Incluye sección de comentarios, datos del cliente y detalles de la cita.

### 7.3 Kanban — `CloserKanbanBoard.jsx`
- Visualización tipo drag-and-drop agrupada por `last_stage`.
- Consume `GET /api/closer/kanban` para obtener las agendas del closer.

---

## 8. Integraciones Post-Booking

| Integración | Servicio | Detalle |
|-------------|----------|---------|
| **Discord Webhook** | `booking_service.py` | Envía card visual (via `ImageService`) + embed con datos de la agenda al canal Discord. |
| **WhatsApp (2Chat)** | `TwoChatService` | Envía confirmación automática al número del cliente desde un número fijo configurado. |
| **Google Calendar** | `GoogleService` | Crea evento en el calendario del Closer asignado. |
| **Lead Pipeline** | `booking_service.py` | Crea/actualiza Lead en el CRM interno, asignando stage `"Agendada"`. |
| **Notifications** | `booking_service.py` | Crea notification in-app para el Closer y Admins. |

---

## 9. Rutas del Frontend (React Router)

| Ruta | Componente | Contexto |
|------|-----------|----------|
| `/book/:event_slug` | `BookingPage` | Link general de un evento |
| `/book/:setter_id/:event_slug` | `BookingPage` | Link con setter incluido |

---

## 10. Archivos Clave (Referencia Rápida)

### Backend
| Archivo | Rol |
|---------|-----|
| `app/models/funnel.py` | Modelos `Event`, `EventGroup`, `Program` |
| `app/models/booking.py` | Modelos `Appointment`, `Availability`, `WeeklyAvailability`, `SurveyQuestion`, `SurveyAnswer` |
| `app/services/booking_service.py` | Lógica central: slots, creación de citas, encuestas, webhooks |
| `app/api/public.py` | Endpoints públicos: funnel, check client, submit lead/survey, book |
| `app/api/closer.py` | Endpoint `get_booking_links()` + Kanban + gestión de agendas |
| `app/services/google_service.py` | Sincronización con Google Calendar |
| `app/services/image_service.py` | Generación de cards visuales para Discord |

### Frontend
| Archivo | Rol |
|---------|-----|
| `frontend/src/pages/public/BookingPage.jsx` | Wizard público de reserva (4 pasos) |
| `frontend/src/pages/public/booking/components/LookupStep.jsx` | Paso 1: búsqueda de cliente |
| `frontend/src/pages/public/booking/components/ContactStep.jsx` | Paso 2: datos de contacto |
| `frontend/src/pages/public/booking/components/SurveyStep.jsx` | Paso 3: encuesta |
| `frontend/src/pages/public/booking/components/CalendarStep.jsx` | Paso 4: selección de horario |
| `frontend/src/components/dashboard/BookingLinkModal.jsx` | Modal para copiar links de agenda |
| `frontend/src/components/modals/AddAgendaModal.jsx` | Modal para crear agenda manualmente |
| `frontend/src/components/modals/AgendaManagerModal.jsx` | Modal para gestionar una agenda existente |
| `frontend/src/components/closer/CloserKanbanBoard.jsx` | Kanban de agendas del Closer |
