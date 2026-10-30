# Inventario: pantallas contra el estándar (tarea 860)

Relevado el 29/10/2026 sobre `avance-local` (olas 1 y 2 integradas). **Solo lectura:** no se migró nada. El orden y los lotes son una propuesta para que Kerwin la apruebe.

**Qué se mide.** Contra el catálogo de `.agents/skills/ui-builder/SKILL.md` (`/ui`) y las normas de Kerwin del 28 y 29/10:
1. cifras con su cuenta en tooltip (`CifraConCuenta`);
2. KPI clicable que abre su lista (`VerRegistros`);
3. filtros y pestañas recordados por usuario (`useEstadoGuardado` / `useParamsGuardados`);
4. tooltips cortos (`data-tip` / `Tooltip`, no `title=`);
5. sin texto montado ni grillas 3 + 1;
6. esqueletos de carga estándar (`Skeleton`, `Reveal`, `EsqueletoLista`) y no «Cargando…» ni spinners;
7. desplegables con `Accordion`;
8. listas con `ListaConfigurable` («mostrando X de Y», columnas, filtro completo).

**Cómo se midió** (heurístico, con expresiones regulares sobre `frontend/src`, sin correr la app). Los números son un indicador, no una auditoría: «Tailwind viejo» cuenta `className` con utilidades (`flex`, `px-4`, `text-sm`…); «a mano» cuenta `className="btn|ibtn|chip"`; «vivo» es alcanzable desde `main.jsx` siguiendo imports, sin contar lo que `App.jsx` importa y no dibuja (la Ficha se carga dinámica y se tomó como viva). El detalle por grupo está en el anexo.

## 1. Lo que cambia el plan (hallazgos)

| # | Hallazgo | Consecuencia |
|---|---|---|
| 1 | **68 archivos / ≈14.700 líneas están muertos** (sin contar fixtures y stubs). `App.jsx` importa `AdminDashboard`, `AnalysisPage`, `AdminLeadsPage`, `CloserLeadsPage`, `SetterStatisticsPage`, `LeadsManagementPage`, `StyleGuidePage`, `ConstructionPage` y no los dibuja; `pages/legacy/*`, `sales_admin/*`, `SetterDeckPage` y 19 gestores/modales y 25 piezas sueltas de `components/` no los importa nadie (lista en §3). | **No se migran, se borran** (Lote 0). Saca ruido del `grep` y del conteo de «pantallas sin migrar». |
| 2 | **El dashboard comercial tiene su propio kit paralelo** (`Cifra` animada, `Tile`, `MetricaClicable`, `Segmented`, `PillMenu`, `Tip`, `Panel`, `Humo`, `EsqueletoPanel`). Marketing y Workshop ya pasaron a `Kpi`/`CifraConCuenta`/`VerRegistros`; Comercial y Closing no. | Primero se decide qué kit manda (§7, decisión 1). Es la deuda más grande y la más vista. |
| 3 | **`ListaConfigurable` (estándar) importa del kit de Comercial** (`Segmented` y `Tip` de `pages/comercial/components`, `PanelConfigurar`). | Cualquier cambio a esas piezas toca los 15 archivos que usan la lista: va en un lote propio (Lote A) y antes de los demás. |
| 4 | **Cuatro `Kpi` locales duplicados**: `TablaAnuncios.jsx:44`, `EntrantesVista.jsx:32`, `WorkshopFunnelView.jsx:38`, `WorkshopTraficoView.jsx:53`; más `KpiCard` (Closing), `StatCard` ×3 (reportes públicos), `Cifra` ×5 locales. | Convergen en `Kpi` + `CifraConCuenta`. |
| 5 | **Solo 7 archivos usan `useVerRegistros` y 15 `CifraConCuenta`**, todos en Marketing, Workshop y el panel de segmentos de Comercial. Closing, Setters, Finanzas, Revisar, Triage y Talent no. | Cumplir «toda cifra abre su lista» es trabajo nuevo en esas pantallas. |
| 6 | **Filtros recordados por usuario: solo Marketing, Workshop y `cm_segmento`/segmentos de Comercial** (11 archivos con `useEstadoGuardado`/`useParamsGuardados`). Lo demás usa `usePersistentFilters` (por navegador, ≈8 archivos vivos), `localStorage` suelto (29 archivos) o nada. | Cambio mecánico y barato: ver §5 («recordar»). |
| 7 | **30 archivos vivos pasan las 500 líneas** (regla del repo). Los peores: `CloserWorkflowPage` 3.196, `PublicFinancialSalesPage` 2.734, `FinancialAgendasPage` 1.929, `CloserPerformanceTab` 1.677, `TabResultado` 1.230. | Partir antes de migrar, o la migración no se puede revisar. |
| 8 | **`CloserPerformanceTab.jsx` (1.677 líneas) está oculto desde el 19/08** (`PublicCloserStatsPage.jsx:38-41` redirige la pestaña `performance` y no hay botón). Muerto funcional, no por import. | Confirmar con Kerwin y borrar (Lote 0b). |
| 9 | **Pantallas fuera de un shell** (`.dc-shell`, `.thalamus`, `.bg-v6`) y con Tailwind: Ventas (hub), Triage, Talent parcial, Operaciones › Ajustes. `ListaConfigurable`, `Kpi`, etc. dependen de las clases del shell y `index.css` fuerza la tipografía con `!important` fuera de ellos. | Cada una necesita primero su shell (o entrar en las exclusiones de `index.css`). Sube el esfuerzo. |
| 10 | **Nativos todavía vivos:** `confirm()`/`alert()` en 16 archivos (peor: `FinancialAgendasPage` 19, `PublicCloserReportPage` 11, `TeamManagementPage` 7); `<select>` en 48 archivos, `<input>` en 133, `animate-spin` en 55, `title="` en 147 (contra 42 con `data-tip`). | Salen en cada lote; no hace falta un lote aparte. |

