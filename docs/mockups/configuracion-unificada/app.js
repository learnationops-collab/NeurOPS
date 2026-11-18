// Estado, dibujo y eventos del mockup de Configuración unificada.

const $ = (s) => document.querySelector(s);
const st = {
  perfil: 'closer', vista: 'baldosas', abierta: true, seccion: 'apariencia', hoja: null,
  tema: 'learnation', modoElegido: 'oscuro', modo: 'oscuro', efectos: 'si', liviano: false,
  ancho: 'completo', margenes: 'con', densidad: 'comoda', letra: '100', fondo: 'aura',
  nav: 'dock', autoOcultar: true, barra: 'desplegada', movil: 'barra', flota: 'fijo',
  nApp: true, nPush: true, nWa: false, nMail: false, silencio: 'fuera',
};
const perfil = () => PERFILES[st.perfil];

// La apariencia se aplica a toda la página: así se ve el cambio detrás de la ventana.
function aplicar() {
  const sistema = window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'claro' : 'oscuro';
  st.modo = st.modoElegido === 'sistema' ? sistema : st.modoElegido;
  const h = document.documentElement.dataset;
  Object.assign(h, { tema: st.tema, modo: st.modo, efectos: st.liviano ? 'no' : st.efectos, ancho: st.ancho, margenes: st.margenes, densidad: st.densidad, liviano: st.liviano ? 'si' : 'no' });
  document.documentElement.style.fontSize = `${st.letra}%`;
}

const avatar = (cls = '') => `<span class="avatar ${cls}"><span>${esc(perfil().inicial)}</span></span>`;
const btnIco = (acc, icon, label, extra = '') => `<button type="button" class="btn-ico" data-acc="${acc}" aria-label="${label}" title="${label}" ${extra}>${ico(icon, 17)}</button>`;

function cabecera() {
  const p = perfil();
  return `<header class="conf-cab">
    <span class="conf-titulo">${ico('user', 17)}<b>Configuración</b></span>
    <div class="conf-acc">
      ${seg('vista', [['baldosas', '', 'grid'], ['pestanas', '', 'list']], st.vista).replace('class="seg"', 'class="seg seg--ico" aria-label="Vista"')}
      <span class="sep"></span>
      <button type="button" class="btn-ico" data-acc="aviso" data-t="El centro de notificaciones" aria-label="Notificaciones" title="Notificaciones">${ico('bell', 17)}${p.notis ? `<span class="globo">${p.notis > 9 ? '9+' : p.notis}</span>` : ''}</button>
      ${p.portal ? btnIco('aviso', 'portal', 'Portal: otra área o rol', 'data-t="Portal"') : ''}
      ${btnIco('salir', 'logout', 'Cerrar sesión')}
      ${btnIco('cerrar', 'x', 'Cerrar')}
    </div>
  </header>`;
}

// La identidad, a la izquierda en Baldosas (como el header de Academy y «Tu cuenta» de Leadership).
function yo() {
  const p = perfil();
  const hora = new Date().getHours();
  const saludo = hora < 6 ? 'Buenas noches' : hora < 13 ? 'Buen día' : hora < 20 ? 'Buenas tardes' : 'Buenas noches';
  const sync = (icon, ok, label) => `<button type="button" class="sync${ok ? ' sync--ok' : ''}" data-acc="ir" data-s="integraciones" title="${label}">${ico(icon, 14)}${ok ? `<i>${ico('check', 9)}</i>` : `<span>${label}</span>`}</button>`;
  return `<aside class="conf-yo">
    <span class="yo-aura" aria-hidden="true"><i></i><i></i></span>
    <button type="button" class="foto foto--grande" data-acc="ir" data-s="cuenta" title="Cambiar foto o personaje"><span>${esc(p.inicial)}</span><i>${ico('camera', 20)}</i></button>
    <p class="yo-hola">${saludo},</p>
    <h2 class="yo-nombre">${esc(p.usuario)}</h2>
    <p class="yo-dato">${esc(p.email)}</p>
    ${p.tel ? `<p class="yo-dato"><span class="bandera">${p.tz}</span>${esc(p.tel)}</p>` : ''}
    <div class="yo-pills"><span class="pill">${esc(p.rol)}</span>
      ${'calendar' in p ? sync('calendar', p.calendar, 'Conectar Calendar') + sync('chat', p.whatsapp, 'Confirmar WhatsApp') : ''}</div>
    <div class="yo-modo">${seg('modo', [['oscuro', 'Oscuro', 'moon'], ['claro', 'Claro', 'sun']], st.modo)}</div>
  </aside>`;
}

function baldosas() {
  const p = perfil();
  return `<div class="conf-cuerpo">${yo()}
    <div class="baldosas">${seccionesDe(st.perfil).filter((s) => s.key !== 'cuenta').map((s) => `<button type="button" class="baldosa${falta(s.key, p) ? ' baldosa--falta' : ''}" data-acc="hoja" data-s="${s.key}">
      <span class="baldosa-ico">${ico(s.icon, 19)}</span><b>${s.label}</b><small>${esc(resumen(s.key, p, st))}</small>${falta(s.key, p) ? '<em class="punto"></em>' : ''}</button>`).join('')}</div>
  </div>`;
}

