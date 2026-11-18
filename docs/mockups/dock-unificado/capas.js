// Lo que flota: el menú de Herramientas (y las listas, como Nuevo), el de ventanas abiertas, las
// ventanas mismas (con la sección oculta en un iframe) y Configuración, que abre el avatar.
/* global st, prod, prefs, secciones, herr, esc, ico, GRUPOS, lateral */

function filaHerr(h) {
  const fij = prefs().fijadas.includes(h.key);
  const tipo = h.tipo === 'pagina' ? ico('ext', 13) : h.tipo === 'lista' ? ico('chevR', 14) : '';
  return `<div class="herr">
    <button type="button" class="herr-ir" data-acc="herr" data-key="${h.key}" style="--c:${h.color || 'currentColor'}">
      <span class="herr-ico">${ico(h.icon, 17)}</span>
      <span class="herr-tx"><b>${esc(h.label)}</b>${h.desc ? `<small>${esc(h.desc)}</small>` : ''}</span>
      ${h.cuenta ? `<span class="senal senal--pide">${h.cuenta}</span>` : ''}<span class="herr-tipo">${tipo}</span>
    </button>
    <button type="button" class="pin" data-acc="fijar" data-key="${h.key}" aria-pressed="${fij}" aria-label="${fij ? 'Quitar' : 'Fijar'} ${esc(h.label)} ${fij ? 'del' : 'en el'} dock">${ico('pin', 15)}</button>
  </div>`;
}

function herramientasHtml() {
  const f = st.filtro.trim().toLowerCase();
  const ocultas = secciones().filter((s) => s.oculta).map((s) => ({
    key: `sec:${s.key}`, label: s.label, desc: 'Sacada del dock: se abre en una ventana', icon: s.icon, color: 'var(--ln-brand)', grupo: 'Secciones ocultas', tipo: 'ventana',
  }));
  const todas = [...prod().herramientas, ...ocultas].filter((h) => !f || `${h.label} ${h.desc || ''}`.toLowerCase().includes(f));
  const grupos = GRUPOS.map((g) => {
    const del = todas.filter((h) => h.grupo === g);
    if (!del.length) return '';
    if (g !== 'Trabajo') return `<p class="grupo">${g}</p><div class="grilla">${del.map(filaHerr).join('')}</div>`;
    const subs = [...new Set(del.map((h) => h.sub))];
    return `<p class="grupo">${g}</p>${subs.map((s) => `<p class="subgrupo">${esc(s)}</p><div class="grilla">${del.filter((h) => h.sub === s).map(filaHerr).join('')}</div>`).join('')}`;
  }).join('');
  return `<div class="pop-cab"><b>Herramientas</b>
      <label class="buscador">${ico('search', 15)}<input id="filtro" value="${esc(st.filtro)}" placeholder="Buscar una herramienta" aria-label="Buscar una herramienta"></label></div>
    ${grupos || '<p class="vacio">Ninguna herramienta con eso.</p>'}
    <div class="pop-pie">
      <button type="button" data-acc="editar">${ico('pencil', 16)} Editar navegación</button>
      <button type="button" data-acc="config-dock">${ico('layers', 16)} Dock y apariencia</button>
    </div>`;
}

function listaHtml() {
  const h = herr(st.pop.key);
  const volver = st.pop.desdeHerr
    ? `<button type="button" data-acc="volver-herr">${ico('left', 16)} ${esc(h.label)}</button>`
    : `<span style="padding:4px 10px;font-weight:800">${esc(h.label)}</span>`;
  return `<div class="lista">${volver}${h.lista.map((o, i) => `<button type="button" data-acc="op-lista" data-i="${i}">${ico(o.icon, 16)} ${esc(o.label)}</button>`).join('')}</div>`;
}

function ventanasPopHtml() {
  return `<p class="grupo" style="margin-top:2px">Ventanas</p><div class="lista">${st.ventanas.map((v) =>
    `<button type="button" data-acc="traer" data-id="${v.id}">${ico('win', 16)} ${esc(v.titulo)} <small style="margin-left:auto;color:var(--ln-text-muted)">${v.min ? 'Minimizada' : 'Abierta'}</small></button>`).join('')}</div>`;
}

// Arriba del botón en el dock; a su derecha en la barra lateral.
function posicionar(pop) {
  const ancla = document.querySelector(st.pop.anclaSel || '[data-acc="herramientas"]');
  if (!ancla) return;
  const b = ancla.getBoundingClientRect();
  const m = 12;
  if (lateral()) {
    pop.style.left = `${b.right + m}px`;
    pop.style.top = `${Math.max(56, Math.min(b.top, window.innerHeight - pop.offsetHeight - m))}px`;
  } else {
    pop.style.left = `${Math.min(Math.max(m, b.left + b.width / 2 - pop.offsetWidth / 2), window.innerWidth - pop.offsetWidth - m)}px`;
    pop.style.top = `${Math.max(56, b.top - pop.offsetHeight - 10)}px`;
  }
}

function capaHtml() {
  if (!st.pop) return '';
  const cuerpo = st.pop.vista === 'herr' ? herramientasHtml() : st.pop.vista === 'lista' ? listaHtml() : ventanasPopHtml();
  const ancho = st.pop.vista === 'herr' ? '' : 'style="width:300px"';
  return `<div class="pop" role="dialog" aria-label="Herramientas" ${ancho}>${cuerpo}</div>`;
}

