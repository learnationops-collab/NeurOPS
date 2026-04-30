# Bitácora - Abril 2026

- **30 de Abril de 2026**:
  - **Métrica CPQL en Marketing**: Se agregó el Costo por Lead Cualificado (CPQL) a los paneles de Rendimiento por Anuncio.
    - Actualización de la lógica en el backend (`app/api/manychat.py`) para calcular y retornar el `cpql`.
    - Modificación de la interfaz gráfica en el tablero general (`AdDashboardTab.jsx`) para visualizar el CPQL justo debajo del CPL con tooltips ajustados.
    - Integración de esta métrica en la tarjeta de CPL del modal de detalles del anuncio (`AdDetailModal.jsx`).

- **28 de Abril de 2026**:
  - **Reasignación Masiva de Leads**: Implementación de herramientas para corregir discrepancias y asignaciones erróneas de leads en Meta Ads.
    - Nuevo endpoint `POST /manychat-webhook/bulk-reassign/preview` para previsualizar la cantidad de leads afectados por un filtro.
    - Nuevo endpoint `POST /manychat-webhook/bulk-reassign` para ejecutar la actualización masiva del `ad_id`.
    - Interfaz gráfica en el Monitor de Webhooks con soporte para mover cantidades exactas (parámetro `limit`) entre anuncios específicos.
  - **Sistema Anti-Duplicados (ManyChat)**:
    - **Prevención (Time-Window)**: Se implementó una validación en `manychat.py` que fuerza la actualización de la interacción más reciente si un mismo usuario interactúa múltiples veces en un rango de 24h, evitando la creación de registros huérfanos.
    - **Limpieza Histórica**: Nuevo endpoint `POST /manychat-webhook/cleanup-duplicates` y botón de "Limpieza Inteligente" en el frontend para agrupar, fusionar datos útiles (ad_id, cualificacion) y purgar registros duplicados del historial.
  - **Motor de Conciliación Automática de Leads**:
    - **Ajuste Dinámico Diario**: Nuevo endpoint `POST /marketing/ads/<ad_id>/adjust-leads` que permite forzar la cantidad exacta de leads para un anuncio en un día específico.
    - **Bolsa de Reasignación y Comodines**: Si los leads sobran, el sistema los mueve a una bolsa de reasignación (`ad_id = None`). Si faltan, el sistema consume de la bolsa o, en su defecto, genera comodines momentáneos (`MOMENTARY-{uuid}`).
    - **Auto-Healing**: Función silenciosa `check_and_replace_momentary_leads` que se dispara automáticamente para reemplazar comodines con leads reales tan pronto como ingresan a la bolsa de reasignación.
    - **Frontend & Tooltips**: 
      - Se añadió un panel de edición rápida en `AdDetailModal.jsx` para ajustar leads por día.
      - Se implementó un sistema de **Tooltips Explicativos** (icono de ayuda) en todas las métricas de anuncios (Leads, % Cualificación, Agendas, Ventas, CPL, CPA, CPV, Inversión) tanto en el Dashboard principal como en el modal de detalle, detallando la definición y fórmula de cálculo de cada KPI.
      - Corrección de bug de visualización de zonas horarias en la gráfica de evolución.

- **27 de Abril de 2026**:
  - **Mejora en Marketing Intelligence**: Implementación de filtrado por fechas personalizado en el Dashboard de Rendimiento.
    - Se actualizaron los endpoints `/marketing/ads/performance` y `/manychat-webhook/stats/dashboard` para soportar `start_date` y `end_date`.
    - Rediseño del selector de periodos en el frontend (`AdDashboardTab.jsx`) con un enfoque minimalista, incluyendo iconos de calendario funcionales y validación de datos para evitar errores de renderizado.
    - Agregado buscador de anuncios en la tabla de rendimiento.
  - **Sincronización de Datos (Producción -> Local):** Se implementó un script de utilidad `actualizar_db.py` que permite volcar la información de la base de datos PostgreSQL de Railway a la SQLite local. El script utiliza SQLAlchemy para mapear todos los modelos del sistema y realizar un `merge` inteligente de registros, facilitando las pruebas en local con datos reales de producción.
  - **Seguridad y Git:** Se configuró el `.env` para manejar `DATABASE_PRODUCTION` de forma aislada y se añadió `actualizar_db.py` al `.gitignore` para prevenir fugas de credenciales o scripts de mantenimiento en el repositorio público.

- **22 de Abril de 2026**:
  - **Corrección de Estadísticas (Setters):** Se refinó la fórmula de la "Tasa de Apertura". Ahora se calcula restando del neto de leads (`Entrantes - No Leads`) aquellos que no respondieron al primer contacto (`Entrantes - Cualificación`), resultando en: `((Entrantes - No Leads) - (Entrantes - Cualificación)) / Entrantes`.
  - **Redefinición de Leads Reales:** Se ajustó la fórmula de "Leads Reales" (Leads Cualificados) para que sea `Cualificación - No Leads`. Este cambio se aplicó de forma integral en el formulario de reporte diario, los tooltips informativos y el motor de agregación del backend para garantizar la coherencia de los KPIs en todos los dashboards.
  - **Nueva Métrica - Sin Respuesta:** Se añadió una nueva estadística denominada "Sin Respuesta" (Aperturas sin respuesta), que calcula la diferencia entre los leads entrantes y los que efectivamente llegan a la etapa de Cualificación (`Entrantes - Cualificación`). Esta métrica permite visualizar rápidamente cuántos prospectos se pierden en el primer contacto.
  - **Optimización de Tasa FU:** Se corrigió la métrica de "FU Response" para que sea una tasa global. Anteriormente solo consideraba los seguimientos de la etapa de Link, ahora promedia las respuestas de todos los seguimientos realizados en todas las etapas del embudo (Cualificación, Dolor, Oferta, Link y Agenda).
  - **Ajuste de Conversión (Dolor):** Se modificó el cálculo de conversión de la etapa de "Dolor". Ahora se basa en el número de "Leads Reales" (Cualificación - No Leads) en lugar del total bruto de la etapa anterior, proporcionando una métrica de efectividad más rigurosa.
  - **Tooltips Explicativos:** Se implementó un sistema de tooltips interactivos (icono de interrogación) en todas las tarjetas de métricas (`StatCard`, `MiniRow`, `MetricCard`) tanto en el dashboard público como en el privado de los setters, detallando el significado y la fórmula de cálculo de cada KPI para mejorar la transparencia operativa.