## 2. Cómo está hoy cada pantalla (de más a menos migrada)

Referencia: **Marketing** y **Workshop** ya son el modelo (`CifraConCuenta`, `VerRegistros`, `ListaConfigurable`, `useParamsGuardados`, esqueletos). **Inbox, Agendas 2.0 (Thalamus), Conflictos y `/ui`** ya están en el estándar; no entran en el trabajo.

| Pantalla | Ruta | Archivo raíz (líneas) | Quién la usa | Estándar que le falta | Esf. | Riesgo |
|---|---|---|---|---|---|---|
| Marketing hub | `/admin/marketing`, `/admin/todos`, `/admin/otras` | `AdminMarketingHubPage` (228) | admin, director_marketing | `Kpi` local ×2 (`TablaAnuncios`, `EntrantesVista`) → `Kpi`; `UnattributedLeadsPage` (547, Tailwind 71, sin esqueleto, `ListaConfigurable` ya); `RendimientoWorkshop` y `ArbolMeta` con `<table>`; 34 `.btn` a mano; 2 `Accordion` ya. **La sesión E toca sus cálculos: esperar.** | S–M | Bajo |
| Workshop | `/admin/workshops` | `WorkshopDashboardPage` (441) | admin, director_marketing | 56 `.btn` a mano (`ProximosView` 10, `ReplayConfigPanel` 8); `WorkshopFormModal` 446 con Tailwind; `window.confirm` en `WorkshopDashboardPage:220`; `Kpi` locales (`WorkshopFunnelView`, `WorkshopTraficoView`); `Simulador`/`Anuncios`/`Landing` sin `CifraConCuenta`. | M | Bajo |
| Conflictos | `/conflictos` | `ConflictosPage` (100) | admin, operator, director_comercial, closer | Nada relevante. | — | — |
| Inbox / Agendas 2.0 / Copiloto | `/inbox`, `/agendas-v2`, `/copiloto` | — | admin, director_comercial, setter | Nada relevante. | — | — |
| **Dashboard comercial · Analizar** | `/admin/comercial` (Analizar), `/closer/mis-datos`, setter › Mis datos | `Analizar` (947), `Comparativas` (425), `Variabilidad` (158), `DashboardSetters` (453) | admin, director_comercial; closer y setter (acotado) | Kit propio (`Tile`, `Cifra`, `Segmented`, `Tip`, `Humo`); el KPI clicable navega a Revisar con `MetricaClicable` y no abre `VerRegistros` (solo el panel de segmentos lo usa); cuentas solo en `Tile`; esqueletos propios (`EsqueletoAnalizar`); filtro de período en URL sin «recordar»; Tailwind 38; `Analizar` pasa las 500 líneas. | L | **Alto** (la más vista) |
| **Dashboard comercial · Revisar y Operar** | `/ops/dashboard?step=registros`, pestaña Revisar | `Revisar` (866), `RevisarLista` (612), `tablasDef.js` (630), `operar/*` | operator, admin, director_comercial | Es **el origen** de `ListaConfigurable` (ya tiene «n de m», facetas, columnas): no se reemplaza. Falta la periferia: `duplicados.jsx` (484, Tailwind 47), `PanelEditarLote` (239), `ModalNoCerradas` (207), 20 `.btn` a mano, 31 «Cargando», `window.confirm` en `LeadModal`. | M | Alto |
| Dashboard comercial · Reportar | pestaña Reportar | `Reportar` (1.049) | director_comercial (reporte del día) | 14 `.btn` a mano, sin esqueleto estándar, supera 500 líneas. | M | Medio |
| **Dashboard comercial · Finanzas / Payroll / Diferencias** | `/finanzas` | `Finanzas` (876), `Diferencias` (775), `Payroll` (476) | admin, director_comercial con `can_view_finance` | **Cifras de plata sin cuenta ni lista** (0 `CifraConCuenta`/`VerRegistros`); 40 `.btn` a mano; período guardado a mano (`localStorage`, 9 usos); `Payroll.Tile` propio; `Diferencias` y `Finanzas` pasan 500 líneas. | L | **Alto** (plata) |
| Dashboard comercial · Proyección / Simulación / cáscara | `DockSecciones`, `DashboardComercial` | `DashboardComercial` (934), `simulador/*` (621) | todos los anteriores | `PillMenu` y `Segmented` propios; `EsqueletoPagina` propio; el archivo raíz es núcleo (regla de «archivos core»). | M | Alto |
| **Closing (rendimiento del closer)** | `/closer/dashboard`, hub `/admin/ventas › Dashboard` | `CloserDashboard` (219) + 18 `Performance*` (2.142) | closer, admin; director_comercial por el hub | Tailwind 219, 12 `ui/Button·Card·Badge`; `KpiCard` propio con `useDrillDown` (no `VerRegistros`); **0 esqueletos** (6 spinners); `ListaConfigurable` ya en 7 puntos; sin filtros recordados. | M–L | Medio |
| Ventas (hub) · Closers | `/admin/ventas` (pestañas Historial, Clientes nuevos, Registro de ventas/agendas, Forms) | `PublicCloserStatsPage` (427), `PublicFinancialSalesPage` (2.734), `FinancialAgendasPage` (1.929), `NewClientsTab` (595), `CloserReportsTable` (402) | admin, director_comercial | Tailwind 1.065, 7 `<table>` a mano (sin «n de m»), 5 `confirm`/`alert` en `CloserReportsTable`, 19 en `FinancialAgendasPage`, 0 esqueletos, filtros con `usePersistentFilters` (por navegador), fuera de shell. | L (×4) | Medio |
| Ventas (hub) · Setters | pestaña Setters del hub; setter › Reporte › Historial | `PublicSetterStatsPage` (1.137), `SetterReportsTable` (431), `IncomingLeadsTab` (450), `ConversationalStatsTab` (930) | admin, director_comercial; setter | Tailwind 465, 5 `<table>`, `LeadUnifiedKPI` y `ConfigurableStatCard` propios, sin esqueletos, fuera de shell. | L | Medio |
| Closer · mazo | `/closer/deck`, `/triage/deck` | `CloserWorkflowPage` (3.196) | closer, triage | **6 veces el límite de líneas**, Tailwind 153, shell `.bg-v6`+`clarity-v6.css`, 16 «Cargando», 0 estándar; `SeguimientosPane` (701, Tailwind 56) y modales del mazo con Tailwind 167. | L | **Muy alto** |
| Ficha del lead (modal) | abierta desde mazo, Revisar, Setter | `FichaLeadModal` (438), `TabResultado` (1.230), `TabHistorial` (669) | closer, setter, triage, dirección | Diseño propio dentro de `.dc-shell`; 82 `.btn`/`.ibtn` a mano (funcionan); 44 «Cargando»; solo 1 archivo usa `standard`. Valor de uniformar: bajo. | L | **Alto** |
| Setter · espacio | `/setter/deck` | `SetterEspacioPage` (335), `ReporteDiario` (620), `MisAgendas` (430) | setter | 15 `.btn` a mano; 21 «Cargando»; `ReporteDiario` pasa 500 líneas; Tálamus/`soloLectura` aparte. Sin `VerRegistros` en Reporte. | M | Medio |
| Talent | `/admin/hiring` | `HiringDashboardPage` (524), `HiringCandidateModal` (960), `TablaPostulaciones` (330) | admin, hiring | Tailwind 261, 37 `.btn` a mano, 0 esqueletos, `HiringCandidateModal` casi 1.000 líneas; `Postulaciones*` con Tailwind 177 y `ListaConfigurable` ya en 5 puntos. | L | Medio |
| Operaciones | `/ops/dashboard` (+ Ajustes, Datos, Formularios, Curso) | `OperadorEspacioPage` (200), `FormsManagementPage` (648), `TeamManagementPage` (444), `DatabasePage` (396), `AdvancedImportTool` (608), `UTMGenerator` (355), course-editor (≈1.200) | operator, admin | Tailwind 404; 12 `confirm`/`alert` nativos (`DatabaseTools`, `DatabasePage`, `TeamManagementPage`, course-editor, `CloserAliasesPanel`); `Accordion` ya en course-editor; fuera de shell. | L | Medio |
| Triage | `/triage/*` | `TriageWorkflowPage` (618), `TriageDetailModal` (283), `TriageMetricas` (140) | triage | Tailwind 216; `Kpi` estándar solo en `TriageMetricas`; `FinancialAgendasPage` es la misma de Ventas. | M | Bajo |
| Reporte del closer | `/closer/report` | `PublicCloserReportPage` (1.097) | closer, admin | 11 `alert`/`confirm`, Tailwind 143, sin esqueletos, pasa 500 líneas. | M | Medio |
| Nueva agenda del closer | `/closer/appointments/new` | `NewAppointmentPage` (256) | closer | Tailwind 27, `ui/Card·Badge`. | S | Bajo |
| Sin asignar | `/unattributed-leads` | `UnattributedLeadsPage` (547) | admin, setter, closer | Ver Marketing. | S–M | Bajo |
| Entrada / Portal | `/login`, `/portal`, `/cortex` | `LoginPage`, `Portal`, `Eleccion` | todos | Cuidada a mano (shell propio). No migrar. | — | — |
| Reserva pública | `/book/*` | `BookingPage` (426), `booking/*` | leads (público) | Pública, con marca propia: **no entra** salvo que Kerwin diga otra cosa. | — | — |
| Globales | dock, avisos, bug widget, playbook, onboarding, `DebugConsole` | `MainLayout` (138), `BugReportChat` (541), `PlaybookOverlay` (294) | todos | Tailwind 679 en `components/*` vivos; en su mayoría herramientas de soporte con poco uso por Kerwin. | M | Bajo |

