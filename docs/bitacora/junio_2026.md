# Bitácora - Junio 2026

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

