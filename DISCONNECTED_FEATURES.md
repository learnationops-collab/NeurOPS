# Funciones y Componentes Desconectados (Offline)

Este archivo sirve como registro histórico de todos los componentes, rutas y menús que fueron desconectados de la interfaz activa para simplificar el flujo del usuario y enfocarse en una estructura de reportes centralizados.

**No han sido borrados de la base de código**, solo removidos de `App.jsx` y `useDockNavigation.js`.

### Rutas Privadas Anteriores (Archivadas)
#### Admin
- `/admin/dashboard` -> `AdminDashboard`
- `/admin/leads` -> `AdminLeadsPage`
- `/admin/finance` -> `FinancePage`
- `/admin/financial-analysis` -> `FinancialAnalysisPage` (Reemplazado por SalesHub)
- `/admin/team` -> `TeamManagementPage`
- `/admin/settings` -> `SettingsPage`

#### Closer
- `/closer/dashboard` -> `CloserDashboard`
- `/closer/stats` -> `StatisticsPage` (Movido al SalesHub de Admin)
- `/closer/settings` -> `CloserSettingsPage`
- `/closer/leads` -> `CloserLeadsPage`
- `/closer/sales/new` -> `CloserNewSalePage`
- `/closer/appointments/new` -> `CloserNewAppointmentPage`

#### Setter
- `/setter/dashboard` -> `SetterDashboard`
- `/setter/agendas` -> `SetterAgendasPage`
- `/setter/stats` -> `SetterStatisticsPage` (Movido al SalesHub de Admin)

#### Operations & Sales Admin
Las rutas operativas como `/ops/dashboard`, `/sales-admin/*` han sido removidas temporalmente del App.jsx para simplificar la arquitectura según la última migración.

### Rutas Clásicas (Ahora Protegidas)
Las siguientes vistas que solían ser públicas ahora reemplazaron los Dashboards nativos bajo la autenticación de sus respectivos roles:
- `PublicSetterReportPage` -> Ahora exclusiva para el setter
- `PublicCloserReportPage` -> Ahora exclusiva para el closer
- `PublicTriageReportPage` -> Ahora exclusiva para el triage
- `AdManagementPage`, `PublicSalesAttributionPage` -> Ahora encapsuladas en `AdminMarketingHubPage`
- `PublicSetterStatsPage`, `PublicCloserStatsPage`, `PublicTriageStatsPage` -> Ahora encapsuladas en `AdminSalesHubPage`
- `PublicCallsBoardPage`, `SalesAttributionPage` -> Ahora encapsuladas en `AdminSheetsHubPage`
