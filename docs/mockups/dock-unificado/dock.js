// El comportamiento del mockup: dock de tres islas o barra lateral, Herramientas, edición de la
// navegación, ventanas, Configuración (lo abre el avatar), auto-ocultar, atajos y medición de uso.
/* global PRODUCTOS, ico, contratoHtml */

const GRUPOS = ['Crear', 'Buscar', 'Trabajo', 'Asistente', 'Pendientes', 'Secciones ocultas', 'Ir a'];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (sel) => document.querySelector(sel);

const st = {
  producto: 'work-setter', nav: 'dock', plegada: false, autoOcultar: true, oculto: false, simulando: false,
  editando: false, renombrando: null, pop: null, filtro: '', ventanas: [], z: 1, uso: {}, registro: [], prefs: {}, activa: {},
};

// Preferencias por producto (en la cuenta, en el diseño real; acá, en memoria).
function prefs() {
  const p = PRODUCTOS[st.producto];
  if (!st.prefs[st.producto]) st.prefs[st.producto] = { orden: [], ocultos: [], nombres: {}, fijadas: [...p.fijadas] };
  return st.prefs[st.producto];
}
const prod = () => PRODUCTOS[st.producto];
const herr = (key) => prod().herramientas.find((h) => h.key === key);
const lateral = () => st.nav === 'lateral' && window.innerWidth > 640;

function secciones() {
  const pr = prefs();
  const base = prod().secciones;
  const ids = [...pr.orden.filter((k) => base.some((s) => s.key === k)), ...base.map((s) => s.key).filter((k) => !pr.orden.includes(k))];
  return ids.map((k) => {
    const s = base.find((x) => x.key === k);
    return { ...s, label: pr.nombres[k] || s.label, original: s.label, oculta: pr.ocultos.includes(k) };
  });
}
const activa = () => st.activa[st.producto] || secciones().find((s) => !s.oculta)?.key;

// Lo que se puede fijar: herramientas y secciones ocultas («sec:clave»).
function fijable(id) {
  if (id.startsWith('sec:')) {
    const s = secciones().find((x) => x.key === id.slice(4));
    return s && s.oculta ? { key: id, label: s.label, icon: s.icon, tipo: 'seccion', seccion: s } : null;
  }
  return herr(id) || null;
}

function usar(key, origen) {
  st.uso[key] = (st.uso[key] || 0) + 1;
  st.registro.unshift(`${new Date().toLocaleTimeString('es-AR')} · ${prod().nombre} · ${key} · desde ${origen}`);
  st.registro = st.registro.slice(0, 12);
  if (!$('#contrato').hidden) $('#contrato').innerHTML = contratoHtml(st);
}

// ── Abrir cosas ──
function abrir(item, origen, ancla) {
  if (!item) return;
  usar(item.key, origen);
  if (item.tipo === 'lista') { st.pop = { vista: 'lista', key: item.key, ancla }; return render(); }
  if (item.tipo === 'pagina') { alert(`«${item.label}» lleva a otra pantalla (mockup).`); return; }
  if (item.tipo === 'accion') { alert(`«${item.label}» corre su acción (mockup).`); return; }
  st.pop = null;
  abrirVentana(item.key, item.label, item.tipo === 'seccion' ? 'seccion' : 'herr', item);
}
function abrirVentana(id, titulo, tipo, item = null) {
  const ya = st.ventanas.find((v) => v.id === id);
  st.z += 1;
  if (ya) Object.assign(ya, { min: false, z: st.z });
  else st.ventanas.push({ id, titulo, tipo, item, x: 120 + st.ventanas.length * 28, y: 90 + st.ventanas.length * 24, min: false, max: false, z: st.z });
  render();
}
const abrirConfig = (tab = 'cuenta') => { st.tabConfig = tab; usar('configuracion', 'avatar'); abrirVentana('config', 'Configuración', 'config'); };