## 3. Lote 0 — código muerto (borrar, no migrar)

Sin importador fuera de sí mismo (verificado con `grep -w` por nombre) o importado en `App.jsx` sin dibujarse.

| Zona | Archivos | Líneas |
|---|---|---|
| Páginas sin ruta: `admin/dashboard` (`AdminDashboard`, `ChartTile`, `StatTile`), `admin/leads/LeadsPage`, `admin/reports/AnalysisPage`, `admin/utils/StyleGuidePage`, `closer/leads/LeadsPage`, `common/ConstructionPage`, `setter/dashboard` (`StatisticsPage`, `FilterBar`, `KPIGrid`, `MessageTable`), `shared/LeadsManagementPage`, `setter/SetterDeckPage` | 14 | ≈4.200 |
| `pages/legacy/*` (5), `pages/sales_admin/*` (3), `pages/public/SetterComparisonView`, `TriageReportsTable` | 10 | ≈2.000 |
| Gestores y modales sin uso: `components/admin/{AcademyProductMapping,IntegrationsManager,ReportQuestionsManager,SetterMetricManager}`, `components/sales/*` (4), `components/funnels/*` (3), `components/modals/{AddAgenda,AgendaManager,CloserAvailability,ExpensesManager,ImportSpend,PayloadConfig,QuickAppointment,SaleDetail}Modal` | 19 | ≈4.500 |
| Piezas sueltas: `components/shared/{AnalysisSection,DashboardCharts,DashboardFilter,RevenueChart,StatsCard}`, `components/closer/{CloserKanbanBoard,CloserPerformanceReport,NextAgendaChrono}`, `components/setter/SetterPerformanceReport`, `components/cobro/EstadoCobroCliente`, `components/deck/*`, `components/dock/WheelSelector`, `components/dashboard/{HotkeysTable,NotificationWidget}`, `components/ui/{Counter,Input}`, `components/rare-ui/{delete-button,fluid-orb}`, `pages/closer/components/{ArmarPlanCuotas,CobroCockpit,FormHints,LeadEditModal}`, `ErrorBoundary` | 25 | ≈4.000 |
| Fixtures, stub y shim (`ficha/__fixtures__` ×2, `resultado.fixtures.js`, `piezasStub`, `bloqueSetterEjemplo.js`, `marketing/todos/CifraConCuenta.jsx`): **verificar primero**, los tests pueden usarlos | 6 | ≈1.000 |

