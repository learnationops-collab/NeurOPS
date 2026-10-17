---
name: ui-builder
description: Construir o modificar pantallas del frontend usando primero los componentes estándar (frontend/src/components/standard). Usar siempre que se cree o cambie UI en React, se migre o integre una sección, o se dude qué botón, tarjeta o estado vacío usar.
---

# ui-builder

Objetivo: que toda la app se vea igual y que la calidad de la UI mejore **por componente, no por sección**. Cuando se mejora un componente estándar, la mejora llega a todas las pantallas que lo usan.

## Principio

**El componente es el mismo; lo que cambia son los datos que le pasa la pantalla.**

- La pantalla calcula (reglas de negocio, filtros, permisos) y le pasa el resultado al componente.
- El componente solo dibuja. Sus props hablan su idioma (`blocks`, `variant`, `color`, `title`), nunca el del negocio (`closer`, `coverage`, `funnel`).
- Las variantes son visuales (`variant="primary"`, `view="week"`). Si una prop la necesita una sola pantalla, esa lógica va en la pantalla.
- Para meter contenido propio de la pantalla dentro del componente se usan `children` o una prop que recibe un nodo (`action`, `badges`, `icon`), que funcionan como los slots de Blade. No se agregan flags.

## Cómo decidir (antes de escribir UI)

1. **¿Qué necesita esta interfaz?** Listá las piezas: cabecera, acciones, listado, estados vacíos, confirmaciones, etc.
2. **¿Con qué componentes cuento?** Revisá el catálogo de abajo y la página `/ui`.
3. **¿Alguno se puede adaptar?** Si alcanza con una variante o una prop visual nueva, agregala al componente estándar (con test y en el catálogo). No copies el componente en la pantalla.
4. **¿La adaptación es excesiva?** Lo es si exige una prop de negocio, una variante que solo usaría esta pantalla, o cambiar lo que el componente ya hace en otras. En ese caso:
   - si la pieza se repite (o se va a repetir) en dos pantallas o más, creá un componente estándar nuevo;
   - si es única de esta pantalla, escribila en la pantalla.

No escribas a mano `className="btn …"`, `"ibtn …"`, `"link-btn"`, `"chip"`, `"panel vacio"`, `"ed-pie--borrar"` ni `"tope"`: tienen componente.

## Integrar una sección (modelo acumulativo)

La base es Thalamus. Cuando se incorpora una sección (por ejemplo Workshop, el dashboard comercial o la Ficha), **se respeta su lógica original** y su UI pasa a los componentes estándar:

- Si la sección resuelve algo **mejor** que el componente (un título, un modal, un estado vacío), esa mejora **se lleva al componente estándar**, y desde ahí mejora a Thalamus y a todas las demás.
- Si resuelve algo **distinto** pero equivalente, se elige una versión. No conviven dos.
- Toda mejora que cambie lo que se ve en otras pantallas se acuerda con el equipo antes de subirla.
- Las secciones activas (cierre de los closers, marketing) se migran con más cuidado: una pantalla por vez, comparando antes y después.

El **Learnation DS** (`components/learnation-ds/`, del Manual de Marca v2.0, clases `ln-*`) se integra de la misma forma: es una sección más que aporta sus soluciones. Su `ln-btn--ghost` es la referencia para el botón de borde (`secondary`).

## Revisión periódica (evitar la saturación)

Cada tanto (por ejemplo, al cerrar cada integración de sección), revisar el catálogo:

- **Usos:** un componente con un solo uso, ¿sigue siendo estándar? Contalo con `grep -rn "<Nombre" frontend/src`.
- **Duplicados:** dos componentes que hacen casi lo mismo se fusionan.
- **Props:** una prop que nadie usa se borra; una prop con nombre de negocio está en el lugar equivocado.
- **Variantes:** si una variante creció demasiado, quizá es otro componente.

## Catálogo

Página en vivo: **`/ui`** (admin y dirección comercial). Muestra cada componente en Modern o Classic, claro u oscuro, dentro de Thalamus o del dashboard comercial.

Import: `import { Button, … } from '<ruta>/components/standard';`