function pestanas() {
  const p = perfil();
  const secs = seccionesDe(st.perfil);
  const actual = secs.find((s) => s.key === st.seccion) || secs[0];
  const grupos = [...new Set(secs.map((s) => s.grupo))];
  return `<div class="conf-cuerpo">
    <nav class="pestanas" aria-label="Secciones de Configuración">
      <button type="button" class="yo-mini" data-acc="ir" data-s="cuenta">${avatar()}<span><b>${esc(p.usuario)}</b><small>${esc(p.rol)}</small></span></button>
      ${grupos.map((g) => `<p class="pest-grupo">${g}</p>${secs.filter((s) => s.grupo === g).map((s) => `<button type="button" class="pest" role="tab" aria-selected="${s.key === actual.key}" data-acc="ir" data-s="${s.key}">
        ${ico(s.icon, 17)}<span>${s.label}</span>${falta(s.key, p) ? '<em class="punto"></em>' : ''}</button>`).join('')}`).join('')}
    </nav>
    <div class="panel" role="tabpanel"><header class="panel-cab"><h2>${actual.label}</h2><p>${actual.desc}</p></header>${CUERPOS[actual.key](p, st)}</div>
  </div>`;
}

// En Baldosas, cada baldosa abre su ventana encima (como «Tu dock» y «Aspecto» de Academy).
function hoja() {
  const s = SECCIONES.find((x) => x.key === st.hoja);
  return `<div class="hoja-capa" data-acc="cerrar-hoja"><div class="hoja" role="dialog" aria-label="${s.label}" data-capa="no">
    <header class="hoja-cab">${btnIco('cerrar-hoja', 'back', 'Volver a Configuración')}<span><b>${s.label}</b><small>${s.desc}</small></span>${btnIco('cerrar-todo', 'x', 'Cerrar')}</header>
    <div class="hoja-cuerpo">${CUERPOS[s.key](perfil(), st)}</div></div></div>`;
}

function render() {
  aplicar();
  $('#mk-perfil').value = st.perfil;
  document.querySelectorAll('[data-mk-vista]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mkVista === st.vista));
  $('#pg-quien').textContent = perfil().nombre;
  const scroll = document.querySelector('.panel, .hoja-cuerpo')?.scrollTop || 0;
  $('#conf').innerHTML = st.abierta ? `<div class="conf-capa" data-acc="cerrar"><div class="conf conf--${st.vista}" role="dialog" aria-label="Configuración" data-capa="no">
    ${cabecera()}${st.vista === 'baldosas' ? baldosas() : pestanas()}</div>${st.vista === 'baldosas' && st.hoja ? hoja() : ''}</div>` : '';
  const nuevo = document.querySelector('.panel, .hoja-cuerpo');
  if (nuevo) nuevo.scrollTop = scroll;
}

let avisoT;
function aviso(t) {
  const a = $('#aviso');
  a.textContent = `${t} (mockup)`;
  a.hidden = false;
  clearTimeout(avisoT);
  avisoT = setTimeout(() => { a.hidden = true; }, 1800);
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-acc]');
  if (!b) return;
  // Un clic adentro de la ventana no la cierra aunque burbujee hasta la capa.
  if (['cerrar', 'cerrar-hoja'].includes(b.dataset.acc) && b.classList.contains(b.dataset.acc === 'cerrar' ? 'conf-capa' : 'hoja-capa') && e.target !== b) return;
  const { acc, k, v, s } = b.dataset;
  if (acc === 'set') {
    st[k] = v;
    if (k === 'modo') st.modoElegido = v;
    if (k === 'vista') { st.hoja = null; if (!seccionesDe(st.perfil).some((x) => x.key === st.seccion)) st.seccion = 'cuenta'; }
  } else if (acc === 'toggle') {
    if (k === 'efectosOn') st.efectos = st.efectos === 'si' ? 'no' : 'si';
    else st[k] = !st[k];
  } else if (acc === 'ir') {
    if (st.vista === 'baldosas') st.hoja = s; else st.seccion = s;
  } else if (acc === 'hoja') st.hoja = s;
  else if (acc === 'cerrar-hoja') st.hoja = null;
  else if (acc === 'cerrar-todo' || acc === 'cerrar') { st.hoja = null; st.abierta = false; }
  else if (acc === 'abrir') st.abierta = true;
  else if (acc === 'salir') return aviso('Cerrar sesión');
  else if (acc === 'aviso') return aviso(b.dataset.t);
  else if (acc === 'pj') { document.querySelectorAll('.pj').forEach((x) => x.classList.toggle('on', x === b)); return; }
  render();
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (st.hoja) st.hoja = null; else st.abierta = false;
  render();
});
$('#mk-perfil').addEventListener('change', (e) => { st.perfil = e.target.value; st.hoja = null; st.seccion = 'apariencia'; render(); });
document.querySelectorAll('[data-mk-vista]').forEach((b) => b.addEventListener('click', () => { st.vista = b.dataset.mkVista; st.hoja = null; st.abierta = true; render(); }));
$('#mk-perfil').innerHTML = Object.entries(PERFILES).map(([k, p]) => `<option value="${k}">${p.nombre}</option>`).join('');
render();