- **Antes de borrar**: confirmar que ningún `.test.jsx` los importa y quitar de `App.jsx` los 8 `import` huérfanos. Los tests de lo borrado se borran con el archivo.
- **Lote 0b (decisión de Kerwin)**: `CloserPerformanceTab` (1.677) y la rama `performance` de `PublicCloserStatsPage`, ocultos desde el 19/08.
- `DatabasePage`, `OperationsPage`, `TeamManagementPage`, `DatabaseTools` y `AdvancedImportTool` **no** están muertos (los usa Operaciones › Ajustes).
- El detector marcó como «sin uso» `index.js` de `standard`, `ficha/piezas` y `comercial/components`, y `agendas_v2/.../turnos.js`: son falsos positivos (se importan como carpeta). No se borran.

## 4. Orden por valor

Valor = cuánto lo ve Kerwin y el equipo × cuánto le falta. «Brecha» = qué tan lejos está del estándar.

| # | Pantalla | Quién la ve | Brecha | Por qué en este lugar |
|---|---|---|---|---|
| 1 | Dashboard comercial · Analizar | dirección, closers, setters | Alta | La pantalla más vista y la que más cifras muestra; marca el criterio para todas. |
| 2 | Closing + Ventas (hub) · Closers | dirección, closers | Alta | «Closing» es lo que Kerwin mira cada día; 0 esqueletos, Tailwind, nativos. |
| 3 | Revisar y Operar (periferia) | operadores, dirección | Media | Ya tiene «n de m»; faltan botones, esqueletos y confirmaciones. |
| 4 | Setters (hub + Espacio) | setters, dirección | Media | Mucho uso del setter; brecha en cifras y listas. |
| 5 | Finanzas / Payroll / Diferencias | dirección con permiso | Alta | Plata sin «cuenta». Alto riesgo: ir despacio y comparar contra el actual. |
| 6 | Workshop | marketing, admin | Baja | Casi hecho; cierres puntuales. |
| 7 | Marketing | marketing, admin | Baja | Casi hecho; **esperar a la sesión E**. |
| 8 | Reportar, Triage, Talent, Operaciones | equipos chicos | Media | Uso menor; se ordenan por riesgo bajo. |
| 9 | Mazo del closer y Ficha | closers (todo el día) | Muy alta pero **riesgo muy alto** | Se parten primero sin cambiar lo que se ve; migrar el aspecto es lo último. |

