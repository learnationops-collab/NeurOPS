// Dibujar y escuchar: clics, arrastre de secciones y de ventanas, atajos, auto-ocultar y la barra del mockup.
/* global st, PRODUCTOS, prod, prefs, secciones, herr, fijable, abrir, abrirVentana, abrirConfig, usar, lateral,
   dockHtml, lateralHtml, barraEdicion, capaHtml, ventanasHtml, posicionar, contratoHtml, $ */

function render() {
  const h = document.documentElement;
  h.classList.toggle('con-lateral', lateral());
  h.classList.toggle('lateral-plegada', lateral() && st.plegada);
  $('#dock').innerHTML = (lateral() ? lateralHtml() : dockHtml()) + barraEdicion();
  $('#capa').innerHTML = capaHtml();
  $('#ventanas').innerHTML = ventanasHtml();
  const pop = document.querySelector('.pop');
  if (pop) posicionar(pop);
  const sec = secciones().find((s) => s.key === (st.activa[st.producto] || secciones().find((x) => !x.oculta)?.key));
  $('#pg-producto').textContent = prod().nombre;
  $('#pg-titulo').textContent = sec ? sec.label : prod().titulo;
  $('#pg-sub').textContent = prod().sub;
  document.querySelectorAll('[data-modo-nav]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.modoNav === st.nav)));
  document.querySelectorAll('[data-modo]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.modo === h.dataset.modo)));
  const ren = document.querySelector('[data-renombrar]');
  if (ren) { ren.focus(); ren.select(); }
  const fil = document.getElementById('filtro');
  if (fil && st.enfocarFiltro) { fil.focus(); fil.setSelectionRange(fil.value.length, fil.value.length); st.enfocarFiltro = false; }
}

function cerrarPop() { if (st.pop) { st.pop = null; render(); } }
function alternarHerr(ancla = '[data-acc="herramientas"]') {
  st.pop = st.pop?.vista === 'herr' ? null : { vista: 'herr', anclaSel: ancla };
  st.filtro = '';
  if (st.pop) usar('herramientas', 'dock');
  render();
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-acc]');
  if (!b) {
    if (st.pop && !e.target.closest('.pop')) cerrarPop();
    return;
  }
  const { acc, key } = b.dataset;
  const pr = prefs();
  if (acc === 'seccion') { st.activa[st.producto] = key; st.pop = null; render(); }
  else if (acc === 'herramientas') alternarHerr();
  else if (acc === 'config') { st.pop = null; abrirConfig('cuenta'); }
  else if (acc === 'config-dock') { st.pop = null; abrirConfig('dock'); }
  else if (acc === 'herr') {
    const h = key.startsWith('sec:') ? fijable(key) : herr(key);
    if (h?.tipo === 'lista') { usar(h.key, 'herramientas'); st.pop = { vista: 'lista', key: h.key, desdeHerr: true, anclaSel: st.pop?.anclaSel }; render(); }
    else abrir(h, 'herramientas');
  }
  else if (acc === 'pin') {
    const h = fijable(key);
    if (h?.tipo === 'lista') { usar(h.key, 'fijado'); st.pop = { vista: 'lista', key: h.key, anclaSel: `[data-acc="pin"][data-key="${key}"]` }; render(); }
    else abrir(h, 'fijado');
  }
  else if (acc === 'fijar') { pr.fijadas = pr.fijadas.includes(key) ? pr.fijadas.filter((x) => x !== key) : [...pr.fijadas, key]; render(); }
  else if (acc === 'volver-herr') { st.pop = { vista: 'herr', anclaSel: st.pop.anclaSel }; render(); }
  else if (acc === 'op-lista') { const o = herr(st.pop.key).lista[Number(b.dataset.i)]; st.pop = null; render(); alert(`«${o.label}» (mockup).`); }
  else if (acc === 'ventanas') { st.pop = st.pop?.vista === 'ventanas' ? null : { vista: 'ventanas', anclaSel: '[data-acc="ventanas"]' }; render(); }
  else if (acc === 'traer') { const v = st.ventanas.find((x) => x.id === b.dataset.id); st.pop = null; abrirVentana(v.id, v.titulo, v.tipo, v.item); }
  else if (acc === 'v-min') { st.ventanas.find((x) => x.id === b.dataset.id).min = true; render(); }
  else if (acc === 'v-max') { const v = st.ventanas.find((x) => x.id === b.dataset.id); v.max = !v.max; render(); }
  else if (acc === 'v-cerrar') { st.ventanas = st.ventanas.filter((x) => x.id !== b.dataset.id); render(); }
  else if (acc === 'editar') { st.pop = null; st.editando = true; st.oculto = false; render(); }
  else if (acc === 'listo') { st.editando = false; st.renombrando = null; render(); }
  else if (acc === 'restablecer') { if (confirm('¿Volver al orden de siempre? Se muestran todas las secciones con su nombre original.')) { Object.assign(pr, { orden: [], ocultos: [], nombres: {} }); render(); } }
  else if (acc === 'ojo') {
    if (pr.ocultos.includes(key)) pr.ocultos = pr.ocultos.filter((x) => x !== key);
    else if (secciones().filter((s) => !s.oculta).length > 1) pr.ocultos = [...pr.ocultos, key];
    render();
  }
  else if (acc === 'plegar') { st.plegada = !st.plegada; render(); }
  else if (acc === 'despertar') despertar();
  else if (acc === 'dejar-simular') { st.simulando = false; $('#mk-simular').checked = false; render(); }
  else if (acc === 'tab') { st.tabConfig = b.dataset.tab; render(); }
  else if (acc === 'salir') alert('Cerrar sesión (mockup).');
  else if (acc === 'cfg') {
    const { cfg, v } = b.dataset;
    if (['tema', 'modo', 'efectos'].includes(cfg)) document.documentElement.dataset[cfg] = v;
    if (cfg === 'tema') $('#mk-tema').value = v;
    if (cfg === 'nav') st.nav = v;
    if (cfg === 'plegada') st.plegada = v === 'true';
    if (cfg === 'auto') { st.autoOcultar = v === 'true'; despertar(); }
    render();
  }
});

