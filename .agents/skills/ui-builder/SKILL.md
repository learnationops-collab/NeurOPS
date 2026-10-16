---
name: ui-builder
description: Construir o modificar pantallas del frontend usando primero los componentes estándar (frontend/src/components/standard). Usar siempre que se cree o cambie UI en React, se migre una pantalla vieja, o se dude qué botón, tarjeta o estado vacío usar.
---

# ui-builder

Objetivo: que toda la app se vea igual y que cada mejora de UI sea acumulativa. Si se mejora un componente estándar, la mejora llega a todas las pantallas que lo usan.

## Principio

**El componente es el mismo; lo que cambia son los datos que le pasa la pantalla.**

- La pantalla calcula (reglas de negocio, filtros, permisos) y le pasa el resultado al componente.
- El componente solo dibuja. Sus props hablan su idioma (`blocks`, `variant`, `color`, `title`), nunca el del negocio (`closer`, `coverage`, `funnel`).
- Las variantes son visuales (`variant="primary"`, `view="week"`), no de negocio. Si una prop la necesita una sola pantalla, esa lógica va en la pantalla.
- Cuando una pantalla necesita poner contenido propio dentro del componente, se usan `children` o una prop que recibe un nodo, que funcionan como los slots de Blade (`action`, `badges`, `icon`). No se agregan flags.

## Orden para construir UI

1. **Buscá en el catálogo** de abajo. Si existe, usalo.
2. **Si existe pero le falta algo**, agregale una variante o una prop visual al componente estándar, con su test, en lugar de copiarlo en la pantalla.
3. **Si no existe y se repite** (o se va a repetir) en dos pantallas o más, crealo en `frontend/src/components/standard/`, exportalo en `index.js`, sumale tests en `standard.test.jsx` y agregalo al catálogo de este archivo.
4. **Solo si es único de esa pantalla**, escribilo en la pantalla.

No escribas a mano `className="btn btn--…"`, `"ibtn …"`, `"link-btn"`, `"panel vacio"`, `"ed-pie--borrar"` ni `"tope"`: tienen componente.

## Catálogo

Import: `import { Button, … } from '<ruta>/components/standard';`

| Componente | Para qué | Props principales |
|---|---|---|
| `Button` | Toda acción con texto | `variant`: `secondary` (por defecto) · `primary` (la acción principal, una por zona) · `ghost` · `danger` (abre una confirmación) · `dangerSolid` (confirma un borrado). `size`: `sm` (por defecto) · `md`. `icon`: un nodo. |
| `IconButton` | Acción de solo ícono | `icon`, `label` (obligatorio, lo lee el lector de pantalla), `size`: `md` · `sm` · `xs`, `danger`, `pressed` |
| `LinkButton` | Acción con aspecto de link («+ Opción») | `icon`, `subtle` |
| `PageHeader` | Cabecera de la página | `title`, `logo`, `badges`, `actions` |
| `HeaderActions` | Desde una sección, mandar botones y filtros a la cabecera | `replaceTitle` (la barra trae su propio «volver») |
| `Card` | Tarjeta | `as`, `aura` (hasta 4 colores de fondo), `soft` |
| `Aura` | Nubes de color difusas de fondo | `colors`, `className` (`humo--hero`, `humo--tarjeta`) |
| `EmptyState` | Vacío, cargando o sin permiso | `icon`, `title`, `aura`, `action`, `children` (el texto) |
| `ConfirmDelete` | «¿Eliminar X?» con Cancelar / Eliminar | `name`, `article` («a »), `detail`, `onCancel`, `onConfirm`, `confirmLabel`, `icon`, `extraActions`, `children` |
| `Chip` | Etiqueta de estado o categoría | `color`, `icon`, `subtle` |

Todo lo que no es prop (`onClick`, `disabled`, `ref`, `data-nav`, `autoFocus`, `title`, `data-tip`…) pasa directo al elemento HTML.

En Thalamus, `data-nav` marca lo que sigue habilitado en solo lectura (el setter): navegar, copiar, probar. Lo que cambia la configuración no lo lleva.

Íconos: los componentes reciben un nodo. En Thalamus, `<Icono n="plus" />` (`pages/agendas_v2/ui/base.jsx`); en el resto, lucide-react.

## Estilos y temas

- Los componentes dibujan con las clases de `pages/agendas_v2/thalamus.css`. **Hoy solo se ven bien dentro de una raíz `.thalamus`** (Thalamus e Inbox). Llevarlos a otras pantallas requiere sacar sus estilos de ese encierro: es el paso siguiente del plan.
- Los colores salen de los temas propios (`frontend/src/temas/`, variables `--ln-*`). Nunca pongas colores fijos en un componente estándar: usá las variables del tema. Así se puede experimentar con colores, márgenes y bordes sin tocar la estructura.
- No uses `components/ui/Button.jsx`, `Card.jsx` ni `Badge.jsx` en código nuevo: son el estilo viejo y quedan solo para las pantallas que todavía no se migraron.

## Pendientes conocidos

- Tres formas distintas de confirmar un borrado: caja (`ConfirmDelete`), popover (editor de formularios) y en línea (Mis eventos, Funnel). Falta decidir una.
- El botón que abre la confirmación es `danger` en Evento y `secondary` en Funnel.
- Próximos componentes: `Input` (campo con ícono, label oculto y botón), `Grid` (`kpis` · `auto` · `list`) y `Calendar` (`month` · `week` · `day`).