## 5. Lotes para sesiones paralelas (sin tocar los mismos archivos)

Esfuerzo: **S** ≤ 2 h · **M** ≈ medio día · **L** ≈ un día o más. Cada lote es una sesión con su worktree y su carpeta; las columnas «No toca» fijan la frontera.

| Lote | Pantallas | Carpetas / archivos (exclusivos) | Esf. | Depende de |
|---|---|---|---|---|
| **0** Limpieza | Código muerto (§3) | Los 68 archivos + `App.jsx` (solo los `import`) | S | — (hacerlo primero; no choca con nadie) |
| **A** Núcleo compartido | `Segmented`/`Tip`/`PillMenu`/`Humo` de Comercial como envoltorios del estándar; `ListaConfigurable` deja de importar de Comercial | `pages/comercial/components/{Shared,Tip,useTipFlotante}.jsx`, `components/listas/ListaConfigurable.jsx`, `components/standard/*` | M | Decisión 2 (§7). Antes de L1–L3 |
| **1** Analizar | Dashboard, Comparativas, Variabilidad, Segmentos, DashboardSetters | `pages/comercial/components/{Analizar,Comparativas,Variabilidad,Segmentos*,PiezasAnalizar,DashboardSetters,EsqueletoAnalizar,Embudo,FlujoEmbudo,Reparto*,variabilidad/*}` y `components/dashboard/*` | L | A, decisión 1 |
| **2** Revisar | `operar/*`, `Revisar*`, `LeadModal`, `PanelExportar`, `ModalNoCerradas` | `pages/comercial/components/{operar,Revisar,RevisarLista,LeadModal,PanelExportar,PanelConfigurar,ModalNoCerradas}` | M | A |
| **3** Finanzas y Reportar | `Finanzas`, `Diferencias`, `Payroll`, `Reportar`, `simulador/*` | `pages/comercial/components/{finanzas,simulador,Reportar}*` | L | A |
| **4a** Closing | `CloserDashboard` y `Performance*`, `CloserReportsTable`, `NewClientsTab`, hub | `pages/closer/dashboard/*`, `pages/public/{PublicCloserStatsPage,CloserReportsTable,NewClientsTab}`, `pages/admin/reports/AdminSalesHubPage` | M–L | Decisión 4 (shell) |
| **4b** Registro de ventas | `PublicFinancialSalesPage` (partir y migrar) | `pages/public/PublicFinancialSalesPage` y lo que salga de partirla | L | 4a (comparte filtros) |
| **4c** Registro de agendas | `FinancialAgendasPage` + 2 modales; sirve a Triage | `pages/admin/reports/{FinancialAgendasPage,Agendas*Modal}` | L | — |
| **5** Setters | Hub Setters, Espacio, Reporte, Mis agendas | `pages/setter/*`, `pages/public/{PublicSetterStatsPage,SetterReportsTable,IncomingLeadsTab,ConversationalStatsTab}`, `components/shared/{LeadUnifiedKPI,ConfigurableStatCard}` | L | A (parcial) |
| **6** Workshop | Cierres puntuales | `pages/admin/workshop/*` | M | — |
| **7** Marketing | `Kpi` locales, `UnattributedLeadsPage`, tablas | `pages/admin/marketing/*` | S–M | **Sesión E termine** |
| **8** Talent | Hiring + Postulaciones | `pages/admin/{hiring,postulaciones}/*` | L | — |
| **9** Operaciones | Espacio, Ajustes, Formularios, Curso, Datos | `pages/operations/*`, `pages/admin/{database,team,backup,dashboard}/*`, `pages/shared/FormsManagementPage`, `components/{operations,admin}/*` | L | — |
| **10** Triage y reporte del closer | Triage, `PublicCloserReportPage`, `NewAppointmentPage` | `pages/triage/*`, `pages/public/{PublicTriageReportPage,PublicCloserReportPage}`, `pages/closer/records/*` | M | 4c |
| **11** Mazo del closer | **Partir** `CloserWorkflowPage` y `SeguimientosPane`, después migrar | `pages/closer/CloserWorkflowPage`, `pages/closer/components/*`, `clarity-v6.css` | L | Aprobación de Kerwin; sesión sola |
| **12** Ficha | Botones/chips a mano, `TabResultado` y `TabHistorial` partidos | `components/ficha/*` | L | Decisión 5 |
| **13** Globales | `MainLayout`, bug widget, playbook, onboarding | `components/{feedback,playbook,modals,shared}` vivos | M | — |