// Renombrar con doble clic; arrastrar secciones en edición.
document.addEventListener('dblclick', (e) => { const n = e.target.closest('[data-dbl]'); if (n) { st.renombrando = n.dataset.dbl; render(); } });
function terminarRenombre(inp, guardar) {
  const pr = prefs();
  const k = inp.dataset.renombrar;
  const s = PRODUCTOS[st.producto].secciones.find((x) => x.key === k);
  const t = inp.value.trim().slice(0, 24);
  if (guardar) { if (!t || t === s.label) delete pr.nombres[k]; else pr.nombres[k] = t; }
  st.renombrando = null;
  render();
}
document.addEventListener('keydown', (e) => {
  const inp = e.target.closest?.('[data-renombrar]');
  if (inp && (e.key === 'Enter' || e.key === 'Escape')) { e.preventDefault(); e.stopPropagation(); terminarRenombre(inp, e.key === 'Enter'); }
}, true);
document.addEventListener('focusout', (e) => { const inp = e.target.closest?.('[data-renombrar]'); if (inp && st.renombrando) terminarRenombre(inp, true); });
document.addEventListener('input', (e) => { if (e.target.id === 'filtro') { st.filtro = e.target.value; st.enfocarFiltro = true; render(); } });

let llevado = null;
document.addEventListener('dragstart', (e) => { const n = e.target.closest?.('[data-arrastrar]'); if (n) { llevado = n.dataset.arrastrar; e.dataTransfer.effectAllowed = 'move'; } });
document.addEventListener('dragover', (e) => {
  const n = e.target.closest?.('[data-arrastrar]');
  if (!llevado || !n || n.dataset.arrastrar === llevado) return;
  e.preventDefault();
  const ids = secciones().map((s) => s.key).filter((k) => k !== llevado);
  const r = n.getBoundingClientRect();
  const vertical = lateral();
  const despues = vertical ? e.clientY - r.top > r.height / 2 : e.clientX - r.left > r.width / 2;
  const i = ids.indexOf(n.dataset.arrastrar) + (despues ? 1 : 0);
  const nuevo = [...ids.slice(0, i), llevado, ...ids.slice(i)];
  if (nuevo.join() !== secciones().map((s) => s.key).join()) { prefs().orden = nuevo; render(); }
});
document.addEventListener('dragend', () => { llevado = null; });

