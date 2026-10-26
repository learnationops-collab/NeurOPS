# Plan: sistema general de vistas (datos, pestañas y plantillas)

19/10/2026. Pedido de Kerwin: que cambiar de pestaña o de vista no reconstruya todo, que cada bloque cargue con su esqueleto y por lotes, que lo cargado quede guardado, y que una mejora hecha en un lugar llegue a todas las vistas que comparten esa pieza.

## Dónde estamos

- No hay librería de datos: 152 archivos piden al servidor, 126 lo hacen dentro de un `useEffect` y casi todos vuelven a pedir cada vez que la vista se monta.
- Casi todas las pestañas se desmontan al salir (`{tab === 'x' && …}`, o un `key` que cambia). Al volver se pide todo de nuevo.
- Hay cinco cachés caseras distintas (`cacheDeVistas`, `datosTaller`, el almacén de Thalamus, `useLeads`, `settersCache`) y dos juegos de piezas repetidas: `components/standard` y `comercial/components/Shared.jsx` (PanelCab, Segmented, esqueletos, `FalloCarga` frente a `ErrorDeCarga`).
- Lo que más duele, en orden:
  1. Comercial: `/comercial/tabla` + `resumen` + `contexto`. Se piden de nuevo en cada sección y la usan director, closer, setter y operaciones.
  2. Mazo del closer: 3–4 pedidos seguidos en cada paso y después de cada acción.
  3. Finanzas y Payroll: `key={tab-periodo}` vacía todo en cada pestaña.
  4. Hiring, Workshop y Marketing: las dos últimas ya están cubiertas en parte.
- Los menús del closer, el setter y operaciones navegan con `window.location.assign`, una recarga completa que borra toda caché.

## La idea: tres piezas, una sola vez

### 1. Capa de datos: TanStack Query (v5)

- Un `QueryClient` para toda la app, en `App.jsx`:
  - `staleTime` 5 min: lo fresco no se vuelve a pedir.
  - `gcTime` 30 min: lo que nadie mira se olvida solo.
  - `retry` 1, sin pedir de nuevo al volver el foco salvo en las vistas que lo pidan.
  - Se vacía con `queryClient.clear()` al salir. Cambiar de rol o de cuenta ya recarga la página.
- Una carpeta `src/queries/` por dominio (`comercial.js`, `closer.js`, `marketing.js`…). Cada archivo tiene:
  - las claves, con su fábrica: `claves.comercial.tabla(filtros)`;
  - los hooks de lectura: `useTablaComercial(filtros)`;
  - las mutaciones, que invalidan su dominio: guardar una venta invalida `['comercial']` y `['closer']`.
  - Así se termina el «después de guardar, recargar toda la vista».
- `useDatosCacheados` pasa a ser una capa fina sobre `useQuery`. Marketing y Workshop, que ya lo usan, no cambian.
- Los sondeos (los de 20 s, 30 s y 120 s) pasan a `refetchInterval` y solo corren con la pestaña del navegador a la vista.
- Precarga: al pasar el mouse por una pestaña o un ítem del dock, `prefetchQuery`.

### 2. Pestañas que no se desmontan: `<Pestanas>`

- Es un componente estándar. Monta la pestaña recién al visitarla por primera vez y después la deja montada y oculta (`hidden` + `inert`), así vuelve al instante y con su scroll.
- Tiene un tope: las últimas 6 pestañas visitadas quedan montadas (como las del closer). Una que sale del tope se desmonta, pero sus datos siguen en la caché de Query: vuelve sin esqueleto.
- La pestaña activa va en la URL (`?tab=`), como hoy.

### 3. Plantillas: `<Vista>`, `<Bloque>` y `<ListaPorLotes>`

- **`<Vista>`:** la cáscara `.dc-shell`. Trae:
  - cabecera (rótulo, título, chip de estado);
  - un lugar para los filtros, con el período y el `EnCabecera` de hoy;
  - el botón «Recargar», que invalida las claves de esa vista;
  - las `<Pestanas>`.