**Qué se puede correr a la vez.** Tras el Lote 0 y el A: 1 + 2 + 3 (Comercial, carpetas distintas), 4a, 5, 6, 8, 9. Lotes 4b/4c/10 en una segunda tanda. 7 cuando E termine. 11 y 12 al final y de a uno.

**Puntos de choque (un integrador, no los toca ningún lote en paralelo):**
- `components/standard/*` y su `standard.css` / `index.js` (si un lote necesita una variante nueva, la pide al integrador).
- `.agents/skills/ui-builder/SKILL.md` (catálogo) y `docs/DECISIONS.md` (ADR de cada decisión) y la bitácora.
- `App.jsx`, `index.css` (exclusiones de tipografía), `comercial.css` (lo comparten Comercial, el mazo del closer y 4a: cada lote agrega su CSS en un archivo propio, no en este).
- `ListaConfigurable.jsx`: solo el Lote A.

## 6. Receta por pantalla (para el brief de cada lote)

Se repite en todos: 1) medir antes y después con capturas; 2) cifras con `Kpi` + `CifraConCuenta` + `onVer` (`useVerRegistros`) y el panel `{panel}` una vez en el JSX; 3) `Segmented` para pestañas y `useParamsGuardados` / `useEstadoGuardado` para recordar pestaña, período y filtros; 4) listas con `ListaConfigurable` + `EsqueletoLista` (las que ya tienen «n de m» no se tocan); 5) cada bloque con su esqueleto (`Skeleton`/`Reveal`), el dato viejo a la vista al recargar; 6) `confirm()`/`alert()` → `InlineConfirm` / `ConfirmDelete` / `toast`; 7) `<select>`/`<input>` → `Select`/`Input`; 8) `title=` → `data-tip`, una idea de ~60 caracteres; 9) revisar que no queden textos montados ni 3 + 1 a ~995 px; 10) archivos ≤ 500 líneas.

