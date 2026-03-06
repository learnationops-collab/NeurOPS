# Sistema de Navegación Mixto (Wheel + Dock + Flechas) — Referencia Técnica

Este documento describe el sistema de desplazamiento mixto que combina un Dock flotante horizontal con navegación vertical tipo "rueda" (wheel), controlable por mouse wheel, clicks y teclas de flechas.

---

## 1. Arquitectura General

El sistema opera en **dos ejes de navegación**:

| Eje | Concepto | Input | Ejemplo |
|-----|----------|-------|---------|
| **Horizontal** | Páginas | `← →` flechas / click en ícono del dock | Board → Leads → Stats → Settings |
| **Vertical** | Secciones dentro de una página | `↑ ↓` flechas / mouse wheel sobre dock / click en labels orbitantes | Dashboard ↔ Resumen |

```
                    [Sección Anterior]  ← orbita arriba (click o ↑)
                          ▲
  [Pág Anterior] ◄— [ PÁGINA ACTIVA / SECCIÓN ACTIVA ] —► [Pág Siguiente]
                          ▼
                    [Sección Siguiente] ← orbita abajo (click o ↓)
```

---

## 2. Componentes

### 2.1 Dock — `frontend/src/components/shared/Dock.jsx`

Barra flotante fija en la parte inferior de la pantalla. Montado por `MainLayout.jsx`.

**Estructura:**
```
┌──────────────────────────────────────────────────┐
│  [🏠]  [👥]  [📊 ══ SECCIÓN ACTIVA ══]  [⚙️]  [U]  │
└──────────────────────────────────────────────────┘
         ← Páginas horizontales →           Avatar
```

**Comportamiento:**
- Cada **página** se muestra como ícono (inactiva) o como "pill" expandida (activa) con el label de la sección actual.
- La pill activa muestra **labels orbitantes** arriba y abajo con la sección anterior/siguiente (solo si hay secciones para esa página).
- Hacer **scroll con el mouse wheel** sobre el dock cambia la sección vertical (no circular, se detiene en los extremos).
- El avatar a la derecha muestra un dropdown con info del usuario y botón de logout.

**Estilos:** Glassmorphism oscuro (`bg-[#1a1c23]/95`, `backdrop-blur-2xl`, `rounded-[2.5rem]`), pill activa azul (`bg-[#1534ff]`).

### 2.2 WheelSelector — `frontend/src/components/dock/WheelSelector.jsx`

Componente reutilizable de selector vertical tipo "rueda" con scroll infinito (loop circular).

**Props:**
| Prop | Tipo | Descripción |
|------|------|-------------|
| `items` | `[{id, icon, label}]` | Items del selector |
| `activeIndex` | `number` | Índice seleccionado |
| `onChange` | `(index) => void` | Callback al cambiar |
| `position` | `'left'` \| `'right'` | Orientación |
| `variant` | `'pill'` \| `'icon'` | Estilo de renderizado |

**Comportamiento:**
- Muestra 3 items simultáneos: anterior (arriba, fantasma opacity 0.2), actual (centro), siguiente (abajo, fantasma).
- Mouse wheel con `deltaY > 5` cambia de item (con `preventDefault`).
- Click en los items fantasma navega directamente.
- **Loop circular**: al llegar al final, vuelve al inicio.

> [!NOTE]
> `WheelSelector` es un componente genérico reutilizable. El `Dock` actualmente implementa su propia lógica de wheel y labels orbitantes directamente, sin usar `WheelSelector` como wrapper. `WheelSelector` está disponible para otros contextos que necesiten selección vertical.

### 2.3 useDockNavigation — `frontend/src/hooks/useDockNavigation.js`

Hook central que maneja toda la lógica de navegación. Consumido por `Dock.jsx`.

**Responsabilidades:**
1. **Definir páginas** según el rol del usuario
2. **Definir secciones** según la página activa
3. **Detectar página activa** desde la URL
4. **Escuchar teclado** (flechas)
5. **Sincronización bidireccional** con las páginas via CustomEvents

---

## 3. Páginas y Secciones por Rol

