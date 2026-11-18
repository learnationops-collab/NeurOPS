// Learnito dentro del chat: su conversación propia, la etiqueta @Learnito en un canal y el panel al costado.
// El «cerebro» es de mentira: responde por palabras clave.
E.ladoL = { ctx: null, msgs: [] };

function responder(pregunta, ctx) {
  const q = pregunta.toLowerCase();
  if (ctx && ctx.tipo === 'aviso') {
    return { texto: `**${ctx.nombre}** agendó hoy por Instagram (palabra MEDICO). Lleva 2 mensajes por WhatsApp con @Valentina y ninguna llamada antes. En leads parecidos, el show up es del 62%.`,
      accion: { tipo: 'Comentario en la ficha', texto: `Lead caliente: confirmar asistencia 1 h antes de la llamada (${ctx.nombre}).` }, chips: ['Ver la ficha', 'Leads parecidos'] };
  }
  if (ctx && (ctx.tipo === 'bitacora' || ctx.tipo === 'tarea')) {
    return { texto: ctx.tipo === 'tarea' ? 'Hay **14 follow-ups** de más de 48 h: 9 de Instagram y 5 de WhatsApp. El más viejo es de hace 4 días.'
      : `**${ctx.nombre}** pagó la seña completa hoy a las 13:02. Tiene acceso desde las 14:12 y la Onboarding Session mañana a las 11:00 con @Camila.`, chips: ['Ver la lista', 'Avisarle a alguien'] };
  }
  if (q.includes('show')) return { texto: 'Show up de las últimas 4 semanas, por closer:', grafico: [['Valentina', 78], ['Closer 2', 64], ['Closer 3', 59]], chips: ['Por semana', 'Ver la lista'] };
  if (q.includes('agenda')) return { texto: 'Hoy hay **6 agendas**: 4 confirmadas y 2 sin confirmar.', grafico: [['Confirmadas', 4], ['Sin confirmar', 2]], chips: ['Por closer', 'Ver la lista'] };
  if (q.includes('avis') || q.includes('decile')) return { texto: 'Te preparé el aviso. No se manda hasta que confirmes.', accion: { tipo: 'Avisarle a @Valentina', texto: 'Martín Ferreyra confirmó para las 15:00.' } };
  return { texto: 'Lo busqué en Work y en la Academia. Esta semana van **7 ventas** sobre una meta de 12, y 3 alumnos nuevos ya tienen la Onboarding agendada.', chips: ['Por programa', 'Por closer'] };
}

function mensajeLearnito(m, i) {
  const max = m.grafico ? Math.max(...m.grafico.map((g) => g[1])) : 1;
  const graf = m.grafico ? `<div class="barras">${m.grafico.map(([k, v]) => `<div class="barra"><span>${esc(k)}</span><i style="width:${(v / max) * 100}%"></i><b>${v}</b></div>`).join('')}</div>` : '';
  const acc = m.accion ? (m.accion.hecha ? `<div class="confirma">${ic('check', 14)} ${m.accion.tipo}: hecho.</div>`
    : `<div class="confirma"><b>${formatear(m.accion.tipo)}</b><textarea>${esc(m.accion.texto)}</textarea>
      <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn--p" data-confirmar="${i}">Confirmar</button><button class="btn" data-descartar="${i}">Descartar</button></div></div>`) : '';
  const chips = m.chips ? `<div class="chips">${m.chips.map((c) => `<button class="sug" data-sug="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : '';
  const pie = m.pidio ? `Respondió a ${PERSONAS[m.pidio].nombre}, con lo que ${m.pidio === E.visor ? 'vos podés' : 'esa persona puede'} ver` : 'Solo lo ves vos';
  return `<div class="msg"><span class="av av-l">${ic('chispa', 15)}</span><div class="msg-cuerpo"><div class="msg-cab"><b>Learnito</b><span class="bot bot--l">IA</span><time>${m.hora}</time></div>
    <div class="l-resp"><p>${formatear(m.texto)}</p>${graf}${acc}${chips}<div class="l-pie">${ic('chispa', 12)} ${pie} · 0,8 ¢</div></div>${reacciones(m, i)}</div>${acciones(i)}</div>`;
}

function vacioLearnito() {
  return `<div class="vacio-l"><span class="ico-l">${ic('chispa', 26)}</span>
    <b style="font-size:16px;color:var(--ln-text-out)">Preguntale lo que quieras</b>
    <span>Es el mismo Learnito de siempre: lee Work y la Academia según tu rol, arma gráficos y deja comentarios o avisos cuando confirmás.<br>También podés etiquetarlo en cualquier canal con <span class="mencion mencion--l">@Learnito</span>.</span>
    <div class="chips" style="justify-content:center">${['Mis agendas de hoy', 'Show up por closer', '¿Cómo venimos con la meta?'].map((s) => `<button class="sug" data-sug="${s}">${s}</button>`).join('')}</div></div>`;
}

function ahora() { const d = new Date(); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; }

// Escribe la pregunta y, un momento después, la respuesta. lista = el arreglo de mensajes donde va.
function preguntar(lista, texto, ctx, pidio, redibujar) {
  lista.push({ tipo: 'escribiendo' });
  redibujar();
  setTimeout(() => {
    lista.pop();
    lista.push({ tipo: 'learnito', hora: ahora(), pidio, ...responder(texto, ctx) });
    redibujar();
  }, 1100);
}

function citaCtx(m) {
  if (!m) return '';
  const quien = m.tipo === 'texto' ? (m.de ? PERSONAS[m.de].nombre : m.alumno) : m.tipo === 'aviso' ? `${m.sistema}: ${m.titulo}` : m.tipo === 'tarea' ? 'Tarea de Leadership' : m.titulo;
  const que = m.tipo === 'texto' ? m.texto : m.nombre || m.titulo;
  return `<div class="ctx"><small>Sobre esto · ${esc(nombreCanal(E.canal).nombre)}</small><b>${esc(quien)}</b><div style="color:var(--ln-text-muted)">${esc(que)}</div></div>`;
}

function dibujarLearnitoLado() {
  const L = E.ladoL;
  const msgs = L.msgs.map((m, i) => (m.tipo === 'pregunta'
    ? `<div class="msg" style="justify-content:flex-end"><div class="l-resp" style="background:var(--ln-ct3-hover);border-color:transparent;max-width:85%"><p>${formatear(m.texto)}</p></div></div>`
    : mensaje(m, `L${i}`))).join('');
  const vacio = !L.ctx && !L.msgs.length ? `<div class="vacio-l" style="padding:24px 12px"><span>Tocá ${ic('chispa', 13)} en cualquier mensaje o tarjeta para preguntarle a Learnito sobre eso, sin salir del canal.</span></div>` : '';
  return `<div class="cab"><div class="cab-txt"><h2>${ic('chispa', 16)} Learnito</h2><small>Al costado · lo ves solo vos</small></div>
      <button class="ib" data-limpiar-l title="Nueva conversación">${ic('mas', 15)}</button></div>
    <div class="scroll" id="linea-l">${citaCtx(L.ctx)}${vacio}<div class="linea" style="padding:8px">${msgs}</div></div>
    <div class="escribir"><div class="campo"><textarea id="texto-l" rows="1" placeholder="Preguntale a Learnito…"></textarea>
      <button class="enviar" data-enviar-l>${ic('enviar', 16)}</button></div>
      <div class="pie-campo"><span>${ic('chispa', 11)} 0,8 de 5 ¢ en esta conversación</span><button class="sug" style="padding:2px 8px" data-publicar-l>Compartir en el canal</button></div></div>`;
}
