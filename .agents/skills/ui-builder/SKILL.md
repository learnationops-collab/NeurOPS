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
| `PageHeader` | Cabecera de la página | `title`, `logo`, `badges`, `actions`, `size`: `md` (título grande, Thalamus) · `sm` (barra baja de 52px, para herramientas de trabajo: el Inbox) |
| `HeaderActions` | Desde una sección, mandar botones y filtros a la cabecera | `replaceTitle` (la barra trae su propio «volver») |
| `Panel` | Bloque de una pantalla (sección de configuración, columna) | `as`, `size`: `md` · `sm`, `aura`, `soft` |
| `Grid` | Cómo se acomodan varios elementos | `variant`: `list` · `cards` (desde 330px) · `charts` (desde 380px) · `kpis` (4 → 2 → 1) · `column`; `as`, `ref` |
| `Kpi` | Número grande con rótulo y detalle | `label`, `value`, `aura`; `children` es el detalle (`<small>` para lo secundario) |
| `Bars` | Barras sin ejes: el embudo por paso de una tarjeta o un embudo con rótulos | `items` `[{key, value, label, display, detail, color, tip}]`, `variant`: `columns` (por defecto, alto con `--ui-bars-h`) · `rows` (rótulo, barra, número y detalle), `scale`: `linear` · `sqrt`, `label`, `onSelect(key)` (cada columna, o cada fila en `rows`, pasa a ser botón; `disabled` en un item lo deja quieto y `title` dice adónde lleva). El color de cada barra lo elige la pantalla |
| `Calendar` | Calendario de horas (semana o día) | `days` `[{key, weekday, number, today, caption, extra}]`, `startHour`, `endHour`, `hourHeight`, `zoneLabel`, `minWidth`, `nowMinutes`, `renderColumn(day, i)` (lo que va en cada columna), `columnProps(day, i)` (eventos de la columna, como arrastrar); `calendarY(minutos, startHour, hourHeight)` da la posición vertical |
| `CalendarEvent` | Tarjeta de un evento en el calendario | `top`, `height`, `title`, `line`, `time`, `sub`, `icon`, `marker`, `tooltip`; `className` (el tono) y `style` (la posición horizontal si se pisa con otras) |
| `Card` | Tarjeta | `as`, `aura` (hasta 4 colores de fondo), `soft` |
| `Aura` | Nubes de color difusas de fondo | `colors`, `size`: `card` · `hero`, `soft` |
| `EmptyState` | Vacío, cargando o sin permiso | `icon`, `title`, `aura`, `action`, `children` (el texto) |
| `ConfirmDelete` | «¿Eliminar X?» con Cancelar / Eliminar | `name`, `article` («a »), `detail`, `onCancel`, `onConfirm`, `confirmLabel`, `icon`, `extraActions`, `children` |
| `Segmented` | Pestañas, períodos, vistas, colas (opciones excluyentes) | `value`, `options` `[{value, label, icon, count, props}]` (`count`: la cuenta al lado del rótulo, «Activos 4») (`props` va a ese botón: `title`, `aria-label` si es solo ícono, `style`), `onChange`, `size`: `md` · `sm`, `orientation`: `horizontal` · `vertical` (lista de colas a la izquierda de una bandeja), `label`, `itemProps` (va a todos), `prefix` (antes de las opciones), `radio` (se anuncia como grupo de radio) |
| `Select` | Desplegable propio (teclado completo, búsqueda tipeando). Su lista va en la capa superior (`subirACapa`): encima de todo, también dentro de un Modal | `value`, `options` `[{value, label, icon, iconColor}]` (`value: ''` = opción vacía), `onChange`, `size`, `label`; los atributos extra van al botón y `data-nav` también a las opciones |
| `Input` | Campo suelto | `variant`: `number` (corto y centrado) · `date`, `invalid`, `as="textarea"`; el resto va al `<input>` (y `ref`) |
| `InputGroup` | Campo con ícono o texto fijo adelante y, a veces, botón pegado | `prefix`, `invalid`, `as="form"`; el `<input>` va como hijo, sin clase |
| `FieldError` | Mensaje de error de un campo | `role` (`alert` por defecto; `note` para una aclaración), `icon` (`false` lo saca), `as` |
| `Switch` | Interruptor sí/no | `checked`, `onChange`, `label`; sin `onChange` es solo un indicador (dentro de una fila que ya es botón) |
| `Stepper` | Contador con − y + | `value`, `min`, `max`, `onChange`, `display` (texto en lugar del número), `label` |
| `Modal` | Ventana sobre la página (Escape, clic afuera, foco, bloquea el scroll). Su entrada no deja un `transform` en efecto, así un `Select` de adentro abre contra la pantalla; no le pongas `transform`/`filter` propios | `onClose`, `className` (ancho propio), `labelledBy`, `id` |
| `ModalHeader` | Cabecera de un modal: ícono, título, subtítulo y cerrar | `title`, `subtitle`, `icon`, `titleId` (para `labelledBy` del Modal), `size`: `md` · `lg`, `actions` (antes de cerrar: vistas, menús), `children` (fila de abajo a todo el ancho: pestañas), `flush` (modal sin padding: la cabecera trae su margen y una línea abajo), `onClose`, `closeProps` |
| `TextArea` | Texto largo que crece solo | `value`, `invalid`, `bare` (sin el estilo de campo, para pantallas con estilo propio) |
| `toast()` + `Toaster` | Aviso corto abajo de la pantalla | `toast(texto, tone: success · error, action: {label, onClick})`; `<Toaster />` una vez en la app; `--ui-toast-bottom` si no hay dock |
| `Tooltip` | Ayuda al pasar el mouse | `<Tooltip />` una vez en la app; cualquier elemento con `data-tip="Título|detalle"` |
| `Avatar` | Foto o iniciales sobre un color | `name`, `photo`, `color`, `size`: `md` · `lg` · `sm` · `xs` |
| `Chip` | Etiqueta de estado o categoría | `color`, `icon`, `subtle`, `square` (solo ícono), `as="button"` (filtro con `aria-pressed`) |
| `Status` | Estado con punto de color («● ACTIVO»), más liviano que un Chip: en la tarjeta o en la barra de la cabecera | `color` |
| `Skeleton` | Envoltorio de un esqueleto de carga: `role="status"`, `aria-busy` y el texto para el lector | `label`, `as` |
| `SkeletonBlock` · `SkeletonText` · `SkeletonCircle` | Las piezas: rectángulo, renglones de texto, avatar. Brillo que barre con los tokens del tema; quietas con reduced-motion | Block: `width`, `height`, `radius`, `step` (lugar en la ola). Text: `lines`, `width`, `lastWidth`, `height` (el hueso), `lineHeight` (el renglón real). Circle: `size` |
| `SkeletonKpi` · `SkeletonRow` · `SkeletonPanel` · `SkeletonChart` | Composiciones: tarjeta KPI, fila de lista o tabla, panel con filas, panel con gráfico | Kpi: `className` (la de la tarjeta real), `valueHeight`, `lineHeight`, `detail`. Row: `cells` (anchos), `columns` (grilla real), `avatar`, `height`. Panel: `className`, `title`, `titleWidth`, `rows`, `rowHeight`, `children`. Chart: `variant`: `bars` · `area`, `height`, `bars`. Todas: `step` |
| `Reveal` | Muestra el esqueleto hasta que llega el dato y lo hace entrar (sube 6 px y aparece) | `ready`, `skeleton`, `as`, `delay` (ms, para escalonar), `className` |
| `skeletonDelay(i)` · `useEntryWindow()` | Retraso topeado del elemento `i` de una tanda; ventana en la que las filas reales entran escalonadas al reemplazar al esqueleto (`[entering, open]`) | — |