| Componente | Para qué | Props principales |
|---|---|---|
| `Button` | Toda acción con texto | `variant`: `secondary` (por defecto) · `primary` (una por zona) · `ghost` · `danger` (abre una confirmación) · `dangerSolid` (confirma un borrado). `size`: `sm` (por defecto) · `md`. `icon`: un nodo. |
| `IconButton` | Acción de solo ícono | `icon`, `label` (obligatorio, lo lee el lector de pantalla), `size`: `md` · `sm` · `xs`, `danger`, `pressed` |
| `LinkButton` | Acción con aspecto de link («+ Opción») | `icon`, `subtle` |
| `PageHeader` | Cabecera de la página | `title`, `logo`, `badges`, `actions` |
| `HeaderActions` | Desde una sección, mandar botones y filtros a la cabecera | `replaceTitle` (la barra trae su propio «volver») |
| `Panel` | Bloque de una pantalla (sección de configuración, columna) | `as`, `size`: `md` · `sm`, `aura`, `soft` |
| `Grid` | Cómo se acomodan varios elementos | `variant`: `list` · `cards` (desde 330px) · `charts` (desde 380px) · `kpis` (4 → 2 → 1) · `column`; `as`, `ref` |
| `Kpi` | Número grande con rótulo y detalle | `label`, `value`, `aura`; `children` es el detalle (`<small>` para lo secundario) |
| `Calendar` | Calendario de horas (semana o día) | `days` `[{key, weekday, number, today, caption, extra}]`, `startHour`, `endHour`, `hourHeight`, `zoneLabel`, `minWidth`, `nowMinutes`, `renderColumn(day, i)` (lo que va en cada columna), `columnProps(day, i)` (eventos de la columna, como arrastrar); `calendarY(minutos, startHour, hourHeight)` da la posición vertical |
| `CalendarEvent` | Tarjeta de un evento en el calendario | `top`, `height`, `title`, `line`, `time`, `sub`, `icon`, `marker`, `tooltip`; `className` (el tono) y `style` (la posición horizontal si se pisa con otras) |
| `Card` | Tarjeta | `as`, `aura` (hasta 4 colores de fondo), `soft` |
| `Aura` | Nubes de color difusas de fondo | `colors`, `size`: `card` · `hero`, `soft` |
| `EmptyState` | Vacío, cargando o sin permiso | `icon`, `title`, `aura`, `action`, `children` (el texto) |
| `ConfirmDelete` | «¿Eliminar X?» con Cancelar / Eliminar | `name`, `article` («a »), `detail`, `onCancel`, `onConfirm`, `confirmLabel`, `icon`, `extraActions`, `children` |
| `Segmented` | Pestañas, períodos, vistas (opciones excluyentes) | `value`, `options` `[{value, label, icon, props}]` (`props` va a ese botón: `title`, `aria-label` si es solo ícono, `style`), `onChange`, `size`: `md` · `sm`, `label`, `itemProps` (va a todos), `prefix` (antes de las opciones), `radio` (se anuncia como grupo de radio) |
| `Select` | Desplegable propio (teclado completo, búsqueda tipeando) | `value`, `options` `[{value, label, icon, iconColor}]` (`value: ''` = opción vacía), `onChange`, `size`, `label`; los atributos extra van al botón y `data-nav` también a las opciones |
| `Input` | Campo suelto | `variant`: `number` (corto y centrado) · `date`, `invalid`, `as="textarea"`; el resto va al `<input>` (y `ref`) |
| `InputGroup` | Campo con ícono o texto fijo adelante y, a veces, botón pegado | `prefix`, `invalid`, `as="form"`; el `<input>` va como hijo, sin clase |
| `FieldError` | Mensaje de error de un campo | `role` (`alert` por defecto; `note` para una aclaración), `icon` (`false` lo saca), `as` |
| `Switch` | Interruptor sí/no | `checked`, `onChange`, `label` |
| `Stepper` | Contador con − y + | `value`, `min`, `max`, `onChange`, `display` (texto en lugar del número), `label` |
| `Modal` | Ventana sobre la página (Escape, clic afuera, foco, bloquea el scroll) | `onClose`, `className` (ancho propio), `labelledBy`, `id` |
| `ModalHeader` | Cabecera de un modal: ícono, título, subtítulo y cerrar | `title`, `subtitle`, `icon`, `titleId` (para `labelledBy` del Modal), `size`: `md` · `lg`, `onClose`, `closeProps` |
| `TextArea` | Texto largo que crece solo | `value`, `invalid`, `bare` (sin el estilo de campo, para pantallas con estilo propio) |
| `toast()` + `Toaster` | Aviso corto abajo de la pantalla | `toast(texto, tone: success · error, action: {label, onClick})`; `<Toaster />` una vez en la app; `--ui-toast-bottom` si no hay dock |
| `Tooltip` | Ayuda al pasar el mouse | `<Tooltip />` una vez en la app; cualquier elemento con `data-tip="Título|detalle"` |
| `Avatar` | Foto o iniciales sobre un color | `name`, `photo`, `color`, `size`: `md` · `lg` · `sm` · `xs` |
| `Chip` | Etiqueta de estado o categoría | `color`, `icon`, `subtle`, `square` (solo ícono), `as="button"` (filtro con `aria-pressed`) |
| `Status` | Estado con punto de color («● ACTIVO»), más liviano que un Chip: en la tarjeta o en la barra de la cabecera | `color` |

Todo lo que no es prop (`onClick`, `disabled`, `ref`, `data-nav`, `autoFocus`, `title`, `data-tip`…) pasa directo al elemento HTML.

