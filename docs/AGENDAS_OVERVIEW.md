# Sistema de Agendas - Referencia Técnica

Este documento centraliza la información necesaria para trabajar con el sistema de agendamiento sin necesidad de re-analizar todo el código.

## 1. Estructura de Datos (Modelos)
Archivo: [app/models.py](file:///c:/Users/coros/Downloads/Trabajo/Learnation%20Workers/NeurOPS/app/models.py)

- **Appointment**: Modelo principal.
    - `last_stage`: Campo crítico para el Kanban (e.g., "Nueva", "Asistencia Confirmada").
    - `result`: Outcome de la agenda (e.g., "Terminada", "No Show", "Cancelada", "Reprogramada"). Determina las estadísticas.
    - `start_time`: Siempre almacenado y procesado en UTC.
    - `closer_id` / `client_id`: Relaciones fundamentales.

## 2. Lógica de Negocio (Servicios)
Archivo: [app/services/booking_service.py](file:///c:/Users/coros/Downloads/Trabajo/Learnation%20Workers/NeurOPS/app/services/booking_service.py)

- **`create_appointment`**: Punto único de creación.
    - Asigna `last_stage='Nueva'` por defecto.
    - Genera una **notificación consolidada** para el Closer y Administradores (`target_users=["role:admin", closer_id]`).
- **`_process_slot`**: Maneja la conversión de horarios. **IMPORTANTE**: Asegurar siempre el uso de `pytz.UTC` antes de generar timestamps para evitar desfases.

## 3. APIs y Endpoints
- **Closer API**: [app/api/closer.py](file:///c:/Users/coros/Downloads/Trabajo/Learnation%20Workers/NeurOPS/app/api/closer.py)
    - `get_kanban_data`: Filtra y agrupa por `last_stage`.
    - `get_notifications`: Soporta filtros por rol y ID, excluyendo notificaciones leídas.
- **Admin API**: [app/api/admin.py](file:///c:/Users/coros/Downloads/Trabajo/Learnation%20Workers/NeurOPS/app/api/admin.py)
    - CRUD de agendas y gestión masiva. Mapea `result` al campo visual `status`.
- **Dashboard Service**: [app/services/dashboard_service.py](file:///c:/Users/coros/Downloads/Trabajo/Learnation%20Workers/NeurOPS/app/services/dashboard_service.py)
    - Mapea el campo `result` de la base de datos a estados lógicos de negocio (`completed`, `no_show`, etc.) para calcular KPIs.

## 4. Frontend (React)
- **Kanban**: [frontend/src/components/CloserKanbanBoard.jsx](file:///c:/Users/coros/Downloads/Trabajo/Learnation%20Workers/NeurOPS/frontend/src/components/CloserKanbanBoard.jsx)
    - Visualiza las agendas basadas en el payload de `get_kanban_data`.
- **Estadísticas**: [frontend/src/pages/closer/dashboard/StatisticsPage.jsx](file:///c:/Users/coros/Downloads/Trabajo/Learnation%20Workers/NeurOPS/frontend/src/pages/closer/dashboard/StatisticsPage.jsx)
    - Renderiza el desglose de resultados basándose en el objeto `type_stats` (actualmente normalizado a una sola categoría).

## 5. Mantenimiento
- **Migraciones**: Cualquier cambio en `Appointment` debe ir seguido de:
    - `.\env\Scripts\python -m flask db migrate -m "..."`
    - `.\env\Scripts\python -m flask db upgrade`
- **Datos de Prueba**: [app/services/admin_ops_service.py](file:///c:/Users/coros/Downloads/Trabajo/Learnation%20Workers/NeurOPS/app/services/admin_ops_service.py) contiene el generador de Mock Data sincronizado con el modelo.