Todo lo que no es prop (`onClick`, `disabled`, `ref`, `data-nav`, `autoFocus`, `title`, `data-tip`…) pasa directo al elemento HTML.

### Menús, listas y popovers (cualquier flotante)

Regla del usuario: un desplegable se ve **encima de todo, siempre**, opaco y entero en la pantalla, con cualquier tema.

- **Encima de todo:** el flotante va en la capa superior del navegador (`popover="manual"`), no con `z-index`. Un `z-index` compite solo dentro del contexto de apilamiento de su padre, y un ancestro con `transform`, `opacity`, `filter` o una entrada animada lo atrapa (el menú de la pastilla del Resumen de Workshop quedaba debajo de las tarjetas KPI).
  - Si es `position:absolute` bajo su botón (`.menu`, `.config-panel`, `.fi-pop`, la lista de un buscador): `ref={useEnPantalla()}` (`components/ui/useEnPantalla.js`). Lo sube a la capa, lo deja donde lo pone su CSS (mide el ancla antes), lo sigue al scrollear y lo corre lo justo para que no se salga. En la Ficha, `usePopover()` ya trae ese `pop`.
  - Si ya se ubica solo con `position:fixed` (calcula `top`/`left` contra el botón): `subirACapa(nodo)` (`components/standard/capa.js`) al abrirlo.
  - El nodo sigue en su lugar del DOM: el clic afuera con `contains`, el tab y los estilos por contexto (`.dc-shell .menu`) no cambian.
- **Opaco:** el fondo es un token de menú (`--bg-flotante`, `--ui-popover-bg`, `--ln-popover-bg`; en Tailwind, `bg-popover`), nunca el de una ventana o tarjeta de vidrio (`--bg-surface`, `bg-surface`, `bg-main`, `bg-slate-900/95`, `backdrop-filter`).
- **Las entradas de contenedores** (`.vista > *`, modales) van con `animation … backwards`, no `both`: `both` deja el `transform` en efecto y atrapa lo `fixed` y los `z-index` de adentro.
- `flotantes.test.js` lo controla: falla si un archivo dibuja un menú sin la capa, si un fondo de menú deja de ser opaco en algún tema o si una entrada vuelve a `both`.

