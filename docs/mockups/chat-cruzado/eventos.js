// Eventos del mockup: un solo listener por tipo, con delegación por data-*.
const $ = (s) => document.querySelector(s);
const DONDE_ORIGINAL = Object.fromEntries(Object.entries(PERSONAS).map(([k, p]) => [k, p.donde]));
const NOMBRES_MENCION = ['Learnito', ...Object.values(PERSONAS).map((p) => p.nombre), 'todos', 'ventas', 'fulfillment', 'desarrollo'];

function redibujarLado() {
  dibujarLado();
  const l = $('#linea-l'); if (l) l.scrollTop = l.scrollHeight;
}

function mensajeDe(ref) {
  if (String(ref).startsWith('L')) return E.ladoL.msgs[+String(ref).slice(1)];
  return MENSAJES[E.canal][+ref];
}

function abrirCanal(id) {
  E.canal = id; E.respondiendo = null; E.buscar = ''; E.mostrarBuscar = false; E.movilLista = false;
  if (CANALES[id]) CANALES[id].nuevos = 0;
  const dm = DIRECTAS.find((d) => d.id === id); if (dm) dm.nuevos = 0;
  if (!MENSAJES[id]) MENSAJES[id] = [];
  dibujarTodo();
}

function abrirDirecta(k) {
  if (k === E.visor) return;
  let dm = DIRECTAS.find((d) => d.con === k);
  if (!dm) { dm = { id: `dm-${k}`, con: k, ultimo: 'Nueva conversación' }; DIRECTAS.push(dm); }
  E.tab = 'equipo';
  abrirCanal(dm.id);
}

function enviar() {
  const campo = $('#texto');
  const texto = campo.value.trim();
  if (!texto) return;
  const lista = MENSAJES[E.canal];
  const cita = E.respondiendo;
  lista.push({ tipo: 'texto', de: E.visor, desde: E.producto, hora: ahora(), texto, respondeA: cita ? cita.tipo : undefined });
  E.respondiendo = null;
  dibujarDetalle();
  if (E.canal === 'learnito') preguntar(lista, texto, null, null, dibujarDetalle);
  else if (/@learnito/i.test(texto)) preguntar(lista, texto, cita ? cita.m : null, E.visor, dibujarDetalle);
  $('#texto').focus();
}

function enviarLado(texto) {
  texto = (texto || '').trim();
  if (!texto) return;
  E.ladoL.msgs.push({ tipo: 'pregunta', texto });
  preguntar(E.ladoL.msgs, texto, E.ladoL.ctx, null, redibujarLado);
}

function abrirMenciones(filtro) {
  const caja = $('#menciones');
  const lista = NOMBRES_MENCION.filter((n) => n.toLowerCase().startsWith(filtro.toLowerCase())).slice(0, 7);
  if (!lista.length) { caja.innerHTML = ''; return; }
  caja.innerHTML = `<div class="menciones">${lista.map((n) => {
    const k = Object.keys(PERSONAS).find((x) => PERSONAS[x].nombre === n);
    const sub = n === 'Learnito' ? 'Responde en el canal' : k ? (PERSONAS[k].donde ? `En ${PRODUCTOS[PERSONAS[k].donde].nombre}` : PERSONAS[k].rol) : 'Avisa a todo el grupo';
    const av = n === 'Learnito' ? `<span class="av av--s av-l">${ic('chispa', 13)}</span>` : k ? avatar(k, 'av--s') : `<span class="av av--s av-sis">${ic('gente', 13)}</span>`;
    return `<button class="persona" data-mencion="${n}">${av}<span><span class="nom">${n}</span><span class="sub">${sub}</span></span></button>`;
  }).join('')}</div>`;
}