- **`<Bloque query esqueleto>`:** muestra el esqueleto en la primera carga, el error con «Reintentar» si falla, el contenido cuando llega, y el contenido atenuado mientras recarga a pedido.
  - Reemplaza a `ErrorDeCarga`, `FalloCarga`, `EsqueletoPanel` y los `if (!datos)` sueltos.
  - Cada bloque pide lo suyo: carga uno por uno, sin que el más lento tape la pantalla.
- **`<ListaPorLotes>`:** `ListaConfigurable` + `useInfiniteQuery`. Un primer lote corto (50 filas) llega rápido y los siguientes se piden al bajar.
  - Necesita que el servidor acepte `limite` + `cursor` (ver Fase 5).
  - Mientras tanto, sigue mostrando de a 40 con `usePaginaProgresiva`.
- Lo repetido de `Shared.jsx` se pasa a `components/standard` y se borra el duplicado. Un arreglo en una plantilla llega a todas las vistas que la usan.

## Fases

Cada fase va en su propia sesión y su propia rama. Se integra a main y después a develop, como siempre.

| Fase | Qué | Depende de |
|---|---|---|
| 0. Base | TanStack Query + `QueryClient`, `src/queries/`, `useDatosCacheados` sobre Query, `<Pestanas>`, `<Vista>` y `<Bloque>` en `standard` (con tests y en el catálogo de la skill), y un helper de tests `renderConQuery` | — |
| 1. Comercial | `DashboardComercial`: resumen, tabla y contexto en `queries/comercial.js`; secciones con `<Pestanas>`; «Mis datos» y «Mi cartera» del closer comparten caché | 0 |
| 2. Closer | Mazo: deck, conteos y no leídos en queries; las acciones invalidan en vez de recargar; vistas del dock con `<Pestanas>`; el menú navega con el router | 0 |
| 3. Finanzas, Payroll, Setter, Operaciones | Fuera los `key` que remontan; secciones con `<Pestanas>`; menú con el router | 0 (y 1 para Revisar) |
| 4. Hiring, Marketing, Workshop, Inbox | Pasan a `queries/` y `<Pestanas>`; fuera `datosTaller.recuerdo` y los `setInterval` | 0 |
| 5. Servidor por lotes | `limite`/`cursor` en `/comercial/tabla`, `/assistant-applications`, `/marketing/entrantes` y `/workshop/landing/sesiones`; `<ListaPorLotes>` en esas listas | 0 |
| 6. Pantallas viejas | Las Tailwind de `MainLayout` (triage, reportes, AdminSalesHub, stats públicas) entran a `<Vista>` cuando se rediseñen; `MainLayout` pasa a una ruta padre con `<Outlet>` para no remontarse | 0 |

- Las fases 1 a 5 tocan archivos distintos y pueden ir en paralelo una vez que la 0 esté en main.
- Thalamus queda como está: ya tiene su almacén y su sondeo de versión. Se revisa al final.

## Cómo se sabe que está bien (en cada vista)

- Ir a otra pestaña y volver: 0 pedidos y nada de esqueleto si pasaron menos de 5 min.
- Ir a otra vista del dock y volver: igual.
- Recargar la página o tocar «Recargar»: pide de nuevo.
- Primera carga: los esqueletos se ven al instante, cada bloque entra cuando llega su dato y el primer lote de una lista tarda menos de 1 s.
- Guardar algo: se actualiza lo que cambió, sin vaciar la pantalla.
- Pasa vitest completo y el build, y se verifica en el navegador con staging en solo lectura.

## Riesgos

- Los tests de vistas que mockean `api` necesitan el proveedor de Query: lo resuelve `renderConQuery` en la fase 0. Son unos 200 archivos de test, pero solo cambian los de las vistas que se migran.
- Las pestañas montadas consumen memoria: de ahí el tope de 6. Las que tienen sondeo lo pausan mientras están ocultas.
- `App.jsx` es un archivo núcleo: en la fase 0 solo se agrega el proveedor.
