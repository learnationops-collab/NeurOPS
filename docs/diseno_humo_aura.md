# El efecto humo — Learnation Design System

Instrucción para reproducir el fondo de humo de colores que vive dentro de
píldoras, tarjetas y paneles del sistema. Los valores de acá son los que están
corriendo en Clarity, no una aproximación.

> Guía que pasó Mario el 23/10/2026 («el estilo de Learnation, para que lo guardes acá»). Es la
> referencia para cualquier aura o humo del frontend: no se inventa otro.

---

## Qué es

No es un gradiente ni una imagen. Son **círculos de color sólido, muy
desenfocados, que se mueven en loop dentro de un contenedor recortado**. El
desenfoque los convierte en manchas suaves; el recorte hace que solo se vea el
pedazo que cae adentro del componente; el modo de fusión hace que se sumen entre
ellos en vez de taparse.

La clave estética: **los colores del humo no son decorativos, son los mismos
datos que muestra el componente**. En el botón de Clarity cada mancha es uno de
los cuatro factores — Valor, Velocidad, Urgencia, Brecha. Por eso el efecto se
siente parte del producto y no un filtro puesto encima.

---

## Anatomía

Cuatro capas, de abajo hacia arriba:

1. **El contenedor** — la píldora o la tarjeta. Tiene `position:relative`,
   `overflow:hidden` (recorta el humo al radio) e `isolation:isolate` (encierra
   el `mix-blend-mode` para que no sangre sobre el resto de la página).
2. **La caja del humo** — un `<span>` absoluto a `inset:0`, con `z-index:-1`
   (detrás del contenido pero dentro del contexto aislado),
   `border-radius:inherit`, `overflow:hidden` y `pointer-events:none`.
3. **Las manchas** — `<i>` vacíos, círculos de un solo color plano.
4. **El contenido** — número, etiqueta, barra. Queda nítido encima.

```html
<button class="clarity-btn">
  <span class="cl-humo" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
  <b>94</b><span>Clarity</span>
  <span class="riel"><i style="background:#FF3FA4;--w:34%"></i>…</span>
</button>
```

El `<span>` del humo va **primero** en el DOM y lleva `aria-hidden="true"`: es
decoración, no debe leerse.

Cuando el humo tiene que quedar por detrás de un hijo con fondo propio —el riel
oscuro de la tarjeta de foco, por ejemplo— se usa `z-index:0` en la caja y
`position:relative;z-index:1` en los hijos, en lugar de `z-index:-1`.

---

## El CSS

```css
.clarity-btn{
  position:relative; overflow:hidden; isolation:isolate;
  display:inline-flex; align-items:center; gap:10px;
  height:44px; padding:0 16px; border-radius:999px;
  background:color-mix(in srgb, var(--brand-secondary) 11%, transparent);
  border:1px solid color-mix(in srgb, var(--brand-secondary) 32%, transparent);
}

.cl-humo{
  position:absolute; inset:0; z-index:-1;
  border-radius:inherit; overflow:hidden;
  opacity:.55; pointer-events:none;
}

.cl-humo i{
  position:absolute;
  width:56%; aspect-ratio:1;      /* círculo relativo al ancho: escala solo */
  border-radius:50%;
  filter:blur(16px);              /* el desenfoque es el efecto */
  mix-blend-mode:screen;          /* se suman entre sí sobre fondo oscuro */
  opacity:.6;
}

/* Cada mancha: su color, su punto de partida, su ritmo. */
.cl-humo i:nth-child(1){ background:var(--f-valor);     left:-10%; top:-30%; animation:aura1  9s ease-in-out infinite }
.cl-humo i:nth-child(2){ background:var(--f-velocidad); left: 28%; top: 20%; animation:aura2 11s ease-in-out infinite }
.cl-humo i:nth-child(3){ background:var(--f-urgencia);  left: 58%; top:-40%; animation:aura3 13s ease-in-out infinite }
.cl-humo i:nth-child(4){ background:var(--f-brecha);    left: 82%; top: 10%; animation:aura2 15s ease-in-out infinite reverse }
```