document.addEventListener('click', (ev) => {
  const t = ev.target.closest('button,[data-canal]');
  if (!t) return;
  const d = t.dataset;
  if (d.canal) abrirCanal(d.canal);
  else if (d.area) { E.areaAbierta = E.areaAbierta === d.area ? null : d.area; dibujarLista(); }
  else if (d.tab) { E.tab = d.tab; dibujarLista(); }
  else if (d.dm) abrirDirecta(d.dm);
  else if ('toggleLista' in d) { if (innerWidth <= 860) E.movilLista = !E.movilLista; else E.lista = !E.lista; dibujarTodo(); }
  else if (d.lado) { E.lado = E.lado === d.lado ? null : d.lado; dibujarTodo(); }
  else if ('cerrar' in d) { $('#ventana').hidden = true; $('#btn-chat').setAttribute('aria-pressed', 'false'); }
  else if ('buscar' in d) { E.mostrarBuscar = !E.mostrarBuscar; E.buscar = ''; dibujarDetalle(); if (E.mostrarBuscar) $('#buscar').focus(); }
  else if (d.reac) {
    const [i, r] = d.reac.split(':');
    if (i.startsWith('L')) return;
    const m = MENSAJES[E.canal][+i];
    m.reacciones = m.reacciones || {};
    if (!(r in m.reacciones)) m.reacciones[r] = 0;
    const clave = `${E.canal}:${i}:${r}`;
    E.mias.has(clave) ? E.mias.delete(clave) : E.mias.add(clave);
    dibujarDetalle();
  } else if (d.responder) {
    if (d.responder.startsWith('L')) return;
    const m = MENSAJES[E.canal][+d.responder];
    const quien = m.tipo === 'texto' ? (m.de ? PERSONAS[m.de].nombre : m.alumno) : m.tipo === 'learnito' ? 'Learnito' : (m.titulo || 'la tarjeta');
    E.respondiendo = { m, tipo: m.tipo === 'texto' || m.tipo === 'learnito' ? 'mensaje' : m.tipo === 'tarea' ? 'tarea' : 'aviso', quien };
    dibujarDetalle(); $('#texto').focus();
  } else if ('cancelar' in d) { E.respondiendo = null; dibujarDetalle(); }
  else if (d.preguntar) {
    if (d.preguntar.startsWith('L')) return;
    E.ladoL = { ctx: MENSAJES[E.canal][+d.preguntar], msgs: [] };
    E.lado = 'learnito'; dibujarTodo();
    enviarLado('¿Qué sabés de esto?');
  } else if (d.sug) {
    if (t.closest('#lado')) enviarLado(d.sug);
    else { $('#texto').value = E.canal === 'learnito' ? d.sug : `@Learnito ${d.sug}`; enviar(); }
  } else if ('enviar' in d) enviar();
  else if ('enviarL' in d) { const c = $('#texto-l'); enviarLado(c.value); }
  else if (d.confirmar || d.descartar) {
    const m = mensajeDe(d.confirmar || d.descartar);
    if (d.confirmar) m.accion.hecha = true; else delete m.accion;
    String(d.confirmar || d.descartar).startsWith('L') ? redibujarLado() : dibujarDetalle();
  } else if ('limpiarL' in d) { E.ladoL = { ctx: null, msgs: [] }; redibujarLado(); }
  else if ('publicarL' in d) {
    const ultima = [...E.ladoL.msgs].reverse().find((m) => m.tipo === 'learnito');
    if (!ultima || E.canal === 'learnito') return;
    MENSAJES[E.canal].push({ ...ultima, accion: undefined, pidio: E.visor, hora: ahora() });
    dibujarDetalle();
  } else if ('arroba' in d) { const c = $('#texto'); c.value += (c.value && !c.value.endsWith(' ') ? ' ' : '') + '@'; c.focus(); abrirMenciones(''); }
  else if (d.mencion) {
    const c = $('#texto');
    c.value = c.value.replace(/@[^\s@]*$/, `@${d.mencion} `);
    $('#menciones').innerHTML = ''; c.focus();
  } else if (t.id === 'btn-chat') { const v = $('#ventana'); v.hidden = !v.hidden; t.setAttribute('aria-pressed', String(!v.hidden)); }
  else if (t.id === 'btn-learnito') { $('#ventana').hidden = false; E.tab = 'equipo'; abrirCanal('learnito'); }
  else if (t.id === 'mk-notas') { const n = $('#notas'); n.hidden = !n.hidden; }
  else if (d.modo) { document.documentElement.dataset.modo = d.modo; marcarModo(); }
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && !ev.shiftKey && ev.target.id === 'texto') { ev.preventDefault(); if ($('#menciones .persona')) $('#menciones .persona').click(); else enviar(); }
  if (ev.key === 'Enter' && !ev.shiftKey && ev.target.id === 'texto-l') { ev.preventDefault(); enviarLado(ev.target.value); }
  if (ev.key === 'Escape') $('#menciones') && ($('#menciones').innerHTML = '');
});

document.addEventListener('input', (ev) => {
  if (ev.target.id === 'texto') {
    const m = ev.target.value.match(/@([^\s@]*)$/);
    m ? abrirMenciones(m[1]) : ($('#menciones').innerHTML = '');
  }
  if (ev.target.id === 'buscar') {
    E.buscar = ev.target.value;
    const pos = ev.target.selectionStart;
    dibujarDetalle();
    const b = $('#buscar'); b.focus(); b.setSelectionRange(pos, pos);
  }
});

document.addEventListener('change', (ev) => {
  const id = ev.target.id;
  if (id === 'mk-producto') { E.producto = ev.target.value; dibujarTodo(); }
  if (id === 'mk-visor') { PERSONAS[E.visor].donde = DONDE_ORIGINAL[E.visor]; E.visor = ev.target.value; E.areaAbierta = null; abrirCanal('equipo'); }
  if (id === 'mk-tema') document.documentElement.dataset.tema = ev.target.value;
});

function marcarModo() {
  document.querySelectorAll('[data-modo]').forEach((b) => b.tagName === 'BUTTON' && b.setAttribute('aria-pressed', String(b.dataset.modo === document.documentElement.dataset.modo)));
}

// ?canal=wins&modo=claro&tema=solido&visor=vale&preguntar=0 abre el mockup en ese estado.
const Q = new URLSearchParams(location.search);
if (Q.get('modo')) document.documentElement.dataset.modo = Q.get('modo');
if (Q.get('tema')) { document.documentElement.dataset.tema = Q.get('tema'); $('#mk-tema').value = Q.get('tema'); }
if (VISORES[Q.get('visor')]) { E.visor = Q.get('visor'); $('#mk-visor').value = E.visor; }
const medirBarra = () => document.documentElement.style.setProperty('--alto-barra', `${$('.mk-barra').offsetHeight}px`);
addEventListener('resize', medirBarra);
medirBarra();
marcarModo();
abrirCanal(Q.get('canal') || 'equipo');
if (Q.get('preguntar')) $(`[data-preguntar="${Q.get('preguntar')}"]`).click();