En Thalamus, `data-nav` marca lo que sigue habilitado en solo lectura (el setter): navegar, copiar, probar. Lo que cambia la configuración no lo lleva.

### Cargas: esqueletos (receta)

Nada de spinners ni tarjetas «Cargando…» que tapan la pantalla. **Cada bloque muestra su esqueleto hasta que llega SU dato.**

1. Lo que no depende de datos (cabecera, pestañas, filtros, botones) se dibuja al instante.
2. Cada bloque depende solo del pedido que lo llena: un estado por pedido (`null` = cargando), pedidos en paralelo, nunca un `loading` global que espere al más lento.
3. Mientras su dato es `null`, el bloque dibuja su esqueleto con la **misma caja** que el real: pasale a `SkeletonKpi`/`SkeletonPanel`/`SkeletonChart` la `className` de la tarjeta real y medí cifra, renglones y filas (`lineHeight` = alto del renglón real). Si al llegar el dato algo de abajo salta, el esqueleto está mal medido.
4. Un `Skeleton` (con `label` que diga qué carga) por bloque o por grupo; las piezas de adentro son decorativas.
5. Al llegar: `<Reveal ready={dato != null} skeleton={…} delay={…}>`. Si el bloque ya anima su propia entrada, alcanza con cambiar esqueleto por contenido.
6. `step` escalona la ola del brillo y la entrada dentro de un esqueleto (0, 1, 2…).
7. Recargar no vuelve a vaciar la pantalla: se deja el dato viejo a la vista (atenuado si hace falta) hasta que llegue el nuevo. El esqueleto es solo para la primera carga.
8. Listas largas con las filas reales entrando escalonadas: `useEntryWindow()` + `skeletonDelay(i)`.
9. Una `ListaConfigurable` cargando: `EsqueletoLista` (`components/listas/`) con sus mismas `columnas`, `claveGuardado`, `facetas` y `agrupables`. Dibuja la barra, la cabecera con los nombres reales y filas con la misma grilla (lee las columnas que la persona eligió).

```jsx
<Reveal ready={goals != null} skeleton={<Skeleton label="Cargando las metas…"><SkeletonPanel className="panel" rows={8} rowHeight={44} /></Skeleton>}>
    <Metas goals={goals} />
</Reveal>
```

`components/huesos/Huesos.jsx` (`Hueso`, `Esqueleto`, `Renglon`, `escalonDe`) es un adaptador sobre estos para las pantallas que ya lo usaban; código nuevo usa los estándar.

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

## Granularidad: bloques, no piezas sueltas

El catálogo de piezas chicas (botón, chip, campo) ya está completo. **De acá en adelante, lo que se estandariza son bloques**: la botonera de un pie de modal, la cabecera de un modal, la fila de una lista, la tarjeta de un listado, una sección de formulario. Un bloque estándar arma las piezas por dentro y la pantalla solo le pasa datos.

- No se crea un componente estándar para una pieza que aparece en una sola pantalla, ni una prop para un detalle de un solo uso. Eso queda en la pantalla.
- Un componente nuevo se justifica cuando el **bloque entero** se repite (o se va a repetir) en dos pantallas o más.
- Antes de agregar una variante a una pieza chica, preguntá si el problema no es que falta el bloque que la contiene.

## Decisiones tomadas (19/10)

- **Confirmar un borrado:** una sola forma, la caja `ConfirmDelete` (en el editor de formularios, la misma caja flota debajo de la papelera). El botón que la abre es siempre `danger`.
- **Cabeceras de modal:** todas con `ModalHeader` (Horario, Configuración y Funnel usan `flush`); las pestañas de Configuración van debajo, con `Segmented`.
- **`link-btn--sutil`:** se descarta. Esos dos usos siempre se vieron como links normales y así quedan.
- **Avatar `lg`:** mide 48px, como decía la regla original.
- **Errores de campo:** siempre `FieldError`.
- **Switch decorativo:** un `Switch` sin `onChange` se dibuja como indicador (un `span` sin foco ni rol de botón), para filas que ya son botón como la del modal de importar preguntas. No es una variante nueva: es el mismo componente sin acción.
- **Barras:** el gasto por embudo de Marketing se queda con sus tarjetas (Kerwin, 19/10: las filas de `Bars` se veían grandes y amontonadas). La lista de campañas de Workshop (`BarraCrece`) es única de esa pantalla y queda ahí.

## Pendientes conocidos

- Calendar: los tonos de las tarjetas (llamada, libre, margen, ocupado, cancelada, hueco) viven en thalamus.css. Cuando otra pantalla use el calendario, pasarlos a variantes genéricas de CalendarEvent (`tone`: solid · soft · muted · success · dashed · hatched).
- Calendar vista de mes: falta. La usan la página pública del lead (PasoCalendario) y la ficha del closer (SelectorFecha); son pantallas activas, migrar con cuidado.
- Inbox (17/10): bandeja de triage, flujos con mini-embudo y lienzo con inspector fijo. Queda la vista previa del mensaje como lo ve el lead.
