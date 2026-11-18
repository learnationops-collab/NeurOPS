// Dibuja la ventana del chat: la lista, la conversación y la columna de la derecha.
const E = {
  producto: 'work', visor: 'santi', tab: 'equipo', canal: 'equipo', areaAbierta: 'ventas',
  lado: 'conectados', lista: true, respondiendo: null, mias: new Set(), buscar: '', movilLista: false,
};

const HILOS = [
  { id: 'hilo-lucia', alumno: 'Lucía Romero', programa: 'Residency Roadmap', pendiente: true, ultimo: '¿Mañana a qué hora es la sesión?' },
  { id: 'hilo-tomas', alumno: 'Tomás Gil', programa: 'Specialist Iniciative', ultimo: 'Gracias, ya lo vi' },
];
MENSAJES['hilo-lucia'] = [{ tipo: 'texto', alumno: 'Lucía Romero', hora: '14:40', texto: '¡Hola! ¿Mañana a qué hora es la sesión de onboarding?' }];
MENSAJES['hilo-tomas'] = [{ tipo: 'texto', alumno: 'Tomás Gil', hora: 'Ayer', texto: 'Gracias, ya lo vi' }];

const visor = () => VISORES[E.visor];
const ve = (canal) => visor().areas.includes(CANALES[canal].area);

function nombreCanal(id) {
  if (CANALES[id]) return { nombre: CANALES[id].nombre, desc: CANALES[id].desc, icono: 'hash' };
  if (id === 'learnito') return { nombre: 'Learnito', desc: 'Tu conversación con Learnito · el mismo en Work, Academy y Leadership', icono: 'chispa' };
  const dm = DIRECTAS.find((d) => d.id === id);
  if (dm) { const p = PERSONAS[dm.con]; return { nombre: p.nombre, desc: p.donde ? `Conectado en ${PRODUCTOS[p.donde].nombre}${p.estado ? ' · ' + p.estado : ''}` : `Visto ${p.visto}`, icono: 'mensaje' }; }
  const bug = BUGS.find((b) => b.id === id);
  if (bug) return { nombre: bug.titulo, desc: `Bug de Leadership · ${bug.estado}`, icono: 'bug' };
  const hilo = HILOS.find((h) => h.id === id);
  if (hilo) return { nombre: hilo.alumno, desc: `${hilo.programa} · hilo con el equipo`, icono: 'birrete' };
  return { nombre: id, desc: '', icono: 'hash' };
}

/* ── Lista ── */
function filaCanal(id, hija) {
  const c = CANALES[id];
  const n = c.nuevos ? `<span class="cuenta cuenta--suave">${c.nuevos}</span>` : '';
  return `<button class="fila ${hija ? 'hija' : ''}" data-canal="${id}" aria-current="${E.canal === id}">${ic('hash', 16)}<span class="nom">${c.nombre}</span>${n}</button>`;
}

function listaEquipo() {
  const online = Object.keys(PERSONAS).filter((k) => PERSONAS[k].donde && k !== E.visor);
  let h = `<button class="fila fila--learnito" data-canal="learnito" aria-current="${E.canal === 'learnito'}"><span class="ico-l">${ic('chispa', 16)}</span>
    <span class="nom">Learnito<span class="sub">Preguntá o etiquetalo en cualquier canal</span></span></button>`;
  h += `<div class="tit-sec">Conectados · ${online.length}</div><div class="conectados">`;
  h += online.map((k) => `<button data-dm="${k}" title="${PERSONAS[k].nombre} · en ${PRODUCTOS[PERSONAS[k].donde].nombre}">${avatarDonde(k)}<span>${PERSONAS[k].nombre}</span></button>`).join('');
  h += '</div>';
  AREAS.filter((a) => visor().areas.includes(a.id)).forEach((a) => {
    const canales = Object.keys(CANALES).filter((k) => CANALES[k].area === a.id);
    if (a.suelta) { h += `<div class="tit-sec">General</div>` + canales.map((k) => filaCanal(k)).join(''); return; }
    const abierta = E.areaAbierta === a.id;
    const nuevos = canales.reduce((s, k) => s + (CANALES[k].nuevos || 0), 0);
    h += `<button class="fila ${abierta ? 'abierta' : ''}" data-area="${a.id}">${ic(a.icono, 16)}<span class="nom">${a.nombre}</span>
      ${!abierta && nuevos ? `<span class="cuenta cuenta--suave">${nuevos}</span>` : ''}<span class="flecha">${ic('flecha', 14)}</span></button>`;
    if (abierta) h += canales.map((k) => filaCanal(k, true)).join('');
  });
  const bugs = visor().bugs === 'gestiona' ? BUGS : BUGS.filter((b) => b.de === E.visor);
  const abiertaB = E.areaAbierta === 'bugs';
  h += `<button class="fila ${abiertaB ? 'abierta' : ''}" data-area="bugs">${ic('bug', 16)}<span class="nom">Bugs<span class="sub">Los reportes de Leadership</span></span>
    ${bugs.length ? `<span class="cuenta">${bugs.length}</span>` : ''}<span class="flecha">${ic('flecha', 14)}</span></button>`;
  if (abiertaB) h += bugs.map((b) => `<button class="fila hija" data-canal="${b.id}" aria-current="${E.canal === b.id}"><span class="nom">${esc(b.titulo)}<span class="sub">${b.estado}</span></span></button>`).join('');
  h += `<div class="tit-sec">Conversaciones <button class="ib" title="Nueva conversación">${ic('mas', 15)}</button></div>`;
  h += DIRECTAS.map((d) => `<button class="fila" data-canal="${d.id}" aria-current="${E.canal === d.id}">${avatarDonde(d.con, 'av--s')}
    <span class="nom">${PERSONAS[d.con].nombre}<span class="sub">${esc(d.ultimo)}</span></span>${d.nuevos ? `<span class="cuenta">${d.nuevos}</span>` : ''}</button>`).join('');
  return h;
}