Tres keyframes, reutilizados con duraciones distintas. Cada uno mueve, escala y
cambia la opacidad en momentos que **no coinciden** (33/66, 40/75, 30/70):

```css
@keyframes aura1{
  0%,100%{ transform:translate(0,0)      scale(1);    opacity:.5 }
  33%    { transform:translate(90%,28%)  scale(1.3);  opacity:.8 }
  66%    { transform:translate(38%,-24%) scale(.85);  opacity:.4 }
}
@keyframes aura2{
  0%,100%{ transform:translate(0,0)      scale(1.1);  opacity:.45 }
  40%    { transform:translate(-70%,24%) scale(.82);  opacity:.75 }
  75%    { transform:translate(52%,-18%) scale(1.28); opacity:.55 }
}
@keyframes aura3{
  0%,100%{ transform:translate(0,0)       scale(.9);   opacity:.4 }
  30%    { transform:translate(-44%,32%)  scale(1.22); opacity:.7 }
  70%    { transform:translate(-92%,-14%) scale(1);    opacity:.45 }
}
```

---

## Las reglas que hacen que funcione

**Duraciones primas entre sí.** 9s, 11s, 13s, 15s. El patrón combinado tarda
muchísimo en repetirse, así que nunca se percibe el loop. Si usás 10/10/10/10 el
efecto se muere: se ve el ciclo.

**Los porcentajes de los keyframes también son distintos** entre animaciones. Si
las tres cambian de dirección en el 50% se sincronizan visualmente aunque duren
distinto.

**Mover con `transform`, no con `left`/`top`.** `left`/`top` disparan layout en
cada frame. `translate` + `scale` corren en el compositor. `left`/`top` se usan
una sola vez, para el punto de partida.

**Desplazamientos grandes, en porcentaje.** `translate(90%, 28%)` sobre un
círculo del 56% del ancho lo saca medio cuerpo fuera del recorte. Ese entrar y
salir es lo que parece humo; si se quedan adentro parece una lámpara de lava.

**El blur va proporcional al tamaño.** Regla práctica: `blur ≈ 30% del
diámetro`. En una píldora de 44px de alto, círculos de ~56% de ancho →
`blur(16px)`. En el panel de pantalla completa del Flow Sprint, círculos del 46%
sobre una caja enorme → `blur(90px)`. Poco blur = se ven pelotas; mucho blur = se
ve un manchón gris.

**`mix-blend-mode:screen` sobre oscuro, `multiply` sobre claro.** Screen suma
luz: donde dos manchas se cruzan aparece un tercer color, y eso es la mitad de la
magia. Sobre fondo claro screen se lava a blanco, así que hay que invertir el
modo y bajar la opacidad:

```css
:root[data-tema="claro"] .cl-humo i{ mix-blend-mode:multiply; opacity:.24 }
```

**`isolation:isolate` en el contenedor.** Sin eso, `mix-blend-mode` se fusiona
contra todo lo que haya detrás en la página y el efecto cambia según dónde esté
el componente.

**Opacidad en dos niveles.** La caja al `.55` y cada mancha al `.6` → ~33%
efectivo. Es deliberado: el humo tiene que ser atmósfera, nunca competir con el
número. Si el texto encima cuesta leerse, bajá la opacidad de la caja, no la del
contenido.

**Respetar `prefers-reduced-motion`.** El fondo queda igual de lindo quieto:

```css
@media (prefers-reduced-motion:reduce){ .cl-humo i{ animation:none } }
```

---

## La tabla de calibración

Estos son los valores reales de cada lugar donde vive el humo en Clarity. Sirve
como referencia para calibrar un componente nuevo: buscá el que tenga un tamaño
parecido y copiá sus proporciones.

