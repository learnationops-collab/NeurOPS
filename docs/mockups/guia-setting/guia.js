let sel = 'dolor', rol = 'setter', vista = { paso: 0, op: 0 };
const cambios = new Set();
const LETRAS = 'ABCDEF';
const USOS = { '': 'Siempre', 'solo si': 'Solo si…', opcional: 'Opcional', 'no se usa': 'No se usa' };

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const et = (id) => ETAPAS.find((e) => e.id === id);
const dc = () => rol !== 'setter';
const siguiente = (e) => { const emb = ETAPAS.filter((x) => x.tramo !== 'salida'); const i = emb.indexOf(e); return i >= 0 ? emb[i + 1] : null; };
const rotulo = (p, o, j) => (p.porRespuesta ? `Si eligió ${o.si}` : p.op.length > 1 ? `Opción ${LETRAS[j]}` : 'Mensaje');

function lista() {
  const btn = (id, n, txt, c) => `<button class="et ${id === sel ? 'act' : ''}" data-id="${id}" style="--c:${c}"><span class="n">${n}</span><span>${esc(txt)}${[...cambios].some((x) => x.startsWith(id + ':')) ? '<span class="sucio"></span>' : ''}</span></button>`;
  const grupos = Object.entries(TRAMOS).map(([k, t]) => `<div class="grupo"><div class="k">${t.n}</div>${
    ETAPAS.filter((e) => e.tramo === k).map((e) => btn(e.id, e.n, e.label, t.c)).join('')}</div>`).join('');
  document.getElementById('lista').innerHTML = `<div class="grupo">${btn('quien', '?', 'Quién es lead', 'var(--muted)')}</div>${grupos}
    <button class="btn ghost" id="nueva-etapa">Agregar etapa</button>`;
}

function opcion(e, p, i, o, j) {
  const mejor = !p.porRespuesta && p.op.length > 1 && o.r && p.op.every((x) => !x.r || x.r[1] <= o.r[1]);
  return `<div class="op">
    <div class="ocab"><span class="letra">${esc(rotulo(p, o, j))}</span>${o.desde ? `<span class="k">desde ${o.desde}</span>` : ''}${mejor ? '<span class="mas">Responden más</span>' : ''}</div>
    ${o.audio ? `<div class="audio">${esc(o.audio)}<span>es un audio · abajo, lo que dice</span></div>` : ''}
    <textarea data-p="${i}" data-o="${j}">${esc(o.x)}</textarea>
    ${o.r ? `<div class="cifra"><b>${o.r[1]}%</b> respondió · ${o.r[0]} enviados en 14 días</div>` : ''}
  </div>`;
}

function paso(e, p, i) {
  const k = `${e.id}:${i}`;
  const prox = siguiente(e);
  const uso = p.uso || '';
  const usos = Object.entries(USOS).map(([v, t]) => `<option value="${v}" ${v === uso ? 'selected' : ''}>${t}</option>`).join('');
  const nueva = !p.porRespuesta && p.op.length < 2 ? `<button class="nueva" data-ab="${i}">Agregar opción B</button>` : '';
  const salida = prox ? `<select class="sel"><option>Sigue en ${esc(e.label)}</option><option ${p.avanza ? 'selected' : ''}>Pasa a ${esc(prox.label)}</option></select>` : '';
  return `<div class="paso ${uso === 'no se usa' ? 'apagado' : ''} ${cambios.has(k) ? 'editado' : ''}" data-k="${k}">
    <div class="pcab"><span class="num">${i + 1}</span><input class="tit" value="${esc(p.t)}" aria-label="Nombre del paso">
      <input class="atajo" value="/${esc(p.atajo)}" aria-label="Atajo">
      <select class="sel uso" data-p="${i}" aria-label="Cuándo se usa">${usos}</select>
      ${uso === 'solo si' ? `<input class="cuando" value="${esc(p.cuando || '')}" placeholder="por ejemplo: ningún horario le sirve">` : ''}</div>
    ${p.botones ? `<div class="ppie">Con botones: <b>${p.botones.join(' · ')}</b></div>` : ''}
    ${p.espera ? `<div class="ppie">Se manda ${esc(p.espera)}</div>` : ''}
    <div class="ops">${p.op.map((o, j) => opcion(e, p, i, o, j)).join('')}${nueva}</div>
    ${p.nota ? `<div class="nota">${esc(p.nota)}</div>` : ''}
    <div class="ppie">${salida ? 'Al mandarlo: ' + salida : ''}<button class="btn ghost quitar">Quitar paso</button></div>
  </div>`;
}

function vistaEtapa(e) {
  const t = TRAMOS[e.tramo];
  return `<div class="ecab"><span class="chip" style="--c:${t.c}">${t.n}</span><h2>${e.n}. ${esc(e.label)}</h2>
      <div class="der">${dc() ? '<button class="btn ghost">Renombrar</button><button class="btn ghost">Mover</button>' : '<button class="btn ghost" id="proponer">Proponer un cambio a la etapa</button>'}</div></div>
    ${e.bot ? `<div class="bot">Esta etapa la arranca el bot con el flujo «${esc(e.bot)}». Lo de abajo es para mandarlo a mano si el bot no salió.<button class="btn">Ver el flujo</button></div>` : ''}
    ${e.nota ? `<div class="nota">${esc(e.nota)}</div>` : ''}
    ${e.pasos.map((p, i) => paso(e, p, i)).join('')}
    <button class="btn" style="justify-self:start" id="nuevo-paso">Agregar paso</button>
    ${(e.anteriores || []).map((a) => `<div class="bot">Versión anterior: ${esc(a.t)}, del ${a.periodo}. No sale en el chat.<button class="btn">Ver</button></div>`).join('')}`;
}

