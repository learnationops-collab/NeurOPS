# Sistema de Agendamiento y Embudos (NeurOPS)

Este documento resume el funcionamiento técnico y lógico del sistema de agendamiento de citas y gestión de embudos de venta.

## 1. Arquitectura de URLs y Links
Los links de agendamiento para clientes finales se construyen dinámicamente:
- **Formato URL**: `https://[dominio]/book/[utm_source]`
- **Ruta Frontend**: `frontend/src/pages/public/BookingPage.jsx`
- **Ruta Backend**: `app/api/public.py` (vía `@bp.route('/public/funnel/<string:utm_source>')`)

## 2. Flujo del Formulario de Cliente (Funnel de 4 Pasos)
El componente `BookingPage.jsx` gestiona un proceso de 4 etapas:

| Paso | Nombre | Descripción |
| :--- | :--- | :--- |
| **1** | **Email** | Verificación inicial. Si el cliente ya existe, se precargan sus datos (Nombre, Teléfono, Instagram). |
| **2** | **Datos** | Captura de `full_name`, `phone` (con selector de prefijo de país) e `instagram`. |
| **3** | **Encuesta** | Preguntas de cualificación dinámicas cargadas desde el backend. |
| **4** | **Reserva** | Selección de fecha y hora basada en disponibilidad real. |

## 3. Lógica de Cualificación (Scoring)
El sistema permite filtrar leads basados en sus respuestas:
- **Puntuación**: Cada opción de una pregunta (`SurveyQuestion`) puede tener puntos asociados.
- **Umbral**: Cada evento (`Event`) tiene un `min_score`.
- **Redirección**: 
  - **Calificado (`total_score >= min_score`)**: Redirige a `redirect_url_success`.
  - **No Calificado**: Redirige a `redirect_url_fail`.

## 4. Gestión de Disponibilidad (Slots)
La disponibilidad se calcula en `app/services/booking_service.py` mediante `get_available_slots_utc`:
1. **Prioridad 1**: Tabla `Availability` (Excepciones/Sobreescrituras para días específicos).
2. **Prioridad 2**: Tabla `WeeklyAvailability` (Horario semanal recurrente).
3. **Filtros**: Se restan las citas existentes (`Appointment`) que no estén canceladas.
4. **Timezone**: El backend calcula todo en UTC, pero el frontend (`BookingPage.jsx`) adapta las visualizaciones a la zona horaria local del cliente.

## 5. Integraciones y Automatización
Al finalizar un agendamiento exitoso (`/public/book`):
- Se crea la `Appointment` en la base de datos local.
- Se sincroniza con **Google Calendar** vía `GoogleService`.
- Se dispara un **Webhook** hacia la URL configurada en la tabla `Integrations` (con el nombre 'Agenda%'). El payload incluye:
  - Datos del cliente.
  - Fecha y hora (en el TZ del closer).
  - Nombre del closer asignado.
  - Fuente (UTM) y número de agenda del cliente.

## 6. Administración (FunnelsManager)
Ubicado en `frontend/src/components/FunnelsManager.jsx` (accedido desde Configuración):
- **Grupos**: Permiten agrupar eventos (ej. "Tráfico Google", "Orgánico").
- **Eventos**: Configuración del link, duración, buffer y redirecciones.
- **Editor de Preguntas**:
  - Permite crear preguntas de tipo `text` o `select`.
  - Las preguntas pueden ser **Globales**, por **Grupo** o por **Evento** específico.
  - Las preguntas globales siempre aparecen en todos los formularios vinculados.
