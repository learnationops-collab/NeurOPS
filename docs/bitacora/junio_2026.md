# Bitácora - Junio 2026

- **29 de Junio de 2026**:
  - **Funcionalidad de Reenvío de Reportes a Discord**:
    - **API Backend (`app/api/public/setter.py`) [MODIFY]**:
      - Registro del endpoint `POST /public/setter-reports/<report_id>/resend-discord` para administradores que activa el webhook de Discord del reporte de un setter específico.
    - **API Backend (`app/api/public/closer.py`) [MODIFY]**:
      - Registro del endpoint `POST /public/closer-reports/<report_id>/resend-discord` para administradores que activa el webhook de Discord del reporte de un closer específico.
    - **Interfaz Frontend (`SetterReportsTable.jsx` [MODIFY])**:
      - Integración de botón de reenvío por Discord con icono `Send` al lado del botón de vista previa. Muestra un spinner de carga (`Loader2`) y se deshabilita mientras se procesa.
    - **Interfaz Frontend (`CloserReportsTable.jsx` [MODIFY])**:
      - Integración de botón de reenvío por Discord con icono `Send` al lado del botón de vista previa. Muestra un spinner de carga (`Loader2`) y se deshabilita mientras se procesa.
  - **Corrección de Reporte Diario de Setters**:
    - **API Backend (`app/api/setter.py`) [MODIFY]**:
      - Se refactorizó la función `_trigger_setter_report_webhook` para importar y utilizar la función unificada de datos `_prepare_setter_report_data` de `app/api/public/setter.py`. Esto unifica la estructura de datos enviada a la plantilla de reporte de setters (`setter_report.html`), solucionando el error `'kpi_metrics' is undefined` de Jinja2 y restableciendo el envío correcto de reportes al webhook de Discord.

- **27 de Junio de 2026**:
  - **Gestión de Formularios de Calificación Perdidos**:
    - **API Backend (`app/api/triage.py`) [MODIFY]**:
      - Se implementaron los endpoints `GET /api/triage/qualified-forms` (para listar y buscar clientes con respuestas de formulario, permitiendo filtrar por "huérfanos" sin citas) y `POST /api/triage/merge-clients` (para fusionar incrementalmente el `form_data` de un cliente origen en el destino, reasignar citas/inscripciones y eliminar el origen duplicado).
    - **API Backend (`app/api/closer.py`) [MODIFY]**:
      - Se dio acceso al rol `triage` al endpoint `/leads/search` para permitir la búsqueda de leads destino para fusiones.
    - **Interfaz Frontend (`FormsManagementPage.jsx` [NEW])**:
      - Creación de la interfaz de administración de formularios huérfanos con estética Glassmorphism, que permite ver las respuestas detalladas del lead y lanzar el flujo de fusión manual a través del CRM.
    - **Navegación e Rutas (`App.jsx` y `useDockNavigation.js`) [MODIFY]**:
      - Se registraron las rutas `/triage/formularios` y `/admin/formularios`, y se integró la pestaña "Formularios" en el Dock para los roles `triage` (Call Confirmer) y `admin`.

  - **Atribución Consistente de Agendas en Base al Primer Pago**:
    - **Servicio de Atribución (`app/services/attribution_service.py`) [NEW]**:
      - Se implementó `AttributionService.get_sales_attribution()` utilizando una estructura *Union-Find* para agrupar ventas y agendas por Lead (Instagram y Correo normalizados).
      - Se definió la regla del primer pago: la agenda del primer pago calificado (`split`, `seña`, `completo`) se propaga a todos los pagos posteriores del mismo lead.
      - Se integró la excepción para pagos tipo `upsell`, que continúan asociándose a su agenda más reciente.
    - **Endpoints de Ventas (`app/api/public/financial_sales.py`) [MODIFY]**:
      - Se integró `AttributionService` en `get_financial_sales` y `get_financial_sales_payroll` para calcular y aplicar la atribución unificada de agendas a las ventas y nóminas.
    - **Cálculo de Comisiones (`app/api/public/finance.py`) [MODIFY]**:
      - Se adaptó `get_commissions_calculated` para utilizar `AttributionService` al calcular las comisiones de Setters y Closers basadas en cobros reales.
    - **Standings de Setters (`app/api/manychat.py`) [MODIFY]**:
      - Se actualizó el endpoint `/manychat-webhook/stats/dashboard` para usar la agenda de la primera venta al calcular el rendimiento global por Setter.
    - **Pruebas y Diagnóstico (`scratch/test_attribution.py`) [NEW]**:
      - Creación de script de pruebas unitarias en memoria para comprobar el algoritmo de Union-Find y las reglas de negocio de atribución.

  - **Mejora en la Atribución Automática por Instagram o Email y Clasificación de Múltiples Pagos**:
    - **Modelos y consultas (`app/models/financial.py` y `app/api/public/financial_agendas.py`) [MODIFY]**:
      - Se modificaron los endpoints de ventas en `financial_sales.py` para admitir atribución dual de ventas a agendas por Instagram o por Correo Electrónico. De igual forma, se deduplicaron los listados de ventas asociadas en `financial_agendas.py` por ID único para evitar montos o conteos inflados cuando coinciden ambos campos.
      - Se optimizó la lógica de clasificación de agendas en `by_closer_state` y `by_source_state` de `get_financial_agendas` de manera que si un lead tiene múltiples pagos atribuidos (por ejemplo, una seña/depósito y una venta completa/upsell), la agenda compute correctamente bajo `"Ventas"` en lugar de clasificarse permanentemente bajo `"Depósitos"`, permitiendo una atribución completa de cierres al equipo.
    - **Ajuste de Desempaquetado [FIX]**:
      - Se ajustó el desempaquetado de `get_agenda_sales_info` a 3 elementos y se clasificaron múltiples pagos como Ventas.

- **26 de Junio de 2026**:
  - **Fase 2: Optimización de Rendimiento**:
    - **React Context (`frontend/src/contexts/AuthContext.jsx`) [MODIFY]**:
      - Se implementó `useMemo` para memorizar el objeto literal de valor del proveedor de `AuthContext`, reduciendo renderizados redundantes de la SPA y mejorando el desempeño general.
    - **Modelos y consultas (`app/models/financial.py` y `app/api/public/financial_agendas.py`) [MODIFY]**:
      - Se modificó `FinancialAgenda.to_dict()` para aceptar el parámetro opcional `sales_count` precalculado, eliminando la consulta N+1.
      - Se reestructuró la consulta fallback optimizándola con comparaciones de tipo `ilike` en lugar de funciones de base de datos sobre texto (`func.lower(func.replace(...))`), erradicando escaneos completos de tabla (full table scans).
      - Se adaptaron ambas ramas del endpoint de obtención de agendas (`get_financial_agendas`) para mapear y pasar los conteos de ventas ya precalculados en lote, logrando cero consultas redundantes durante la serialización.
      - **Hotfix:** Se eliminó un import local redundante de `sqlalchemy` en la rama `else` de `get_financial_agendas` que sombreaba la variable de nivel de módulo `func` y causaba un `UnboundLocalError` (error 500) en peticiones de listados completos.
    - **Esquema e Indexación de Base de Datos (`app/models/crm.py` y `app/models/payment.py`) [MODIFY]**:
      - Se inyectaron índices explícitos (`index=True`) a las claves foráneas en `LeadEventLog` (`appointment_id`, `user_id`), `Payment` (`enrollment_id`, `payment_method_id`) y `Enrollment` (`client_id`, `program_id`, `closer_id`), acelerando significativamente los JOINs y filtros frecuentes del CRM.
    - **Migración de Base de Datos [NEW]**:
      - Se generó y aplicó la migración `f83ef7f1cc72` ("Optimizacion de indices y rendimiento") mediante Alembic/Flask-Migrate.

  - **Fase 1: Blindaje de Seguridad Crítica**:
    - **API Backend (`app/api/auth.py`) [MODIFY]**:
      - Se eliminó por completo la ruta `/auth/emergency-create` que permitía la creación no autorizada de usuarios administradores mediante un secreto hardcodeado en el backend.
    - **Configuración de la Aplicación (`config.py`) [MODIFY]**:
      - Se modificó `SECRET_KEY` para que provenga obligatoriamente de la variable de entorno `SECRET_KEY` en producción (arrojando un `RuntimeError` en su ausencia para forzar despliegues seguros), con un fallback seguro únicamente para desarrollo.
      - Se definieron `SESSION_COOKIE_SECURE` y `REMEMBER_COOKIE_SECURE` de forma dinámica (`True` en producción/Railway, y `False` en desarrollo local sobre HTTP).
    - **Manejadores de Excepciones (`app/__init__.py`) [MODIFY]**:
      - Se modificaron los manejadores globales de error 500 y excepciones generales para retornar un JSON genérico limpio en producción. Se restringe el volcado detallado de trazas (`traceback.format_exc()`) únicamente a entornos donde `app.debug` sea verdadero, previniendo fuga de información técnica sensible.
    - **Documentación (`docs/arquitectura_y_funcionamiento.md`) [MODIFY]**:
      - Se documentaron las variables de entorno críticas de seguridad en la sección de Entorno de Despliegue.

  - **Fase 3: Activación de CSRF Segura**:
    - **Instancia de Axios Frontend (`frontend/src/services/api.js`) [MODIFY]**:
      - Se implementó un esquema de obtención perezosa (lazy) del token CSRF mediante una solicitud a `/api/auth/csrf-token` usando una instancia limpia de Axios, guardándolo en memoria y evitando bucles redundantes.
      - Se actualizó el interceptor de peticiones (`api.interceptors.request.use`) para que resuelva de forma asíncrona dicho token e inyecte la cabecera `X-CSRFToken` en todas las llamadas que muten estado (POST, PUT, DELETE, PATCH).
    - **API Backend Factory (`app/__init__.py`) [MODIFY]**:
      - Se eliminaron las exenciones globales de CSRF (`csrf.exempt`) en todos los blueprints internos consumidos por la SPA (como `api_bp`, `closer_api_bp`, `setter_api_bp`, `analytics_bp`, `marketing_bp`, `comments_bp`, `triage_bp`, `workshop_bp`, `conversational_bp` y `alerts_bp`), forzando una validación estricta de CSRF en el backend. Se conservaron exentos únicamente los endpoints consumidos por automatizaciones o integraciones externas independientes de navegador (n8n webhooks, ManyChat API, etc.).

  - **Fase 1.5: Trazabilidad y Preparación para CSRF**:
    - **Servicio de Agendamiento (`app/services/booking_service.py`) [MODIFY]**:
      - Se inyectó trazabilidad de auditoría en la función estática `log_lead_event` para comprobar si existe una suplantación activa (`session.get('is_impersonating')`). Si es así, se añade de manera automática una leyenda descriptiva especificando la identidad del operador original actuando en nombre del usuario suplantado. Se añadió también un control `has_request_context()` para garantizar la estabilidad del servicio en webhooks y scripts CLI.
    - **API Backend (`app/api/auth.py`) [MODIFY]**:
      - Se creó el endpoint `GET /api/auth/csrf-token` que genera un token de seguridad CSRF válido y lo expone a la SPA de React.

  - **Métricas de Conversión y Rendimiento del Dashboard**:
    - **Métricas de Closers (`app/services/closer_service.py` y `app/api/manychat.py`) [MODIFY]**:
      - Se incorporó el KPI Cierre Real sobre Asistencia en el dashboard de closers y el recálculo de la tasa de apertura (`openings_tasa`) como tasa de respuesta para evitar valores superiores al 100%.

- **25 de Junio de 2026**:
  - **Rediseño y Optimización de KPIs de Reporte Diario de Setters**:
    - **API Backend (`app/api/public/setter.py`) [MODIFY]**:
      - Se implementó en `_prepare_setter_report_data` el cálculo y recopilación de métricas históricas de los últimos 10 reportes para Entrantes, Tasa de Apertura, Tasa de Cualificación y Conversión por Cualificado, y de los últimos 7 reportes para Agendas.
      - Se añadió la lógica de comparación con el mismo día de la semana anterior (7 días antes), calculando diferencias absolutas, diferencias en puntos porcentuales (pp) y variaciones relativas.
      - Se generaron las coordenadas SVG para dibujar sparklines dinámicos de los últimos 10 reportes para cada KPI.
      - Se implementó el cálculo dinámico de **Insights Rápidos** en Python, comparando las métricas de hoy contra los promedios de los últimos 7 días (para Entrantes, Apertura, Cualificación y Conversión) y el volumen de agendas contra la semana anterior.
      - **Corrección de NameError [FIX]**: Se reintrodujo la variable `avg_metrics` en el diccionario de retorno para mantener compatibilidad y evitar errores en la carga de datos.
    - **Plantilla HTML (`app/templates/reports/setter_report.html`) [MODIFY]**:
      - Se rediseñó la sección de estadísticas principales para mostrar un panel horizontal de 5 KPIs (Entrantes, Tasa de Apertura, Tasa de Cualificación, Conversión por Cualificado y Agendas) con estética glassmorphism premium.
      - Se incorporaron visualizaciones de tendencias (flechas de variación), valores de la semana anterior y gráficos sparklines dinámicos.
      - Se removieron las secciones redundantes e inactivas como `averages-row`, la columna de conversión de la derecha y "Eficacia de Preguntas", optimizando el embudo a ancho completo.
      - Se diseñó e integró una sección horizontal de **Insights Rápidos** con badges circulares semafóricos (flechas de subida/bajada/neutral) y textos explicativos dinámicos.
      - **Mejora de Legibilidad y Tipografía [MODIFY]**: Se importó la tipografía premium `Plus Jakarta Sans` desde Google Fonts como la fuente por defecto del reporte. Se incrementaron significativamente los tamaños de fuente de las cabeceras, tarjetas, tablas, textos cualitativos y pie de página para mejorar drásticamente su lectura cuando el HTML es renderizado a imagen.
    - **Manejo de safe_percent en el Contexto de Renderizado [MODIFY]**:
      - Definición de `safe_percent` en el contexto de renderizado de Jinja2.

  - **Eliminación de la Pestaña de Comparación en Performance Center de Setters**:
    - **Interfaz Frontend (`PublicSetterStatsPage.jsx`) [MODIFY]**:
      - Se eliminó la pestaña de "Comparación" de la barra de pestañas superior en la vista de Setters (accesible para administradores).
      - Se removió el renderizado del componente `SetterComparisonView` y su correspondiente importación, simplificando el panel y removiendo redundancias.

- **24 de Junio de 2026**:
  - **Automatización de Reporte Diario de Closers y Registro de Decisiones**:
    - **Base de Datos (SQLite/PostgreSQL) [MODIFY]**:
      - Se agregaron las columnas `with_decision_maker` (Boolean, nullable=True) a la tabla `appointments` y `sold_in_call` (Boolean, nullable=True) a la tabla `financial_sales`.
      - Se crearon y aplicaron las migraciones correspondientes en la base de datos local SQLite.
    - **API Backend (`app/services/sheets_service.py` y `app/services/closer_service.py`) [MODIFY]**:
      - Actualización de `SheetsService.post_to_sheets` y `_rebuild_sales` para poblar el campo `sold_in_call` en `FinancialSale`.
      - Actualización de `CloserService.process_agenda` para registrar `with_decision_maker` en `Appointment`.
    - **API Backend (`app/api/public/closer.py` y `app/api/closer.py`) [NEW / MODIFY]**:
      - Creación del endpoint `GET /api/public/closer-report/prefill` para pre-rellenar el reporte diario del closer de manera automatizada.
      - Modificación de `GET /api/closer/deck` para admitir el parámetro opcional `selected_date` y permitir filtrar las agendas por cualquier fecha seleccionada.
    - **Interfaz Frontend (`CloserWorkflowPage.jsx` e `AgendaManagerModal.jsx`) [MODIFY]**:
      - Integración de modal en `CloserWorkflowPage.jsx` y toggle en `AgendaManagerModal.jsx` para calificar si la llamada asistida (Show Up) fue "Con decisor" o "Sin decisor".
      - Incorporación de un input de tipo fecha (`type="date"`) en la cabecera de `CloserWorkflowPage.jsx` para cambiar dinámicamente la fecha y recargar las agendas de ese día en el deck.
      - **Simplificación de Reagendas y Segundas Llamadas**: Remoción del flujo de slots de disponibilidad y reemplazo del panel de reprogramación por un input `datetime-local` en línea idéntico al del registro de agendas, añadiendo un botón de **Confirmar** al lado para validar la selección y prevenir la creación accidental de agendas por error.
    - **Interfaz Frontend (`NewSalePage.jsx`) [MODIFY]**:
      - Inclusión del switch interactivo para marcar si una venta manual fue cerrada "Dentro de la llamada (In-Call)".
    - **Interfaz Frontend (`PublicCloserReportPage.jsx`) [MODIFY]**:
      - Integración de llamada automática al endpoint de pre-relleno al cambiar el closer o la fecha, autocompletando la gran mayoría de métricas operativas del día con un banner premium indicando el éxito de la operación.

  - **Rediseño de Desglose de Rendimiento y Nuevos Estados (2TH Call, No Lead, Follow Up) [MODIFY]**:
    - **Backend API (`app/api/public/financial_agendas.py` y `app/services/closer_service.py`)**:
      - Reestructuración de la agregación de métricas de agendas agrupándolas en 3 bloques lógicos: `PREPARATION` (Pendiente, Contactado, Confirmado, Reagendada, Cancelada, Cerrada), `EXECUTION` (Show Up, No Show, 2TH Call) y `RESULTS` (Ventas, Depósitos, Follow Ups, No Leads).
      - Remoción del cálculo de desgloses para "Call Confirmer" para simplificar y optimizar la respuesta de la API (manteniendo la recolección de `unique_triage` para poblar correctamente las asignaciones visuales y selectores del historial).
      - Implementación de etiquetado automático: al agendar una 2ª llamada en el CRM, la cita actual pasa automáticamente al estado `Follow Up` y la nueva se crea pre-etiquetada como `2TH Call` en `appointments` y `financial_agendas`. Se integró también soporte completo para el estado `No Lead`.
      - **Consistencia Matemática de Show Up**: Ajustada la clasificación para que estados como `Follow Up` y `No Lead` se computen dentro de la columna `Show Up` en `EXECUTION`. De este modo, la sumatoria en `RESULTS` ($\text{Show Up} = \text{Ventas} + \text{Depósitos} + \text{Follow Ups} + \text{No Leads}$) es coherente y los porcentajes no presentan desfases ni superan el 100%.
      - **Seguridad y Protección de Webhooks**: Se removieron las URLs de Discord Webhook hardcodeadas en texto plano en todos los controladores de reportes (`app/api/public/closer.py`, `app/api/setter.py`, `app/api/public/triage.py`, `app/api/triage.py` y `app/services/alert_service.py`). Ahora se cargan de manera dinámica desde la variable de entorno `DISCORD_REPORTS_WEBHOOK` o desde las integraciones de base de datos, con fallbacks seguros.
    - **Frontend (`FinancialAgendasPage.jsx` y `CloserWorkflowPage.jsx`)**:
      - Creación del componente `PerformanceTable` en `FinancialAgendasPage.jsx` con el diseño exacto en tres columnas con sub-encabezados, iconos y tooltips de información. Se cambió la etiqueta e indicador `Deals` por `Ventas` para mayor claridad en español.
      - Remoción de la pestaña e informes de Call Confirmer en el historial de agendas.
      - Inclusión del botón de acción rápida **No Lead** en el deck de closers (`CloserWorkflowPage.jsx`) para descartar prospectos directamente.

  - **Mejora del Dashboard de Rendimiento de Closers**:
    - **API Backend (`app/services/closer_service.py`) [MODIFY]**:
      - Separación explícita de las transacciones de tipo "Upsell" y "Renovacion" en `get_comprehensive_stats`, evitando que se acumulen en los Split Pays.
      - Implementación del cálculo dinámico de `reports_productivity` para evaluar el cumplimiento de reportes diarios de todos los closers activos (Clasificación: Al día, Sin reportar hoy, Sin reportar ayer).
    - **Interfaz Frontend (`CloserPerformanceTab.jsx`) [REDESIGN]**:
      - Fusión de las tarjetas superiores de Facturación y Cierre en una sola tarjeta premium de "Facturación y Flujo de Caja", detallando New Cash, Installments, Reservas, Upsells, Renovaciones, y el Ticket Promedio.
      - Creación de la tarjeta "Productividad de Reportes" utilizando SVG Circular Progress animado y listado detallado de closers activos con badges de estado y fecha de último reporte.
      - Actualización de la tarjeta de "Conversiones de Embudo", eliminando conversiones financieras redundantes y agregando los ratios de Inasistencias (No Show Rate) y Cancelaciones (Cancel Rate).
  - **Corrección de Bugs Críticos en Dashboard de Closers [HOTFIX]**:
    - **API Backend (`app/services/closer_service.py`) [FIX]**:
      - Corregido `UnboundLocalError: cannot access local variable 'User'` en `get_comprehensive_stats`. La causa era un import local de `User` dentro del bloque `reports_productivity` que impedía a Python resolver la variable en el scope anterior del mismo método. Se movió el import de `User` y `CloserDailyReport` al inicio del método, eliminando el import duplicado.
    - **Interfaz Frontend (`PublicCloserStatsPage.jsx`) [FIX]**:
      - Corregido el valor por defecto de `closer_id` de `'3'` (ID inexistente) a `''` (todo el equipo).
      - Agregada validación post-carga: si el `closer_id` persistido en `localStorage` no existe en la lista de closers activos, se resetea automáticamente a `''` para evitar resultados vacíos silenciosos.