// ── Ventanas ──
function cuerpoVentana(v) {
  if (v.tipo === 'config') return configHtml();
  if (v.tipo === 'seccion') {
    const s = v.item.seccion;
    return `<div class="iframe"><div class="iframe-url">${esc(prod().nombre.split(' · ')[0].toLowerCase())}.learnation/${s.key}?embebida=1</div>
      <div class="iframe-cuerpo"><div><b style="color:var(--ln-text-out)">${esc(s.label)}</b><br>La sección, entera, en un iframe. Sin dock propio: la ventana ya es la navegación.</div></div></div>`;
  }
  if (v.id === 'buscar' || v.id === 'alumno') {
    return `<label class="buscador">${ico('search', 15)}<input placeholder="Nombre, mail, Instagram o teléfono" aria-label="Buscar"></label>
      <div class="lista" style="margin-top:10px"><button type="button">${ico('id', 16)} Martina Gómez <small style="margin-left:auto;color:var(--ln-text-muted)">@martig · agenda 14 nov</small></button>
      <button type="button">${ico('id', 16)} Martín Pérez <small style="margin-left:auto;color:var(--ln-text-muted)">martin@… · sin agenda</small></button></div>`;
  }
  return `<p class="nota">${esc(v.item?.desc || '')}</p><p class="nota" style="margin-top:10px">Contenido de «${esc(v.titulo)}» (mockup). Arrastrala por la cabecera: arriba la agranda, abajo la minimiza.</p>`;
}
function ventanasHtml() {
  return st.ventanas.map((v) => `<section class="ventana${v.max ? ' max' : ''}" data-v="${v.id}" ${v.min ? 'hidden' : ''}
      style="left:${v.x}px;top:${v.y}px;z-index:${900 + v.z}${v.tipo === 'config' ? ';width:640px' : ''}" aria-label="${esc(v.titulo)}">
    <div class="v-cab" data-mover="${v.id}"><b>${esc(v.titulo)}</b>
      <button type="button" class="btn-ico" data-acc="v-min" data-id="${v.id}" aria-label="Minimizar">${ico('minus', 16)}</button>
      <button type="button" class="btn-ico" data-acc="v-max" data-id="${v.id}" aria-label="Agrandar">${ico('max', 15)}</button>
      <button type="button" class="btn-ico" data-acc="v-cerrar" data-id="${v.id}" aria-label="Cerrar">${ico('x', 16)}</button></div>
    <div class="v-cuerpo">${cuerpoVentana(v)}</div></section>`).join('');
}

// ── Configuración (la abre el avatar) ──
function seg(nombre, valor, opciones) {
  return `<div class="seg" role="group">${opciones.map(([v, t]) => `<button type="button" data-acc="cfg" data-cfg="${nombre}" data-v="${v}" aria-pressed="${String(valor) === String(v)}">${t}</button>`).join('')}</div>`;
}
function configHtml() {
  const tab = st.tabConfig || 'cuenta';
  const h = document.documentElement;
  const tabs = [['cuenta', 'Cuenta'], ['apariencia', 'Apariencia'], ['dock', 'Dock'], ['beta', 'Beta']];
  let cuerpo = '';
  if (tab === 'cuenta') {
    cuerpo = `<div class="quien"><span class="avatar"><span>${esc(prod().usuario[0])}</span></span><span class="quien-txt"><b>${esc(prod().usuario)}</b><small>${esc(prod().rol)}</small></span></div>
      <p class="nota">Tus datos, tu personaje y tus integraciones (Google, WhatsApp). Cerrar sesión vive acá y en la tarjeta de la barra lateral.</p>
      <div><button type="button" class="boton" data-acc="salir">${ico('logout', 15)} Cerrar sesión</button></div>`;
  } else if (tab === 'apariencia') {
    cuerpo = `<div class="fila-config"><b>Tema</b>${seg('tema', h.dataset.tema, [['learnation', 'Learnation'], ['solido', 'Sólido'], ['relampago', 'Relámpago'], ['puro', 'Puro']])}</div>
      <div class="fila-config"><b>Modo</b>${seg('modo', h.dataset.modo, [['oscuro', 'Oscuro'], ['claro', 'Claro']])}</div>
      <div class="fila-config"><b>Efectos</b>${seg('efectos', h.dataset.efectos, [['si', 'Aura y vidrio'], ['no', 'Plano']])}</div>
      <p class="nota">Un solo sistema de temas para Work, Academy y Leadership: lo que elegís acá se ve igual en los tres.</p>`;
  } else if (tab === 'dock') {
    cuerpo = `<div class="fila-config"><b>Navegación</b>${seg('nav', st.nav, [['dock', 'Dock abajo'], ['lateral', 'Barra lateral']])}</div>
      <div class="fila-config"><b>Barra lateral</b>${seg('plegada', st.plegada, [[false, 'Desplegada'], [true, 'Solo íconos']])}</div>
      <div class="fila-config"><b>Auto-ocultar</b>${seg('auto', st.autoOcultar, [[true, 'Sí'], [false, 'Siempre visible']])}</div>
      <div class="fila-config"><b>Secciones</b><button type="button" class="boton" data-acc="editar">Editar navegación</button></div>
      <p class="nota">Se guarda en tu cuenta: otra compu arranca igual. En el teléfono siempre va abajo.</p>`;
  } else {
    cuerpo = '<p class="nota">Las versiones beta de cada lugar (como Componentes de Leadership): quien quiera, prueba lo nuevo antes.</p>';
  }
  return `<div class="config"><div class="config-tabs" role="tablist">${tabs.map(([id, t]) => `<button type="button" role="tab" data-acc="tab" data-tab="${id}" aria-selected="${tab === id}">${t}</button>`).join('')}</div>
    <div class="config-cuerpo">${cuerpo}</div></div>`;
}