En Thalamus, `data-nav` marca lo que sigue habilitado en solo lectura (el setter): navegar, copiar, probar. Lo que cambia la configuración no lo lleva.

Íconos: los componentes reciben un nodo. En Thalamus, `<Icono n="plus" />` (`pages/agendas_v2/ui/base.jsx`); en el resto, lucide-react.

En Thalamus, `Seg`, `Sx`, `Switch`, `Paso`, `Modal` y `Avatar` de `ui/base.jsx` son **adaptadores**: traducen la forma de Thalamus (opciones `{v, n, icono}`, `nav`) a los estándar, que son los que dibujan. Código nuevo usa los estándar directamente.

## Al crear o cambiar un componente estándar

1. Código en `frontend/src/components/standard/`, exportado en `index.js`.
2. Estilos solo en `standard.css`, con clases `ui-*` y variables `--ui-*`. Nunca colores fijos: cada `--ui-*` lee el tema (`--ln-*`), después la variable de la pantalla y, al final, un valor de respaldo.
3. Si el componente tiene base propia (`.ui-x.ui-x{…}`), sumá `.ui-x` al bloque `:where(…)` de variables del principio de `standard.css`. Si falta, sus `var(--ui-…)` quedan vacías sin error visible; `css.test.js` lo detecta.
4. Test en `standard.test.jsx` (o el archivo de su familia: `controls`, `fields`).
5. Ejemplo en la página `/ui` (`pages/ui/Catalogo.jsx`, array `SECCIONES`).
6. Fila en el catálogo de este archivo, en el mismo commit.

Si una pantalla necesita ajustar el componente según el contexto (por ejemplo, más bajo dentro de un campo), la regla va en el CSS de esa pantalla, apuntando a la clase `ui-*`. Así le gana a la base sin tocar las otras pantallas.

**Especificidad:** la base de cada componente pesa dos clases (`.ui-btn.ui-btn`). Un ajuste por contexto tiene que pesar **al menos tres** (`.thalamus .ev-acc .ui-btn--secondary`, `.thalamus .fm-setters .fm-setter`). Con dos (`.thalamus .fm-setter`) empata con la base, y gana la hoja que el bundle cargue última: hoy anda, mañana no.

## Estilos y temas

- `standard.css` funciona en cualquier pantalla: usa su propio prefijo, así que no choca con los `.btn` y `.chip` de la Ficha, Hiring o el dashboard, ni con los `ln-*` del DS.
- Fuera de `.thalamus`, `.dc-shell` y los demás shells, `index.css` fuerza la tipografía con `!important`. Ahí los pesos 800 y 900 se ven como 400 y 600. Usar los componentes en pantallas viejas requiere sumar esa pantalla a las exclusiones de `index.css`, o migrarla a un shell.
- No uses `components/ui/Button.jsx`, `Card.jsx` ni `Badge.jsx` en código nuevo: son el estilo viejo.

## Pendientes conocidos

- Hay tres formas de confirmar un borrado: caja (`ConfirmDelete`), popover (editor de formularios) y en línea (Mis eventos, Funnel). Falta elegir una.
- El botón que abre la confirmación es `danger` en Evento y `secondary` en Funnel.
- En el CSS viejo, `link-btn--sutil` nunca tuvo efecto: la regla base, escrita después, le pisaba el color. Los dos usos (Configurar evento › funnel, Sesiones › «Usar la propuesta») se ven como links normales y se migraron así. ¿Deberían ser `subtle`?
- Avatar `lg` hoy solo suma una sombra: en el CSS viejo `.avatar--l` quedaba antes que `.avatar` y la base le pisaba el tamaño. ¿Debería medir 48px, como decía la regla?
- El switch del modal de importar preguntas es solo un indicador dentro de una fila que ya es botón (un `Switch` ahí sería un botón dentro de otro): falta una variante decorativa.
- El error de «Nuevo evento» de la lista de Eventos usa `.err-nuevo` (12px, peso normal) y el de arriba `FieldError` (12,5px, negrita): unificar.
- Hay tres cabeceras de modal con diseño propio (Horario `hor-cab`, Configuración `conf-cab` con pestañas, Funnel `fm-cab`): candidatas a unificar con `ModalHeader` (cambia lo que se ve).
- Calendar: los tonos de las tarjetas (llamada, libre, margen, ocupado, cancelada, hueco) viven en thalamus.css. Cuando otra pantalla use el calendario, pasarlos a variantes genéricas de CalendarEvent (`tone`: solid · soft · muted · success · dashed · hatched).
- Calendar vista de mes: falta. La usan la página pública del lead (PasoCalendario) y la ficha del closer (SelectorFecha); son pantallas activas, migrar con cuidado.
- Inbox (17/10): ya usa los componentes estándar. Quedan las mejoras de diseño propias (bandeja de conversaciones, errores marcados en los nodos, vista previa del mensaje).