function listaEstudiantes() {
  return `<div class="tit-sec">Grupos</div>
    <button class="fila hija" disabled>${ic('hash', 16)}<span class="nom">Anuncios</span></button>
    <button class="fila hija" disabled>${ic('hash', 16)}<span class="nom">Comunidad</span></button>
    <button class="fila hija" disabled>${ic('hash', 16)}<span class="nom">Victorias</span></button>
    <div class="tit-sec">Conversaciones <button class="ib" title="¿Con quién?">${ic('mas', 15)}</button></div>` +
    HILOS.map((h) => `<button class="fila" data-canal="${h.id}" aria-current="${E.canal === h.id}"><span class="av av--s" style="background:#64748B">${h.alumno[0]}</span>
      <span class="nom" ${h.pendiente ? 'style="color:var(--ln-brand)"' : ''}>${h.alumno}<span class="sub">${esc(h.ultimo)}</span></span>${h.pendiente ? '<span class="cuenta">1</span>' : ''}</button>`).join('');
}

function dibujarLista() {
  const conEst = visor().areas.includes('fulfillment');
  if (!conEst && E.tab === 'estudiantes') E.tab = 'equipo';
  document.getElementById('lista').innerHTML = `
    <div class="cab"><div class="tabs">
      <button data-tab="equipo" aria-pressed="${E.tab === 'equipo'}">Equipo <span class="cuenta cuenta--suave">8</span></button>
      ${conEst ? `<button data-tab="estudiantes" aria-pressed="${E.tab === 'estudiantes'}">Estudiantes <span class="cuenta">1</span></button>` : ''}
    </div></div>
    <div class="scroll">${E.tab === 'equipo' ? listaEquipo() : listaEstudiantes()}<div style="height:12px"></div></div>`;
}

/* ── Mensajes ── */
function acciones(i) {
  return `<div class="acciones">${REACCIONES.slice(0, 3).map((r) => `<button data-reac="${i}:${r}" title="Reaccionar">${ic(r, 15)}</button>`).join('')}
    <button data-responder="${i}" title="Responder">${ic('responder', 15)}</button>
    <button class="l" data-preguntar="${i}" title="Preguntar a Learnito sobre esto">${ic('chispa', 15)}</button>
    <button title="Copiar">${ic('copiar', 15)}</button></div>`;
}

function reacciones(m, i) {
  if (!m.reacciones) return '';
  return `<div class="reacs">${Object.entries(m.reacciones).map(([r, n]) => {
    const mia = E.mias.has(`${E.canal}:${i}:${r}`);
    return `<button class="reac" data-reac="${i}:${r}" aria-pressed="${mia}">${ic(r, 13)} ${n + (mia ? 1 : 0)}</button>`;
  }).join('')}</div>`;
}