// ── Piezas ──
const senal = (s) => (s.senal ? `<span class="senal senal--${s.senal.tipo}" title="${esc(s.senal.titulo)}">${s.senal.tipo === 'aviso' ? '' : esc(s.senal.texto)}</span>` : '');
// Plegada, la barra lateral muestra hasta 5 secciones (la activa siempre entre ellas) y un «+N» que la despliega.
const TOPE_SECCIONES = 5;
const TOPE_ACCESOS = 3;
const masBtn = (n, acc, que) => `<button type="button" class="btn-ico mas" data-acc="${acc}" aria-label="${n} ${que} más" title="${n} ${que} más">+${n}</button>`;
function navItems() {
  const act = activa();
  let lista = secciones();
  let resto = 0;
  if (lateral() && st.plegada && !st.editando) {
    const vis = lista.filter((s) => !s.oculta);
    let primeras = vis.slice(0, TOPE_SECCIONES);
    if (!primeras.some((s) => s.key === act)) primeras = [...vis.slice(0, TOPE_SECCIONES - 1), vis.find((s) => s.key === act)].filter(Boolean);
    resto = vis.length - primeras.length;
    lista = primeras;
  }
  return lista.map((s) => {
    if (st.editando) {
      const nombre = st.renombrando === s.key
        ? `<input class="renombrar" data-renombrar="${s.key}" value="${esc(s.label)}" maxlength="24" aria-label="Nuevo nombre de ${esc(s.original)}">`
        : `<span class="nombre" data-dbl="${s.key}" title="Doble clic para renombrar">${esc(s.label)}</span>`;
      return `<div class="nav-item edit${s.oculta ? ' oculta' : ''}" draggable="true" data-arrastrar="${s.key}">${ico(s.icon)}${nombre}
        <button type="button" class="ojo" data-acc="ojo" data-key="${s.key}" aria-label="${s.oculta ? 'Mostrar' : 'Ocultar'} ${esc(s.label)}">${ico(s.oculta ? 'eyeOff' : 'eye', 15)}</button></div>`;
    }
    if (s.oculta) return '';
    const solo = lateral() && st.plegada;
    return `<button type="button" class="nav-item" data-acc="seccion" data-key="${s.key}" ${s.key === act ? 'aria-current="page"' : ''}
      aria-label="${esc([s.label, s.senal?.titulo].filter(Boolean).join(', '))}" ${solo ? `title="${esc(s.label)}"` : ''}>
      ${ico(s.icon)}${solo ? '' : `<span class="nombre">${esc(s.label)}</span>`}${senal(s)}</button>`;
  }).join('') + (resto > 0 ? masBtn(resto, 'plegar', resto === 1 ? 'sección' : 'secciones') : '');
}
// `que`: 'accesos' (botones de un toque), 'widgets' (lo vivo y extensible: Flow, Pomodoro) o todo.
function pinsHtml(que = 'todo') {
  let items = prefs().fijadas.map(fijable).filter(Boolean).filter((h) => que === 'todo' || (que === 'widgets') === !!h.widget);
  // Plegada, la tarjeta muestra hasta 3 accesos; el resto, en Herramientas.
  let resto = 0;
  if (que === 'accesos' && lateral() && st.plegada && items.length > TOPE_ACCESOS) {
    resto = items.length - TOPE_ACCESOS;
    items = items.slice(0, TOPE_ACCESOS);
  }
  return items.map((h) => {
    if (h.widget) return `<button type="button" class="widget-flow" data-acc="pin" data-key="${h.key}" aria-label="Flow Sprint, 24 minutos"><i></i><span id="flow-t">24:13</span></button>`;
    const globo = h.cuenta ? `<span class="globo">${h.cuenta}</span>` : '';
    return `<button type="button" class="btn-ico" data-acc="pin" data-key="${h.key}" aria-label="${esc(h.label)}" title="${esc(h.label)}">${ico(h.icon)}${globo}</button>`;
  }).join('') + (resto > 0 ? masBtn(resto, 'herramientas', resto === 1 ? 'acceso fijado' : 'accesos fijados') : '');
}
const simulandoHtml = () => (st.simulando ? `<span class="simulando">${ico('eye', 16)} Simulando a ${esc(prod().usuario)} <button type="button" data-acc="dejar-simular">Salir</button></span>` : '');
const sinLeer = () => prod().herramientas.reduce((n, h) => n + (h.cuenta || 0), 0);
const ventanasBtn = () => {
  const n = st.ventanas.length;
  return n ? `<span class="sep"></span><button type="button" class="btn-ico" data-acc="ventanas" aria-label="Ventanas abiertas · Ctrl+\`" aria-expanded="${st.pop?.vista === 'ventanas'}">${ico('win')}<span class="globo">${n}</span></button>` : '';
};
const herrBtn = (conNombre) => `<button type="button" class="${conNombre ? 'btn-herr' : 'btn-ico'}" data-acc="herramientas" aria-label="Herramientas · Ctrl+J"
  aria-expanded="${st.pop?.vista === 'herr'}">${ico('wrench')}${conNombre ? '<span>Herramientas</span>' : ''}${sinLeer() ? `<span class="globo">${sinLeer()}</span>` : ''}</button>`;
const avatarBtn = () => `<button type="button" class="avatar" data-acc="config" aria-label="Configuración de ${esc(prod().usuario)}" title="Configuración"><span>${esc(prod().usuario[0])}</span></button>`;