## 7. Decisiones que necesito de Kerwin

1. **Analizar: ¿KPI → `VerRegistros` (panel lateral) o se queda `MetricaClicable` → Revisar?** La norma dice `VerRegistros`; hoy Analizar navega a otra pestaña. Cambia el flujo de la pantalla más usada.
2. **Kit de Comercial: ¿`Segmented`, `Tip`, `PillMenu`, `Humo` pasan a ser envoltorios del estándar?** Cambia el aspecto en ≈77 archivos si el estándar se ve distinto; si se ve igual, es invisible.
3. **Mazo del closer:** ¿OK partirlo en componentes **sin cambiar nada de lo que se ve** como primer paso?
4. **Pantallas sin shell** (Ventas, Triage, Operaciones › Ajustes): ¿se envuelven en `.dc-shell` (cambia la tipografía a la de Comercial)?
5. **Ficha:** los `.btn` a mano funcionan y son 82; ¿se uniforman o se dejan? Es mucho riesgo para poca ganancia visible.
6. **Borrados:** ¿OK el Lote 0 completo y el 0b (`CloserPerformanceTab`)?
7. **Reserva pública `/book` y Entrada/Portal:** quedan fuera.

## 8. Pendientes que salen de este inventario

(Por la regla de pendientes, deberían anotarse en `docs/pendientes_*.md`; esta tarea solo escribe este archivo.)

- [ ] Aprobación de Kerwin de los lotes y de las 7 decisiones de §7.
- [ ] Cargar una tarea de Leadership por lote (hoy solo existe la 860).
- [ ] `graphify update .` no se corrió (no se tocó código).
- [ ] Verificar los falsos positivos de §3 antes de borrar (carga dinámica con `import.meta.glob`, tests).

## Anexo · Métricas por grupo (archivos vivos ≥ 40 líneas)

`std` = archivos que importan de `components/standard`; `TW` = `className` con utilidades Tailwind; `btn` = `.btn/.ibtn/.chip` a mano; `ui` = `components/ui/{Button,Card,Badge}`; `Carg.` = «Cargando»/spinner; `Skel.` = menciones de esqueleto; `K·C·V` = `Kpi`·`CifraConCuenta`·`VerRegistros`; `url/ls` = `useSearchParams` / `localStorage`.