### Closer
| Página | Path | Secciones |
|--------|------|-----------|
| Board | `/closer/dashboard` | Dashboard, Resumen |
| Leads | `/closer/leads` | Pipeline (Kanban), Tabla |
| Stats | `/closer/stats` | _(sin secciones)_ |
| Ajustes | `/closer/settings` | Perfil, Equipo, Apariencia |

### Setter
| Página | Path | Secciones |
|--------|------|-----------|
| Board | `/setter/dashboard` | Notificaciones, Reporte |
| Stats | `/setter/stats` | _(sin secciones)_ |

### Admin
| Página | Path | Secciones |
|--------|------|-----------|
| Dashboard | `/admin/dashboard` | Inicio, Resumen |
| Leads | `/admin/leads` | _(sin secciones)_ |
| Finanzas | `/admin/finance` | _(sin secciones)_ |
| Equipo | `/admin/team` | Gestión, Estadísticas |
| Ajustes | `/admin/settings` | Perfil, Equipo, Apariencia |

### Sales Admin
| Página | Path | Secciones |
|--------|------|-----------|
| Dashboard | `/sales-admin/dashboard` | Resumen, Rendimiento |
| Equipo | `/sales-admin/team` | Gestión, Estadísticas |
| Ajustes | `/sales-admin/settings` | Perfil, Equipo, Apariencia |

### Operator
| Página | Path | Secciones |
|--------|------|-----------|
| Dashboard | `/ops/dashboard` | _(sin secciones)_ |
| Base de Datos | `/ops/database` | _(sin secciones)_ |
| Ajustes Técnicos | `/ops/settings` | Perfil, Equipo, Apariencia |

---

## 4. Sistema de Inputs

### 4.1 Teclado (Arrow Keys)

Manejado en `useDockNavigation.js`:

| Tecla | Acción | Comportamiento |
|-------|--------|---------------|
| `ArrowLeft` | Página anterior | **Circular** (último → primero) |
| `ArrowRight` | Página siguiente | **Circular** (primero → último) |
| `ArrowUp` | Sección anterior | **Circular** (solo si hay secciones) |
| `ArrowDown` | Sección siguiente | **Circular** (solo si hay secciones) |

**Protección**: No se activa si el foco está en `INPUT`, `TEXTAREA`, o `contentEditable`.

### 4.2 Mouse Wheel (sobre el Dock)

Manejado en `Dock.jsx`:

- `deltaY > 10` → Sección siguiente
- `deltaY < -10` → Sección anterior
- **No circular** (se detiene en el primer/último elemento, a diferencia del teclado)
- `preventDefault` para evitar scroll de página

### 4.3 Click Directo

- Click en ícono de página → `onPageChange(index)` → `navigate(path)`
- Click en label orbitante (arriba/abajo) → `onSectionChange(index ± 1)`

---

## 5. Sincronización Bidireccional (Custom Events)

El dock y las páginas se comunican mediante dos `CustomEvent` en `window`:

```
┌────────────────────┐                          ┌────────────────────┐
│       DOCK         │                          │      PÁGINA        │
│  useDockNavigation │                          │  (e.g. Dashboard)  │
│                    │                          │                    │
│  Usuario cambia    │ ──dispatch──────────►    │  Escucha:          │
│  sección en dock   │  'request-section-change'│  handleRequest()   │
│                    │  { detail: { index } }   │  → setActiveSection │
│                    │                          │                    │
│  Escucha:          │ ◄──dispatch──────────    │  Página cambia     │
│  handleSection     │  'page-section-changed'  │  sección interna   │
│  Change()          │  { detail: {             │  → dispatch evento │
│  → setActiveSection│    activeSection } }     │                    │
└────────────────────┘                          └────────────────────┘
```

### Evento: `request-section-change` (Dock → Página)
- **Emisor**: `useDockNavigation.js` (línea 203)
- **Receptores**: Todos los dashboards que tienen secciones
- **Payload**: `{ index: number }`
- **Propósito**: El dock le dice a la página que cambie su contenido visible