function dockHtml() {
  const izq = simulandoHtml() + pinsHtml();
  return `<div class="dock${st.oculto ? ' oculto' : ''}${st.editando ? ' editando' : ''}">
    <div class="izq">${izq ? `<div class="isla">${izq}</div>` : ''}</div>
    <div class="isla barra-movil"><nav class="nav" aria-label="Secciones" style="display:flex;gap:2px">${navItems()}</nav>${ventanasBtn()}</div>
    <div class="der"><div class="isla">${herrBtn(false)}<span class="sep"></span>${avatarHover()}</div></div>
  </div>${st.oculto ? `<button type="button" class="revelar" data-acc="despertar" aria-label="Mostrar el dock">${ico('up', 16)}</button>` : ''}`;
}
// En el dock, pasar el mouse por el avatar abre la misma tarjeta que la barra lateral desplegada
// (sin plegar ni lo fijado, que en el dock ya están a la izquierda). Tocarlo sigue abriendo Configuración.
function avatarHover() {
  const p = prod();
  return `<div class="av-hover">${avatarBtn()}
    <section class="tarjeta tarjeta-flot" aria-label="Tu sesión">${notifBtn()}
      <div class="quien quien--grande">${avatarBtn()}<span class="quien-txt"><b>${esc(p.usuario)}</b><small>${esc(p.rol)}${st.simulando ? ' · simulación' : ''}</small></span></div>
      ${filaTarjeta()}
    </section></div>`;
}
function lateralHtml() {
  const p = prod();
  const pleg = st.plegada;
  const plegar = `<button type="button" class="plegar" data-acc="plegar" aria-label="${pleg ? 'Desplegar' : 'Plegar'} la barra">${ico(pleg ? 'right' : 'left', 17)}</button>`;
  return `<aside class="lateral${pleg ? ' plegada' : ''}${st.editando ? ' editando' : ''}" aria-label="Navegación">
    <section class="tarjeta" aria-label="Tu sesión">
      ${plegar}${pleg ? '' : notifBtn()}
      <div class="quien${pleg ? '' : ' quien--grande'}">${avatarBtn()}${pleg ? '' : `<span class="quien-txt"><b>${esc(p.usuario)}</b><small>${esc(p.rol)}${st.simulando ? ' · simulación' : ''}</small></span>`}</div>
      ${pleg ? '' : filaTarjeta()}
      ${st.simulando ? simulandoHtml() : ''}
      ${pleg ? `<div class="acciones-tarjeta">${herrBtn(false)}</div>` : ''}
      <div class="fijadas-tarjeta">${pinsHtml('accesos')}</div>
    </section>
    <div class="lado-nav">
      <nav class="nav" aria-label="Secciones">${navItems()}</nav>
      <div class="fin">${widgetsLateral()}${ventanasBtn().replace('<span class="sep"></span>', '')}</div>
    </div>
  </aside>`;
}
// Notificaciones, arriba a la derecha de la tarjeta desplegada: abre Pendientes (avisos, conflictos, reportes).
const notifBtn = () => {
  const b = herr('bandeja');
  return `<button type="button" class="notif btn-ico" data-acc="pin" data-key="bandeja" aria-label="Notificaciones" title="Notificaciones">${ico('bell', 17)}${b?.cuenta ? `<span class="globo">${b.cuenta}</span>` : ''}</button>`;
};
// La fila de la tarjeta desplegada, iguales en los tres productos: Cerrar sesión, las transversales
// (Mensajes, Leadership), Herramientas y Configuración.
function filaTarjeta() {
  const btn = (acc, key, icon, label, cuenta, extra = '') => `<button type="button" class="btn-ico" data-acc="${acc}" ${key ? `data-key="${key}"` : ''}
    aria-label="${label}" title="${label}" ${extra}>${ico(icon)}${cuenta ? `<span class="globo">${cuenta}</span>` : ''}</button>`;
  const m = herr('mensajes');
  const l = herr('leadership');
  return `<div class="tres">${btn('salir', '', 'logout', 'Cerrar sesión')}${m ? btn('pin', 'mensajes', m.icon, m.label, m.cuenta) : ''}${l ? btn('pin', 'leadership', l.icon, l.label) : ''}`
    + btn('herramientas', '', 'wrench', 'Herramientas · Ctrl+J', sinLeer(), `aria-expanded="${st.pop?.vista === 'herr'}"`)
    + btn('config', '', 'gear', 'Configuración') + '</div>';
}

// En la barra lateral, los widgets fijados van al fondo de la navegación y se pueden extender:
// desplegada, una tarjeta con su detalle; plegada, el widget chico.
function widgetsLateral() {
  const ws = prefs().fijadas.map(fijable).filter((h) => h && h.widget);
  if (!ws.length) return '';
  if (st.plegada) return `<div class="widgets-lado">${pinsHtml('widgets')}</div>`;
  return `<div class="widgets-lado">${ws.map((h) => `<section class="widget-ext" aria-label="${esc(h.label)}">
    <div class="widget-ext-cab">${ico(h.icon, 16)}<b>${esc(h.label)}</b><span class="widget-ext-t" id="flow-t">24:13</span></div>
    <p>Ordenar la semana del equipo comercial</p>
    <div class="widget-ext-acc"><button type="button" class="boton">Pausar</button><button type="button" class="boton" data-acc="pin" data-key="${h.key}">Abrir</button></div>
  </section>`).join('')}</div>`;
}

function barraEdicion() {
  return st.editando ? `<div class="barra-edicion" role="status"><span><b>Editando la navegación</b> · arrastrá · el ojo oculta · doble clic renombra</span>
    <button type="button" class="boton" data-acc="restablecer">Restablecer</button><button type="button" class="boton boton--cta" data-acc="listo">Listo</button></div>` : '';
}