function vistaQuien() {
  const ro = dc() ? '' : 'readonly';
  const inp = (x) => `<input value="${esc(x)}" ${ro}>`;
  return `<div class="ecab"><h2>Quién es lead</h2><div class="der">${dc() ? '' : '<button class="btn ghost" id="proponer">Proponer un cambio</button>'}</div></div>
    <div class="campo"><h3>Es lead</h3><div class="lst">${QUIEN.leads.map(inp).join('')}</div></div>
    <div class="campo"><h3>No es lead (va a No lead)</h3><div class="lst">${QUIEN.noleads.map(inp).join('')}</div></div>
    <div class="campo"><h3>Excepción</h3><textarea ${ro}>${esc(QUIEN.excepcion)}</textarea></div>`;
}

function burbujas(texto) {
  return texto.split(/\n\s*\n/).map((b) => `<div class="b">${esc(b)
    .replace(/\{nombre\}/g, '<span class="v">Sofía</span>')
    .replace(/\{link de agenda\}/g, '<span class="v">work.thelearnation.com/a/elias</span>')
    .replace(/\[([^\]]+)\]/g, '<span class="h">$1</span>')}</div>`).join('');
}

function previa() {
  const e = et(sel), el = document.getElementById('previa');
  if (!e || !e.pasos.length) { el.innerHTML = '<div class="k">Elegí una etapa con pasos</div>'; return; }
  const vis = e.pasos.map((p, i) => [p, i]).filter(([p]) => p.uso !== 'no se usa');
  if (!e.pasos[vista.paso] || e.pasos[vista.paso].uso === 'no se usa') vista = { paso: vis[0][1], op: 0 };
  const p = e.pasos[vista.paso], o = p.op[vista.op] || p.op[0];
  el.innerHTML = `<div class="k">Así lo ve el setter al escribir «/»</div>
    <div class="menu">${vis.map(([q, i]) => `<div class="fila"><code>/${esc(q.atajo)}</code><span>${esc(q.t)}</span>${
      q.op.length > 1 ? `<span class="ab">${q.op.map((x, j) => `<button data-v="${i}:${j}" class="${i === vista.paso && j === vista.op ? 'act' : ''}">${q.porRespuesta ? esc(x.si.slice(0, 5)) : LETRAS[j]}</button>`).join('')}</span>`
      : `<span class="ab"><button data-v="${i}:0" class="${i === vista.paso ? 'act' : ''}">Ver</button></span>`}</div>`).join('')}</div>
    <div class="k">${esc(p.t)} · ${esc(rotulo(p, o, p.op.indexOf(o)))}</div>
    <div class="burbujas">${burbujas(o.x)}</div>
    <small style="color:var(--muted)">Lo marcado en amarillo lo completa el setter antes de mandar.</small>`;
}

function pendientes() {
  const el = document.getElementById('pendientes');
  el.hidden = !cambios.size;
  document.getElementById('pend-t').textContent = `${cambios.size} cambio${cambios.size > 1 ? 's' : ''} sin publicar`;
}

function todo() {
  lista();
  document.getElementById('editor').innerHTML = sel === 'quien' ? vistaQuien() : vistaEtapa(et(sel));
  previa(); pendientes();
}

document.addEventListener('click', (ev) => {
  const g = (s) => ev.target.closest(s);
  const f = g('.et'); if (f) { sel = f.dataset.id; vista = { paso: 0, op: 0 }; todo(); return; }
  const v = g('[data-v]'); if (v) { const [a, b] = v.dataset.v.split(':').map(Number); vista = { paso: a, op: b }; previa(); return; }
  const ab = g('[data-ab]'); if (ab) { const e = et(sel); e.pasos[+ab.dataset.ab].op.push({ x: '' }); cambios.add(`${e.id}:${ab.dataset.ab}`); todo(); return; }
  if (g('#nuevo-paso')) { const e = et(sel); e.pasos.push({ t: 'Paso nuevo', atajo: 'nuevo', op: [{ x: '' }] }); cambios.add(`${e.id}:${e.pasos.length - 1}`); todo(); return; }
  if (g('#nueva-etapa') || g('#proponer')) { if (dc() && g('#nueva-etapa')) return; document.getElementById('velo').classList.add('abierto'); return; }
  if (g('#cerrar') || g('#mandar')) { document.getElementById('velo').classList.remove('abierto'); return; }
  if (g('#descartar')) { cambios.clear(); todo(); return; }
  if (g('#publicar')) { cambios.clear(); document.getElementById('ver').textContent = 'Publicada hace un momento'; todo(); return; }
  const r = g('#rol button'); if (r) { rol = r.dataset.rol; document.querySelectorAll('#rol button').forEach((b) => b.classList.toggle('act', b === r)); todo(); return; }
  const t = g('#tema button'); if (t) { document.body.dataset.theme = t.dataset.t; document.querySelectorAll('#tema button').forEach((b) => b.classList.toggle('act', b === t)); }
});

document.addEventListener('change', (ev) => {
  if (!ev.target.matches('.uso')) return;
  const e = et(sel); e.pasos[+ev.target.dataset.p].uso = ev.target.value; cambios.add(`${e.id}:${ev.target.dataset.p}`); todo();
});

document.addEventListener('input', (ev) => {
  const p = ev.target.closest('.paso'); if (!p) return;
  if (ev.target.matches('textarea[data-p]')) {
    et(sel).pasos[+ev.target.dataset.p].op[+ev.target.dataset.o].x = ev.target.value;
    vista = { paso: +ev.target.dataset.p, op: +ev.target.dataset.o }; previa();
  }
  cambios.add(p.dataset.k); p.classList.add('editado'); pendientes();
});

todo();