### Evento: `page-section-changed` (Página → Dock)
- **Emisor**: Los dashboards cuando cambian de sección internamente
- **Receptor**: `useDockNavigation.js` (línea 187)
- **Payload**: `{ activeSection: number }`
- **Propósito**: La página le dice al dock que sincronice su indicador visual

### Páginas que implementan la sincronización:

| Página | Archivo |
|--------|---------|
| Closer Dashboard | `pages/closer/dashboard/CloserDashboard.jsx` |
| Closer Leads | `pages/closer/leads/LeadsPage.jsx` |
| Setter Dashboard | `pages/setter/dashboard/SetterDashboard.jsx` |
| Admin Dashboard | `pages/admin/dashboard/AdminDashboard.jsx` |
| Admin Settings | `pages/admin/settings/SettingsPage.jsx` |
| Sales Admin Dashboard | `pages/sales_admin/dashboard/SalesAdminDashboard.jsx` |

---

## 6. Flujo Completo de una Navegación

### Ejemplo: Closer presiona `↓` en el Dashboard

```
1. keydown 'ArrowDown' detectado en useDockNavigation.js
2. Guard: no es INPUT/TEXTAREA → procede
3. sections.length > 0 → calcula nextIndex = (0 + 1) % 2 = 1
4. onSectionChange(1) →
   a. setActiveSection(1) en el hook
   b. dispatch 'request-section-change' { index: 1 }
5. CloserDashboard.jsx escucha el evento →
   a. setActiveSection(1) internamente
   b. Renderiza la sección "Resumen" en vez de "Dashboard"
   c. dispatch 'page-section-changed' { activeSection: 1 }
6. useDockNavigation escucha → confirma sincronización (no-op si ya coincide)
7. Dock.jsx re-renderiza:
   - Pill activa muestra "RESUMEN" como label
   - Label orbitante superior: "DASHBOARD"
   - Label orbitante inferior: (no se muestra, es el último)
```

---

## 7. Archivos Clave

| Archivo | Rol |
|---------|-----|
| `frontend/src/components/shared/Dock.jsx` | Dock flotante con pages, secciones orbitantes y wheel handler |
| `frontend/src/hooks/useDockNavigation.js` | Lógica central: roles, páginas, secciones, teclado, custom events |
| `frontend/src/components/dock/WheelSelector.jsx` | Componente genérico de selector vertical con scroll infinito |
| `frontend/src/components/MainLayout.jsx` | Monta el `Dock` en el layout principal |

### Páginas consumidoras (escuchan `request-section-change`):

| Archivo | Rol |
|---------|-----|
| `pages/closer/dashboard/CloserDashboard.jsx` | Dashboard del Closer (Dashboard / Resumen) |
| `pages/closer/leads/LeadsPage.jsx` | Leads del Closer (Pipeline / Tabla) |
| `pages/setter/dashboard/SetterDashboard.jsx` | Dashboard del Setter (Notificaciones / Reporte) |
| `pages/admin/dashboard/AdminDashboard.jsx` | Dashboard del Admin (Inicio / Resumen) |
| `pages/admin/settings/SettingsPage.jsx` | Settings del Admin (Perfil / Equipo / Apariencia) |
| `pages/sales_admin/dashboard/SalesAdminDashboard.jsx` | Dashboard del Sales Admin (Resumen / Rendimiento) |

---

## 8. Detalles de Implementación Importantes

> [!IMPORTANT]
> **Diferencia Circular vs No-Circular**: El teclado (flechas) usa navegación **circular** (hace loop), pero el wheel del mouse en el Dock es **no-circular** (se detiene en los extremos). Esto es intencional para evitar cambios accidentales por scroll.

> [!WARNING]
> **Reset de sección al cambiar página**: Cada vez que se navega a una página diferente, `activeSection` se resetea a `0`. Esto evita estados inconsistentes donde una página tiene sección 2 pero la siguiente solo tiene 1 sección.

> [!NOTE]
> **Detección de página activa**: Se usa `location.pathname.startsWith(page.path)` para detectar la página activa. Esto permite que sub-rutas (como `/closer/dashboard/detail`) sigan mostrando la página correcta como activa en el dock.
