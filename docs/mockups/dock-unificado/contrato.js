// El contrato del dock: lo que Work, Academy y Leadership implementan igual, cada uno con su tecnología.
// Se muestra en el panel «Contrato» del mockup, con la medición de uso de esta sesión al final.

function contratoHtml(st) {
  const uso = Object.entries(st.uso).sort((a, b) => b[1] - a[1]);
  return `
<h2>Decisiones (Santi, 17/11/2026)</h2>
<ul>
  <li>El avatar abre Configuración. No hay menú de cuenta; cerrar sesión vive en Configuración › Cuenta y en la tarjeta de la barra lateral.</li>
  <li>La navegación se edita en los tres: ordenar, ocultar y renombrar. Revierte el ADR-120 de Academy.</li>
  <li>El dock se auto-oculta (10 s quieto o al scrollear hacia abajo), con una pastilla para traerlo. Se puede apagar.</li>
  <li>Una sección oculta se abre desde Herramientas en una ventana con un iframe de la sección (<code>?embebida=1</code>, sin dock propio).</li>
  <li>Las secciones no se numeran. Cada una conserva su señal: lo que pide, la cuenta, el ✓ o el aviso.</li>
  <li>Se mide el uso de cada herramienta; qué herramientas quedan se decide con esos datos.</li>
  <li>Un solo sistema de temas para los tres.</li>
</ul>

<h2>Anatomía</h2>
<table>
  <tr><th>Modo</th><th>Partes</th></tr>
  <tr><td>Dock abajo</td><td><b>Fijado</b> (izquierda: simulación, lo fijado, widgets vivos como Flow) · <b>Navegación</b> (centro: secciones con su señal y el botón de ventanas) · <b>Sistema</b> (derecha: Herramientas y el avatar)</td></tr>
  <tr><td>Barra lateral</td><td>Dos contenedores separados. <b>Tarjeta</b>: el avatar grande y centrado (abre Configuración), el nombre y el rol debajo, plegar en la esquina; plegar arriba a la izquierda y Notificaciones (Pendientes) arriba a la derecha; una fila de botones iguales en los tres productos: Cerrar sesión, Mensajes y Leadership (transversales; Learnito pasa a vivir dentro de Mensajes), Herramientas y Configuración; después la simulación y los accesos fijados de un toque. <b>Navegación</b>: las secciones (alineadas a la izquierda) y, al fondo, los widgets fijados que se extienden (Flow, Pomodoro) y las ventanas abiertas. Plegada: una columna centrada con botones de 46 px, hasta 3 accesos fijados (el resto, «+N» que abre Herramientas) y hasta 5 secciones, la activa siempre entre ellas (el resto, «+N» que despliega la barra).</td></tr>
  <tr><td>Teléfono</td><td>Una sola barra abajo: secciones (solo la activa con nombre), Herramientas y avatar. Sin barra lateral.</td></tr>
</table>

<h2>Una sección</h2>
<p><code>{ key, label, icon, href, embed, senal?: { tipo: 'pide' | 'cuenta' | 'hecho' | 'aviso', texto, titulo } }</code></p>
<ul>
  <li><b>pide</b>: algo te espera (pastilla de marca con la cantidad). Es la de Academy (<code>sectionActions</code>).</li>
  <li><b>cuenta</b>: avance «2/5» (las pestañas del closer en Work).</li>
  <li><b>hecho</b>: ✓ (el reporte enviado). <b>aviso</b>: un punto ámbar sin texto (el día sin reportar).</li>
  <li><code>titulo</code> es lo que se lee en voz alta y en el tooltip. <code>embed</code> es la dirección que carga la ventana cuando está oculta.</li>
</ul>

<h2>Una herramienta</h2>
<p><code>{ key, label, desc, icon, color, grupo, sub?, tipo: 'pagina' | 'ventana' | 'accion' | 'lista', roles, canal?, cuenta?, atajo?, widget? }</code></p>
<ul>
  <li><b>pagina</b> lleva a otra pantalla (↗) · <b>ventana</b> se abre encima · <b>accion</b> corre algo · <b>lista</b> se despliega en el mismo menú (›), como Nuevo.</li>
  <li>Grupos comunes, en este orden: Crear · Buscar · Trabajo (con <code>sub</code> propio de cada producto: Agendas, Estudiantes, Foco…) · Asistente · Pendientes · Secciones ocultas · Ir a.</li>
  <li>Todo se puede fijar con el 📌. Lo fijado va a la izquierda (o a la tarjeta), en el orden en que se fijó. Una lista fijada abre directo su lista; un widget fijado se dibuja vivo.</li>
  <li>El menú tiene un buscador arriba y, al pie, «Editar navegación» y «Dock y apariencia».</li>
</ul>

<h2>Atajos (iguales en los tres)</h2>
<table>
  <tr><td><code>Ctrl+K</code></td><td>Buscar (lead, alumno, tarea: la herramienta del grupo Buscar)</td></tr>
  <tr><td><code>Ctrl+J</code></td><td>Herramientas</td></tr>
  <tr><td><code>Ctrl+L</code></td><td>Learnito</td></tr>
  <tr><td><code>Ctrl+N</code></td><td>Lo del grupo Crear (Nuevo en Work y Academy, Capturar en Leadership)</td></tr>
  <tr><td><code>Ctrl+\`</code></td><td>Ventanas abiertas</td></tr>
  <tr><td><code>Esc</code></td><td>Cierra el menú, termina la edición o minimiza la ventana de arriba</td></tr>
</table>

<h2>Preferencias, en la cuenta</h2>
<p><code>{ fijadas: [keys], nav: { &lt;dock&gt;: { orden, ocultos, nombres } }, modo: { lateral, plegada }, autoOcultar, tema: { tema, modo, efectos } }</code>. Una por persona. Al entrar, lo de la cuenta pisa lo del navegador. Simulando no se lee ni se guarda.</p>

<h2>Temas: un solo sistema</h2>
<p>Tres ejes en <code>&lt;html&gt;</code>: <code>data-tema</code> (learnation, solido, relampago, puro) × <code>data-modo</code> (oscuro, claro) × <code>data-efectos</code> (aura y vidrio, o plano). Roles <code>--ln-*</code> (los de Work, que seguían los contenedores C1/C2/C3 de Academy).</p>
<table>
  <tr><th>Hoy</th><th>Pasa a</th></tr>
  <tr><td>Work Classic y Modern</td><td>Learnation (Modern = efectos planos)</td></tr>
  <tr><td>Academy modern / glass / solid</td><td>Learnation / Learnation con vidrio / Sólido</td></tr>
  <tr><td>Leadership learnation / future-lightning / solid-pure</td><td>Learnation / Relámpago / Puro</td></tr>
</table>
<table>
  <tr><th>Rol</th><th>Work</th><th>Academy</th><th>Leadership</th></tr>
  <tr><td>page-bg</td><td>--ln-page-bg</td><td>--bg-page</td><td>--gradient-page</td></tr>
  <tr><td>ct1 (destacado)</td><td>--ln-brand</td><td>.ct-1</td><td>--brand-secondary</td></tr>
  <tr><td>ct2 (panel)</td><td>--ln-ct2-bg</td><td>--ct2-bg</td><td>--bg-surface</td></tr>
  <tr><td>ct3 (control)</td><td>--ln-ct3-bg</td><td>--ct3-bg</td><td>--bg-element</td></tr>
  <tr><td>popover-bg</td><td>--ln-popover-bg</td><td>--bg-surface-popover</td><td>--bg-surface-popover</td></tr>
  <tr><td>dock-bg</td><td>(no tenía)</td><td>dk-island</td><td>--dock-bg</td></tr>
  <tr><td>text-out / text-in</td><td>--ln-text-out / -in</td><td>--text-out / --text-in</td><td>--text-main</td></tr>
  <tr><td>text-muted</td><td>--ln-text-muted</td><td>--text-muted</td><td>--text-muted</td></tr>
  <tr><td>border-main</td><td>--ln-border-main</td><td>--border-main</td><td>--border-main</td></tr>
  <tr><td>radius / radius-control</td><td>--ln-radius</td><td>--radius-main / -control</td><td>--radius-main / -control</td></tr>
</table>
<p>Contraste: el magenta del modo claro baja a <code>#C9156F</code> (el <code>#E11D8F</code> de Academy y Leadership no llega a 4.5:1 con texto blanco). Texto sobre magenta oscuro, en Ink.</p>

<h2>Medición de uso</h2>
<p>Cada vez que se abre algo: <code>{ herramienta, producto, rol, origen: herramientas | fijado | atajo | avatar, cuando }</code>. Con dos semanas de datos, lo que casi nadie abre se saca o se junta con otra.</p>
<table><tr><th>Esta sesión</th><th>Veces</th></tr>
${uso.length ? uso.map(([k, n]) => `<tr><td>${k}</td><td>${n}</td></tr>`).join('') : '<tr><td colspan="2">Todavía nada: abrí herramientas para ver cómo se cuenta.</td></tr>'}
</table>
${st.registro.length ? `<ul>${st.registro.map((r) => `<li><code>${r}</code></li>`).join('')}</ul>` : ''}

<h2>Qué cambia en cada servicio</h2>
<ul>
  <li><b>Work</b>: casi todo ya está. Faltan el auto-ocultar, el iframe de las secciones ocultas (cada sección necesita su dirección), sacar los números, los grupos comunes, el buscador del menú y los temas nuevos.</li>
  <li><b>Academy</b>: el avatar abre Configuración (hoy abre un menú), la navegación editable, las preferencias a la cuenta (hoy en el navegador), los grupos comunes en <code>staff_tools.php</code> y los atajos.</li>
  <li><b>Leadership</b>: el avatar abre Ajustes directo, los grupos comunes, la señal de cada sección y el tema único (hoy, Clarity).</li>
</ul>`;
}