// Mover ventanas por la cabecera: arriba del todo, pantalla completa; abajo del todo, al dock.
let mov = null;
document.addEventListener('pointerdown', (e) => {
  const cab = e.target.closest('[data-mover]');
  if (!cab || e.target.closest('button')) return;
  const v = st.ventanas.find((x) => x.id === cab.dataset.mover);
  st.z += 1; v.z = st.z;
  mov = { v, dx: e.clientX - v.x, dy: e.clientY - v.y, nodo: cab.parentElement };
  mov.nodo.style.zIndex = 900 + v.z;
});
document.addEventListener('pointermove', (e) => {
  if (!mov) return;
  mov.v.max = false; mov.v.x = e.clientX - mov.dx; mov.v.y = Math.max(44, e.clientY - mov.dy);
  Object.assign(mov.nodo.style, { left: `${mov.v.x}px`, top: `${mov.v.y}px` });
  mov.nodo.classList.remove('max');
});
document.addEventListener('pointerup', (e) => {
  if (!mov) return;
  if (e.clientY < 60) mov.v.max = true;
  else if (e.clientY > window.innerHeight - 40) mov.v.min = true;
  mov = null;
  render();
});

// Auto-ocultar: a los 10 s quieto (o al scrollear hacia abajo) el dock baja; vuelve al acercarse al borde o con una tecla.
let reloj = null;
function despertar() {
  clearTimeout(reloj);
  if (st.oculto) { st.oculto = false; render(); }
  if (!st.autoOcultar || lateral()) return;
  reloj = setTimeout(() => { if (!st.pop && !st.editando && !mov) { st.oculto = true; render(); } }, 10000);
}
window.addEventListener('mousemove', (e) => { if (window.innerHeight - e.clientY < 100) despertar(); }, { passive: true });

// Atajos, los mismos en los tres productos.
window.addEventListener('keydown', (e) => {
  despertar();
  if (e.key === 'Escape') {
    if (st.pop) return cerrarPop();
    if (st.editando) { st.editando = false; return render(); }
    const arriba = st.ventanas.filter((v) => !v.min).sort((a, b) => b.z - a.z)[0];
    if (arriba) { arriba.min = true; render(); }
    return;
  }
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  const k = e.key.toLowerCase();
  const del = (g) => prod().herramientas.find((h) => h.grupo === g);
  if (k === 'k' && del('Buscar')) { e.preventDefault(); abrir(del('Buscar'), 'atajo'); }
  else if (k === 'j') { e.preventDefault(); alternarHerr(); }
  else if (k === 'l' && herr('learnito')) { e.preventDefault(); abrir(herr('learnito'), 'atajo'); }
  else if (k === 'n' && del('Crear')) { e.preventDefault(); const h = del('Crear'); if (h.tipo === 'lista') { usar(h.key, 'atajo'); st.pop = { vista: 'lista', key: h.key }; render(); } else abrir(h, 'atajo'); }
  else if (e.key === '`' && st.ventanas.length) { e.preventDefault(); st.pop = { vista: 'ventanas', anclaSel: '[data-acc="ventanas"]' }; render(); }
});
window.addEventListener('resize', render);

// El cronómetro del widget de Flow (Leadership), para mostrar que lo fijado puede estar vivo.
let flow = 24 * 60 + 13;
setInterval(() => { flow += 1; const n = document.getElementById('flow-t'); if (n) n.textContent = `${Math.floor(flow / 60)}:${String(flow % 60).padStart(2, '0')}`; }, 1000);

// La barra del mockup.
const sel = $('#mk-producto');
sel.innerHTML = Object.entries(PRODUCTOS).map(([k, p]) => `<option value="${k}">${p.nombre}</option>`).join('');
sel.addEventListener('change', () => { st.producto = sel.value; st.pop = null; st.editando = false; render(); });
$('#mk-tema').addEventListener('change', (e) => { document.documentElement.dataset.tema = e.target.value; render(); });
document.querySelectorAll('[data-modo-nav]').forEach((b) => b.addEventListener('click', () => { st.nav = b.dataset.modoNav; st.oculto = false; render(); despertar(); }));
document.querySelectorAll('[data-modo]').forEach((b) => b.addEventListener('click', () => { document.documentElement.dataset.modo = b.dataset.modo; render(); }));
$('#mk-simular').addEventListener('change', (e) => { st.simulando = e.target.checked; render(); });
$('#mk-contrato').addEventListener('click', () => { const c = $('#contrato'); c.hidden = !c.hidden; if (!c.hidden) c.innerHTML = contratoHtml(st); });

render();
despertar();