- **21 de Abril de 2026**:
  - **Sistema de Workshop:** Se implementó una nueva infraestructura para el seguimiento de Workshops semanales integrada con ManyChat WhatsApp.
  - **Modelos de Workshop:** Creación de tablas para `WorkshopTemplate`, `WorkshopButton`, `WorkshopTemplateSent` (envíos diarios) y `WorkshopInteraction` (clicks anónimos).
  - **API de Seguimiento:** Desarrollo de endpoints en `/api/workshop/plantilla-sent` e `/api/workshop/interaction` para capturar métricas de efectividad en tiempo real.
  - **Consolidación de Migraciones:** Se realizó una limpieza profunda del historial de migraciones, unificando los cambios del día en una sola versión maestra (`777workshop123`) para asegurar un despliegue estable en la base de datos PostgreSQL de Railway.
  - **Corrección de Estadísticas:** Se solucionó un error crítico en el Performance Center donde la "Tasa de Apertura" siempre mostraba 0% (Backend: `setter.py`).


- **18 de Abril de 2026**:
  - **Experiencia del Closer:** Se unificó la experiencia del closer con el nuevo sistema de analítica premium.
  - **Navegación:** Los closers ahora son redirigidos automáticamente a sus estadísticas (`/closer/stats`) al iniciar sesión. Se añadieron botones de navegación bidireccional entre el reporte diario y el dashboard de analítica.
  - **Filtrado Dinámico:** Se implementó el auto-filtrado por ID de usuario en `PublicCloserStatsPage`, `PublicCloserReportPage` y `CloserReportsTable`, asegurando que cada closer vea y reporte sus datos de forma inmediata y segura.
  - **Arquitectura:** Se registraron las nuevas rutas protegidas en `App.jsx` y se ajustó el sistema de auto-selección de identidad en el frontend para optimizar la carga operativa del equipo de ventas.


- **15 de Abril de 2026**:
  - **Métricas de Eficacia:** Se implementó el sistema de seguimiento de eficacia de preguntas, migrando de un esquema JSON flexible a columnas estructuradas en la base de datos (`q1_useful`, `q1_unuseful`, etc.).
  - **Backend:** Se actualizaron todos los endpoints de reporte (`setter.py` y `public/setter.py`) para soportar la persistencia y agregación estadística de estas nuevas métricas.
  - **Frontend:** Refactorización total de la sección de eficacia en `SetterReportModal` y `PublicSetterReportPage`, implementando una tabla de 2x2 para capturar datos granulares de las preguntas 1 y 2.
  - **Dashboard:** Se integró la visualización de eficacia en `PublicSetterStatsPage` con un diseño minimalista posicionado al final del análisis de funnel, justo encima de las gráficas evolutivas.
  - **Webhooks:** Se actualizó el generador de imágenes de Discord para incluir la nueva sección de eficacia de preguntas en el reporte premium.
  - **Correcciones:** Se solucionó un error de pantalla blanca causado por un import faltante (`HelpCircle`) y se normalizó el cálculo de porcentajes en la UI.

- **14 de Abril de 2026**:
  - Se actualizó el flujo de inicio de sesión (`App.jsx` y `LoginPage.jsx`) para que el usuario con rol de setter ingrese, por defecto, a su página de estadísticas (`/setter/statistics`).
  - Se enlazaron correctamente las vistas del reporte diario y las estadísticas del setter, añadiendo un botón en `StatisticsPage.jsx` hacia el reporte, y un botón en `PublicSetterReportPage.jsx` para retornar a las estadísticas, mejorando la navegación general.
  - Se migró el panel de estadísticas principal de los setters a `PublicSetterStatsPage.jsx` (la misma vista completa que usa el administrador) con la condicionante de mostrar sólo su propia información y ocultar la pestaña de "Comparación".
  - Se corrigió el agregado de valores predeterminados para las estadísticas de los setters, tomando correctamente los endpoints desde `app/api/setter.py` (`get_stats_summary`) para los nuevos apartados.

- **13 de Abril de 2026**: 
  - Se implementó la lógica de evaluación de eficacia de preguntas frecuentes en el reporte diario de los setters.
  - Se añadieron componentes interactivos (input numérico y switch con tailwind) en la UI del `PublicSetterReportPage`.
  - Se corrigió un error de usabilidad en el componente `Dock.jsx` que impedía interactuar con el botón de "Cerrar Sesión".
  - Todos los cambios de backend se adaptaron para manejar adecuadamente métricas de `frequent_questions` a través del esquema JSON.
  - Limpieza de directorio raíz ("Clean Architecture"): organización de manuales hacia `docs/`, logs y crashes hacia `logs/`, centralización de herramientas bajo `scripts/` y eliminación de archivos residuales como keys expuestos.