- **23 de Junio de 2026**:
  - **Reestructuración de la Barra Inferior (Dock) y Flujo de Trabajo Secuencial para Closers**:
    - **API Backend (`app/api/closer.py`) [MODIFY]**:
      - Modificación del endpoint `/api/closer/deck` para admitir el parámetro `step`. Si es `'agendas'`, devuelve las citas de hoy del closer (permitiendo que sigan visibles para ajustes dinámicos durante el día).
      - **Corrección de Zona Horaria en Deck**: Se adaptó el cálculo de "Hoy" en `step == 'agendas'` para usar la zona horaria del usuario (`current_user.timezone`) y convertir el rango a UTC naive para buscar citas en la base de datos de manera precisa.
      - Incorporación del endpoint `POST /api/closer/deck/bulk-update` para actualizar estados de citas en lote usando la lógica de negocio de `CloserService.process_agenda`.
    - **Navegación Frontend (`useDockNavigation.js`) [MODIFY]**:
      - Reconfiguración del Dock de closers para guiar en 4 pasos (1. Agendas del Día, 2. Declarar Venta, 3. Reporte Diario, 4. Dashboard), conservando el acceso opcional a "Sin Anuncio".
    - **Enrutamiento Frontend (`App.jsx`) [MODIFY]**:
      - Vinculación de la ruta `/closer/deck` a la nueva interfaz `CloserWorkflowPage` en lugar de la vista compartida.
    - **Interfaz Frontend [REDESIGN] (`CloserWorkflowPage.jsx` [NEW])**:
      - Creación del nuevo espacio de trabajo interactivo del Closer bajo la estética Dark Glassmorphism.
      - Implementación de la lista de agendas del día, selección múltiple, buscador y botones de acción rápidos de un solo clic para registrar asistencia (Asistió, No Show, Canceló) o abrir selector local de reagendas/segundas llamadas.
      - Integración del panel lateral derecho con el visor compacto de la ficha de calificación del lead.
    - **Corrección de Fechas en Tablero de Agendas (`FinancialAgendasPage.jsx`) [MODIFY]**:
      - Se implementó `toLocalDateString` para resolver el bug donde el filtro de "Hoy" y el de inicio de mes usaban `toISOString()` (que provocaba el desfase de zona horaria, mostrando agendas de mañana en lugar de las de hoy).
    - **Resolución de Closers y Sincronización de Citas en el Deck (`booking_service.py`, `financial_agendas.py`) [MODIFY]**:
      - Corrección de la lógica de resolución en [resolve_user_by_name](file:///c:/Users/EQUIPO%20DELL/Documents/GitHub/NeurOPS/app/services/booking_service.py#L372) para remover espacios adicionales de los nombres, permitiendo vincular citas de Google Sheets asignadas a "Jean Carlo Pérez" al usuario "Jean Carlo" (ID 4) del CRM.
      - Optimización de [sync_all_financial_agendas](file:///c:/Users/EQUIPO%20DELL/Documents/GitHub/NeurOPS/app/api/public/financial_agendas.py#L571) para permitir una sincronización selectiva temporal rápida (últimos 14 días por defecto) al procesar peticiones HTTP en producción, previniendo Gateway Timeouts y permitiendo resincronizar toda la historia únicamente al proveer el parámetro `all=true`.
      - Ejecución de la resincronización selectiva de los últimos 7 días de agendas para resolver retroactivamente el `closer_id` de las citas activas. Esto corrige el problema de la cola vacía en `/closer/deck?step=agendas`.

- **22 de Junio de 2026**:
  - **Selector de Closer Asignado y Call Confirmer en Registro de Agendas [MODIFY]**:
    - **Backend**:
      - Se modificó la consulta de `unique_closers` en `get_financial_agendas()` de `app/api/public/financial_agendas.py` para combinar los closers de agendas históricas con todos los usuarios registrados y activos que tienen el rol de `closer`.
    - **Frontend**:
      - En `FinancialAgendasPage.jsx`, se cambió el visualizador del closer en la tabla por un selector desplegable (`select`) que actualiza la base de datos asíncronamente en línea.
      - En el modal de edición de agendas, se reemplazaron las entradas de texto libre de `Closer` y `Call Confirmer` (encargado triage) por selectores desplegables dinámicos que utilizan `uniqueClosers` y `uniqueTriage` para prevenir errores de escritura manual.

  - **Organización y Actualización de Script de Sincronización de Base de Datos (`scripts/actualizar_db.py`) [NEW / DELETE]**:
    - Se incorporaron las importaciones y la sincronización de los nuevos modelos creados recientemente (`TeamMember`, `MonthlyPayroll`, `MonthlyPaymentMethodBalance`, `MonthlySaving`, `AlertRule` y `Alert`).
    - Se ordenó la lista de modelos por dependencias de claves foráneas para asegurar un vaciado e inserción limpios (evitando errores UNIQUE y violaciones de integridad).
    - Se ejecutó el script con éxito para actualizar la base de datos local SQLite con los datos de producción de PostgreSQL.
    - Se reubicó el script dentro del directorio `scripts/` adaptando dinámicamente la resolución del path raíz del proyecto, y se removió la versión duplicada de la raíz.

  - **Organización de Script de Carga de Formularios (`scripts/apply_form_data.py`) [NEW / DELETE]**:
    - Se reubicó el script manual `apply_form_data.py` (utilizado para importar datos de formularios históricos desde un markdown local) a la carpeta `scripts/` para mantener limpia la raíz del proyecto para producción.
    - Se adaptó el script para resolver dinámicamente la ruta del archivo de configuración `.env` y el path de importación de la aplicación.

  - **Directiva de Limpieza de la Raíz del Proyecto [POLICY]**:
    - Se establece la regla obligatoria de mantener la raíz del repositorio lo más limpia posible, limitándola estrictamente a los archivos necesarios para el despliegue de producción.
    - No se deben subir ni mantener en la raíz scripts de uso manual, de mantenimiento o utilitarios que no sean indispensables para el funcionamiento diario en producción; este tipo de herramientas secundarias deben ser ubicadas ordenadamente dentro del directorio `scripts/`.

  - **Depuración de Scripts Locales Innecesarios [DELETE]**:
    - Se eliminó el script utilitario de depuración de clientes `fix_prod_db.py` de la raíz del proyecto.
    - Se eliminaron del directorio `scripts/` los scripts y herramientas de mantenimiento que no son necesarios para el funcionamiento diario en producción: `adaptar_datos_historicos.py`, `apply_form_data.py`, `db/migrate_leads.py`, `db/seed.py` (removiendo asimismo el directorio `scripts/db/`) y el script obsoleto de lectura de Google Sheets `sync_sheets.py` (puesto que el registro de agendas se realiza mediante webhook externo de n8n y las ventas se registran directamente desde la aplicación hacia Sheets).
    - Se preservó únicamente el script de sincronización local `scripts/actualizar_db.py`.

  - **Fusión de Desgloses de Rendimiento con Pestañas (`FinancialAgendasPage.jsx`) [MODIFY]**:
    - Se unificaron las tres tablas de desgloses de rendimiento (por Closer, por Fuente y por Call Confirmer) en una sola tarjeta Glassmorphic colapsable.
    - Por defecto, toda la sección de desgloses se presenta contraída (minimizada) para optimizar el espacio de visualización al entrar al tablero.
    - Se implementó un selector de pestañas interactivo ("Fuente", "Call Confirmer", "Closer", "Todos") para permitir la conmutación fluida y el renderizado condicional de los desgloses según la necesidad del operador.

  - **Reestructuración de la Barra Inferior (Dock) y Flujo de Trabajo Secuencial para Setters**:
    - **API Backend (`app/api/setter.py`) [MODIFY]**:
      - Modificación del endpoint `/api/setter/deck` para aceptar un parámetro `step` (`entrantes`, `cualificacion`, `link-agenda`).
      - Filtrado dinámico de los leads en la cola según el paso del flujo secuencial en el que se encuentren (sin contactar, contactados sin cualificar, cualificados sin link).
      - Habilitación del guardado de `result` en `process_setter_card`.
      - Creación del nuevo endpoint `POST /api/setter/deck/bulk-update` para procesar actualizaciones en lote del estado y la keyword (anuncio) de múltiples citas.
    - **API Backend (`app/api/public/lead_roadmap.py`) [MODIFY]**:
      - Inyección de `appointment_keyword` en la respuesta de `/public/lead-roadmap` para exponer el anuncio asociado a la cita activa.
    - **Interfaz Frontend (`useDockNavigation.js`) [MODIFY]**:
      - Configuración de 4 pasos numerados para el Setter iniciando directamente desde Cualificación (1. Cualificación, 2. Link de Agenda, 3. Reporte Diario, 4. Dashboard).
      - Adaptación de la detección del elemento activo para soportar parámetros de consulta (`location.search`), permitiendo destacar el paso correcto en el Dock inferior.
    - **Interfaz Frontend (`LeadRoadmapDetail.jsx`) [MODIFY]**:
      - Adición de un selector interactivo dinámico en la sección de Metadatos de Adquisición para editar la keyword (anuncio) en caliente desde la ficha del lead si el usuario es un setter y hay una cita activa.
    - **Interfaz Frontend [REDESIGN] (`SetterWorkflowPage.jsx` [NEW] y `App.jsx` [MODIFY])**:
      - Creación del nuevo componente de productividad y espacio de trabajo `SetterWorkflowPage.jsx` con diseño de alta densidad, checkboxes de selección masiva y panel de herramientas para lotes.
      - Remoción de la etapa inicial de "Leads Entrantes", estructurando el espacio de trabajo del Setter a partir de "1. Cualificación" (Leads contactados que se deben cualificar/descualificar en un clic).
      - Redireccionamiento de la ruta `/setter/deck` en `App.jsx` hacia este nuevo espacio de trabajo enfocado del Setter.

  - **Rediseño Compacto del Detalle del Lead y Pestañas de Calificación (`LeadRoadmapDetail.jsx`, `SetterWorkflowPage.jsx`) [MODIFY]**:
    - **Frontend (`LeadRoadmapDetail.jsx`)**:
      - Implementación de la propiedad `compact`. Si está activa (como en el visor lateral del flujo del Setter), se renderiza una cabecera simplificada con datos esenciales de contacto y un grid de metadatos de 2 columnas de alta densidad.
      - Ocultamiento de la sección horizontal de pasos del lead (`Lead Roadmap`) en modo compacto.
      - Creación de pestañas de alternancia rápida ("Respuestas Bot" y "Calificar Lead") para separar de forma limpia la visualización del formulario n8n y el formulario de calificación manual, eliminando el solapamiento visual.
      - Ocultamiento completo de las secciones de membresías, resumen de ventas, notas internas e historial de actividad en modo compacto para liberar espacio de pantalla vertical.
      - Restricción de acceso en la calificación en caliente para que los usuarios con rol de `setter` no visualicen las secciones de "Observaciones de Call Confirmer" ni "Objeciones" (específicos de otros roles), reduciendo la pantalla al registro de los dolores del prospecto.
    - **Frontend (`SetterWorkflowPage.jsx`)**:
      - Activación de la propiedad `compact={true}` al invocar a `<LeadRoadmapDetail>` en la ficha lateral del Setter.

  - **Ajuste en la Etapa Link de Agenda (`SetterWorkflowPage.jsx`) [MODIFY]**:
    - **Frontend**:
      - Eliminación del botón "Agendado" en el paso 2 (Link de Agenda) para el Setter, delegando la detección del agendamiento al sistema automático de booking.
      - Reemplazo de la acción rápida (tanto individual como en lote) para marcar la cita directamente como "Link Enviado" en lugar de "Agendado" cuando el setter les provee su link de booking.
      - Eliminación del botón "Link" (que copiaba el enlace al portapapeles) en el renglón del lead del paso 2 (Link de Agenda) para dejar únicamente el botón de acción rápida "Link Enviado".

  - **Unificación de Navegación en Barra Inferior (Dock) y Remoción de Wizard Superior (`SetterWorkflowPage.jsx`, `useDockNavigation.js`) [MODIFY]**:
    - **Frontend**:
      - Eliminación completa de la barra de navegación superior (Wizard/Asistente) redundante en `SetterWorkflowPage.jsx` para centralizar toda la navegación en la barra inferior (Dock).
      - Limpieza de código eliminando la variable inactiva `stepsConfig` y la función `handleStepChange` en `SetterWorkflowPage.jsx`.
      - Configuración y ordenamiento de las páginas en el Dock para el Setter en `useDockNavigation.js`: 1. Cualificación, 2. Link de Agenda, 3. Reporte Diario, y 4. Dashboard (estadísticas).

  - **Corrección del Gráfico de Embudo en la Vista del Reporte Diario (`PublicSetterReportPage.jsx`) [MODIFY]**:
    - **Frontend**:
      - Se reemplazó el contenedor restrictivo del gráfico de embudo (`w-full aspect-square max-h-[300px]`) por un contenedor flexible con altura mínima adecuada (`w-full flex flex-col items-center justify-center min-h-[400px]`). Esto evita que el embudo colapse verticalmente y que se superpongan o corten las etapas y las tasas de conversión intermedias.
      - Se eliminó la propiedad no soportada `height="100%"` de la instancia del componente `<FunnelChart />`.
      - El gráfico de embudo en la vista general del Dashboard se mantuvo intacto sin verse afectado.

- **20 de Junio de 2026**:
  - **Soporte para el Estado "Cerrada" en Agendas [MODIFY]**:
    - **Backend**:
      - Se añadió `"Cerrada"` a la lista `"unique_states"` en `app/api/public/financial_agendas.py` y se inicializó con `0` en los desgloses dinámicos por closer, fuente y triage/Call Confirmer.
      - Se modificó `app/services/booking_service.py` para mapear `"cerrada"` y `"cerrado"` al resultado `'Cerrada'`, marcando la cita como procesada por closer y setter (`closer_processed = True` y `setter_processed = True`).
      - Se añadió el mapeo `'Cerrada': 'Cerrada'` al diccionario `outcome_map` de `process_agenda` en `app/services/closer_service.py`.
    - **Frontend**:
      - Se actualizó el helper `getEstadoBadgeVariant` en `FinancialAgendasPage.jsx` para asignar estilo `indigo` al estado `"Cerrada"`.
      - Se modificaron las tablas de "Desglose por Closer", "Desglose por Fuente" y "Desglose por Call Confirmer" en `FinancialAgendasPage.jsx` agregando la columna y celda `"Crd"`.
      - Se añadió la opción `"Cerrada"` al select inline de estados en la tabla de agendas e igualmente al select del modal de edición de agenda.
      - Se modificó `LeadsManagementPage.jsx` agregando `"Cerrada"` en las opciones de filtro de estado y su correspondiente estilo visual para los badges de leads.
      - Se modificó `AgendaManagerModal.jsx` para agregar la opción en `statuses` como `{ id: 'Cerrada', label: 'Cerrada (Venta)', icon: CheckCircle2, color: 'text-violet-500' }`.
      - Se modificó `AddAgendaModal.jsx` para agregar la opción en el select de estados del modal.

- **19 de Junio de 2026**:
  - **Normalización de Codificación de Bitácora [MODIFY]**:
    - Se corrigieron los errores de caracteres corruptos en `docs/bitacora/junio_2026.md` al normalizar y convertir el archivo desde un formato de codificación mixto a UTF-8 estándar.
  - **Desglose por Call Confirmer en Tablero de Agendas (`financial_agendas.py`, `FinancialAgendasPage.jsx`) [MODIFY]**:
    - **Backend (`financial_agendas.py`)**: Se agregó la agregación en memoria `by_triage_state` en el endpoint `GET /public/financial-agendas` para agrupar dinámicamente las estadísticas de agendas y cierres por el encargado de Call Confirmer (`encargado_triage`).
    - **Frontend (`FinancialAgendasPage.jsx`)**: Se incorporó el estado `byTriageState` y la visualización de la tabla "Desglose por Call Confirmer" en la cuadrícula de desgloses de la interfaz de administración, manteniendo la coherencia de diseño con los desgloses de closer y fuentes (incluyendo porcentajes interactivos mediante `HoverPercentCell`, cálculo de show rate y cierres).

- **18 de Junio de 2026**:
  - **Corrección de Renderizado en Gestión de Leads (`LeadsManagementPage.jsx`) [MODIFY]**:

    - Se solucionó un error crítico (pantalla solo con el fondo) que impedía visualizar la página al faltar la importación del icono `PhoneCall` de `lucide-react` en los KPIs inferiores.

  - Se agregó el endpoint /notifications/read-all para todos los roles (admin, closer, setter, triage).

  - Se añadió el botón 'Marcar Leídas' en la bandeja de leads (MainLayout.jsx).

  - Se simplificó la vista de las notificaciones para mostrar solo el contenido y el nombre del lead, haciéndolo más específico y de uso rápido.

  - Se resolvió el problema de visualización de conjuntos de anuncios en el Dashboard, modificando el endpoint '/manychat-webhook/stats/dashboard' para incluir todos los anuncios activos (con 0 estadísticas) y devolviendo sus estados.

  - Se implementó la lógica real de archivado en la base de datos ('status' = 'archived') para Campañas y Conjuntos de anuncios, reemplazando el guardado local.

  - Se agregó el botón para mostrar/ocultar y archivar conjuntos de anuncios en 'AdManagementPage' y 'AdDashboardTab'.

  - Se integró la librería 'papaparse' en el frontend para el manejo de archivos CSV.

  - Se creó el componente 'ImportSpendModal' que permite subir el reporte de anuncios desde Meta Ads.

  - Se implementó un algoritmo de auto-mapeo que vincula los nombres de los conjuntos de anuncios del CSV con los del sistema NeurOPS.

  - Se agregó el botón 'Cargar Inversión' en la pestaña 'PeriodSpendTab' para auto-rellenar los importes gastados, optimizando la carga diaria de inversión publicitaria.

  - Se modificó el endpoint de actualización de inversión ('PUT /api/ads/period-spend/<id>') para permitir la modificación de la fecha ('start_date' y 'end_date').

  - Se integró un selector de fecha interactivo en el Historial de Inversión del panel de Gestión de Anuncios, permitiendo corregir fácilmente la fecha al editar un registro existente.

  - Se modificó el comportamiento de la edición de fecha en el Historial de Inversión para que se aplique al grupo completo de registros (por día) en lugar de hacerlo individualmente.

  - La opción de edición de fecha se trasladó al encabezado de cada grupo.

  - Se reorganizó el desglose por closer y por fuente en el Tablero de Agendas (FinancialAgendasPage.jsx) a una vista completamente vertical.

  - Se rediseñó la celda HoverPercentCell para mostrar el número y el porcentaje de manera simultánea en posiciones separadas.

  - Se añadió funcionalidad para colapsar/minimizar las tablas de desglose por closer y por fuente con botones de chevron.

  - Se eliminó por completo la funcionalidad de Cartera de Clientes. Se quitaron los imports, pestañas y rutas correspondientes de useDockNavigation.js, PublicCloserStatsPage.jsx y App.jsx.

  - Se corrigió la comparación de datos en el Dashboard de Setters (MessageTable.jsx) para que los mensajes nuevos o sin registros del periodo anterior se comparen con valores en 0 en lugar de no mostrar datos.

  - Se implementó la visualización de la comparación de periodos anteriores en todas las métricas del componente LeadUnifiedKPI.jsx (Leads entrantes, tasa de respuesta, cualificación, no cualificados, respondidos y sin respuesta).

  - Se agregó la comparación del periodo anterior a la Matriz de Pérdida de Pasos y a la Matriz de Tenacidad en Seguimiento. Además, se aumentó el tamaño de las fuentes de los títulos y cifras para una mejor legibilidad en el dashboard de Setters.

  - Se rediseñó la visualización de la gráfica del embudo en el dashboard de closers (FunnelChart.jsx) reemplazando el gráfico SVG inestable de Recharts por un componente HTML/CSS personalizado con estética glassmorphic y visualización interactiva de las tasas de conversión paso a paso.

- **17 de Junio de 2026**:
  - **Mejora en Desgloses del Tablero de Agendas (`FinancialAgendasPage.jsx`) [MODIFY]**:

    - Se agregaron los porcentajes correspondientes a todos los valores numéricos (estados, total y cierres) en las tablas de "Desglose por Closer" y "Desglose por Fuente".

    - Al pasar el puntero (hover) sobre cada número en el desglose, este cambia dinámicamente al porcentaje respectivo sobre el total de agendas.

    - Se implementó de forma robusta con el componente atómico `HoverPercentCell` previniendo divisiones por cero.

  - **Edición Ágil de la Fecha de Reunión (Fecha Meet) (`FinancialAgendasPage.jsx`) [MODIFY]**:

    - Se reemplazó el campo de texto plano de la fecha de reunión en la tabla por un selector interactivo nativo `datetime-local` para habilitar la edición en línea instantánea.

    - Se actualizó el formulario del modal de edición de agenda para utilizar el selector `datetime-local` en lugar de una entrada de texto manual.

    - Se diseñó el helper `formatToDatetimeLocal` para normalizar y formatear fechas ISO al formato requerido por los inputs de navegador de manera robusta.

  - **Simplificación de la Fecha de Creación (`FinancialAgendasPage.jsx`) [MODIFY]**:

    - Se removió la hora y minutos de la visualización de la fecha de creación ("F. Creación") en el historial de agendas.

    - Se creó el helper `formatDateOnly` para formatear de forma segura y consistente únicamente el día, mes y año en español (ej. "17 de jun. de 2026").

  - **Integración de Formulario de Calificación n8n en Lead Roadmap (`financial_agendas.py`, `lead_roadmap.py`, `client.py`, `LeadRoadmapDetail.jsx`) [NEW / MODIFY]**:

    - **Base de Datos (SQLite/PostgreSQL)**:

      - Se añadió la columna `form_data` (JSON, nullable) al modelo `Client` en `app/models/client.py`.

      - Se ejecutaron las migraciones: `add_form_data_to_client` (`80c788051ebb`).

    - **Backend (API)**:

      - Se creó el endpoint público `POST /api/public/financial-agendas-form` en `app/api/public/financial_agendas.py`, accesible desde n8n en `https://work.thelearnation.com/api/public/financial-agendas-form`.

      - Recibe: `nombre`, `telefono`, `fuente_form`, `instagram`, `examen`, `profesion`, `formacion`, `empleo`, `interes`, `puntaje`, `inversion`, `apoyo`.

      - Detección de duplicados por Instagram normalizado o teléfono. Si el cliente existe, actualiza `form_data` incrementalmente con `flag_modified`. Si no existe, crea un nuevo `Client`.

      - Se expone `form_data` en el retorno de `GET /api/public/lead-roadmap` y en `update_client_roadmap` de `app/api/public/lead_roadmap.py`.

    - **Frontend (Interfaz)**:

      - Se rediseñó la sección inferior de `LeadRoadmapDetail.jsx` a un **grid de 3 columnas simétricas**:

        - Col 1: Tarjeta "Calificación Formulario (n8n)" con las respuestas del formulario (examen, profesión, formación, empleo, puntaje, inversión, interés, apoyo).

        - Col 2: Panel "Calificación en Caliente" (dolores, observaciones, objeciones, Quick Save).

        - Col 3: Membresías y Programas + Resumen de Venta + Notas Internas.

      - La **Tabla de Detalle de Actividad** fue movida a fila inferior en ancho completo (`lg:col-span-3`).

      - Se importó el ícono `ClipboardList` de `lucide-react`. Build de producción validado sin errores.

- **16 de Junio de 2026**:
  - **Implementación del Centro de Alertas (`alert.py`, `alert_service.py`, `alerts.py`, `__init__.py`, `sheets.py`, `App.jsx`, `useDockNavigation.js`, `AlertsHubPage.jsx`, `AlertsCenter.jsx`, `AlertRulesConfig.jsx`) [NEW / MODIFY]**:

    - **Backend (API, Modelos y Servicios)**:

      - Creación del archivo de modelos `app/models/alert.py` con las tablas `alert_rules` y `alerts` para almacenar las condiciones configuradas y el historial de incidencias gatilladas.

      - Registro de los nuevos modelos en el paquete global en `app/models/__init__.py`.

      - Ejecución de migraciones y actualización del esquema de la base de datos local (`add_alerts_system`).

      - Creación del servicio principal `app/services/alert_service.py` con el motor `evaluate_rules()` para procesar CPL, CPQL, Leads, Inversión, Agendas y Ventas asociadas a las reglas. El motor evita duplicados y envía notificaciones JSON embed premium a Discord.

      - Creación del blueprint `app/api/alerts.py` con el CRUD de reglas de alerta, listado de alertas, resolución, forzar evaluación manual y configuración del webhook de Discord en `integrations`.

      - Registro del blueprint de alertas y exención de CSRF en `app/__init__.py`.

      - Integración de la evaluación automática al final de la sincronización en background en `app/api/sheets.py`.

    - **Frontend (Interfaz y Navegación)**:

      - Registro de la página principal `/admin/alerts` limitada a administradores en `frontend/src/App.jsx`.

      - Adición del menú "Alertas" (Bell) en el Dock para acceso inmediato en `frontend/src/hooks/useDockNavigation.js`.

      - Creación de la página `AlertsHubPage.jsx` que implementa pestañas horizontales superiores en alineación estética con el resto de hubs de la plataforma, permitiendo cambiar dinámicamente entre Centro de alertas, Configuración de alertas e Historial.

      - Creación del componente `AlertsCenter.jsx` con KPI cards superiores de severidad, listado de alertas y un panel derecho con resumen de la última semana y gráfico de área de Recharts que compara la evolución del indicador contra el límite establecido (ReferenceLine).

      - Creación del componente `AlertRulesConfig.jsx` con listado de reglas, toggles de estado rápidos, formulario deslizante (Drawer) para creación/edición de reglas y modal para configurar dinámicamente la URL del Webhook de Discord.

  - **Alertas de Conversión de Seña a Venta Real (Discord Webhooks)**:

    - **Backend (`app/services/closer_service.py`) [MODIFY]**: Se implementó el método estático `check_and_notify_down_payment_conversion(client_data, sale_data)` que detecta si la venta actual es PIF (`full`, `completo`, `pif`) o Split pay (`first_payment`, `cuota`, `primer pago`, `split`). Si es así, realiza una búsqueda cruzada normalizada de señas anteriores (`down_payment`, `seña`, `deposito`) tanto en la tabla interna de pagos (`Payment` / `Client`) como en el registro de ventas externas (`FinancialSale`). En caso de hallar una coincidencia, envía una notificación estructurada con embed detallado a los webhooks de Discord de los canales de **Wins** (ID `1232723653032935464`) y **Onboarding** (ID `1318622160951971922`), cargando las URLs desde variables de entorno (`DISCORD_WINS_WEBHOOK`, `DISCORD_ONBOARDING_WEBHOOK`) o la tabla `Integration` (`sale_wins` y `sale_onboarding`).

    - **Integración de Webhook en Flujos de Venta (`sheets_service.py` y `api/public/financial_sales.py`) [MODIFY]**:

      - Se agregó el hook de verificación en `SheetsService.post_to_sheets` al registrar ventas de Google Sheets tras el `commit()`.

      - Se integró el hook de verificación en `receive_financial_sales` en `financial_sales.py` tras confirmar exitosamente el commit en lote/individual de ventas financieras.

      - Se inyectó la llamada al hook en `trigger_sale_automation` en `closer_service.py` para capturar conversiones en pagos internos de la UI.

    - **Pruebas de Integración (`scratch/test_conversion.py`) [NEW]**: Script de pruebas que simula el flujo completo de extremo a extremo, levantando un servidor web HTTP mock temporal para asegurar que las alertas a Discord Wins y Onboarding se emiten correctamente ante una conversión.

  - **Renombramiento de "Triage" a "Call Confirmer" en el Frontend**:

    - **Interfaz (Frontend) [MODIFY]**: Se modificaron las etiquetas textuales y títulos visibles en el frontend de "Triage" a "Call Confirmer" para reflejar el nombre real del rol:

      - En `TeamManagementPage.jsx`: Se actualizó el listado de roles y la opción correspondiente en el modal de creación/edición de usuarios.

      - En `FinancialAgendasPage.jsx`: Se cambiaron las referencias en los dropdowns de filtrado superior, cabecera de la tabla y campos del formulario de edición.

      - En `PublicTriageStatsPage.jsx` y `PublicTriageReportPage.jsx`: Se actualizaron títulos de dashboard, logos y textos informativos del sistema.

      - En `TriageTrackerTable.jsx` y `CloserDeckPage.jsx`: Se renombraron las columnas de visualización del rol y del perfil de calificación de triage.

    - **Verificación**: Se validó el correcto funcionamiento mediante la compilación de producción (`npm run build`) del frontend sin errores.

  - **Reordenamiento y Mejoras en Lead Roadmap y Soporte para n8n**:

    - **Frontend (`LeadRoadmapDetail.jsx`) [MODIFY]**: Se reordenó la sección de Calificación en Caliente del panel lateral para seguir la secuencia: **Dolor** -> **Observaciones de Call Confirmer** -> **Objeciones**. Se actualizó el título a "Observaciones de Call Confirmer" y se eliminó la sección redundante de "Dolores del Lead" ubicada en la parte inferior del panel.

    - **Frontend (`LeadRoadmapModals.jsx`) [MODIFY]**: Se cambió la etiqueta de "Agenda / Triage (ID)" por "Agenda / Call Confirmer (ID)" en el modal de vinculación manual de eventos para mantener la consistencia con el renombramiento del rol.

    - **Backend (`app/api/public/financial_agendas.py`) [MODIFY]**: Se añadió soporte para la variable `telefono` al recibir payloads del webhook de n8n para agendas externas. Se implementó además una extracción robusta e insensible a mayúsculas para `encargado_triage` con un buscador de claves candidatas y se agregaron registros de logs (`current_app.logger.info`) para auditoría y diagnóstico rápido de la carga de webhook de n8n.

    - **Backend (`app/api/public/lead_roadmap.py`) [MODIFY]**: Se corrigió la línea de tiempo del Roadmap (Etapa 3: Dolor) para incorporar dinámicamente los dolores manuales del prospecto (`client.dolores`) y marcar la etapa como completada. También se integró un evento cronológico de "Calificación Registrada" en la actividad detallada del roadmap al guardar dolores u objeciones manuales.

    - **Verificación**: Se validó el correcto funcionamiento mediante la compilación de producción (`npm run build`) del frontend y compilación de sintaxis de Python sin errores.

  - **Integración de Lead Roadmap en Leads Entrantes (Setter & Closer)**:

    - **Frontend (`LeadsManagementPage.jsx`) [MODIFY]**:

      - Se importó el componente `LeadRoadmapModal`.

      - Se implementó el estado `isRoadmapOpen` para manejar la visibilidad del modal de Roadmap.

      - Se agregó un botón interactivo "Roadmap" con diseño premium en la cabecera de la tarjeta del lead activo (dentro de `MazoCartas`), utilizando el icono `Layers` y una estética de color violeta.

      - Se instanció condicionalmente el modal `<LeadRoadmapModal>` al final del JSX, pasando los datos del lead activo (`instagram`, `email` y `phone`) y configurando llamadas a `fetchQueue` y `fetchEventLogs` al completarse de manera exitosa para actualizar la bitácora de eventos y la cola en caliente.

      - Se validó el correcto funcionamiento mediante la compilación de producción (`npm run build`) del frontend sin errores.

  - **Apertura de Lead Roadmap desde Leads Entrantes (Estadísticas del Setter)**:

    - **Frontend (`IncomingLeadsTab.jsx`) [MODIFY]**:

      - Se importó el componente `LeadRoadmapModal`.

      - Se implementó el estado `selectedRoadmapLead` para controlar el lead seleccionado y la apertura del modal.

      - Se modificó la columna de `Prospecto (Instagram)` en la tabla de leads entrantes para hacer el nombre del prospecto cliqueable (`cursor-pointer` y efectos hover) y abrir el roadmap al hacer clic.

      - Se instanció el componente `<LeadRoadmapModal>` al final de la página, permitiendo a los setters analizar y calificar dolores/notas de forma directa.

      - Se verificó la compilación sin fallas en el build de Vite.

  - **Edición de WhatsApp / Teléfono en Registro de Agendas**:

    - **Frontend (`FinancialAgendasPage.jsx`) [MODIFY]**: Se añadió el input de edición para el campo `whatsapp` (WhatsApp / Teléfono) en el modal de edición de agenda (`editingAgenda`), permitiendo la corrección o adición manual de números telefónicos de contacto directo.

    - **Verificación**: Se validó el correcto funcionamiento y la ausencia de errores mediante la compilación del build de producción de Vite (`npm run build`).

  - **Reemplazo del Mazo de Cartas por Lead Roadmap en Gestión de Leads**:

    - **Frontend (`LeadsManagementPage.jsx`) [MODIFY]**:

      - Se removió la dependencia e importación de `MazoCartas` y `LeadRoadmapModal`.

      - Se importó `LeadRoadmapDetail` para empotrarse directamente en la pantalla de forma estática en la columna central.

      - Se eliminaron el estado `isRoadmapOpen` y toda la navegación secuencial (botones Anterior / Siguiente, ficha por ficha).

      - Se añadió una función `handleSelectFilteredCard` para poder cambiar de lead al hacer clic sobre cualquier elemento de la cola de prospectos activos.

      - Se reestructuró la columna izquierda en dos bloques independientes: **Mi Cola** (para listar todos los prospectos asignados al usuario y permitir su selección directa) y **Sin Asignar** (para los leads entrantes que necesitan asignarse).

      - Se reestructuró el layout del grid general a 2 columnas principales: Controles de selección de leads a la izquierda (`lg:col-span-1`) y el visor principal de `LeadRoadmapDetail` a la derecha (`lg:col-span-3`).

      - Se quitó la columna derecha redundante (bitácora de eventos simplificada y gráfica circular de estados), ya que el roadmap integrado ya visualiza el historial de actividad detallado de forma nativa.

      - Se verificó la compilación del bundle de producción sin fallas.

  - **Cambio de Stripe a Mercury en Hub de Finanzas (Nómina y Medios de Pago)**:

    - **API Backend (`app/api/public/finance.py`) [MODIFY]**:

      - Se actualizó el sembrado de nómina inicial en `_seed_variable_members` para establecer `'Mercury'` como medio de pago predeterminado para los integrantes variables Marlon y Jean Carlos en lugar de `'Stripe'`.

      - Se modificó `default_methods` en la consulta y creación de balances de pasarelas (`manage_balances`) para cambiar `'Stripe'` por `'Mercury'`, definiendo los métodos predeterminados de balances corporativos como `['Mercury', 'AirTM']`.

    - **Base de Datos (Migración Local SQLite) [NEW]**:

      - Se creó y ejecutó el script `scratch/migrate_stripe_to_mercury.py` que actualizó en caliente todos los registros de las tablas `team_members`, `monthly_payroll` y `monthly_payment_method_balances` que tenían `'Stripe'` como `payment_method`, reconfigurándolos de manera consistente a `'Mercury'`.

    - **Frontend (`FinancePage.jsx`) [MODIFY]**:

      - Se modificó el valor inicial del estado al crear un integrante de equipo para usar `'Mercury'`.

      - Se cambiaron las opciones de los selectores de medio de pago y sus valores de contingencia a `'Mercury'` tanto en la tabla de nómina para el equipo fijo como para el equipo variable, y dentro del modal para agregar/editar integrantes.

    - **Verificación**: Se validó el correcto funcionamiento mediante la compilación del bundle de producción de Vite (`npm run build`) sin advertencias ni errores.

  - **Reenvío de Webhook de Ventas a n8n desde el Registro de Ventas**:

    - **API Backend (`app/api/public/financial_sales.py`) [MODIFY]**: Se implementó el endpoint `POST /api/public/financial-sales/<int:sale_id>/resend-webhook` para retransmitir una venta de manera asíncrona al webhook de n8n por medio de `SheetsService._trigger_n8n_webhook`, extrayendo el documento de identidad desde `raw_data`.

    - **Frontend (`PublicFinancialSalesPage.jsx`) [MODIFY]**:

      - Se importó el icono `Send` de `lucide-react`.

      - Se implementó la función `handleResendWebhook(sale)` que despliega un cuadro de diálogo nativo de confirmación (`window.confirm`) y emite una petición POST al backend con toasts informativos de carga, éxito y error.

      - Se integró un botón con el icono `Send` en la columna de acciones de la tabla del registro de ventas.

    - **Verificación**: Se validó el correcto funcionamiento y la ausencia de errores mediante la compilación del build de producción de Vite (`npm run build`).

  - **Simplificación de Notificaciones de Alertas en Discord**:

    - **Backend (`app/services/alert_service.py`) [MODIFY]**: Se modificó `AlertService._send_to_discord` para establecer la URL del webhook de triage y setting como fallback predeterminado si no está configurada la variable `DISCORD_ALERTS_WEBHOOK` ni el registro de integración en base de datos, eliminando la necesidad de que el usuario ingrese este enlace manualmente.

  - **Botón de Prueba para el Sistema de Alertas**:

    - **API Backend (`app/api/alerts.py`) [MODIFY]**: Se implementó el endpoint `POST /api/alerts/test` que genera e inserta una alerta de prueba en estado resuelto y la envía inmediatamente a Discord mediante `AlertService._send_to_discord`.

    - **Frontend (`AlertsCenter.jsx` y `AlertRulesConfig.jsx`) [MODIFY]**:

      - Se importó el icono `Send` de `lucide-react` en ambos componentes.

      - Se implementó la función `handleTestAlert` en ambos paneles.

      - Se integró el botón "Probar Alerta" con el icono `Send` en el header del Centro de Alertas y de la sección de Configuración de Alertas, permitiendo probar la conexión desde cualquier pestaña de la vista.

    - **Verificación**: Se validó el correcto funcionamiento y la ausencia de errores mediante la compilación del build de producción de Vite (`npm run build`).

  - **Simulación y Prueba de Reglas de Alertas Configuradas**:

    - **API Backend (`app/api/alerts.py`) [MODIFY]**: Se implementó el endpoint `POST /api/alerts/rules/<int:rule_id>/test` para forzar la activación simulada de una regla específica con datos ficticios que cumplan la condición. Se genera una alerta activa real (con `is_resolved=False`) para reflejarla de inmediato en la interfaz web y se notifica a Discord mediante `AlertService._send_to_discord`.

    - **Frontend (`AlertRulesConfig.jsx`) [MODIFY]**:

      - Se implementó la función `handleTestRule(rule)` para disparar la simulación en vivo de una regla específica con toasts de estado.

      - Se agregó un botón con el icono `Send` en la columna de acciones de cada fila de la tabla de reglas configuradas para iniciar la simulación.

    - **Verificación**: Se validó el correcto funcionamiento y la ausencia de errores mediante la compilación del build de producción de Vite (`npm run build`).

- **15 de Junio de 2026**:
  - **Reestructuración de Roles, Vista de Triage y Estados de Agendas**:

    - **Backend (API y Modelos)**:

      - Se reemplazó el rol `sales_admin` por `triage` en `app/models/user.py`.

      - Se agregó la columna `encargado_triage` al modelo `FinancialAgenda` en `app/models/financial.py` y se expuso en `to_dict()`.

      - Se removió el rol `ROLE_SALES_ADMIN` de los decoradores de acceso en `app/decorators.py`.

      - Se modificó la API de agendas en `app/api/public/financial_agendas.py` para capturar `encargado_triage` en peticiones POST/PUT, y retornar los nuevos estados de agenda (`Contactado` y `Confirmado`) y actualizar conteos y agrupaciones.

      - Se creó y aplicó la migración de base de datos local para la columna `encargado_triage`.

      - Se adaptó `app/services/booking_service.py` para mapear los nuevos estados en la sincronización de agendas.

    - **Frontend (Interfaz)**:

      - Se eliminó la ruta y vista pública `/publico` (`PublicHubPage.jsx`) en `frontend/src/App.jsx` y se eliminó físicamente el archivo.

      - Se modificaron los redireccionamientos del rol de triage de `/triage/report` a `/triage/agendas` en `LoginPage.jsx` y `useDockNavigation.js`.

      - Se reemplazó el rol de `sales_admin` por `triage` en `TeamManagementPage.jsx` y `OperatorControls.jsx`.

      - Se actualizó el tablero `FinancialAgendasPage.jsx` para incluir la columna "Triage", el campo `encargado_triage` y los nuevos estados en el modal de edición de agendas, así como el desglose por closer/fuente de los nuevos estados.

      - Se validó el correcto funcionamiento mediante la compilación exitosa de producción (`npm run build`).

  - **Gestión de Dolores del Lead en el Lead Roadmap**:

    - **Backend (API y Modelos)**:

      - Se agregó la columna `dolores` en el modelo `Client` en `app/models/client.py`.

      - Se creó y aplicó la migración de base de datos correspondiente (`add_dolores_to_client`).

      - Se modificó la API de Lead Roadmap en `app/api/public/lead_roadmap.py` para devolver el campo `dolores` del cliente en `lead_profile`, y consolidar los dolores ingresados manualmente con los detectados de encuestas/ManyChat en `dolores_lead`.

      - Se actualizó el endpoint `/public/lead-roadmap/update-client` para capturar y persistir el campo `dolores`.

    - **Frontend (Interfaz)**:

      - Se actualizó `LeadRoadmapDetail.jsx` incorporando un selector de tags rápidos de dolores comunes y una caja de texto dedicada para `dolores` dentro del panel de Calificación en Caliente.

      - Se integró el estado con el backend y se evitó la colisión del estado con la variable destructurada mediante el renombrado a `doloresConsolidados`.

      - Se validó con un build de producción exitoso.

  - **Frecuentes y Agregación Manual de Objeciones y Dolores en Lead Roadmap**:

    - **Backend (API)**:

      - Se modificó el endpoint `/public/lead-roadmap` en `app/api/public/lead_roadmap.py` para consultar en caliente todos los registros de clientes y calcular los 10 dolores y 10 objeciones más frecuentes, retornándolos en la respuesta.

    - **Frontend (Interfaz)**:

      - Se eliminaron las constantes estáticas `commonObjections` y `commonDolores` de `LeadRoadmapDetail.jsx`.

      - Se definieron los estados para frecuentes y entradas manuales, permitiendo agregar nuevos dolores/objeciones al presionar Enter o hacer clic en `+`.

      - Se listan los tags activos con botones `×` para poder removerlos de forma rápida.

      - Se muestran en una sección de "Frecuentes" los tags dinámicos obtenidos del servidor que aún no están asociados al lead, permitiendo agregarlos con un solo clic.

      - Se fuerza el refresco en caliente de la ficha al guardar los cambios para actualizar la lista de frecuentes global.

      - Se validó la compilación exitosa sin advertencias o errores utilizando `npm run build`.

  - **Filtro y Asignación In-line por Encargado de Triage en Tablero de Agendas**:

    - **Backend (API) (`financial_agendas.py`)**:

      - Se añadió el parámetro `encargado_triage` al endpoint `GET /public/financial-agendas`.

      - Se implementó el filtrado de agendas por la columna `encargado_triage` (manejando de forma robusta la opción `"Sin Asignar"` para encontrar registros nulos o vacíos).

      - Se importó el modelo `User` en `financial_agendas.py` y se modificó el cálculo de `unique_triage` para combinar los encargados asignados actualmente en la BD con todos los usuarios del sistema que tienen el rol de `triage` y están activos, permitiendo listar a todo el equipo de triage para asignaciones inmediatas.

    - **Frontend (Interfaz) (`FinancialAgendasPage.jsx`)**:

      - Se agregó el filtro `encargadoTriage` a `usePersistentFilters` para persistir su estado de filtro.

      - Se adaptó la llamada de API para pasar el parámetro `encargado_triage` y almacenar `uniqueTriage` en el estado.

      - Se integró el selector dropdown "Triage" en la barra de control de filtros, permitiendo seleccionar los encargados dinámicamente y los registros "Sin Asignar".

      - Se reemplazó el badge/texto estático de encargado de triage por un **selector dropdown interactivo en línea** (`select`) en la tabla de agendas. Este dropdown permite asignar o cambiar en caliente el encargado de triage directamente desde la fila con un solo clic (disparando una petición `PUT` de actualización al backend).

      - Se actualizó el `colSpan` del mensaje de tabla vacía de 8 a 9 columnas para alinear correctamente el diseño.

      - Se validó que el build de producción finalice sin errores.

- **14 de Junio de 2026**:
  - **Resaltado y Conteo de Ventas en Registro de Agendas de Closers (`closer.py`, `financial.py`, `financial_agendas.py`, `LeadsPage.jsx`, `CloserDashboard.jsx`, `CloserKanbanBoard.jsx`, `FinancialAgendasPage.jsx`) [MODIFY]**:

    - **Backend (API y Modelos)**:

      - Se agregaron los campos `sales_count` y `has_sale` a las agendas y pipelines de closer en `app/api/closer.py`.

      - Se integró el cálculo en tiempo real de ventas asociadas a través de instagram o email en la función `to_dict()` del modelo `FinancialAgenda` en `app/models/financial.py`.

      - Se reestructuró la API de agendas financieras en `app/api/public/financial_agendas.py` para calcular en memoria el total de cierres (`cierres`) por Closer y por Fuente de forma consolidada, evitando N+1 queries.

    - **Frontend (Interfaz)**:

      - Se integró un badge esmeralda premium (`✓ X cierres`) en la tabla de agendas (`LeadsPage.jsx`), las tarjetas y listas del Kanban (`CloserKanbanBoard.jsx`), el listado del panel principal (`CloserDashboard.jsx`) y el Tablero de Agendas Financieras (`FinancialAgendasPage.jsx`).

      - Se incorporó la columna **"Cierres"** en los paneles de desgloses de "Desglose por Closer" y "Desglose por Fuente" en `FinancialAgendasPage.jsx` para visualizar el volumen agregado de ventas concretadas.

      - Se aplicó una sutil tonalidad de fondo y borde esmeralda a las celdas y tarjetas de agendas que tienen al menos una venta registrada en todas estas vistas.

  - **Remoción de Redundancia de Métricas en Dashboard de Setters (`PublicSetterStatsPage.jsx`) [MODIFY]**:

    - Se identificó y eliminó la métrica redundante "Calidad de Tráfico" (`leads / entrantes`), la cual mostraba exactamente la misma información que la "Tasa de Cualificación sobre Entrantes" (`% / Entrantes`) en el bloque unificado superior.

    - Se reemplazó por la métrica clave **"Conversión Final"** (Agendas / Entrantes: `funnel_agenda / entrantes`), que representa el yield global de citas generadas respecto al volumen inicial de conversaciones del periodo.

    - Se actualizaron las fórmulas del valor principal, sub-indicadores, tooltip conceptual de cálculo e histórico de comparación.

  - **Corrección de Visibilidad de Gráfico de Embudo (`FunnelChart.jsx`, `PublicSetterReportPage.jsx`) [MODIFY]**:

    - Se solucionó el colapso a altura cero de `ResponsiveContainer` de Recharts agregando la prop `height` (por defecto `'300px'`) y usando estilos inline en el contenedor del componente `FunnelChart.jsx`.

    - Se adaptaron las llamadas correspondientes en los dashboards y se pasó `height="100%"` en la página de reporte de setters (`PublicSetterReportPage.jsx`) para preservar el contenedor responsivo de relación de aspecto cuadrada.

  - **Evitación de Desbordamiento Horizontal en Tooltips (`StatTooltip.jsx`) [MODIFY]**:

    - Se optimizó la detección de límites del viewport (`window.innerWidth`) en el componente de portal `StatTooltip.jsx`.

    - Si un tooltip se posiciona demasiado cerca de los bordes izquierdo o derecho de la pantalla (como el de "Agendas Generadas" en el extremo izquierdo del dashboard de setters), se desplaza horizontalmente de manera dinámica para mantenerse dentro del área visible.

    - La flecha indicadora inferior del tooltip se ajusta dinámicamente (`arrowLeft`) para continuar apuntando exactamente al centro del elemento hovered.

  - **Solución al Clipping de Tooltips mediante React Portals y StatTooltip (`StatTooltip.jsx`, `AdDashboardTab.jsx`) [MODIFY]**:

    - **Parámetro Flexible en `StatTooltip.jsx`**: Se añadió la propiedad opcional `calcLabel` al componente de tooltip compartido para permitir silenciar o personalizar el prefijo "Fórmula / Explicación:" (por ejemplo, mostrando "Detalle:" en la estructura del anuncio).

    - **Dashboard de Rendimiento por Anuncio (`AdDashboardTab.jsx`)**:

      - Se eliminaron todos los tooltips absolutos tradicionales basados en CSS (`group-hover/tooltip` y similares) en los desgloses de estructura del anuncio de la tabla y tarjetas de galería, resolviendo el bug de clipping (donde quedaban recortados por el `overflow-x-auto` u `overflow-hidden` del layout).

      - Se reemplazaron por el componente portalizado `StatTooltip` que se renderiza directamente en `document.body` y con z-index seguro (`z-[99999]`), garantizando que siempre se visualicen sobre todo elemento de la página.

      - Se integró el soporte de tooltips explicativos y fórmulas matemáticas para las métricas de negocio principales (Inversión, Leads, CPL, % Cualificado, CPQL, Agendas, CPA, Ventas, CPV, Cash Collect y ROAS) en:

        - Las celdas de datos numéricos en la tabla de **Campañas** (`renderCampaignsTable`).

        - Las celdas de datos numéricos en la tabla de **Conjuntos de Anuncios** (`renderAdSetsTable`).

        - Las celdas y la estructura del anuncio de la tabla de **Anuncios** (list view).

        - Las tarjetas de KPIs generales superiores (6 tarjetas fijas).

        - Los botones e indicadores individuales en la vista de **Galería** de anuncios.

      - Se validó de forma robusta la compilación de producción (`npm run build`) para certificar la consistencia del bundle sin errores de tipografía o imports.

  - **Ajustes de Profit, Etiquetas y Tooltips en Hub de Finanzas (`FinancePage.jsx`) [MODIFY]**:

    - **Corrección de Profit**: Se actualizó la etiqueta y subtítulo del KPI card en el frontend a "Profit (Ingresos - Gastos)" para alinearlo con la lógica matemática implementada en el backend (Ingresos Totales - Gastos Totales del periodo).

    - **Simplificación de Egresos y Pestaña**: Se renombró la categoría "Suscripciones Software" a simplemente "Software" en el desglose de distribución de gastos en el Resumen Financiero. Asimismo, se simplificó la pestaña "Presupuesto Anuncios" a simplemente "Anuncios".

    - **Remoción de Duplicados**: Se eliminó el "Balance General (A - B)" de la sección "Balance del Período", al ser equivalente al Profit operativo.

    - **Tooltips Informativos detallados**: Se integraron componentes dinámicos de tooltip (`InfoTooltip`) bajo estilo CSS Glassmorphism en todas las secciones, KPIs principales, columnas de tablas y balances de pasarelas del Hub de Finanzas para detallar conceptualmente cada dato y su fórmula de cálculo.

  - **Accesos Rápidos de Períodos en Performance Center de Setters (`PublicSetterStatsPage.jsx`) [MODIFY]**:

    - **Botones de Filtros Rápidos**: Se integró una hilera de accesos rápidos estilo Glassmorphic en el panel de filtros principales (Ayer, Últimos 7 días, Últimos 30 días, Este mes, Mes anterior) para permitir cambiar el rango temporal de análisis de manera instantánea.

    - **Soporte de Cómputo de Fechas**: Se ampliaron los cálculos automáticos de rangos de fechas de inicio (`start_date`) y fin (`end_date`) en el hook `useEffect` correspondiente para dar soporte consistente a todos los nuevos presets de tiempo.

  - **Optimización de Escalas de Fuente y Legibilidad (`LeadUnifiedKPI.jsx` y `PublicSetterStatsPage.jsx`) [MODIFY]**:

    - **Aumento de Textos e Indicadores**: Se incrementó el tamaño de las fuentes que se encontraban en escalas demasiado reducidas (como `text-[7px]`, `text-[8px]`, `text-[9px]` y `text-[10px]`) en métricas secundarias, tasas de conversión, subtítulos y porcentajes comparativos de los KPIs a escalas más legibles (`text-xs`, `text-sm`, `text-base` y `text-xl`).

    - **Mejora en Tablas y Grids**: Se incrementó el tamaño de la tipografía y el grosor de las barras de progreso de la tabla de pérdida de pasos (Funnel Matrix) y los bloques informativos de conversión de Setters, logrando una interfaz limpia de alta legibilidad en monitores y dispositivos.

  - **Tooltips Descriptivos con Fórmulas de Cálculo en Dashboard de Setters**:

    - **Frontend (Componente Compartido) [NEW] [StatTooltip.jsx](file:///c:/Users/EQUIPO%20DELL/Documents/GitHub/NeurOPS/frontend/src/components/shared/StatTooltip.jsx)**:

      - Creación de un componente premium `StatTooltip` con estética oscura permanente y bordes redondeados. Muestra el nombre del KPI, el valor actual, la explicación de negocio y la fórmula de cálculo exacta al pasar el ratón (hover) sobre los números o porcentajes.

      - Utiliza una sutil decoración de línea punteada (`underline decoration-dotted decoration-indigo-500/50`) para indicar de forma intuitiva al usuario que el elemento posee un tooltip informativo interactivo.

    - **Frontend (Visualización del Embudo Inicial) [MODIFY] [LeadUnifiedKPI.jsx](file:///c:/Users/EQUIPO%20DELL/Documents/GitHub/NeurOPS/frontend/src/components/shared/LeadUnifiedKPI.jsx)**:

      - Integración de `StatTooltip` en todos los números y porcentajes del KPI unificado: Leads Entrantes, Tasa de Respuesta, Respondidos, Sin Respuesta, Leads Cualificados, Tasa de Cualificación sobre Entrantes, Tasa de Cualificación sobre Respuesta y Leads No Cualificados.

    - **Frontend (Estadísticas Generales de Setters) [MODIFY] [PublicSetterStatsPage.jsx](file:///c:/Users/EQUIPO%20DELL/Documents/GitHub/NeurOPS/frontend/src/pages/public/PublicSetterStatsPage.jsx)**:

      - Integración de `StatTooltip` en los KPIs principales: Agendas Generadas, Conversión sobre Leads Reales, Eficacia a Cita, Conversión Openings a Cita, Tasa Follow-Up, y la proporción de Follow-Up Respondidos / Enviados y Calidad de Tráfico.

      - Integración en las columnas de la **Matriz de Pérdida de Pasos** (explicando cada etapa del embudo, la conversión paso a paso y el porcentaje total) y en la **Matriz de Tenacidad en Seguimiento** (explicando los mensajes enviados, respondidos y la tasa de respuesta por etapa).

      - Integración en la tabla de **Rendimiento por Setter** (explicando la cantidad de reportes diarios y la tasa de cumplimiento de reportes).

    - **Frontend (Métricas Conversacionales) [MODIFY] [ConversationalStatsTab.jsx](file:///c:/Users/EQUIPO%20DELL/Documents/GitHub/NeurOPS/frontend/src/pages/public/ConversationalStatsTab.jsx)**:

      - Integración de `StatTooltip` en los 6 principales KPIs de la pestaña conversacional (Mensajes Recibidos, Respuestas Totales, Leads Generados, Leads Cualificados, Agendas Generadas, Ventas Generadas) y sus tasas porcentuales derivadas (Promedio Diario, Tasa Global de Respuesta, Tasa Conversión a Lead, Tasa de Cualificación, Tasa de Agenda y Tasa de Cierre).

- **13 de Junio de 2026**:
  - **Correcciones de Finanzas y Presupuesto de Anuncios (`finance.py` y `FinancePage.jsx`) [MODIFY]**:

    - **Remoción del KPI "Balance en pasarela"**: Eliminado de la interfaz para evitar redundancia y confusión.

    - **Cálculo del Balance Neto**: Se corrigió el cálculo de gastos generales en el resumen financiero de modo que refleje el presupuesto de anuncios configurado en lugar de la inversión en anuncios real de ese periodo.

    - **Pestaña "Presupuesto Anuncios"**: Diseñado e implementado un panel premium Glassmorphic que permite registrar y consultar en tiempo real el presupuesto asignado mensual, el gasto real ejecutado y la diferencia/desviación presupuestaria.

    - **Ajuste de Ahorros**: Se corrigió la fórmula para sumar los ahorros en el balance neto (`A - B + C`) en lugar de restarlos, tanto en el backend como en la etiqueta del frontend.

- **12 de Junio de 2026**:
  - **Estructura Jerárquica y Filtros estilo Meta Ads en Rendimiento por Anuncio (`AdDashboardTab.jsx`) [MODIFY]**:

    - **Navegación por Sub-pestañas**: Se diseñó e implementó un sistema de navegación mediante sub-pestañas integrando los niveles **Campañas**, **Conjuntos de Anuncios** y **Anuncios** (las cuales emulan la experiencia y flujo de Meta Ads Manager).

    - **Agregación de Datos en Memoria**: Cómputo asíncrono y reactivo de las métricas financieras (Inversión, Leads, CPL, % Cualificado, CPQL, Agendas, CPA, Ventas, CPV, Cash Collect y ROAS) agrupadas a nivel de Campaña (`campaignsData`) y Conjunto de Anuncios (`adSetsData`) basándose en los datos generales devueltos por el backend, optimizando el rendimiento sin requerir peticiones de red adicionales.

    - **Filtros Cruzados en Cascada**: Selección interactiva mediante checkboxes individuales y masivos para campañas y conjuntos de anuncios. Al seleccionar elementos superiores:

      - Los acumulados generales del panel de KPIs superior se actualizan reactivamente.

      - Las listas/tablas inferiores se filtran dinámicamente en cascada (mostrando únicamente adsets y ads vinculados a la selección).

      - El gráfico de rendimiento por fuente/setter se recalcula en caliente mostrando agendas correspondientes a los anuncios filtrados.

    - **Píldoras de Filtros Activos**: Integración de una barra con tags o píldoras interactivas de color esmeralda y azul que reflejan las selecciones activas y posibilitan limpiar filtros puntualmente o de forma masiva.

    - **Tablas de Datos Premium**: Se mantuvieron los estándares de diseño Dark Glassmorphism, con compatibilidad de ordenamiento por columnas dinámico y códigos de color semafóricos (basados en HSL y thresholds configurados) para todas las nuevas tablas.

- **11 de Junio de 2026**:
  - **Optimización Responsiva y Scroll en Modales de Agendas y Ventas**:

    - **Estructura Fija de 3 Capas con Viewports Dinámicos (`dvh`) (`FinancialAgendasPage.jsx`, `NewSaleModal.jsx`, `AddAgendaModal.jsx`, `QuickSaleModal.jsx`, `QuickAppointmentModal.jsx`) [MODIFY]**: Se implementó una estructura modular y responsiva separando la Cabecera Fija (Header), el Cuerpo con Scroll Interno (`flex-1 overflow-y-auto min-h-0`) y el Pie de Página Fijo (Footer) que contiene de forma permanente los botones de acción ("Guardar", "Confirmar", "Atrás", etc.) sin requerir scroll y previniendo que queden ocultos. Se limitó la altura máxima de todos los modales usando viewports dinámicos (`max-h-[80dvh]` o `max-h-[78dvh]`) para adaptarse automáticamente al colapsar/expandir el toolbar inferior del navegador en pantallas de móviles, tablets o bajo zoom.

    - **Grids y Layouts Optimizados**:

      - Se reestructuró `AddAgendaModal.jsx` en grids responsivos compactando los inputs del cliente nuevo en doble columna y agrupando Fecha/Hora/Estado/Tipo de cita.

      - Se rediseñó `QuickAppointmentModal.jsx` en un grid lateral de dos columnas (Izquierda: buscador de lead y tipo de agenda; Derecha: selector de día y horarios disponibles), logrando aprovechar el espacio horizontal en pantallas medianas y reduciendo drásticamente la altura.

      - Se unificó el botón "Continuar" del Paso 1 en `NewSaleModal.jsx` con el botón del footer fijo del formulario mediante lógica condicional inteligente.

  - **Pestaña de Leads Entrantes de Manychat en Sección de Setters y Admins**:

    - **API (Backend) (`manychat.py`) [MODIFY]**: Se modificó el endpoint de edición `PUT /api/manychat-webhook/answer/<int:answer_id>` para admitir la actualización del campo `keyword` (palabra clave) de la interacción del lead. Al recibir la modificación, el backend busca de manera automática si existe un anuncio (`Ad`) asociado a esa nueva palabra clave y actualiza el campo `ad_id` de forma acorde, manteniendo una atribución automática óptima.

    - **Interfaz (Frontend) (`IncomingLeadsTab.jsx` y `PublicSetterStatsPage.jsx`) [NEW / MODIFY]**:

      - Se diseñó y creó el componente premium `<IncomingLeadsTab />` bajo una estética Dark Glassmorphic. Este componente incluye filtros de cualificación y búsqueda de leads en tiempo real.

      - **Flujo de Progreso Webhook (FlowProgress)**: Se integró un indicador visual del embudo de Manychat en 4 pasos (*Inbox*, *Mensaje*, *Respuesta*, *Cualificación*) que refleja de forma instantánea el estado del lead a medida que el webhook se ejecuta a lo largo de la conversación.

      - **Edición Inline**: Se implementó la edición inline con controles rápidos (`Check` / `X`) para modificar la palabra clave de un lead directamente sobre la tabla sin necesidad de abrir modales de edición.

      - **Auto-Refresco en Tiempo Real**: Se incorporó un interruptor interactivo que activa un interval de polling cada 5 segundos para actualizar automáticamente la bandeja de leads entrantes sin intervención del usuario.

      - **Tiempo Transcurrido (Tiempo Relativo)**: Se reemplazó la hora absoluta de llegada en la tabla por la visualización del tiempo transcurrido (ej: "Hace 5 min", "Hace 2 horas") mediante un helper formatTimeRelative en IncomingLeadsTab.jsx, dejando la fecha y hora absoluta en un formato secundario y más pequeño abajo para mayor claridad y precisión.

      - Se importó y registró el nuevo componente como una pestaña oficial llamada **"Leads Entrantes"** en el Performance Center de Setters (`PublicSetterStatsPage.jsx`), haciéndola visible y operable tanto para Setters como para Administradores.

  - **Selectores de Opciones Controladas para Ventas Financieras**:

    - **Frontend (`PublicFinancialSalesPage.jsx`) [MODIFY]**:

      - Se implementaron selectores desplegables (`<select>`) controlados para los campos **Programa** (`RR`, `AL`, `SI`), **Tipo de Pago** (`Seña`, `Parcial`, `Cuota`, `Completo`, `Renovación`, `Upsell`), **Método de Pago** (`Stripe`, `PayPal`, `Binance`, `Hotmart`), **Closer** (mapeando `Jean Carlo` al correo `jeancarlo@thelearnation.com`), y **Setter** (`workshop`, `vsl`, `Elias`) tanto en la edición inline de la tabla como en el modal de creación de nueva venta (`showCreateModal`).

      - Cada selector cuenta con una opción de *"Otro / Agregar nuevo..."*. Al seleccionarla, se despliega dinámicamente un input de texto de forma condicional que permite escribir un valor personalizado de texto libre.

      - Se modificó la etiqueta visual de Setter en la columna de roles de la tabla de `S:` a `F:` (Fuente) de forma coherente con las instrucciones del usuario.

  - **Cálculo de Comparación Temporal al Mes Anterior en Dashboards**:

    - **Backend (APIs de Estadísticas) (`setter.py`, `closer.py`, `conversational.py`) [MODIFY]**:

      - Se reemplazó el cálculo de comparación temporal de ventana deslizante simple (que retrocedía el número de días de la ventana) por un cálculo de mes calendario anterior exacto.

      - Se implementó la función auxiliar `_subtract_one_month` (y `_subtract_one_month_dt` para `datetime` en `conversational.py`) para restar un mes calendario de forma segura y tolerante a diferencias de duración de meses (ej: manejando correctamente días inexistentes al final del mes anterior).

      - Se actualizaron los endpoints `/public/setter-stats`, `/public/closer-stats` y `/stats/conversational` para devolver datos comparativos correspondientes al mismo rango de fechas pero del mes anterior calendario exacto.

  - **Integración del Porcentaje de Cancelaciones e Inasistencias en el Dashboard de Closers**:

    - **Frontend (`CloserPerformanceTab.jsx`) [MODIFY]**:

      - Se integró el desglose detallado de **No Show Rate (Inasistencias %)** y **Cancel Rate (Cancelaciones %)** en el pilar estratégico de Productividad y Agendamiento.

      - Ambos indicadores muestran sus valores porcentuales correspondientes al periodo consultado y su respectiva comparación con el mes anterior calendario, complementando la tasa de asistencia (Show Rate) y la cantidad absoluta de reuniones no concretadas.

  - **Tooltips Descriptivos Interactivos al hacer Hover en KPIs**:

    - **Frontend (`CloserPerformanceTab.jsx`) [MODIFY]**:

      - Se diseñó el componente utilitario `MetricWithTooltip` para renderizar tooltips flotantes en HTML de diseño glassmorphism flotante sobre cualquier elemento sin romper la maquetación CSS flex/grid.

      - Se envolvieron todos los números e indicadores clave del Pilar 1 (ingresos brutos, netos, cuotas, señas y nuevas ventas), Pilar 2 (ventas, close rate, ticket promedio y conversión de señas) y Pilar 3 (asistencias, show rate, no show rate, cancel rate, pitch rate e inasistencias totales) con descripciones precisas de negocio que aparecen al pasar el mouse por encima de los números.

- **10 de Junio de 2026**:
  - **Corrección y Estandarización de Estado de Ventas ("Confirmada" a "Completada")**:

    - **API Backend (`financial_sales.py` y `finance.py`) [MODIFY]**: Se actualizó el filtro `sale_is_completed` para que considere como completadas las ventas con estado `"Confirmada"` además de `"Completada"`. Esto soluciona la omisión de las ventas "Confirmadas" en los totales de los dashboards y comisiones. Asimismo, se modificaron los endpoints de creación (`POST /public/financial-sales/new`) y actualización (`PUT /public/financial-sales/<id>`) para mapear automáticamente el valor `"Confirmada"` a `"Completada"`.

    - **Servicio de Sincronización (`sheets_service.py`) [MODIFY]**: Se modificaron los métodos `post_to_sheets` y `_rebuild_sales` para normalizar en caliente el estado `"Confirmada"` a `"Completada"` al guardar localmente o reconstruir registros desde Google Sheets. Esto asegura que la base de datos almacene de manera consistente `"Completada"`.

    - **Frontend (Formulario de Ventas) (`NewSalePage.jsx`) [MODIFY]**: Se reemplazó la opción y el valor por defecto `"Confirmada"` por `"Completada"` en el formulario de declaración de ventas manuales de los closers. Se agregó el campo `"Documento de identidad"` (`documento_identidad`) en el formulario de ventas de los closers.

    - **Webhook n8n y Backend (`sheets_service.py` y `financial_sales.py`) [MODIFY]**: Se integró el envío del nuevo campo `"Documento de identidad"` en el webhook asíncrono hacia n8n (`_trigger_n8n_webhook`) y en el endpoint de creación de ventas manuales.

  - **Soporte para Tipo de Pago "Upsell"**:

    - **Frontend (`NewSalePage.jsx` y `PublicFinancialSalesPage.jsx`) [MODIFY]**: Se añadió la opción `"Upsell"` en los selectores de tipo de pago del formulario de closers y del modal de registro de ventas del administrador. Se asignó un código de color rosa (`text-pink-400 bg-pink-500/10`) para identificar visualmente las ventas tipo Upsell en el dashboard.

    - **API Backend (`financial_sales.py`) [MODIFY]**: Se modificó `parse_financial_data` para reconocer `"upsell"` en la columna de tipo de pago y parsearlo correctamente como `"Upsell"` sin arrojar errores de validación.

  - **Botón "Enviar mensaje de WhatsApp" y Campo "enviar_mensaje" para n8n**:

    - **Frontend (`NewSalePage.jsx` y `PublicFinancialSalesPage.jsx`) [MODIFY]**: Se renombró el switch de automatización en los formularios de ventas manuales a "Enviar mensaje de WhatsApp" con una descripción adaptada. Se modificó el estado local para utilizar `enviar_mensaje` (por defecto `true`). Al enviar la venta, se transmite el valor de `enviar_mensaje` y se fuerza `enviar_webhook: true` para garantizar que la automatización de n8n siempre reciba la venta y filtre mediante el booleano en una rama del flujo.

  - **Fecha de la Venta Obligatoria al Inicio de los Formularios**:

    - **Frontend (`NewSalePage.jsx` y `PublicFinancialSalesPage.jsx`) [MODIFY]**: Se agregó/movió el campo "Fecha de la Venta *" al inicio de los formularios de venta (en la sección de datos y en el modal de creación) estableciendo validación de obligatoriedad en el envío. Se genera la `marca_temporal` usando la fecha seleccionada y la hora local actual.

  - **Reversión de Parseo de Fechas (Revert de `dayfirst=True`) y Restauración**:

    - **Backend (`sheets_service.py`, `financial_sales.py`, `financial_agendas.py`) [REVERT]**: Se revirtió el uso de `dayfirst=True` en `parser.parse` debido a efectos colaterales no deseados al editar manualmente fechas ISO (como `2026-05-01` que se interpretaba como el 5 de enero).

    - **Bases de Datos (SQLite y PostgreSQL Prod) [RESTORE]**: Se ejecutó el script `restore_sales_dates.py` para re-parsear las fechas de las ventas y agendas según el comportamiento original por defecto (sin `dayfirst`), restaurando la consistencia y permitiendo al usuario corregir las fechas problemáticas de forma manual.

  - **Redirección del Botón Registrar Venta**:

    - **Frontend (`PublicFinancialSalesPage.jsx`) [MODIFY]**: Se modificó la acción del botón "Registrar Venta" en el panel de administración para que redirija mediante `useNavigate` a la ruta `/closer/sales/new` en lugar de abrir el modal interno de creación de ventas, unificando la experiencia de declaración de ventas en una sola vista.

  - **Implementación de Parseador de Fechas Dinámico y Robusto**:

    - **Backend (`sheets_service.py`, `financial_sales.py`, `financial_agendas.py`) [MODIFY]**: Se implementó una función `parse_date_robustly` que detecta dinámicamente el formato del string recibido. Si la cadena corresponde al formato de fecha del selector del navegador/ISO (`YYYY-MM-DD`), la procesa con `dayfirst=False`. Si corresponde al formato de marca temporal español con barras diagonales (`DD/MM/YYYY`), la procesa con `dayfirst=True`. Esto blinda el backend contra inconsistencias al guardar o editar manualmente registros.

  - **Búsqueda e Integración de Leads desde Google Sheets (FinancialAgenda)**:

    - **API Backend (`closer.py`) [MODIFY]**: Se optimizó el endpoint `GET /leads/search` para buscar prospectos concurrentemente en la tabla local de `Client` y en la tabla de agendas históricas de Google Sheets (`FinancialAgenda`). El endpoint consolida ambos resultados omitiendo duplicados mediante sets de emails e Instagrams normalizados. Los resultados de `FinancialAgenda` que no existen en el CRM local se envían al frontend con `id: null` y cargando los datos de la agenda (Setter, Instagram, Email, Teléfono, etc.) para que se autocomplete de inmediato el formulario. Esto permite registrar ventas a prospectos agendados en fechas pasadas (como el 24 de abril) cuyos datos no se habían plasmado aún en un registro de cliente local.

  - **Corrección en Buscador del Registro de Agendas**:

    - **API Backend (`financial_agendas.py`) [MODIFY]**: Se corrigió un error lógico en el endpoint `GET /public/financial-agendas` donde la variable `query` (que almacena el filtro de búsqueda por texto `search`) era sobrescrita por `date_query` (que solo contiene filtros de fecha). Ahora la asignación de variables se realiza en la secuencia correcta, permitiendo que las búsquedas por texto funcionen correctamente en el panel de control y tablas de agendas.

  - **Corrección en Sincronización de Edición de Ventas (Campos Dinámicos)**:

    - **API Backend (`financial_sales.py`) [MODIFY]**: Se modificó la respuesta JSON del endpoint `PUT /public/financial-sales/<int:sale_id>` para calcular y adjuntar todos los campos dinámicos (`programa`, `tipo_pago_simple`, `monto_bruto`, `monto` ajustado, `closer_name`, `setter` y `has_agenda`). Esto previene que al guardar la edición de una venta el frontend pierda temporalmente estos campos en el estado de React (que causaba que el "tipo de pago" o "programa" se vieran como "N/A" o no se actualizaran en caliente hasta refrescar la página).

- **8 de Junio de 2026**:
  - **Diseño e Implementación del CRM Lead Roadmap Unificado**:

    - **API Backend (Agregación Multi-fuente) (`lead_roadmap.py`) [NEW MODULE]**: 

      - Creación del nuevo controlador de API `@bp.route('/public/lead-roadmap')` que reúne y consolida en un solo JSON estructurado de 6 etapas la trayectoria del lead: 1) *Llegó* (ManyChat creation/keywords), 2) *Contactó* (primeras interacciones de bot o citas), 3) *Dolor* (calificaciones y encuestas de dolor), 4) *Agenda* (citas de sheets o locales), 5) *Llamada* (resultado y notas de closer), y 6) *Venta* (desglose financiero, métodos y cuotas).

      - Módulo registrado en `app/api/public/__init__.py`.

      - Incorporación de la ruta `POST /public/lead-roadmap/update-client` para crear o actualizar en caliente perfiles de `Client`.

      - Incorporación de la ruta `POST /public/lead-roadmap/relate-event` para vincular manualmente por Instagram una agenda (`FinancialAgenda`) o venta (`FinancialSale`) específica a un Lead.

    - **Interfaz de Línea de Tiempo Premium (`LeadRoadmapDetail.jsx`) [NEW COMPONENT]**:

      - Diseño Glassmorphism Dark de alta gama con iconos y colores HSL. Muestra un avatar de perfil del lead, metadatos del anuncio, una línea de tiempo interactiva de 6 etapas, tabla cronológica de todos los micro-eventos (actividad), y desgloses de recaudación, dolores e historial de comentarios con funcionalidad de añadir comentarios en caliente.

    - **Modal Global Reactivo (`LeadRoadmapModal.jsx`) [NEW COMPONENT]**:

      - Modal animado con `framer-motion` que carga de manera dinámica `LeadRoadmapDetail` pasándole el Instagram, email, teléfono o client_id del prospecto.

    - **Modificaciones en la Cartera de Clientes (`ClientsPage.jsx`) [MODIFY]**:

      - Reescritura del flujo: la tabla de clientes de la cartera sigue sirviendo como buscador principal. Al hacer clic en un cliente, el listado cambia fluidamente a la espectacular vista del Roadmap de Lead del cliente con herramientas para editar perfil o asociar ventas/agendas, incluyendo botón para volver al listado general.

    - **Llamado a Modal en Registros de Agendas y Ventas (`PublicFinancialSalesPage.jsx` y `FinancialAgendasPage.jsx`) [MODIFY]**:

      - Modificación de las tablas de Registro de Ventas y Registro de Agendas para que al hacer clic en el nombre del prospecto (el cual ahora se renderiza de color indigo/underline al hacer hover) se abra el modal interactivo de Lead Roadmap para ver sus detalles en caliente y corregir datos incorrectos o faltantes.

    - **Refinamiento de Eventos de la Línea de Tiempo (`lead_roadmap.py`) [MODIFY]**:

      - Se eliminó el evento redundante `"Cita Local Agendada"` para evitar duplicaciones en el historial de eventos del CRM.

      - Se formateó la fecha en el evento `"Agenda Creada"` usando una función utilitaria en español (`format_datetime_es`) para mejorar drásticamente la legibilidad (ej: `"08 jun 2026, 14:00 hs"`).

  - **Optimización y Flexibilidad en el Registro de Agendas (Filtro por Tipo de Fecha)**:

    - **API Backend (`financial_agendas.py`) [MODIFY]**: Se añadió soporte en el endpoint de listado `GET /public/financial-agendas` para el parámetro `date_filter_by` ('meet' o 'created'). Permite filtrar el rango de fechas y ordenar los registros dinámicamente ya sea por fecha de la reunión (`date`/`fecha_meet`) o por fecha de creación/registro (`registro`), usando comparaciones directas de cadenas para mantener compatibilidad e independencia de la base de datos (SQLite/PostgreSQL) sin necesidad de migraciones.

    - **Interfaz (Frontend) (`FinancialAgendasPage.jsx`) [MODIFY]**:

      - Se añadió la columna **F. Creación** (mostrando el momento en que se registró la cita) lado a lado con la columna **F. Reunión** (fecha del encuentro/meet) en la tabla del historial.

      - Se integró un hermoso y fluido switch/botón deslizable con estética Dark Glassmorphism ("Fecha Meet" vs "F. Creación") en la barra de filtros superiores. Al alternar este switch, se cambia de forma reactiva el criterio de filtrado por fechas y de ordenación de los registros.

      - Se corrigieron los anchos de columna y el `colSpan` de los estados vacíos a 8 columnas de forma coherente.

  - **Corrección de Fechas y Atribución de Fuentes en Lead Roadmap**:

    - **API Backend (`lead_roadmap.py`) [MODIFY]**:

      - Se corrigió la resolución del nombre completo del cliente en `lead_profile["full_name"]` para leer del campo `lead` (nombre real del cliente) de la agenda en lugar del campo `nombre` (que almacena al Setter/Fuente), evitando nombres de setters en la ficha principal.

      - Se reestructuró la resolución de la fecha de creación del lead (`created_at`) en el perfil y las etapas para usar el campo de registro de la agenda más antigua (`registro`) o de la venta original (`marca_temporal`) en lugar de usar la fecha de la cita oficial (`date`) o la fecha de inserción local (`created_at`), resolviendo el error de "no hay fecha de creación".

      - Se corrigió la fecha del evento `"Agenda Creada"` en la actividad para basarse en la fecha de registro original (`fa.registro`) en lugar del timestamp de sincronización local, lo que previene que los eventos se dupliquen o se agrupen con fecha de hoy.

      - Se corrigió el detalle del evento `"Agenda Creada"` y la etapa `"4. Agenda"` para mostrar la fuente real del setter/origen en base a `fa.nombre` (ej: Elias, workshop, vsl, etc.) en lugar de `fa.lead` (que imprimía nombres de otros leads).

    - **Interfaz (Frontend) (`LeadRoadmapDetail.jsx`) [MODIFY]**: Se implementó un formateo seguro y controlado de la fecha de creación del lead (`lead.created_at`) mediante una verificación asíncrona para evitar posibles errores de renderizado de fechas nulas o con formatos incorrectos.

  - **Actualización y Sincronización de Base de Datos Local**:

    - **Refactorización de Sincronizador (`actualizar_db.py`) [MODIFY]**: Se actualizaron las importaciones y la lista ordenada de modelos `modelos` para incluir todos los modelos del proyecto (incluyendo `ClientComment`, `event_closers`, `Availability`, `WeeklyAvailability`, `SurveyQuestion`, `PaymentMethod` y `ManychatAdLead`) ordenados adecuadamente por jerarquía de claves foráneas.

    - **Sincronización Exitosa**: Se ejecutó exitosamente el script de sincronización con el entorno virtual (`env\Scripts\python.exe actualizar_db.py`), importando con éxito todos los miles de registros de campañas, anuncios, agendas, leads, citas, ventas y pagos desde la base de datos en producción (PostgreSQL) a la base de datos local SQLite (`instance/local.db`).

  - **Corrección de Fecha N/A, Control de Duplicados de Agendas y Eliminación Manual**:

    - **Base de Datos y Modelos (`financial.py`) [MODIFY]**: Se modificó `to_dict` en la clase `FinancialAgenda` para incorporar un fallback seguro hacia `created_at` si el campo `registro` es nulo o vacío. Esto soluciona de inmediato el problema donde todos los registros en producción mostraban "N/A" como fecha de creación.

    - **Backend (API de Agendas) (`financial_agendas.py`) [MODIFY]**:

      - Se adaptó `receive_financial_agendas` (POST) para persistir el campo `registro` de forma explícita al insertar nuevas agendas.

      - **Prevención de Duplicados**: Se implementó una lógica de unicidad que valida si ya existe una agenda programada para el mismo prospecto (cruzando su Instagram, Email o Whatsapp) el mismo día de la cita. En caso afirmativo, actualiza sus campos (closer, fecha, estado, raw_data) en lugar de crear un registro duplicado.

    - **Backend (API de Roadmap) (`lead_roadmap.py`) [MODIFY]**: 

      - Se modificó el listado de actividades (`activity`) de `get_lead_roadmap` para adjuntar de manera explícita el `id` y el tipo de evento (`event_type` como `"agenda"` o `"sale"`) en las actividades cronológicas originadas en agendas y ventas.

      - **Ocultar Hora de Agendas**: Se incorporó la función `format_date_es` para formatear el evento `"Agenda Creada"` mostrando únicamente el día, mes y año de la cita de agenda sin la hora ni los minutos.

      - **Fusión de Duplicados**: Se implementó una lógica de deduplicación (en caliente) en el endpoint para que, si un cliente posee múltiples registros de agendas o ventas programadas en el mismo día, solo se liste un único evento consolidado en el historial de actividades cronológicas.

      - **Blindaje de Búsqueda Cruzada contra Datos Genéricos (Bugfix Mezcla de Datos)**: Se definió el helper `is_generic_val` y se adaptó la res       - **Ajuste de Visualización**: Se adaptó el formateador `formatTime` del componente para que, al procesar eventos del tipo `"agenda"`, no muestre la hora y sólo pinte la fecha correspondiente.  - **Rediseño Premium "CEO Edition" y Calificación en Caliente en el Lead Roadmap**:

    - **Base de Datos y Modelos (`app/models/client.py`) [MODIFY]**: Se añadieron las columnas `objeciones` (db.Text) y `observaciones` (db.Text) a la clase `Client` para permitir que los setters y closers registren información estructurada sobre la calificación. Se generó y aplicó la migración correspondiente en local.

    - **Backend (API) (`lead_roadmap.py`) [MODIFY]**:

      - Se actualizaron los resolvedores para importar e integrar los modelos `Enrollment` y `Program`.

      - Se actualizó el endpoint `GET /api/public/lead-roadmap` para inyectar los nuevos campos `objeciones` y `observaciones` en el perfil del cliente, y para calcular y retornar el listado de programas activos del cliente con su fecha de inscripción, monto pagado y permanencia (tiempo transcurrido calculado dinámicamente en meses y días).

      - Se actualizó el endpoint `POST /api/public/lead-roadmap/update-client` para recibir y persistir en caliente las objeciones y observaciones del cliente en la base de datos.

    - **Frontend (UI) (`LeadRoadmapDetail.jsx` y `LeadRoadmapModals.jsx`) [MODIFY/NEW]**:

      - **Estructura y Modularización (Token-Efficient)**: Se extrajeron los modales de edición de lead (`EditLeadModal`) y de vinculación de eventos (`LinkEventModal`) al nuevo archivo [LeadRoadmapModals.jsx](file:///c:/Users/EQUIPO%20DELL/Documents/GitHub/NeurOPS/frontend/src/components/leads/LeadRoadmapModals.jsx) para mantener el archivo principal [LeadRoadmapDetail.jsx](file:///c:/Users/EQUIPO%20DELL/Documents/GitHub/NeurOPS/frontend/src/components/leads/LeadRoadmapDetail.jsx) por debajo de la regla estricta de 500 líneas (quedando en 450 líneas) y permitiendo un mantenimiento más ágil.

      - **Cabecera de Adquisición (CEO Trayectory Overview)**: Se rediseñó la cabecera del prospecto para detectar automáticamente y pintar en badges el canal de entrada (`ManyChat / Instagram`, `Workshop / WhatsApp` o `VSL / Bio Instagram`), la permanencia acumulada en el ecosistema en días, y los nombres explícitos del setter y closer asignados.

      - **Panel de Calificación en Caliente**: Se integró una sección en la barra lateral derecha para que los setters y closers registren y guarden en un solo clic las objeciones y observaciones de triage. Incluye píldoras/botones interactivos con atajos para objeciones comunes (Precio, Tiempo, Socio, Prioridad, Garantía) que permiten autocompletar el campo rápidamente.

      - **Sección de Permanencia en Programas**: Se diseñó una tarjeta visual premium que muestra todas las membresías del cliente, indicando la fecha de inicio, la inversión acumulada y la permanencia exacta del alumno en dicho programa. Ahora resuelve el programa de forma complementaria desde la base de datos de ventas (`FinancialSale`) si el lead no posee un registro formal de matrícula (`Enrollment`), mostrando un badge que indica la procedencia del dato (`Matrícula` o `Venta Declarada`).

  - **Implementación Completa del Hub de Finanzas (`/admin/finance`)**: Se creó una vista de finanzas privada, accesible solo para administradores con el permiso `can_view_finance`, con 4 pestañas funcionales.

    - **Modelos de Base de Datos (`app/models/financial.py`) [NEW MODELS]**:

      - `TeamMember`: Integrante del equipo con nombre, rol, tipo de sueldo (`fijo` / `variable`), sueldo base y método de pago por defecto.

      - `MonthlyPayroll`: Registro de nómina mensual por integrante, con sueldo base, comisiones calculadas automáticamente, bonos, método de pago y estado de pago (`is_paid` / `paid_at`).

      - `MonthlyPaymentMethodBalance`: Balance mensual por pasarela de pago con monto real y monto esperado (para detectar diferencias).

      - `MonthlySaving`: Registro manual de ahorros por mes.

    - **Modelo de Usuario (`app/models/user.py`) [MODIFY]**: Se añadió la columna `can_view_finance` (Boolean, default False) para controlar el acceso granular a la vista de finanzas.

    - **Migración (`migrations/`) [NEW]**: Se ejecutaron `flask db migrate` y `flask db upgrade` para aplicar los 4 nuevos modelos a la base de datos local y de producción.

    - **Backend API Financiera (`app/api/public/finance.py`) [NEW FILE]**:

      - Decorador `finance_admin_required`: Valida que el usuario esté autenticado y tenga `role=admin` y `can_view_finance=True`.

      - `GET/POST /public/finance/team-members`: CRUD completo de integrantes del equipo.

      - `PUT/DELETE /public/finance/team-members/<id>`: Editar y eliminar integrantes.

      - `GET/POST /public/finance/payroll?month=YYYY-MM`: Listado y guardado de nómina mensual, con cálculo automático de comisiones de Elias (8% setter), Jean Carlos (10% closer) y Marlon (5% en ventas no renovación) basado en `FinancialSale` del período.

      - `GET/POST /public/finance/balances?month=YYYY-MM`: Registro de balances reales y esperados por pasarela (Stripe, AirTM, PayPal, Wise, Banco, Hotmart).

      - `GET/POST /public/finance/savings?month=YYYY-MM`: Ingreso manual de ahorros mensuales.

      - `GET /public/finance/summary?month=YYYY-MM`: Resumen financiero completo (ingresos netos, gastos por categoría, profit, balance y balance neto).

    - **Permisos Backend (`app/api/admin.py`) [MODIFY]**: Se actualizaron los endpoints `POST /admin/users` y `PUT /admin/users/<id>` para leer y guardar el campo `can_view_finance`. Asimismo, se añadió soporte de `start_date` y `end_date` como query params en `GET /admin/finance/overview` para filtrar gastos por el mes seleccionado desde el frontend.

    - **Auth Backend (`app/api/auth.py`) [MODIFY]**: Se inyectó `can_view_finance` en las respuestas de `/auth/me` y `/auth/login`.

    - **Navegación (`frontend/src/hooks/useDockNavigation.js`) [MODIFY]**: El item "Finanzas" con ruta `/admin/finance` se muestra únicamente si `user.role === 'admin' && user.can_view_finance`.

    - **Ruta Protegida (`frontend/src/App.jsx`) [MODIFY]**: Se registró la ruta `/admin/finance` con `<ProtectedRoute roles={['admin']}>`.

    - **Toggle de Acceso (`frontend/src/pages/admin/team/TeamManagementPage.jsx`) [MODIFY]**: En la gestión de usuarios con rol `admin`, se agregó un toggle interactivo para activar/desactivar el permiso `can_view_finance` individualmente.

    - **Dashboard Financiero (`frontend/src/pages/admin/reports/FinancePage.jsx`) [NEW FILE]**:

      - **Tab Resumen**: KPIs de Profit, Ingresos, Gastos y Balances en pasarelas. Distribución de gastos por categoría (Sueldos, Anuncios, Software, Equipos) e ingresos por método de pago. Panel de Balance General y Balance Neto con campo manual de Ahorros.

      - **Tab Medios de Pago**: Tabla editable por pasarela con campos `Lo que hay (real)` y `Lo que debe haber (esperado)`, calculando automáticamente la diferencia.

      - **Tab Nómina (Equipo)**: Tabla de nómina mensual con sueldo base, comisión (pre-calculada para Setters/Closers), bonos, medio de pago y checkbox de pagado. CRUD de integrantes via modal. Comisiones de Elias/Jean Carlos/Marlon se calculan automáticamente desde ventas del mes y son editables manualmente.

      - **Tab Software / Equipos**: Formulario para registrar gastos de categoría `software` y `equipo` filtrados por el mes seleccionado. Lista completa con opción de eliminar.

  - **Correcciones y Ajustes del Hub de Finanzas** (mismo día, feedback del usuario):

    - **Clarificación Conceptual**: "Equipo" = trabajadores de la empresa (Belu, Pedro, Andrés, Kerwin, Santiago con sueldo fijo; Elias, Jean Carlos, Marlon con sueldo variable por comisiones). No hardware/equipamiento.

    - **Backend API (`finance.py`) [MODIFY]**:

      - Se eliminó la query `equipo_expenses` (hardware) del cálculo de `get_finance_summary`, ya que los sueldos del equipo están cubiertos por `total_sueldos`.

      - Se actualizó `total_expenses = total_software + total_anuncios + total_sueldos` (sin hardware).

      - Se eliminó `"equipo"` del dict `expenses_breakdown` en la respuesta JSON.

      - En `manage_balances`, se redujo `default_methods` a solo `['Stripe', 'AirTM']` (se eliminó PayPal, Wise, Banco, Hotmart).

      - El campo `expected_amount` en balances ahora se **auto-calcula** desde la nómina del mes (`MonthlyPayroll` + `TeamMember`), sumando el total a pagar por cada pasarela. Ya no es un valor manual almacenado.

    - **Frontend (`FinancePage.jsx`) [MODIFY]**:

      - **Tab Resumen**: Distribución de gastos cambiada de 4 a 3 categorías (eliminado "Equipamiento"), renombrado "Sueldos y Nómina" a "Equipo (Nómina)". Grid de 2 columnas → 3 columnas.

      - **Tab Medios de Pago**: Columnas renombradas a "Saldo Actual" (editable) y "Por Pagar (Nómina)" (solo lectura, auto-calculado desde backend). Se agregó fila de **Total** al pie de la tabla. Se eliminaron PayPal, Wise, Banco y Hotmart; solo Stripe y AirTM.

      - **Tab Nómina**: La tabla se dividió en dos secciones claramente diferenciadas: **Equipo Fijo** (sueldo estable) y **Equipo Variable (Comisiones)**, separadas por filas cabecera con indicadores de color (índigo/esmeralda). El `select` de medio de pago en cada fila ahora solo muestra Stripe y AirTM.

      - **Tab Software**: Eliminada la opción "Equipos / Hardware" del select de categoría. El tab fue renombrado de "Software / Equipos" a "Software". El filtro de fetch solo incluye categoría `software`.

      - **Modal de Equipo**: El `select` de medio de pago en el formulario de nuevo/editar integrante ahora solo muestra Stripe y AirTM.

- **6 de Junio de 2026**:
  - **Mejora del Registro de Agendas (Nuevos Estados y Filtros)**:

    - **Base de Datos local (SQLite/PostgreSQL) (`financial.py`) [MODIFY / MIGRATION]**: Se añadió el campo `estado` al modelo `FinancialAgenda` con valor por defecto `'Pendiente'` y se aplicaron las migraciones correspondientes (`add_estado_to_financial_agenda`). Se actualizó además el método `to_dict` para serializar la nueva columna.

    - **Backend (API) (`financial_agendas.py`) [MODIFY]**:

      - Se adaptó `receive_financial_agendas` (POST) para persistir el estado proveniente del payload o usar `'Pendiente'`.

      - Se adaptó `update_financial_agenda` (PUT) para permitir la actualización de la propiedad `estado`.

      - Se modificó `get_financial_agendas` (GET) para soportar filtros combinados por `estado`, `closer` y `fuente` (que mapea a `nombre` en base de datos), consultando además listas ordenadas de valores únicos (`unique_states`, `unique_closers`, `unique_sources`) para poblar dinámicamente los selectores en el frontend.

      - **Corrección de Filtros (Restricción por Periodo y Sanitización)**: Se modificaron las consultas de `unique_closers` y `unique_sources` para restringirlas estrictamente al subconjunto del periodo de fechas seleccionado (`date_query`). Adicionalmente, se implementó un algoritmo heurístico en la API que analiza y descarta registros con múltiples palabras largas en el campo de fuente (identificando nombres propios de clientes reales para eliminarlos del dropdown selector).

    - **Interfaz (Frontend) (`FinancialAgendasPage.jsx`) [MODIFY]**:

      - Se añadieron estados para almacenar los arrays de valores únicos del backend.

      - Se expandió `usePersistentFilters` para almacenar y persistir los filtros `estado`, `closer` y `fuente`.

      - **Rediseño de Layout de Filtros (Ergonomía)**: Se reestructuró la cabecera integrando los paneles de KPIs globales (`Total Agendados` y `Próximas Citas`) directamente al lado del título principal para optimizar espacio vertical. El input de búsqueda textual se reubicó a la derecha de la cabecera.

      - **Barra de Control Unificada**: Se diseñó una barra de filtros unificada y dedicada (`Control Bar`) posicionada justo debajo del header principal con estética Glassmorphism, que agrupa por bloques los presets rápidos, los inputs de fecha (desde/hasta) y los tres selectores dropdowns (`Estado`, `Closer`, `Fuente`), incorporando además un botón interactivo representado por el icono `FilterX` de lucide-react para resetear todos los filtros activos al instante.

      - Se actualizó el listado en la tabla reemplazando el Badge estático por un selector dropdown interactivo (`select`) en línea. Este selector aplica estilos CSS reactivos de acuerdo con el estado seleccionado (respetando la paleta HSL del tema) y ejecuta de forma asíncrona un llamado `PUT /public/financial-agendas/<id>` para actualizar el estado del registro en caliente al instante al cambiar la opción.

      - Se integró el selector dropdown de estado en el modal de edición de agenda, garantizando la sincronización bidireccional y recálculo instantáneo al guardar cambios.

      - **Desglose de KPIs de Agendas por Closer y Fuente [NEW FEATURE]**:

        - **Backend (API)**: El endpoint `GET /public/financial-agendas` ahora agrupa y retorna la cantidad de agendas por cada estado y combinación Closer-Estado/Fuente-Estado (`by_closer_state` y `by_source_state`) y calcula valores únicos dinámicamente de forma sanitizada.

        - **Frontend**: Se integró un grid de dos columnas de diseño Glassmorphism con tablas interactivas de desglose por Closer y por Fuente. Muestran para cada entidad los conteos de agendas en cada estado (Pendiente, Show Up, No show, Reagendada, Cancelada), el total, y calcula dinámicamente el **Show Rate** (porcentaje de Show Up respecto al total de citas atendidas: Show Up + No show) para una rápida toma de decisiones.

      - **Mejoras de CEO en el Mazo de Closers (/closer/deck) [NEW FEATURE]**:

        - **Backend (API) (`closer.py`) [MODIFY]**: Se modificaron las rutas `/deck` y `/deck/card/<appt_id>` para inyectar mediante el helper `_format_appointment_for_deck` la lista de respuestas de encuestas (`survey_answers`), `client_id`, `setter_id` y `setter_name` directamente en el payload de las citas.

        - **Frontend (UI) (`CloserDeckPage.jsx` y `QuickSaleModal.jsx`) [MODIFY]**:

          - Se integró el panel colapsable del **Perfil de Triage** para ver las respuestas de calificación del lead al instante.

          - Se añadieron **acciones de contacto alternativo** mediante botones premium de WhatsApp (con mensaje personalizado) y Email al lado del link de Instagram.

          - Se implementó la visualización del **Historial de Eventos** (Línea de tiempo) y Comentarios en la barra lateral derecha a través de pestañas deslizables.

          - Se agregó el botón **Registrar Venta** dinámico (visible si result es "Asistió"). Al hacer clic, abre `QuickSaleModal` pre-completando los datos de este lead (id, nombre, email) de forma transparente y sin fricciones operativas.

  - **Integración de Webhook de Ventas a n8n y Toggle de Automatización**:

    - **API Backend (`sheets_service.py` y `financial_sales.py`) [MODIFY]**: 

      - Implementación de un flujo no bloqueante (mediante un subhilo en segundo plano `threading.Thread`) en `SheetsService.post_to_sheets`. Cada vez que se registra y confirma una nueva venta local en `Ventas_DB` (a través de Closers o Administradores), se disparará un POST HTTP a la URL definida en la variable de entorno `N8N_WEBHOOK_URL` o `VENTAS_WEBHOOK`.

      - Se modificaron `SheetsService.post_to_sheets` y la ruta intermedia de creación de venta en `/public/financial-sales/new` para capturar el parámetro boolean `enviar_webhook` en el payload de la venta y así omitir el envío a n8n si el usuario lo desactiva.

    - **Formato Compatible**: Los datos se envían en un payload JSON que incluye tanto las claves originales en inglés como las claves en español solicitadas (`Nombre`, `Monto abonado`, `Setter`, `Instagram`, etc.), garantizando compatibilidad inmediata en el nodo de n8n.

    - **Frontend (`NewSalePage.jsx` y `PublicFinancialSalesPage.jsx`) [MODIFY]**: Se diseñó e integró un switch deslizable interactivo con el label *"Automatización (n8n)"* en los formularios de registro de ventas del Closer y del Administrador. Por defecto se inicializa en `true` para asegurar el flujo automatizado habitual, pero permite al vendedor desactivarlo manualmente antes de enviar los datos a la base local y Google Sheets.

  - **Optimización y Refinamiento de la Barra de Filtros en el Registro de Ventas**:

    - **Interfaz (Frontend) (`PublicFinancialSalesPage.jsx`) [MODIFY]**:

      - **Redistribución y Simetría**: Se rediseñó la Fila Principal de filtros para compactar el Buscador (`Search`), el selector de rango de fecha (`Calendar`/`input[type="date"]`) y los presets rápidos de fecha (`Hoy`, `Este Mes`, `Mes Anterior`, `30 días`) en una sola línea responsiva de alta densidad (`grid-cols-12`). Esto elimina la fila independiente de presets que causaba asimetría visual y consumía valioso espacio en pantalla.

      - **Dimensiones y Proporciones Finas**: Se redujo la altura y paddings de los elementos de control (`py-2`, `text-xs`) y se acotaron los márgenes para lograr una integración armoniosa que requiere el mínimo espacio vertical pero mantiene total funcionalidad y legibilidad táctil/de ratón.

      - **Filtros Avanzados Compactados**: Se refinó la cuadrícula de los 5 selects de control avanzados (`Programa`, `Tipo de Pago`, `Método`, `Closer`, `Fuente`) reduciendo su padding lateral e interno, disminuyendo los iconos a `w-3.5 h-3.5` y reduciendo el espaciado vertical (`gap-1`) para mantener coherencia geométrica de alta gama visual.

- **5 de Junio de 2026**:
  - **Refactorización de Filtros y Corrección de Crash en el Dashboard de Closers (Rendimiento)**:

    - **Interfaz (Frontend) (`PublicCloserStatsPage.jsx`) [MODIFY]**: Se eliminó el `useEffect` dependiente que calculaba las fechas en base a un selector de preset, el cual causaba renders innecesarios y estados conflictivos. Se refactorizó la lógica para almacenar las fechas iniciales directamente en el estado y actualizarlas en caliente. Se añadieron botones premium para filtrado rápido por periodos (**Hoy**, **Ayer**, **Mes anterior**, **Este mes**, **Últimos 30 días**) alineados con el diseño Dark Glassmorphism del dashboard de ventas financieras, resolviendo la pantalla en blanco y haciendo el flujo de filtros 100% estable sin necesidad de recargar la página.

    - **API Backend (`closer_service.py`) [MODIFY]**: Se blindó la lógica de parseo de fechas en `CloserService` (`get_comprehensive_stats`, `get_closer_clients`, `get_leads_kpis` y `get_agenda_stats`) envolviendo los llamados a `datetime.strptime` en bloques `try/except ValueError`. Esto garantiza que los valores vacíos, nulos o parcialmente escritos del selector de fechas en el frontend no provoquen un error 500 en el servidor y sean ignorados silenciosamente de forma segura.

- **4 de Junio de 2026**:
  - **Corrección en la Gráfica de Rendimiento por Fuente (Marketing Hub)**:

    - **API Backend (`manychat.py`) [MODIFY]**: Se modificó el endpoint `/manychat-webhook/stats/dashboard` y `/manychat-webhook/ad-details/<int:ad_id>` para resolver correctamente la fuente/setter de las agendas y ventas. Se actualizó el acceso de `agenda.lead` a `agenda.nombre`, de acuerdo con la convención de normalización de la base de datos de agendas financieras, evitando que se muestren nombres de clientes en el eje horizontal del gráfico de barras de rendimiento por fuente.

  - **Optimización de Logs de Chromium en Entorno Headless (Railway)**:

    - **API Backend (`image_service.py`) [MODIFY]**: Se unificaron y ampliaron los flags de Chromium (`custom_flags`) pasados a `Html2Image` en Linux. Se agregaron `--disable-gpu`, `--disable-software-rasterizer`, `--log-level=3` y se aseguró el uso de `--disable-dbus` y `--disable-extensions` en todos los métodos de generación de tarjetas de reporte. Esto elimina el ruido masivo de advertencias del motor gráfico y de conexión a bus de sistema en los logs de despliegue en Railway.

  - **Persistencia en la Edición de Setter de Ventas con Agenda**:

    - **API Backend (`financial_sales.py`) [MODIFY]**: Se refactorizó la función helper `normalize_ig` a nivel de módulo (removiendo sus definiciones internas duplicadas en `get_financial_sales` y `get_financial_sales_payroll`). Se modificó el endpoint `PUT /public/financial-sales/<int:sale_id>` para que, al editar el `setter_name` de una venta, si existe una agenda asociada a la misma vía Instagram, actualice también automáticamente la fuente de la agenda (`agenda.nombre = setter_name`). Esto previene que el cambio se revierta al refrescar la página debido a la atribución dinámica de agendas.

  - **Filtro por Usuario y Exportación PDF en Consolidado de Nómina (PayRoll)**:

    - **Interfaz (Frontend) (`AdminPayrollPage.jsx`) [MODIFY]**: Se implementó un filtro de selección de alta gama para filtrar por usuario en el panel superior (Todos, Elias, Jean Carlo, Marlon). El filtro es reactivo; al seleccionar un usuario en particular, se ocultan las tarjetas de los demás y se establece automáticamente la pestaña de auditoría en el usuario seleccionado. Asimismo, se agregó el botón de "Exportar PDF" en la cabecera del dashboard (el cual fue simplificado a *"Consolidado de Nómina"*) para invocar la impresión nativa. Se diseñó un banner dinámico de "Período" visible en impresión con un parseador robusto en `formatSaleDate` que elimina el bug del desajuste de zona horaria UTC de Javascript en fechas de rango simple (YYYY-MM-DD). También se simplificó la tabla de auditoría de ventas dejando únicamente las columnas esenciales (**Fecha**, **Cliente**, **Programa**, **Método** y **Comisión** sin porcentaje), y si el filtro superior está en "Todos" (`selectedUserFilter === 'all'`), se muestra condicionalmente la columna de **Monto Bruto**. Finalmente, se actualizaron los roles en las tarjetas superiores a **Setter** (Elias), **Closer** (Jean Carlo) y **Director de ventas** (Marlon).

    - **Estilos Globales (`index.css`) [MODIFY]**: Se añadieron reglas de estilos de impresión `@media print` para forzar un diseño formal corporativo con fondo claro/blanco y texto negro de alto contraste. Se ocultaron automáticamente barras de navegación, botones, filtros y docks. Asimismo, se anularon los desbordamientos y alturas fijas de la app (`overflow: visible !important`, `height: auto !important`) en los contenedores principales del layout (`h-screen`, `h-full`, `overflow-hidden`, `overflow-y-auto` y `#app-main-scroll`) para garantizar que el PDF se expanda infinitamente y se imprima a lo largo de múltiples hojas mostrando todos los registros.

  - **KPIs de Ticket Promedio en Dashboard de Closing con Montos Brutos y Auditoría de Discrepancias**:

    - **API Backend (`closer_service.py`) [MODIFY]**: Se modificó `CloserService.get_comprehensive_stats` para utilizar el **monto bruto original** de las ventas oficiales (`FinancialSale.monto`), eliminando los descuentos de pasarelas (Stripe y Hotmart) en esta sección para evitar discrepancias de cálculo. Adicionalmente, implementó la detección de discrepancias diarias agrupando tanto el cash reportado en llamada (`CloserDailyReport`) como el cash total registrado (`FinancialSale`) por fecha; si el monto en llamada reportado supera al registrado, se añade al listado de discrepancias (`discrepancies`) con la fecha, montos correspondientes y diferencia.

    - **Interfaz (Frontend) (`CloserPerformanceTab.jsx` y `PublicCloserStatsPage.jsx`) [MODIFY]**:

      - Se pasaron `setActiveTab` y `setFilters` desde la página principal de estadísticas al tabulador de rendimiento de closers.

      - Se extrajo la lista de discrepancias diarias en `salesMetrics`.

      - Se integró un botón dinámico de advertencia (color de alerta ámbar) en la cabecera de la tabla **Ventas Breakdown** si se detectan discrepancias en el período seleccionado.

      - Se implementó un modal Glassmorphism premium (`DiscrepanciesModal`) que visualiza en una tabla los días en conflicto, ofreciendo un botón de acción rápida *"Ir a Ventas"* por cada día. Al hacer clic, ajusta automáticamente el filtro temporal de la vista superior al día exacto de la discrepancia y redirige al administrador a la pestaña de **Registro Ventas** para su resolución.

  - **Selector de Tema Rápido y Accesible en el Dock**:

    - **Interfaz (Frontend) (`Dock.jsx`) [MODIFY]**: Se diseñó e integró un selector de temas dinámico y accesible globalmente desde cualquier sección de la app en la barra del Dock inferior. Al hacer hover o clic en el botón de la paleta (`Palette`), se despliega un popover premium con opciones y descripciones breves para cambiar el tema en caliente al instante (**Elegant Blue**, **Clean Mac**, y **Custom Pro**). Utiliza transiciones y estados activos visualmente atractivos.

- **3 de Junio de 2026**:
  - **Filtro y Cash Collect por Método de Pago en Registro de Ventas**:

    - **API (Backend) (`__init__.py`) [MODIFY]**:

      - Modificación del endpoint `GET /public/financial-sales` para capturar el parámetro `metodo_pago` y filtrar la consulta de base de datos por dicho método de manera reactiva.

      - Implementación de la agregación por método de pago (`payment_methods_breakdown`) agrupando el volumen de ventas y el cash total recaudado por cada método de pago.

      - Retorno dinámico de la lista de métodos de pago únicos (`unique_payment_methods`) en la respuesta JSON global.

    - **Interfaz (Frontend) (`PublicFinancialSalesPage.jsx`) [MODIFY]**:

      - Integración de `metodoPago` en el estado de filtros persistentes mediante el hook `usePersistentFilters` y envío del parámetro `metodo_pago` a la API.

      - Inclusión de un nuevo dropdown selector "Método:" en la barra superior de filtros que se puebla dinámicamente con los métodos únicos recibidos del backend.

      - Rediseño de la cuadrícula de KPIs a 3 columnas (`lg:grid-cols-3`) para alojar una nueva tarjeta premium: **Cash Collect por Método de Pago**, la cual detalla de forma ordenada la recaudación, cantidad de ventas y porcentajes correspondientes a cada método (Stripe, Paypal, Wise, Banco, etc.) con píldoras de colores estilizadas.

  - **Redirección y Edición de Reportes en Vista Principal**:

    - **Interfaz (Frontend) (`App.jsx`, `CloserReportsTable.jsx` y `PublicCloserReportPage.jsx`) [MODIFY]**:

      - Se añadió el rol `'admin'` a la ruta protegida `/closer/report` en [App.jsx](file:///c:/Users/EQUIPO%20DELL/Documents/GitHub/NeurOPS/frontend/src/App.jsx). Esto previene que el sistema rebote a los administradores a su página por defecto al intentar acceder a la vista de edición desde el historial de reportes.

      - Se eliminó el modal redundante de edición `EditCloserReportModal` dentro de `CloserReportsTable.jsx`, optimizando el tamaño del archivo y la experiencia de usuario.

      - Se modificó la acción "Editar reporte completo" para redirigir directamente al formulario principal `/closer/report` mediante `useNavigate`, enviando el reporte a editar como estado (`state: { editReport: r }`).

      - Se adaptó `PublicCloserReportPage.jsx` para recibir el reporte a través de `useLocation`, auto-completar todas las secciones del formulario y la pestaña de reflexión en el `useEffect`.

      - Se reestructuró `handleSubmit` para realizar un llamado asíncrono vía `PUT /public/closer-reports/${editReport.id}` en lugar de `POST` al estar editando, y utilizar `navigate(-1)` para regresar dinámicamente a la vista de origen (ya sea el historial de reportes del closer o del admin).

      - Se implementó un título de página dinámico ("Editar Reporte Diario" vs "Reporte Diario Closer"), un botón para "Cancelar Edición" (que también usa `navigate(-1)`) y etiqueta dinámica en el botón de envío principal ("GUARDAR CAMBIOS").

      - **Estabilización de Modo Oscuro Permanente**: Se reestructuraron los componentes `MetricInput` y `CollapsibleSection` y las tablas internas para eliminar la alternancia dinámica al modo claro (`bg-slate-200`, `bg-white/60`) cuando las secciones se consideran completadas. Ahora el formulario mantiene una estética premium y consistente en modo oscuro (`bg-slate-900`/`bg-slate-800/30`) tanto en la creación de un nuevo reporte como en la edición de reportes precargados, incorporando una sutil señal de completado verde (`animate-pulse`) en cada sección.

  - **Desactivación de Sincronización de Agendas desde Google Sheets**:

    - **Backend (API) (`sheets.py` y `public/__init__.py`) [MODIFY]**:

      - Se deshabilitó la reconstrucción y vaciado de la tabla de agendas (`Llamadas_DB`) desde Google Sheets en el endpoint de sincronización manual `/api/sheets/sync` y en el endpoint automático del cronjob `/api/sheets/cron-sync` en [sheets.py](file:///c:/Users/EQUIPO%20DELL/Documents/GitHub/NeurOPS/app/api/sheets.py). Esto evita que el cron o las solicitudes manuales borren las agendas enviadas en tiempo real por n8n directamente a la base de datos local.

      - Se deshabilitó la sincronización manual en el endpoint público `/api/public/financial-agendas/sync` en [__init__.py](file:///c:/Users/EQUIPO%20DELL/Documents/GitHub/NeurOPS/app/api/public/__init__.py). Ambos endpoints retornan ahora un mensaje informativo confirmando que la sincronización ha sido deshabilitada en favor del flujo directo con n8n/Calendly.

  - **Corrección de Inversión de Campos en Agendas Financieras y Funcionalidades**:

    - **Backend (API) (`__init__.py`, `marketing.py`, `closer.py`) [MODIFY]**:

      - Se corrigió el mapeo en `POST /public/financial-agendas` para que, cuando no se envíe `setter` explícito en el JSON pero vengan `nombre` y `lead` (de n8n), asigne `lead` como el Setter y `nombre` como el Cliente/Lead. Asimismo, se agregó soporte completo para la nueva clave `fuente` enviada por n8n (que mapea `fuente` -> Setter y `nombre`/`cliente`/`lead` -> Cliente).

      - Se actualizó la resolución del Setter de agendas de `agenda.lead` a `agenda.nombre` en la atribución de ventas (`get_financial_sales`), standings de marketing (`get_unattributed_leads`) y endpoints del closer (`/leads/search` y `/appointments/by-instagram`), asegurando que todos los flujos lean del campo correcto.

      - Se añadió el endpoint `POST /public/financial-agendas/repair-db` para posibilitar la normalización automática y selectiva de la base de datos de producción (PostgreSQL) tras el despliegue.

    - **Base de Datos (SQLite) (`local.db`) [MIGRATION]**:

      - Se creó y ejecutó el script `repair_agendas.py` que realizó una corrección y restauración selectiva y exitosa de 1549 agendas sincronizadas de Google Sheets en la base de datos local (corrigiendo la inversión errónea del script de migración inicial), dejando todos los registros en su formato correcto.

    - **Interfaz (Frontend) (`FinancialAgendasPage.jsx`) [VALIDATION]**:

      - Se renombró la columna "Setter" a "Fuente" en la tabla, el placeholder de búsqueda superior y las etiquetas del modal de edición para reflejar el cambio en Google Sheets y n8n.

      - Se verificó y validó el correcto funcionamiento de las acciones de edición (`PUT`) y eliminación (`DELETE`) de agendas directamente en el tablero, y se comprobó que el empaquetado final (`npm run build`) compile al 100% de forma correcta.

  - **Mejora de la Atribución por Agendas y Resolución de Ventas sin Agenda**:

    - **Backend (API) (`__init__.py`) [MODIFY]**:

      - Se implementó el parámetro de filtro `sin_atribucion` en `GET /public/financial-sales` para retornar únicamente ventas que no tienen agendas asociadas.

      - Se inyectó el flag `"has_agenda"` en la respuesta JSON de cada venta, calculando el match de Instagram en memoria.

      - Se amplió la búsqueda en `GET /public/financial-agendas` para permitir localizar agendas por `mail` y `whatsapp`.

      - Se corrigió la creación de agendas en `POST /public/financial-agendas` para guardar explícitamente los campos `mail` y `whatsapp` recibidos.

    - **Componente Modal Atómico (`AttributionModal.jsx`) [NEW]**:

      - Se creó un modal interactivo que guía la atribución manual: 1) Permite corregir el Instagram de la venta. 2) Permite buscar agendas existentes por nombre/correo/teléfono y vincularlas actualizando el Instagram de la agenda. 3) Permite crear una nueva agenda desde cero si no existe en el sistema.

    - **Interfaz (Frontend) (`PublicFinancialSalesPage.jsx`) [MODIFY]**:

      - Se simplificó la tarjeta de KPI "Atribución por Agendas" para visualizar únicamente el Ticket Promedio por Agenda, el Cash Collect Promedio por Llamada (Show Up), y la cantidad de ventas sin agenda.

      - Se agregó el botón/filtro global "Atribuir (Sin Agenda)" en la cabecera para filtrar la lista al instante.

      - Se implementó la columna "Atribución" en la tabla para ver el estado y abrir el modal interactivo de atribución.

  - **Eliminación y Exclusión Local Persistente de Ventas**:

    - **Base de Datos local (`financial.py`) [NEW MODEL]**: Se creó la tabla `excluded_sales` mapeada al modelo `ExcludedSale` para almacenar marcas temporales de ventas a excluir. Se aplicó la migración correspondiente en el motor local (`flask db migrate` / `flask db upgrade`).

    - **Modularización del Controlador de API Pública (`__init__.py`, `financial_sales.py`, `financial_agendas.py`) [REFACTOR]**: Se redujo el archivo core `__init__.py` en ~730 líneas moviendo todo el código de gestión de ventas y agendas financieras a dos módulos independientes (`financial_sales.py` y `financial_agendas.py`), logrando un código más limpio y fácil de mantener y cumpliendo con la regla de 500 líneas.

    - **Endpoint de Eliminación (`financial_sales.py`) [NEW ROUTE]**: Se implementó la ruta `DELETE /public/financial-sales/<int:sale_id>`. Si la venta eliminada posee una `marca_temporal`, esta se registra en `ExcludedSale` antes de remover físicamente la venta de la tabla `financial_sales`.

    - **Sincronización Inteligente (`sheets_service.py`) [MODIFY]**: Se modificó `SheetsService._rebuild_sales` para omitir y descartar automáticamente cualquier fila de Google Sheets cuya marca temporal figure en `excluded_sales`. Esto garantiza que al presionar "Sincronizar Sheets" no se re-importen las ventas borradas.

    - **Interfaz (Frontend) (`PublicFinancialSalesPage.jsx`) [MODIFY]**: Se importó `Trash2` de `lucide-react` y se agregó un botón con tono rojo premium en la columna de acciones de la tabla. Al hacer clic, pide confirmación dinámica (`window.confirm`) y ejecuta de forma asíncrona la petición de eliminación a la API pública, refrescando instantáneamente el tablero y recalculando los KPIs globales.

    - **Rediseño de KPIs Financieros Sin Scroll (`PublicFinancialSalesPage.jsx`) [MODIFY]**: Se eliminó la visualización vertical con scrollbar en las tarjetas de *Cash Collect por Tipo de Pago* y *Cash Collect por Método de Pago* (que utilizaban `max-h-[160px] overflow-y-auto`). Se rediseñaron a una moderna cuadrícula responsiva de dos columnas (`grid grid-cols-2 gap-2`) con cajitas compactas individuales. Esto elimina la necesidad de hacer scroll para ver la información y ofrece una visualización simétrica, fluida y de alta gama.

    - **Sincronización Bidireccional en Caliente y Persistencia Local Permanente [NEW FEATURE]**:

      - **API Backend (`sheets_service.py`, `financial_sales.py` y `sheets.py`) [MODIFY]**: Se creó el método `update_in_sheets` en `SheetsService` para enviar un POST con la acción `"update"`. Se modificó el endpoint de edición `PUT /public/financial-sales/<int:sale_id>` para propagar modificaciones de celdas (como el Instagram) en caliente a Google Sheets.

      - **Desactivación de Sincronización Destructiva (`sheets_service.py`) [MODIFY]**: Se modificó `sync_from_sheets` para que, cuando se llame con `Ventas_DB`, retorne inmediatamente un estado `disabled` en lugar de vaciar la tabla local, convirtiendo a la base SQLite/PostgreSQL de producción en la fuente de verdad permanente de la aplicación.

      - **Parámetro de Emergencia Force (`sheets_service.py`, `financial_sales.py`, `sheets.py`) [MODIFY]**: Se añadió soporte al parámetro de consulta `?force=true` tanto en el backend como en el servicio. Esto le permite al administrador del sistema forzar la reconstrucción manual destructiva de la base de datos de producción (PostgreSQL) desde Google Sheets en Railway en caso de despliegue desde cero, recuperando el histórico completo.

      - **Inserción Local Obligatoria al Crear Venta (`sheets_service.py`) [MODIFY]**: Se modificó `post_to_sheets` para que, antes de propagar la nueva venta declarada vía POST a Google Sheets, la inserte de forma inmediata y segura en la base de datos local y de producción (`FinancialSale`), garantizando la consistencia y persistencia permanente en caliente.

      - **Interfaz (Frontend) (`PublicFinancialSalesPage.jsx`) [MODIFY]**: Se removió por completo el botón de "Sincronizar Sheets" en la UI de filtros del dashboard de ventas para evitar que se gatillen peticiones de sincronización destructiva accidental.

      - **Edición de Fecha de Ventas (`financial_sales.py` y `PublicFinancialSalesPage.jsx`) [MODIFY]**:

        - **API Backend**: Se modificó `PUT /public/financial-sales/<int:sale_id>` para que intercepte el parámetro `date` y actualice el campo `sale.date` en SQLite/PostgreSQL de producción.

        - **Frontend**: Se integró un selector de tipo fecha (`<input type="date">`) en la primera columna al editar una fila de venta en caliente. Se modificaron `handleEditClick` para inicializarla a partir de la venta (`split('T')[0]`) y `handleSave` para enviarla en el payload de actualización, recalculando en caliente todos los dashboards y KPIs filtrados.

  - **Botón y Formulario para Registrar Ventas No Registradas**:

    - **API (Backend) (`financial_sales.py`) [NEW ROUTE]**:

      - Se implementó la ruta `POST /public/financial-sales/new` para procesar el registro manual de una venta no registrada.

      - Construye un payload robusto con toda la información requerida e invoca `SheetsService.post_to_sheets` para guardarlo localmente en la base de datos (SQLite/Postgres) de forma inmediata y propagarlo síncronamente al archivo de Google Sheets.

    - **Interfaz (Frontend) (`PublicFinancialSalesPage.jsx`) [MODIFY]**:

      - Se incorporó un botón premium "+ Registrar Venta" en el panel superior de filtros que abre un modal con diseño Glassmorphism.

      - Se implementó un formulario interactivo completo (`CreateSaleModal`) que permite registrar nombre de cliente, instagram, email, teléfono, programa, tipo de pago, monto, método de pago, estado, fecha de la venta, closer, setter y observaciones.

      - Se pre-completa por defecto la fecha de hoy y se valida que los campos requeridos (nombre del cliente y monto) estén presentes antes de enviar la información, refrescando en caliente la vista principal al registrar exitosamente.

      - **Buscador de Agendas en el Modal**: Se integró un input buscador de agendas que llama con debounce al endpoint público `/public/financial-agendas` para obtener agendas coincidentes (por nombre, email, instagram o whatsapp). Al seleccionar una agenda, autocompleta en caliente la información de cliente, instagram, email, teléfono, setter, closer y fecha de cita en el formulario de la venta, con un botón para limpiar/desvincular de forma interactiva.

      - **Unificación de Estados de Venta**: Se reemplazó el estado inicial por defecto `"Confirmada"` por `"Completada"` en el formulario de registro manual. Se actualizaron además las opciones del select en el modal de creación para ofrecer exactamente las mismas opciones estandarizadas que la tabla y base de datos: `"Completada"`, `"Pendiente"`, `"Reembolsada"` y `"Cancelada"`.

      - **Blindaje y Tolerancia a Fallos en Datos de Ventas**: Se implementó la función utilitaria `formatSaleDate` y validaciones defensivas en `handleEditClick`, `paymentTypesBreakdown` y `paymentMethodsBreakdown` para evitar crashes en tiempo de ejecución (que detenían el renderizado y el scroll infinito de la tabla de ventas) al procesar o editar registros con campos de fecha, tipo de pago o método de pago nulos o vacíos.

      - **Filtrado de Acumulados por Ventas Completadas**: Se modificó el backend (`financial_sales.py`) para que la sumatoria total (`total_monto`), las comisiones por setter, el dinero atribuido por agendas y los breakdowns por tipo/método de pago computen y sumen únicamente los montos de transacciones en estado `"Completada"` (o sin estado).

  - **Mejoras en el Tablero de Agendas (`FinancialAgendasPage.jsx`)**:

    - **Formato de Fecha**: Se modificó la columna de Fecha en el historial para renderizar la propiedad `agenda.date` formateada en un formato legible en español (día, mes, año, hora y minutos) con fallback al texto original `fecha_meet`.

    - **Visibilidad y Usabilidad del Modal de Edición**: Se corrigió el problema de visibilidad del texto escrito en los inputs del modal de edición reemplazando las clases no estándar de Tailwind (`bg-slate-850 border-slate-750`) por clases de alta gama y alta compatibilidad (`bg-slate-950 border-slate-800`), y se forzó la alineación a la izquierda (`text-left`) en las etiquetas del formulario.

  - **Deducción de Comisión de Stripe del 4.5% y Consistencia de Ventas Completadas**:

    - **API Backend (Ventas Financieras) (`financial_sales.py`)**: Implementación del descuento del 4.5% en caliente para montos de transacciones pagadas con Stripe, afectando el listado, acumulados y breakdowns del panel de ventas.

    - **API Backend (Estadísticas de Closers) (`closer_service.py`)**: Integración del descuento del 4.5% en la recaudación de closers (`CloserService.get_comprehensive_stats`) usando expresiones condicionales de SQL (`case`). Además, se acotó la consulta oficial para considerar únicamente transacciones en estado `"Completada"` (o sin estado).

    - **API Backend (Marketing y Atribución) (`marketing_service.py` y `public/marketing.py`)**: Adaptación del dashboard de rendimiento de anuncios, reporte de atribución e historial de desatribuidos para aplicar en caliente el descuento a montos pagados con Stripe, y restringir todos los cálculos financieros únicamente a ventas completadas.

  - **Visualización de Totales Neto/Bruto y Ajuste de Título en Ventas por Fuente**:

    - **API Backend (`financial_sales.py`)**: Se calcula y devuelve el campo `total_monto_bruto` (sin comisiones) en el endpoint de listado de ventas.

    - **Frontend (`PublicFinancialSalesPage.jsx`)**:

      - Se renombró la sección principal *"Ventas por Fuente (Setter)"* a *"Ventas por Fuente"*.

      - Se actualizó el indicador de *"Total Acumulado"* en el panel para mostrar tanto el total Neto (con comisiones descontadas) como el total Bruto original (si difieren).

  - **Deducción de Comisión de Hotmart del 8.9%**:

    - **API Backend (`financial_sales.py`, `closer_service.py`, `marketing_service.py`, `public/marketing.py`)**: Extensión de la lógica de comisiones del backend para restar en caliente un **8.9%** a todas las transacciones cuyo método de pago sea **"Hotmart"** (monto neto resultante: `monto * 0.911`), afectando a todos los listados, reportes de atribución, desatribuidos y KPIs generales de closers/marketing.

    - **Frontend (`PublicFinancialSalesPage.jsx` y `SalesAttributionPage.jsx`)**: Se modificó la renderización del sufijo *"neto"* y del valor bruto original para que reaccione dinámicamente ante cualquier diferencia numérica entre el neto y el bruto, haciéndola compatible automáticamente con Stripe, Hotmart y futuros métodos con comisión.

  - **Sección de Ventas por Closer**:

    - **API Backend (`financial_sales.py`)**: Implementación del helper `resolve_closer_name` para mapear correos a nombres de closers limpios, y la acumulación y retorno de la recaudación neta agrupada en `closers_breakdown`.

    - **Frontend (`PublicFinancialSalesPage.jsx`)**: Incorporación de la tarjeta premium *"Ventas por Closer"* con barra segmentada, desglose por closer y simulador interactivo de comisiones de closers (por defecto al 10%). Se actualizó además la columna de Roles en la tabla de ventas para mostrar el nombre legible del closer.

- **2 de Junio de 2026**:
  - **Corrección Definitiva en la Atribución por Agendas y Ventas por Fuente en el Monolito API**:

    - **Resolución Dinámica por Instagram con Fuente Real de la Agenda (`__init__.py`) [MODIFY]**: Rediseño integral de la lógica del endpoint `GET /public/financial-sales` en `app/api/public/__init__.py`. Ahora se realiza un cruzado en memoria de todas las ventas del periodo contra las agendas (`FinancialAgenda`) por usuario de Instagram normalizado. Para resolver el setter/fuente de la venta, el sistema extrae el campo `agenda.lead` (que en la base de datos almacena la fuente real de la cita como Elias, Workshop, VSL, etc.), filtrando textos de eventos genéricos (como "Entrevista"). Si no hay match o el lead no es válido, se mantiene el setter original de la venta (`FinancialSale.setter`), logrando una atribución 100% precisa y libre de nombres de clientes.

    - **Sincronización del Setter en Listado de Ventas (`__init__.py`) [MODIFY]**: Inyección del setter dinámicamente resuelto en el listado de ventas paginado devuelto al frontend, asegurando que la tabla detallada de la UI muestre exactamente los mismos datos coherentes que el gráfico de barras agregado de "Ventas por Fuente".

    - **Standings de Setters Consistentes en el Dashboard de Marketing (`manychat.py`) [MODIFY]**: Optimización del cálculo de `global_setters` para ventas y agendas en `app/api/manychat.py` (endpoint `GET /manychat-webhook/stats/dashboard`). Se implementó la misma lógica de resolución por Instagram usando `agenda.lead` para las ventas, logrando total sincronización en el rendimiento por setter y eliminando la mezcla de nombres de prospectos en el marketing hub.

  - **Implementación de Ticket Promedio y Recaudación Promedio por Agenda**:

    - **API (Backend) (`__init__.py`) [MODIFY]**: Modificación del endpoint `GET /public/financial-sales` para calcular el número total de llamadas agendadas (`total_agendas`) en el rango de fechas seleccionado utilizando `FinancialAgenda.query` con filtros de fecha idénticos a los de ventas. Este valor se inyecta en el campo `total_agendas` dentro de `"con_agenda"` en `agenda_breakdown` para consumo dinámico.

    - **Interfaz (Frontend) (`PublicFinancialSalesPage.jsx`) [MODIFY]**: Rediseño de la tarjeta *"Atribución por Agendas"* del Registro de Ventas. Se calcula en caliente el **Ticket Promedio** para ventas con agenda y sin agenda, así como el ratio **Recibido x Agenda (Cita)** (recaudación total con agenda / total de citas agendadas). Se renderizan elegantemente en la base de cada columna con simetría visual y píldoras estilizadas para ofrecer un reporte premium limpio.

  - **Búsqueda Autocompletable Interactiva por Múltiples Campos en Formulario de Ventas**:

    - **API (Backend) (`closer.py` y `auth.py`) [MODIFY]**: Modificación de la ruta `/leads/search` para buscar prospectos por coincidencia parcial en nombre, email, instagram o teléfono, cruzando la agenda más reciente para su autocompletado inmediato. Además, se modificaron los endpoints `/auth/me`, `/auth/impersonate` y `/auth/revert` para inyectar el campo `email` del usuario en la sesión del frontend.

    - **Interfaz (Frontend) (`NewSalePage.jsx`) [MODIFY]**: Implementación de una barra de búsqueda inteligente con dropdown flotante absoluto. Al seleccionar una coincidencia, se autocompleta el formulario entero. El input del `email_vendedor` se inicializa con el correo del Closer logueado en la sesión (corrigiendo la persistencia al simular o refrescar) pero manteniéndose editable. Se removió por completo de la interfaz el campo visual de Setter, asegurando que la atribución se asocie internamente en el formulario de forma exclusiva al vincular el lead con su agenda correspondiente.

  - **Campo de Examen del Lead, Estado de la Venta e Intercambio de Columnas con Google Sheets**:

    - **Base de Datos local (SQLite/PostgreSQL)**: Se añadió la columna `examen` al modelo `Appointment` y se ejecutaron las migraciones locales correspondientes (`add_examen_to_appointment`).

    - **Sincronización (`sheets_service.py`) [MODIFY]**: Modificación de la función `_rebuild_sales` para propagar automáticamente a la cita (`Appointment`) local más reciente del cliente el examen extraído de la venta sincronizada de Sheets. Adicionalmente, se corrigió el cruce de las columnas físicas L (Estado) y M (Setter) mapeando `setter` a la columna M (`item.get('estado')`) y `estado` a la columna L (`item.get('setter')`).

    - **Formulario de Declarar Venta (`NewSalePage.jsx`) [MODIFY]**:

      - Corrección de error de sintaxis JSX cerrando los tags abiertos del campo de teléfono.

      - Inclusión del selector para el **Estado de la Venta** con opciones: `Confirmada`, `Pendiente`, `Cancelada`.

      - Incorporación del campo **Examen del Lead** (autocompletado dinámicamente desde la agenda/cita).

      - Vinculación correcta del textarea de observaciones al estado `form.notas` en lugar de `form.examen`.

      - Inversión de campos en el payload (`setter: form.estado`, `estado: form.setter`) para escribir correctamente en las columnas físicas L (Estado) y M (Setter) en Google Sheets.

  - **Separación de Programa y Tipo de Pago en Registro de Ventas**:

    - **API (Backend) (`__init__.py`) [MODIFY]**: Creación de la función utilitaria `split_tipo_pago` que separa el programa (ej: `RR`) del tipo de pago simple (ej: `completo`). Se actualizó `get_financial_sales` para inyectar `"programa"` y `"tipo_pago_simple"` en el JSON de las ventas, agrupar `payment_types_breakdown` por tipo de pago simple, y recolectar conjuntos globales de `unique_programs` y `unique_payment_types` (simples).

    - **Interfaz (Frontend) (`PublicFinancialSalesPage.jsx`) [MODIFY]**:

      - Se dividió el filtro selector de Pago en dos selectores independientes: "Programa" y "Pago", enviando los nuevos parámetros a la API.

      - Se separó la columna "Producto/Pago" en la tabla en dos columnas: "Programa" y "Pago" (que muestra el tipo de pago simple y método de pago).

      - Se adaptó la edición en línea en la tabla para inicializar y editar Programa y Tipo de Pago Simple por separado, combinándolos de vuelta en el formato original `{programa} - {tipo_pago_simple}` al guardar para mantener consistencia con Google Sheets y la base local.

- **1 de Junio de 2026**:
  - **Optimización y Refinamiento del Dashboard de Rendimiento por Anuncio**: Rediseño integral y reubicación de elementos para maximizar la usabilidad, consistencia y densidad de datos.

    - **Reposicionamiento del Título (Hub de Marketing)**: Reubicación del título principal *"NeurOPS High Performance - Gestor de Marketing"* al extremo derecho de la barra de pestañas superior del Hub de Ventas (`AdminMarketingHubPage.jsx`). Esto eliminó la cabecera independiente en `AdManagementPage.jsx`, liberando un valioso espacio de pantalla vertical.

    - **Panel de KPIs de Alta Densidad**: Creación de un bloque de 6 tarjetas de KPIs fijos y estilizados al inicio del panel `AdDashboardTab.jsx` (Inversión, Leads, Costo x Lead/Cualificado, Agendas, Ventas, Cash Collect & ROAS) que consolida los datos del periodo seleccionado.

    - **Eliminación de la Fila de Totales**: Remoción de la fila de totales generales dentro de la tabla de anuncios (vista lista), centralizando toda la visualización de acumulados de forma limpia únicamente en el nuevo panel superior de KPIs.

    - **Estructura y Tooltips Interactivos**:

      - **API (Backend)**: Modificación del endpoint `/manychat-webhook/stats/dashboard` en `app/api/manychat.py` para consultar y devolver directamente los nombres de campaña (`campaign_name`) y conjunto de anuncios (`ad_set_name`) correspondientes a cada anuncio.

      - **Interfaz (Frontend)**: Integración de tooltips de alta prioridad visual (`z-[100]`) orientados hacia abajo (`top-full`) en el nombre de cada anuncio, tanto en la vista lista como en la vista galería. Esto evita el recorte de tooltips en los bordes superiores de la tabla y proporciona un acceso rápido a la estructura jerárquica del anuncio.

    - **Filtros y Vistas por Defecto**: Actualización de los valores por defecto en `AdDashboardTab.jsx` para cargar inicialmente en **"Vista Lista"** (tabla) y filtrar automáticamente por el periodo **"Este mes"** (`this_month`).

    - **Gráficos Minimizables**: Implementación de controles interactivos (*ChevronUp* / *ChevronDown*) en la tarjeta de *"Rendimiento por Fuente"* para colapsar y expandir la gráfica de barras de Setters, optimizando el espacio en pantalla según las necesidades del usuario.

    - **Corrección de Visibilidad en el Historial de Inversión (Períodos)**: Modificación de la función `loadHistory` en `AdManagementPage.jsx` para remover los parámetros restrictivos de rango de fechas (`start_date` / `end_date`) en la petición `GET /public/ads/period-spend`. Esto soluciona el bug por el cual las inversiones recién guardadas del período seleccionado no se visualizaban en la tabla inferior del Historial de Inversión debido al filtrado estricto por fechas.

    - **Simplificación a Inversión Diaria**: Modificación de la pestaña "Inversión (Períodos)" a **"Inversión"** en `AdManagementPage.jsx`. Se reemplazó el selector de rango de fechas por un selector de un único día, el cual establece tanto `start_date` como `end_date` a la misma fecha seleccionada. Esto optimiza el flujo para registrar inversiones diarias (uno por uno) y actualiza automáticamente los textos e indicadores a nivel de día en toda la interfaz.

    - **Paginación y Scroll Infinito en Tráfico Landings**: Optimización de `LandingTrafficTable.jsx` para mostrar inicialmente solo 10 registros y realizar una carga progresiva de 10 en 10 al hacer scroll hacia abajo. Se implementó utilizando `IntersectionObserver` de forma reactiva e integrada con la búsqueda textual local y los filtros de fechas, añadiendo además un indicador visual de carga animado que informa del total de registros cargados y disponibles.

  - **Optimización y Reestructuración del Dashboard de Rendimiento de Setters (Performance Center)**:

    - **Eliminación de Redundancias Críticas (`PublicSetterStatsPage.jsx`) [MODIFY]**:

      - Se removió por completo la sección redundante de los *"3 Pilares Estratégicos"*, la cual repetía variables idénticas de leads entrantes, cualificados y tasas de respuesta ya cubiertas por la cabecera.

      - Se reemplazó por **4 Tarjetas de Rendimiento Clave** de alto valor operativo y de negocios: **Agendas Totales** (volumen absoluto con porcentaje de conversión sobre leads reales), **Eficacia a Cita** (conversión sobre leads cualificados), **Tasa Follow-Up** (tenacidad de seguimientos con volumen de enviados/respondidos) y **Eficacia Discovery** (promedio de utilidad de preguntas clave del bot).

    - **Matriz de Conversión y Pérdida de Pasos (Step Conversion Matrix) [NEW]**:

      - Se eliminó el panel "Standings (Leads)" del Funnel que duplicaba conteos.

      - Se diseñó e implementó una hermosa y compacta **Tabla de Pérdida de Pasos**, que detalla las 6 etapas del embudo de setting (*Entrantes*, *Cualificados*, *Dolor*, *Oferta*, *Link*, *Agenda*), indicando el volumen absoluto, la tasa de conversión paso a paso relativa a la etapa anterior, y el porcentaje total de efectividad sobre entrantes. Esto le permite al admin identificar al instante el "cuello de botella" del setter.

    - **Matriz de Tenacidad en Seguimiento (Follow-Up Matrix) [NEW]**:

      - Se implementó una rejilla de alta densidad que resume la tenacidad de los seguimientos (*Qual FU*, *Pain FU*, *Offer FU*, *Link FU*, *Agenda FU*) mostrando los respondidos sobre enviados y una píldora visual con código de colores semafórico (verde para tasas ≥40%, amarillo para ≥15%, rojo para <15%).

    - **Optimización Visual del Funnel**: Se ajustó el layout del gráfico interactivo circular (`FunnelChart`) en un contenedor independiente, unificándolo estéticamente con el tema Dark Glassmorphism.

  - **Eliminación del Discovery (Preguntas Bot) y Sustitución por KPI de Negocio**:

    - **Simplificación del Reporte Diario de Setters (`PublicSetterReportPage.jsx`, `SetterReportModal.jsx` y `SetterReportModal.jsx` de components) [MODIFY]**:

      - Se eliminaron por completo las variables `q1_useful`, `q1_unuseful`, `q2_useful`, `q2_unuseful` y el bloque JSX de *"Eficacia de Preguntas"* del formulario de reporte diario, eliminando esta carga de datos obsoleta e inútil para los Setters.

    - **KPI Calidad de Tráfico (Leads Netos / Entrantes) (`PublicSetterStatsPage.jsx`) [MODIFY]**:

      - Se reemplazó la Tarjeta 4 de *"Eficacia Discovery"* (que estaba en 0% por ser obsoleta) por un KPI de enorme valor de negocio: **Calidad de Tráfico**.

      - Este KPI calcula el ratio de Leads Netos (Leads Reales) sobre conversaciones totales Entrantes del periodo de forma dinámica. Visualiza el volumen absoluto en píldoras estilizadas, manteniendo además la comparación interactiva con el periodo anterior de forma limpia y coherente.

      - Se removió también la sección inferior redundante de "Calidad de Preguntas".

    - **Limpieza de Comparaciones (`SetterComparisonView.jsx`) [MODIFY]**:

      - Se eliminaron las métricas obsoletas de preguntas Q1/Q2 del comparador de Setters, dejando un panel limpio de redundancias.

  - **Reemplazo de Formulario de Google por Formulario Integrado de Ventas para Closers**:

    - **Frontend (Interfaz Web en React) (`NewSalePage.jsx`) [MODIFY]**:

      - Se reescribió por completo la página de declaración de ventas manuales de los closers para capturar los datos requeridos exactamente como se reciben en Google Sheets (`Ventas_DB`).

      - **Autocompletado de Sesión Activa**: Integración de `useAuth` para recuperar de forma automática el correo del Closer logueado y pre-cargar el campo `email_vendedor` de forma predeterminada.

      - **Carga de Setters Activos**: Se incorporó un llamado asíncrono a `GET /public/active-setters` para poblar un select interactivo dinámico con el listado de Setters del equipo para una atribución de comisiones transparente.

      - **Autocompletado de Leads Agendados**: Se conservó y optimizó la lista de prospectos agendados recientes de `/closer/sale-metadata` para que, al seleccionarse, autocomplete en caliente el nombre de cliente, Instagram, email de cliente y teléfono del contacto de un solo golpe.

      - **Sincronización Directa a Google Sheets (Apps Script)**: Modificación de la función `handleSubmit` para realizar un `POST /api/sheets/push?tabla=Ventas_DB` en lugar de la persistencia local heredada anterior. Esto envía los datos de la venta directamente a la hoja de cálculo de Google Sheets de producción y gatilla la sincronización en caliente (`sync_from_sheets`) inmediatamente después, manteniendo toda la base local en perfecta consistencia en tiempo real.

      - **Estética Dark Glassmorphism Premium**: Rediseño visual adaptado a la paleta de colores del proyecto, incorporando iconos interactivos y transiciones fluidas de enrutamiento con react-hot-toast.

  - **KPIs y Filtros del Registro de Ventas para Closers (`PublicFinancialSalesPage.jsx`) [MODIFY]**:

    - **Filtro Interactivo por Tipo de Pago**:

      - **API (Backend)**: Modificación del endpoint `GET /public/financial-sales` en `app/api/public/__init__.py` para capturar el parámetro `tipo_pago` y filtrar la consulta de base de datos de manera reactiva por dicho tipo de pago.

      - **Interfaz (Frontend)**: Integración de un dropdown de selección de alta gama para "Pago" en el panel de filtros superiores. Este dropdown se puebla automáticamente con la lista dinámica de tipos de pago (`unique_payment_types`) devueltos por el backend, permitiendo alternar filtros al instante.

    - **KPI de Cash Collect por Agendas (Atribución)**:

      - Implementación de un panel de KPI premium con diseño Dark Glassmorphism que calcula en caliente el dinero recaudado a través de citas generadas por Setters (Con Agenda) vs Ventas Directas Orgánicas (Sin Agenda) sobre todo el período seleccionado.

      - Integración de una hermosa barra de progreso segmentada de dos tonos que indica el porcentaje y el conteo de ventas por cada tipo de atribución.

    - **KPI de Cash Collect por Tipo de Pago**:

      - Creación de un panel de desglose dinámico que agrupa la recaudación según el formato de pago registrado (`Completo`, `Parcial`, `Seña`, `Cuota`, etc.).

      - Diseñado con píldoras de colores semafóricos HSL que clasifican las transacciones y proporcionan métricas claras sobre la distribución financiera de las ventas.

  - **Vista Detallada de Reporte Diario de Setters con Icono de Ojo (`SetterReportsTable.jsx`) [MODIFY]**:

    - **Icono de Previsualización (Ojo)**:

      - **Interfaz (Frontend)**: Integración del icono `Eye` de `lucide-react` en la columna de acciones de la tabla de reportes de setters (`SetterReportsTable.jsx`). Al hacer clic, abre el reporte en una pestaña nueva (`_blank`) pasando el token activo de autenticación, restringiendo su visibilidad únicamente a los administradores (`user.role === 'admin'`).

      - **API (Backend)**: Creación de la ruta pública de previsualización `@bp.route('/public/setter-reports/<int:report_id>/preview')` en `app/api/public/setter.py`. Valida robustamente la sesión activa del administrador o el token enviado y renderiza en caliente el template físico `setter_report.html` con las métricas detalladas calculadas.

  - **Optimización y Reestructuración de la Tabla de Ventas Breakdown en Dashboard de Closing (`CloserPerformanceTab.jsx`) [MODIFY]**:

    - **Optimización de Rendimiento (React useMemo)**: Se encapsuló todo el bloque de procesamiento y cálculo de métricas financieras de ventas y periodos comparativos en un hook `useMemo` consolidado (`salesMetrics`). Esto previene recálculos redundantes e innecesarios durante los re-renders del componente, acelerando significativamente la fluidez y velocidad del dashboard.

    - **Reestructuración y Nuevas Columnas en la Tabla "Ventas Breakdown"**:

      - Se eliminaron por completo las columnas antiguas de *"Recup. Cants"* y *"Recup. Cash"*.

      - Se implementaron e integraron las nuevas columnas **"Cash en llamada"** (dinero ingresado de forma inmediata en la videollamada comercial) y **"Cash fuera de llamada"** (calculado restando dinámicamente el cash en llamada al cash collect total recolectado de cada categoría).

      - Se reordenaron las columnas respetando la secuencia exacta solicitada:

        1. *Tipo de Pago* (PIF, Split Pay, Cuotas Cobradas, Promesas/Señas).

        2. *Cantidad*.

        3. *Cash en llamada*.

        4. *Cash fuera de la llamada*.

        5. *Cash total*.

      - Se recalcularon y adaptaron de manera consistente todas las filas individuales de la cuadrícula, así como la fila de **Totales generales**, integrando las correspondientes píldoras visuales y el análisis comparativo con el periodo anterior de forma limpia y transparente.

    - **Remoción de Redundancias Críticas**: Se removieron los 9 KPI cards que se encontraban en el pie de la tabla Ventas Breakdown, ya que duplicaban datos del flujo de caja, cantidades de ventas y cuotas que ya están cubiertos de manera prominente en los 3 Pilares superiores.

    - **Nuevo Panel de KPIs Premium de Ticket Promedio**: Se transformaron los indicadores no duplicados y valiosos de ticket promedio en un hermoso grid de 4 tarjetas de alta gama visual posicionadas estratégicamente **arriba de las tablas** y **debajo del embudo de conversión**:

      1. *Ticket Promedio PIF* (Pago Completo).

      2. *Ticket Promedio Split* (Pago Inicial Fraccionado).

      3. *Ticket Promedio Seña* (Reserva / Promesa).

      4. *Ticket Promedio Cuota* (Pagos de seguimiento).

      Cada tarjeta incluye tooltips explicativos detallados y el respectivo análisis comparativo con el periodo anterior (`renderComparisonSubdataLeft`), optimizando la densidad de información y mejorando la jerarquía visual del dashboard de closing.

    - **Ratios y Gráficos Circulares para Primera y Segunda Llamada**:

      - Se eliminaron las barras de progreso genéricas y lineales de la parte inferior de la tabla de **Agenda Breakdown**.

      - Se implementó un componente helper especializado e interactivo llamado `CallPieChart` que separa y visualiza con absoluta precisión los ratios de **Primera Llamada** y **Segunda Llamada** mediante dos hermosos gráficos circulares interactivos colocados en una cuadrícula responsiva lado a lado.

      - Cada gráfico distribuye el volumen y porcentaje de **Asistencia** (Show Rate), **No Show** y **Llamadas Canceladas**, acompañados de leyendas e indicadores numéricos con un diseño premium y consistente con la estética Dark Glassmorphism del proyecto.

    - **Gráficos Circulares para el Desglose de Ventas Breakdown**:

      - Se implementó un componente helper especializado e interactivo llamado `SalesPieChart` para graficar de forma granular el desglose financiero al pie de la tabla **Ventas Breakdown**.

      - Incorpora dos hermosos gráficos circulares interactivos colocados en una cuadrícula responsiva lado a lado: **Distribución de Cierres (Cantidad)** y **Distribución de Recaudación (Cash)**.

      - Cada gráfico segmenta las transacciones por tipo de pago (PIF, Split Pay, Cuotas Cobradas y Señas), indicando el volumen/cash absoluto y la variación porcentual con leyendas de alta gama visual.

    - **Simplificación y Eliminación de Gráficos Redundantes en el Pie de Página**:

      - Al integrarse los gráficos circulares directamente en las tablas correspondientes, se eliminaron los gráficos duplicados de *"Tipo de Cierre"* y *"Estado de Agendas"* de la fila inferior general.

      - Se reorganizó la fila inferior (`BOTTOM ROW`) en un grid de 2 columnas centrado exclusivamente en la distribución de la tenacidad de los seguimientos: **Re-engagement (Hot)** y **Re-engagement (Cold)**, logrando un dashboard sumamente limpio, simétrico y de altísimo valor analítico.

  - **Rediseño Estético y de Layout del Reporte Diario de Setters para Discord (`setter_report.html`) [MODIFY]**:

    - **Reestructuración de Grilla Principal**: Se implementó una cuadrícula de dos columnas en `.main-grid` (`1.62fr 1.38fr`) alineada a la parte superior. Esto compactó el layout de una altura excesiva (~2000px) a un formato simétrico (~1150px), previniendo que Discord comprima y arruine la nitidez del reporte.

    - **Columna Izquierda (Datos Cuantitativos)**: Agrupa el análisis unificado del embudo y del inbox, maximizando el espacio de la tabla de stages.

    - **Columna Derecha (Datos Cualitativos e Insights)**: Agrupa el bloque de "Insights Rápidos" reestructurado como una lista vertical (eliminando colisiones de texto horizontales) junto a las "Reflexiones de Alto Rendimiento" y "Respuestas Cualitativas del Día" formateadas como pilas verticales con bordes con acentos de color.

    - **Reubicación de Sparklines**: Se movieron los sparklines SVG de la parte inferior de las `.stat-card` para situarse al lado derecho de su respectivo valor numérico principal. Esto redujo el alto mínimo de las tarjetas a `180px` conservando la densidad y el aspecto premium.

    - **Legibilidad y Tipografía**: Se incrementaron y afinaron los tamaños de fuente de títulos, etiquetas, badges de tendencia y valores de texto libre en toda la interfaz para una lectura 100% clara en Discord.

  - **Mejora del Unified Funnel Analysis y Simplificación de Reflexiones (`setter_report.html`, React Forms, Backend) [MODIFY]**:

    - **Embudo Horizontal Visual con 6 Etapas**:
      - Se implementó en el template Jinja2 (`setter_report.html`) un embudo horizontal visual de alta gama compuesto por una tarjeta para **Entrantes** (con su valor y 100%) y 6 chevrons con iconos premium representativos de cada paso: Cualificación, **Leads** (renombrado de Leads Netos, mostrando la cantidad intermedia y la conversión relativa), Dolor, Oferta, Link y Agenda.
      - Se integró un grid de 5 tarjetas inferiores que comparan en puntos porcentuales (pp) cada tasa de conversión actual con su promedio correspondiente de los últimos 7 días.
      - Se reubicaron los paneles de **Insights Rápidos** y **Reflexiones de Alto Rendimiento** a la sección inferior en una cuadrícula responsiva lado a lado, otorgándole el 100% de la anchura disponible al panel de **Unified Funnel Analysis** para maximizar el espacio de las tablas y el gráfico.

    - **Tablas Stacked Detalladas de Follow-ups y Openings**:
      - Se dividió el análisis de interacciones en dos tablas apiladas y ordenadas: **Follow-ups por Etapa** (con columnas de Enviados, Respondidos, Efectividad y barras de progreso de color por etapa) y **Openings por Etapa** (añadiendo soporte y guardado para Oferta y Link, cubriendo las 4 etapas y mostrando % Respuesta con barras de progreso).
      - Se modificaron los modelos de base de datos (`SetterDailyStats`) agregando los 4 campos de openings correspondientes y se ejecutó la migración correspondiente.
      - Se actualizó el endpoint de API para persistir y calcular promedios de estos nuevos campos tanto en el flujo público (`app/api/public/setter.py`) como privado (`app/api/setter.py`).
      - **Hotfix (safe_percent)**: Se inyectó la función utilitaria `safe_percent` en el contexto de renderizado de la plantilla HTML para evitar excepciones de variable indefinida durante la renderización en el preview y en la generación de imágenes para Discord.

    - **Simplificación del Formulario de Reflexiones Cualitativas**:
      - Se modificó `DailyReflectionSection.jsx` reduciendo el formulario cualitativo de 6 a solo 2 preguntas: **Reflexión Diaria** y **Victoria del Día**, eliminando preguntas redundantes.
      - Se ajustó la validación en `PublicCloserReportPage.jsx` para que apruebe la sección de reflexiones con `>= 2` elementos.
      - Se actualizó `reflectionKeys` en `SetterReportModal.jsx` a solo 2 claves.

    - **Corrección en la Tasa de Apertura (Openings)**:
      - Se modificó el cálculo de la Tasa de Apertura (`openings_tasa`) en `app/api/public/setter.py` para evitar porcentajes superiores al 100%.
      - La fórmula cambió de `aperturas_enviadas / entrantes` a una tasa de respuesta real: `aperturas_respondidas / aperturas_enviadas` considerando las cuatro etapas de openings.
      - Se adaptaron los cálculos de los promedios de los últimos 10 y 7 días (`avg_apertura_10`, `avg_apertura_7`) y la comparación con el día previo.
      - Se actualizó el label descriptor en `setter_report.html` a "% de respuesta sobre aperturas".

  - **Dashboard de Closers - Conversiones de Embudo (`CloserPerformanceTab.jsx`) [MODIFY]**:
    - Se agregó el KPI **Cierre Real sobre Asistencia** (`Asistencias → Ventas`) a la lista de conversiones críticas del embudo de closers.
    - Se calcula de forma dinámica como la relación de ventas reales frente a agendas asistidas (`realSalesCount / stats.agendas.totals.attended`), incluyendo el cálculo comparativo con el periodo anterior.
    - Se vistió con el color de acento HSL `text-teal-400` manteniendo consistencia con los demás KPIs del panel.