| Dónde | Manchas | Ancho | Blur | Op. caja | Op. mancha | Duraciones |
|---|---|---|---|---|---|---|
| Píldora de Clarity (`.cl-humo`) | 4 factores | 56% | 16px | .55 | .6 | 9/11/13/15 |
| Panel de Clarity (`.cl-aura`) | 4 factores | 54% | 32px | .6 | .5 | 9/11/13/15 |
| Barra de captura (`.cap-aura`) | 4 factores | 40% | 26px | .5 | .55 | 9/11/13/15 |
| Dock (`.dock-aura`) | 3 de marca | 56% | 26px | .85 | .6 | 9/11/13 |
| Fila en flow (`.fila-humo`) | 3 de marca | 34% | 28px | .5 | .7 | 11/15/19 |
| Tarjeta de foco (`.foco-aura`) | 4 factores | 46% | 46px | .5 | .5 | 12/15/17/19 |
| Nota (`.nota-humo`) | 3, color del ítem | 64% | 30px | .4 | .55 | 21/27/31 |
| Flow Sprint (`.sprint-humo`) | 6 de marca | 46% | 90px | .5 | .55 | 19/23/27/29/31/35 |

Se lee un patrón: **cuanto más grande la superficie, más lento y más difuso**. La
píldora late en 9 segundos; la pantalla completa del Sprint respira en 35. Un
componente chico con animaciones lentas parece congelado; uno grande con
animaciones rápidas marea.

---

## Cómo adaptarlo

| Quiero… | Cambio |
|---|---|
| Humo más denso | subir `width` de las manchas (56% → 80%) |
| Humo más sutil | bajar `opacity` de la caja (.55 → .3) |
| Más calmo | duplicar las duraciones (9/11/13/15 → 18/22/26/30) |
| Más nervioso | reducirlas y achicar los `scale` |
| En una caja grande | subir el `blur` proporcionalmente y bajar el `width` % |
| Menos colores | 2 o 3 manchas alcanzan; con 5+ se vuelve barro |

Los colores salen de tokens (`--f-valor`, `--f-velocidad`, `--f-urgencia`,
`--f-brecha`), nunca literales: así el humo sigue al tema y a la marca sin tocar
este CSS. Los tokens de factores apuntan a los colores del sistema:

```css
--f-valor:var(--brand-secondary);   /* #FF3FA4 */
--f-velocidad:var(--success);       /* #2FBF8F */
--f-urgencia:var(--warning);        /* ámbar   */
--f-brecha:var(--info);             /* #4E8BD8 */
```

---

## Cuándo usarlo

El humo marca **estado vivo o jerarquía**, no decora cualquier superficie.

- Lo que está corriendo ahora mismo — la fila en flow, el panel del Sprint.
- Lo que encabeza una jerarquía — la tarjeta de foco, el #1 de Momentum.
- Lo que resume varios datos en un número — la píldora de Clarity.

No lleva humo una lista, un formulario, un modal de confirmación ni una fila
cualquiera de tabla. Si todo brilla, nada destaca.

---

## Errores típicos

- Poner el humo con `::before` y un `background:radial-gradient()`. Se ve plano y
  no se pueden animar las manchas por separado.
- Olvidar `overflow:hidden` en el contenedor → el humo se derrama fuera del radio.
- Olvidar `z-index:-1` + `isolation:isolate` → el humo tapa el texto.
- Usar `z-index:-1` cuando algún hijo tiene fondo propio → el humo desaparece
  debajo de ese fondo. Ahí va `z-index:0` en la caja y `z-index:1` en los hijos.
- Un selector descendiente demasiado ancho (`.tarjeta svg`) que alcance a íconos
  que no son del humo.
- Animar `filter:blur()` — es carísimo por frame. El blur es fijo; lo que se
  anima es posición, escala y opacidad.
- Usar los colores de marca al 100% de opacidad → el componente grita. El humo es
  un susurro de color.