function tarjeta(m) {
  if (m.tipo === 'aviso') {
    return `<div class="tarjeta ${m.tono === 'exito' ? 't-exito' : 't-aviso'}"><div class="tarjeta-in">
      <div class="tarjeta-tit">${ic(m.tono === 'exito' ? 'llama' : 'calendario', 13)} ${m.titulo}</div>
      <div class="tarjeta-nom">${esc(m.nombre)}</div>${m.tel ? `<div class="tarjeta-sub">${m.tel}</div>` : ''}
      <div class="chips">${m.chips.map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</div>
      <div class="cajas">${m.cajas.map(([k, v]) => `<div class="caja"><small>${k}</small><b>${formatear(v)}</b></div>`).join('')}</div></div></div>`;
  }
  if (m.tipo === 'bitacora') {
    return `<div class="tarjeta t-bitacora"><div class="tarjeta-in"><div class="tarjeta-tit">${ic('birrete', 13)} ${m.titulo}</div>
      <div class="tarjeta-nom">${esc(m.nombre)}</div><div class="tarjeta-sub">${formatear(m.detalle)}</div></div></div>`;
  }
  return `<div class="tarjeta t-tarea"><div class="tarjeta-in"><div class="tarjeta-tit">${ic('tarea', 13)} Tarea de Leadership</div>
    <div class="tarjeta-nom">${esc(m.titulo)}</div><div class="tarjeta-sub">${esc(m.origen)}</div>
    <div class="cajas"><div class="caja"><small>Para</small><b>${formatear('@' + PERSONAS[m.asignada].nombre)}</b></div><div class="caja"><small>Vence</small><b>${m.vence}</b></div></div></div></div>`;
}

function mensaje(m, i, lista) {
  const cita = m.respondeA ? `<div class="cita">Responde a ${m.respondeA === 'tarea' ? 'la tarea' : 'la tarjeta'} de arriba</div>` : '';
  if (m.tipo === 'learnito') return mensajeLearnito(m, i);
  if (m.tipo === 'escribiendo') return `<div class="msg"><span class="av av-l">${ic('chispa', 15)}</span><div class="msg-cuerpo"><div class="msg-cab"><b>Learnito</b></div><div class="escribiendo"><i></i><i></i><i></i></div></div></div>`;
  if (m.tipo === 'texto') {
    const p = m.de ? PERSONAS[m.de] : null;
    const av = p ? avatar(m.de) : `<span class="av" style="background:#64748B">${m.alumno[0]}</span>`;
    const tag = m.desde ? tagProducto(m.desde) : '<span class="tag" style="background:#64748B">Alumno</span>';
    return `<div class="msg">${av}<div class="msg-cuerpo">${cita}<div class="msg-cab"><b>${p ? p.nombre : esc(m.alumno)}</b>${tag}<time>${m.hora}</time></div>
      <div class="msg-txt">${formatear(m.texto)}</div>${reacciones(m, i)}</div>${acciones(i)}</div>`;
  }
  const autor = m.tipo === 'tarea' ? `<b>${PERSONAS[m.de].nombre}</b>${tagProducto('leadership')}`
    : m.tipo === 'aviso' ? `<b>${m.sistema}</b><span class="bot">Bot</span>` : '<b>Bitácora</b><span class="bot" style="color:var(--bitacora);background:rgba(34,184,216,.14)">Academy</span>';
  const av = m.tipo === 'tarea' ? avatar(m.de) : `<span class="av av-sis">${ic(m.tipo === 'aviso' ? 'campana' : 'birrete', 15)}</span>`;
  return `<div class="msg">${av}<div class="msg-cuerpo"><div class="msg-cab">${autor}<time>${m.hora}</time></div>${tarjeta(m)}${reacciones(m, i)}</div>${acciones(i)}</div>`;
}