| Grupo | Arch. | Líneas | std | TW | btn | ui | `<table>` | Carg. | Skel. | K·C·V | Lista | url/ls |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Comercial · Analizar | 21 | 4.512 | 7 | 38 | 5 | 0 | 0 | 8 | 40 | 0·8·3 | 0 | 0/0 |
| Comercial · Revisar+Operar | 11 | 3.923 | 0 | 70 | 20 | 0 | 1 | 31 | 33 | 0·0·0 | 0 | 0/2 |
| Comercial · Reportar | 1 | 1.049 | 0 | 1 | 14 | 0 | 0 | 3 | 5 | 0·0·0 | 0 | 0/4 |
| Comercial · Finanzas | 10 | 3.378 | 0 | 14 | 40 | 0 | 1 | 9 | 18 | 0·0·0 | 0 | 0/9 |
| Comercial · Simulación | 6 | 621 | 0 | 0 | 1 | 0 | 0 | 1 | 2 | 0·0·0 | 0 | 0/0 |
| Comercial · cáscara | 7 | 2.212 | 2 | 2 | 3 | 0 | 0 | 15 | 30 | 0·0·0 | 0 | 2/0 |
| Closer · mazo | 1 | 3.196 | 0 | 153 | 0 | 0 | 0 | 16 | 13 | 0·0·0 | 0 | 2/0 |
| Closer · panes del mazo | 8 | 1.791 | 0 | 167 | 0 | 2 | 0 | 33 | 61 | 0·0·0 | 0 | 0/0 |
| Closing | 19 | 2.142 | 0 | 219 | 0 | 12 | 0 | 6 | 0 | 0·0·0 | 7 | 0/0 |
| Ficha | 55 | 10.837 | 1 | 5 | 82 | 0 | 0 | 44 | 23 | 0·0·0 | 0 | 0/2 |
| Ventas · Closers | 8 | 8.353 | 0 | 1.065 | 0 | 4 | 7 | 47 | 0 | 0·0·0 | 0 | 0/15 |
| Ventas · Setters | 4 | 2.948 | 0 | 465 | 0 | 0 | 5 | 24 | 0 | 0·0·0 | 0 | 0/4 |
| Setter · espacio | 19 | 3.460 | 0 | 4 | 15 | 0 | 0 | 21 | 2 | 0·0·0 | 0 | 6/4 |
| Workshop | 48 | 6.056 | 20 | 6 | 56 | 0 | 3 | 84 | 151 | 9·20·4 | 26 | 6/0 |
| Marketing | 36 | 5.133 | 18 | 82 | 34 | 0 | 3 | 49 | 114 | 9·42·6 | 17 | 2/2 |
| Talent | 18 | 5.041 | 1 | 261 | 37 | 0 | 0 | 30 | 0 | 0·0·0 | 5 | 2/0 |
| Operaciones | 27 | 4.720 | 1 | 404 | 21 | 4 | 1 | 58 | 5 | 0·0·0 | 0 | 2/11 |
| Triage | 8 | 1.969 | 1 | 216 | 0 | 0 | 0 | 22 | 7 | 4·0·0 | 0 | 0/0 |
| Conflictos | 2 | 215 | 2 | 0 | 0 | 0 | 0 | 3 | 14 | 3·0·0 | 0 | 0/0 |
| Globales (modales, feedback, playbook, shared, ui) | 40 | 6.870 | 1 | 679 | 2 | 0 | 0 | 43 | 0 | 0·0·0 | 0 | 0/4 |
| Entrada | 6 | 820 | 0 | 0 | 0 | 0 | 0 | 24 | 0 | 0·0·0 | 0 | 2/2 |
| Reserva pública | 7 | 1.239 | 0 | 164 | 0 | 10 | 0 | 2 | 0 | 0·0·0 | 0 | 2/0 |

Lectura: «Skel.» alto en Comercial viene de sus esqueletos propios (`EsqueletoPanel` etc.), no del estándar; por eso `std` es la columna que importa. `Carg.` en Workshop y Marketing incluye rótulos de sus esqueletos (`Skeleton label="Cargando…"`), así que sobrestima los spinners reales.