function dibujarDetalle() {
  const c = nombreCanal(E.canal);
  let msgs = MENSAJES[E.canal] || [];
  if (E.buscar.length >= 2) msgs = msgs.filter((m) => (m.texto || '').toLowerCase().includes(E.buscar.toLowerCase()));
  const cuerpo = E.canal === 'learnito' && !msgs.length ? vacioLearnito() : `<div class="dia">Hoy</div>` + msgs.map((m, i) => mensaje(m, i)).join('');
  const resp = E.respondiendo !== null ? `<div class="respondiendo">${ic('responder', 14)} Respondiendo a ${E.respondiendo.quien}<button class="ib" data-cancelar>${ic('cerrar', 14)}</button></div>` : '';
  const placeholder = E.canal === 'learnito' ? 'Preguntale a Learnito…' : `Escribí en ${c.nombre}…`;
  document.getElementById('detalle').innerHTML = `
    <div class="cab"><button class="ib" data-toggle-lista aria-pressed="${E.lista}" title="Mostrar u ocultar la lista">${ic('panel')}</button>
      <div class="cab-txt"><h2>${ic(c.icono, 16)} <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.nombre)}</span></h2><small>${esc(c.desc)}</small></div>
      <button class="ib" data-buscar aria-pressed="${!!E.mostrarBuscar}" title="Buscar en la conversación">${ic('buscar')}</button>
      <button class="ib" data-lado="conectados" aria-pressed="${E.lado === 'conectados'}" title="Conectados">${ic('gente')}</button>
      <button class="ib" data-lado="learnito" aria-pressed="${E.lado === 'learnito'}" title="Learnito al costado">${ic('chispa')}</button>
      <button class="ib" title="Minimizar" data-cerrar>${ic('minimizar')}</button><button class="ib" title="Pantalla completa">${ic('maximizar')}</button>
      <button class="ib" title="Cerrar" data-cerrar>${ic('cerrar')}</button></div>
    ${E.mostrarBuscar ? `<div style="padding:8px 14px;border-bottom:1px solid var(--ln-border-subtle)"><div class="campo">${ic('buscar', 16)}<textarea id="buscar" rows="1" placeholder="Buscar en ${esc(c.nombre)} (2 letras o más)">${esc(E.buscar)}</textarea></div></div>` : ''}
    <div class="scroll" id="linea"><div class="linea">${cuerpo}</div></div>
    <div class="escribir" style="position:relative">${resp}<div id="menciones"></div>
      <div class="campo"><button class="ib" title="Adjuntar">${ic('clip')}</button>
        <textarea id="texto" rows="1" placeholder="${esc(placeholder)}"></textarea>
        <button class="ib" data-arroba title="Etiquetar">${ic('arroba')}</button>
        <button class="enviar" data-enviar title="Enviar">${ic('enviar', 16)}</button></div>
      <div class="pie-campo"><span>${E.canal === 'learnito' ? 'Solo lo ves vos' : '@ etiqueta a alguien · @Learnito le pregunta en el canal'}</span><span>Lo ven en Work, Academy y Leadership</span></div></div>`;
  const linea = document.getElementById('linea');
  linea.scrollTop = linea.scrollHeight;
}

/* ── Columna de la derecha ── */
function dibujarConectados() {
  const grupos = ['work', 'academy', 'leadership'].map((prod) => {
    const gente = Object.keys(PERSONAS).filter((k) => PERSONAS[k].donde === prod);
    if (!gente.length) return '';
    return `<div class="grupo-p"><span class="tag p-${prod}">${PRODUCTOS[prod].letra}</span> En ${PRODUCTOS[prod].nombre} · ${gente.length}</div>` +
      gente.map((k) => { const p = PERSONAS[k]; return `<button class="persona" data-dm="${k}">${avatar(k)}<span><span class="nom">${p.nombre}${k === E.visor ? ' (vos)' : ''}</span>
        <span class="sub ${p.estado ? 'estado' : ''}">${p.estado || p.rol}</span></span></button>`; }).join('');
  }).join('');
  const off = Object.keys(PERSONAS).filter((k) => !PERSONAS[k].donde);
  return `<div class="cab"><div class="cab-txt"><h2>${ic('gente', 16)} Conectados</h2><small>Usó un servicio en los últimos 5 minutos</small></div></div>
    <div class="scroll">${grupos}<div class="grupo-p" style="color:var(--ln-text-faint)">Desconectados · ${off.length}</div>
    ${off.map((k) => `<button class="persona off" data-dm="${k}">${avatar(k)}<span><span class="nom">${PERSONAS[k].nombre}</span><span class="sub">${PERSONAS[k].rol} · visto ${PERSONAS[k].visto}</span></span></button>`).join('')}
    <div class="ctx"><small>Cómo se calcula</small>Cada servicio avisa a la Academia cuando la persona lo usa (a lo sumo una vez por minuto). Se guarda en caché, no en una tabla. El estado «En llamada» sale de su agenda de Work o de la Academia.</div></div>`;
}

function dibujarLado() {
  const el = document.getElementById('lado');
  el.innerHTML = E.lado === 'learnito' ? dibujarLearnitoLado() : dibujarConectados();
}

function dibujarTodo() {
  PERSONAS[E.visor].donde = E.producto;
  const v = document.getElementById('ventana');
  v.classList.toggle('sin-lista', !E.lista);
  v.classList.toggle('sin-lado', !E.lado);
  v.classList.toggle('movil-lista', E.movilLista);
  dibujarLista(); dibujarDetalle(); dibujarLado();
  const pg = { work: ['Work', 'Agendas de hoy'], academy: ['Academy', 'Dashboard del equipo'], leadership: ['Leadership', 'Tablero de la semana'] }[E.producto];
  document.getElementById('pg-producto').textContent = pg[0];
  document.getElementById('pg-titulo').textContent = pg[1];
}
