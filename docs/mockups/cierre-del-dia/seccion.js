// Sección "Reporte": Hoy + Historial. Reemplaza los reportes de closer, setter, triage, Academia y Leadership.
// No hay botón de cerrar ni se "sube": se edita a lo largo del día y se cierra solo a las 10:00 del día siguiente.
// Los días anteriores también se pueden editar. Cada número abre su detalle (detalle.js).
const $ = (id) => document.getElementById(id);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ico = {
  check: (s = 14) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg>`,
  img: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></svg>',
  link: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
  libro: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/></svg>',
  medalla: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="9" r="6"/><path d="m8.5 14-1.5 8 5-3 5 3-1.5-8"/></svg>',
};
const NDIA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

let rol = 'closer', tab = 'hoy', cerrado = false, periodo = 7, abierto = -1, diaSel = 0;
let st = {}, estados = {};
// Estado de cada día. Los días pasados arrancan con lo que se cargó en su momento y se editan igual que hoy.
function stDe(i) {
  if (estados[i]) return estados[i];
  const x = ROLES[rol], d = DIAS[i];
  const s = { elegido: null, captura: false, link: false, sinGente: false, motivo: '', que: '', por: '', mejor: '', traba: '', flujo: '', noLab: false, mas: [], res: {}, corr: {}, mano: {} };
  x.mano.forEach(([g, l, v]) => { s.mano[g + '|' + l] = v === '' ? '' : String(v); });
  if (i > 0 && d.est === 'ok') {
    Object.assign(s, { elegido: Math.max(0, x.gente.findIndex(p => p[1] === d.quien)), que: d.vic, mejor: d.man });
    Object.keys(s.mano).forEach((k, j) => { if (s.mano[k] === '') s.mano[k] = String(2 + (i * 7 + j * 3) % 9); });
    x.revisar.forEach((r, k) => { if (r[0] === 'bloquea') s.res[k] = 'Asistió'; });
  }
  if (i > 0 && d.est === 'libre') s.noLab = true;
  return (estados[i] = s);
}
function reset() { estados = {}; diaSel = 0; st = stDe(0); }
function verDia(i) { diaSel = i; st = stDe(i); tab = 'hoy'; }

// 60 días hacia atrás desde hoy (lunes 23/11). Valores deterministas.
let semilla = 7, DIAS = [];
const rnd = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;
function generarDias() {
  semilla = 7 + Object.keys(ROLES).indexOf(rol);
  const x = ROLES[rol];
  DIAS = Array.from({ length: 60 }, (_, i) => {
    const f = new Date(2026, 10, 23 - i), dom = f.getDay() === 0;
    const est = i === 0 ? 'hoy' : dom ? 'libre' : (i === 2 || i === 16 || i === 37) ? 'inc' : 'ok';
    const v = x.hist.map(([, , base, modo]) => dom ? 0 : modo === 'avg' ? base * (0.8 + rnd() * 0.4) : base * (0.3 + rnd() * 1.4));
    return { i, f, est, v, vic: x.vics[i % x.vics.length], man: MANANAS[i % MANANAS.length], quien: x.gente[i % x.gente.length][1] };
  });
}
const nomDia = (d) => `${NDIA[d.f.getDay()]} ${d.f.getDate()}`;

function fmt(v, f) {
  if (f === 'usd') return 'US$ ' + Math.round(v).toLocaleString('es-AR');
  if (f === '%') return Math.round(v) + '<small>%</small>';
  if (f === 'min') return Math.floor(v / 60) + '<small>h</small> ' + String(Math.round(v % 60)).padStart(2, '0');
  return Math.round(v).toLocaleString('es-AR');
}
const plano = (v, f) => fmt(v, f).replace(/<[^>]+>/g, '');
const cuenta = (v, f = 'n') => `<span data-v="${v}" data-f="${f}">${fmt(0, f)}</span>`;

function spark(serie) {
  const w = 160, h = 40, max = Math.max(...serie), min = Math.min(...serie), r = max - min || 1;
  const pts = serie.map((v, i) => [3 + i * (w - 6) / (serie.length - 1), 4 + (h - 8) * (1 - (v - min) / r)]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const [lx, ly] = pts[pts.length - 1];
  return `<svg class="st-k__viz st-spark" viewBox="0 0 ${w} ${h + 6}" preserveAspectRatio="none" aria-hidden="true">
    <path class="area" d="${d} L ${lx} ${h + 6} L 3 ${h + 6} Z"/><path class="linea" d="${d}" style="--l:400" vector-effect="non-scaling-stroke"/>
    <circle cx="${lx}" cy="${ly}"/></svg>`;
}
function metaBar(v, m, txt) {
  const p = Math.min(1, v / m);
  return `<div class="st-meta"><div class="st-meta__b"><i class="${p >= 1 ? 'lleno' : ''}" data-w="${(p * 100).toFixed(0)}"></i></div><small>${txt}</small></div>`;
}
function anillo(pct, k) {
  const c = 2 * Math.PI * 30;
  return `<svg class="st-anillo" viewBox="0 0 74 74" aria-hidden="true"><circle class="fondo" cx="37" cy="37" r="30"/>
    <circle class="valor" cx="37" cy="37" r="30" style="--c:${c.toFixed(1)};transition-delay:${300 + k * 90}ms" data-off="${(c * (1 - pct / 100)).toFixed(1)}"/>
    <text x="37" y="37"><tspan data-v="${pct}" data-f="n">0</tspan>%</text></svg>`;
}
function delta(v, prom, menos, txt) {
  const dif = v - prom, bien = menos ? dif < 0 : dif > 0, pct = prom ? Math.round(Math.abs(dif) / prom * 100) : 0;
  const cls = Math.abs(dif) < 0.05 * (prom || 1) ? 'igual' : bien ? 'sube' : 'baja';
  return `<span class="st-k__delta ${cls}">${cls === 'igual' ? '= como siempre' : (dif > 0 ? '▲ ' : '▼ ') + pct + '%'} <span>${txt}</span></span>`;
}
const tarjeta = (k, l, v, f, extra, suf = '', e = '') => `<div class="st-k"${e} style="animation-delay:${k * 90}ms"><span class="st-k__lbl">${l}</span>
  <span class="st-k__val">${cuenta(v, f)}${suf}</span>${extra}</div>`;

function animar(raiz) {
  raiz.querySelectorAll('[data-v]').forEach((el, k) => {
    const v = +el.dataset.v, f = el.dataset.f;
    if (reduce) { el.innerHTML = fmt(v, f); return; }
    const t0 = performance.now() + 150 + Math.min(k, 30) * 40, dur = 1000;
    const tick = (t) => {
      const p = Math.min(1, Math.max(0, (t - t0) / dur)), e = 1 - Math.pow(1 - p, 3);
      el.innerHTML = fmt(v * e, f);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  requestAnimationFrame(() => requestAnimationFrame(() => {
    raiz.querySelectorAll('[data-w]').forEach(i => i.style.width = i.dataset.w + '%');
    raiz.querySelectorAll('[data-h]').forEach(i => i.style.height = i.dataset.h + '%');
    raiz.querySelectorAll('[data-off]').forEach(c => c.style.strokeDashoffset = c.dataset.off);
  }));
}
function quieto(raiz) {
  raiz.querySelectorAll('[data-v]').forEach(el => el.innerHTML = fmt(+el.dataset.v, el.dataset.f));
  raiz.querySelectorAll('*').forEach(e => { e.style.animation = 'none'; e.style.transition = 'none'; });
  raiz.querySelectorAll('[data-w]').forEach(i => i.style.width = i.dataset.w + '%');
  raiz.querySelectorAll('[data-off]').forEach(c => c.style.strokeDashoffset = c.dataset.off);
}
let obs;
function alVerse(caja, pintarla) {
  if (obs) obs.disconnect();
  obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { obs.disconnect(); pintarla(); animar(caja); } }, { threshold: 0.15 });
  obs.observe(caja);
}

// --- Estado del día -----------------------------------------------------------------------------
const conQuien = () => ({ lead: 'un lead', alumno: 'un alumno', tarea: 'una tarea' })[ROLES[rol].quien];
const okVictoria = (s = st) => s.sinGente ? s.motivo.trim().length >= 5 : s.elegido != null && !!s.que.trim();
const okManana = (s = st) => !!s.mejor.trim();
const agendasPend = (s = st) => ROLES[rol].revisar.filter((r, k) => r[0] === 'bloquea' && !s.res[k]).length;
const manoPend = (s = st) => Object.values(s.mano).filter(v => v === '').length;
const pendientes = (s = st) => agendasPend(s) + manoPend(s);
const cuando = () => diaSel ? 'ese día' : 'hoy';
const tienePend = () => ROLES[rol].revisar.length || Object.keys(st.mano).length;
function faltan(s = st) {
  const f = [], p = pendientes(s);
  if (p) f.push(p + ' pendiente' + (p > 1 ? 's' : ''));
  if (!okVictoria(s)) f.push('la victoria');
  if (!okManana(s)) f.push('el «mañana»');
  return f;
}
// hoy (en curso), ok (completo), inc (incompleto) o libre. Los días sin tocar usan su estado guardado.
function estadoDe(i) {
  const s = i === diaSel ? st : estados[i];
  if (!s) return DIAS[i].est;
  if (s.noLab) return 'libre';
  if (i === 0 && !cerrado) return 'hoy';
  return faltan(s).length ? 'inc' : 'ok';
}
const badge = (n, ok, warn) => `<span class="card__n ${ok ? 'ok' : warn ? 'warn' : ''}">${ok ? ico.check() : n}</span>`;
const cab = (n, t, ok, extra = '', warn = false) => `<div class="card__cab">${badge(n, ok, warn)}<h3>${t}</h3>${extra}</div>`;

// --- Tarjetas de hoy ----------------------------------------------------------------------------
function cPendientes() {
  const x = ROLES[rol], p = pendientes();
  const ag = x.revisar.map(([t, a, s], k) => {
    const hecho = t === 'bloquea' && st.res[k];
    return `<div class="rv__i ${hecho ? 'hecho' : t}"><span class="tag">${hecho ? 'Listo' : t === 'bloquea' ? 'Falta' : 'Aviso'}</span><span>${a}<small>${hecho ? 'Resultado: ' + st.res[k] : s}</small></span>
      ${t === 'bloquea' ? `<select data-res="${k}" aria-label="Resultado"><option value="">Cargar resultado</option>${x.resultados.map(r => `<option ${st.res[k] === r ? 'selected' : ''}>${r}</option>`).join('')}</select>` : ''}</div>`;
  }).join('');
  const nombres = [...new Set(x.mano.map(r => r[0]))];
  const grupos = nombres.map(g => {
    const m = x.mano.filter(r => r[0] === g).map(r => [r[1], r[2]]);
    return `<div class="pend-sec"><h4>${g}</h4><div class="tiles">${m.map(([l, v], k) => {
      const id = g + '|' + l, val = st.mano[id], lleno = val !== '';
      return `<label class="tile mano ${lleno ? 'lleno' : ''}" style="animation-delay:${k * 40}ms"><em>${lleno ? (val === String(v) && v !== '' ? 'Sugerido · confirmalo' : 'Cargado') : 'A mano'}</em>
        <input data-mano="${id}" inputmode="numeric" value="${val}" placeholder="—" aria-label="${g}: ${l}"><span>${l}</span></label>`;
    }).join('')}</div></div>`;
  }).join('');
  return cab('!', 'Antes de que se cierre', !p, `<small>${p ? p + ' pendiente' + (p > 1 ? 's' : '') + (diaSel ? ' · mientras falten, el día queda incompleto' : ' · si quedan a las 10:00, el día se cierra incompleto') : 'Todo cargado'}</small>`, p > 0)
    + (ag ? `<div class="rv">${ag}</div>` : '') + grupos;
}

function cVictoria() {
  const x = ROLES[rol];
  let c;
  if (st.sinGente) {
    c = `<div class="cd-campo"><label for="motivo">Por qué no hubo ${({ lead: 'leads', alumno: 'alumnos', tarea: 'pedidos' })[x.quien]} ${cuando()}</label>
      <textarea id="motivo" placeholder="Por ejemplo: estuve todo el día armando el workshop">${st.motivo}</textarea></div>
      <button class="cd-otra" type="button" data-acc="conGente" style="justify-self:start">Mejor elijo ${conQuien()}</button>`;
  } else if (st.elegido == null) {
    c = `<p class="cd-sub">¿Con quién fue? Elegí ${conQuien()} con ${x.quien === 'tarea' ? 'la' : 'el'} que trabajaste ${cuando()}.</p>
      <div class="cd-lista">${x.gente.map(([i, n, s], k) => `<button type="button" class="cd-persona" data-k="${k}"><i>${i.length > 2 ? '#' : i}</i><span><b>${i.length > 2 ? '#' + i + ' ' : ''}${n}</b><small>${s}</small></span></button>`).join('')}</div>
      <div class="cd-fila"><input class="cd-buscar" placeholder="Buscar otr${x.quien === 'tarea' ? 'a tarea' : 'o ' + x.quien}" aria-label="Buscar">
      <button class="cd-otra" type="button" data-acc="sinGente">${x.sinGente}</button></div>`;
  } else {
    const [i, n, s] = x.gente[st.elegido];
    c = `<div class="cd-elegido"><i>${i.length > 2 ? '#' : i}</i><span><b>${n}</b><br><small style="color:var(--ln-text-muted)">${s}</small></span><button type="button" data-acc="cambiar">Cambiar</button></div>
      <div class="cd-dos">
        <div class="cd-campo"><label for="que">Qué pasó</label><textarea id="que" placeholder="Lo concreto: qué hizo, qué logró">${st.que}</textarea></div>
        <div class="cd-campo"><label for="por">Por qué es una victoria <small>· opcional</small></label><textarea id="por" placeholder="Qué cambia para esa persona o para el equipo">${st.por}</textarea></div>
      </div>
      <div class="cd-prueba">
        <button type="button" class="${st.captura ? 'ok' : ''}" data-acc="captura">${ico.img}${st.captura ? 'captura-whatsapp.png' : 'Sumar captura'}</button>
        <button type="button" class="${st.link ? 'ok' : ''}" data-acc="link">${ico.link}${st.link ? 'drive.google.com/…' : 'Sumar link'}</button>
        <span class="cd-nota">Prueba opcional</span>
      </div>
      ${x.bitacora ? `<span class="cd-nota">${ico.libro}Se guarda en la bitácora de ${n.split(' ')[0]} y la ven los closers.</span>` : ''}
      ${st.mas.map(m => `<div class="cd-elegido"><i>${x.gente[m][0].length > 2 ? '#' : x.gente[m][0]}</i><span><b>${x.gente[m][1]}</b> · otra victoria</span></div>`).join('')}
      ${x.gente.length > 1 + st.mas.length ? '<button class="cd-sumar" type="button" data-acc="sumar">+ Sumar otra victoria</button>' : ''}`;
  }
  return cab(1, 'Tu victoria', okVictoria()) + c;
}

function cManana() {
  const x = ROLES[rol];
  return cab(2, 'Mañana', okManana()) + `<div class="cd-dos">
    <div class="cd-campo"><label for="mejor">Qué harías mejor mañana</label><textarea id="mejor" placeholder="Una o dos líneas">${st.mejor}</textarea></div>
    <div class="cd-campo"><label for="traba">Algo de la plataforma que te trabó <small>· opcional, les llega a los devs</small></label><textarea id="traba" placeholder="Por ejemplo: el filtro de Contacto se borra al volver">${st.traba}</textarea></div></div>
    ${x.flujo ? `<div class="cd-campo"><label for="flujo">Cómo trabajaste ${cuando()} <small>· opcional</small></label><textarea id="flujo" placeholder="Tu flujo de trabajo: en qué orden, qué te funcionó">${st.flujo}</textarea></div>` : ''}`;
}

// Todos los números en tarjetas: KPIs, embudo y bloques por tipo (comparar, mix, pasos, cifras), tasas y logros.
// Un valor 'm:Grupo|Campo' lee lo cargado a mano; si está vacío se muestra «—».
function leer(v) {
  if (typeof v === 'string' && v.startsWith('m:')) { const m = st.mano[v.slice(2)]; return { n: m === '' ? null : +m, mano: true }; }
  return { n: v, mano: false };
}
const num = (r, f = 'n') => r.n == null ? '<span class="vacio">—</span>' : cuenta(r.n, f);
const ex = (l, r, extra = {}) => exp({ l, v: r.n, mano: r.mano, ...extra });
const tagMano = (r) => r.mano ? '<em class="tag-m">a mano</em>' : '';
const PALETA = ['var(--acento)', '#2fd3ff', 'var(--ok)', 'var(--warn)', '#f472b6', '#a3e635'];

function bComparar(b, d) {
  const ed = st.corr[b.tit];
  const cab = `<span></span>${b.cols.map(c => `<span class="h">${c}</span>`).join('')}${b.conv ? '<span class="h">Resp.</span>' : ''}`;
  const filas = b.filas.map(([l, ...vals], fi) => {
    const rs = vals.map(leer), max = Math.max(1, ...rs.map(r => r.n || 0));
    return `<span class="l">${l}</span>` + rs.map((r, ci) => ed && !r.mano
      ? `<span class="c"><input value="${r.n}" aria-label="${l} ${b.cols[ci]}"></span>`
      : `<span class="c"${ex(l + ' · ' + b.cols[ci], r, { corr: b.corr })}><b>${num(r)}</b><span class="mini"><i data-w="${r.n ? (r.n / max * 100).toFixed(0) : 0}" style="transition-delay:${d + 200 + fi * 60}ms"></i></span></span>`).join('')
      + (b.conv ? `<span class="c pct"${exp({ l: l + ' · respuesta', v: rs[0].n && rs[1].n != null ? Math.round(rs[1].n / rs[0].n * 100) : null, f: '%', mano: true })}>${rs[0].n && rs[1].n != null ? Math.round(rs[1].n / rs[0].n * 100) + '%' : '—'}</span>` : '');
  }).join('');
  const m = b.filas.some(([, ...v]) => v.some(x => leer(x).mano));
  return `<h4>${b.tit}${m ? '<em class="tag-m">a mano</em>' : ''}${b.corr ? `<button type="button" data-corr="${b.tit}">${ed ? 'Listo' : 'Corregir'}</button>` : ''}</h4>
    <div class="cmp" style="--n:${b.cols.length + (b.conv ? 1 : 0)}">${cab}${filas}</div>`;
}
function bMix(b, d) {
  const conValor = b.partes.filter(p => p[1] > 0), sin = b.partes.filter(p => !p[1]).map(p => p[0]);
  return `<h4>${b.tit}</h4><div class="mix__tot"${exp({ l: 'Cash del día', v: b.total, f: b.f })}>${cuenta(b.total, b.f)}<span>${b.sub}</span></div>
    <div class="mix__barra">${conValor.map((p, k) => `<i data-w="${(p[1] / b.total * 100).toFixed(1)}" style="background:${PALETA[k]};transition-delay:${d + 250 + k * 150}ms"></i>`).join('')}</div>
    <div class="mix__ley">${conValor.map((p, k) => `<span${exp({ l: p[0], v: p[1], f: b.f })}><i style="background:${PALETA[k]}"></i>${p[0]}<b>${cuenta(p[1], b.f)}</b><small>${p[2] || ''}</small></span>`).join('')}</div>
    ${sin.length ? `<p class="mix__cero">Sin ventas: ${sin.join(' · ')}</p>` : ''}
    ${b.pie ? `<div class="mix__pie">${b.pie.map(([l, v, f]) => `<div${exp({ l, v, f })}><b>${cuenta(v, f)}</b><span>${l}</span></div>`).join('')}</div>` : ''}`;
}
function bPasos(b, d) {
  return `<h4>${b.tit}${b.series.some(s => s[1].some(p => leer(p[1]).mano)) ? '<em class="tag-m">a mano</em>' : ''}</h4><div class="pasos">${b.series.map(([nom, pasos], si) => {
    const rs = pasos.map(p => leer(p[1])), max = Math.max(1, ...rs.map(r => r.n || 0));
    return `<div class="serie">${nom ? `<h5>${nom}</h5>` : ''}<div class="serie__fila">${pasos.map(([l], k) => {
      const r = rs[k], prev = rs[k - 1], conv = k && r.n != null && prev.n ? Math.round(r.n / prev.n * 100) + '%' : '';
      return `${k ? `<span class="conv">→${conv ? `<b>${conv}</b>` : ''}</span>` : ''}<div class="paso"${ex(l, r)}><span class="col"><i data-h="${r.n ? Math.max(6, r.n / max * 100).toFixed(0) : 4}" style="transition-delay:${d + 200 + si * 120 + k * 90}ms"></i></span>
        <b>${num(r)}</b><span>${l}</span></div>`;
    }).join('')}</div></div>`;
  }).join('')}</div>`;
}
function bCifras(b) {
  return `<h4>${b.tit}</h4><div class="cifras">${b.items.map(([l, v, suf]) => { const r = leer(v);
    return `<div class="cifra"${ex(l, r)}><b>${num(r)}${suf ? `<small> ${suf}</small>` : ''}</b><span>${l}</span>${tagMano(r)}</div>`; }).join('')}</div>`;
}
const BLOQUE = { comparar: bComparar, mix: bMix, pasos: bPasos, cifras: bCifras };
const valores = (b) => b.t === 'comparar' ? b.filas.flatMap(([, ...v]) => v) : b.t === 'pasos' ? b.series.flatMap(s => s[1].map(p => p[1])) : b.t === 'cifras' ? b.items.map(i => i[1]) : [];
function sinCargar(b) { const vs = valores(b).map(leer); return vs.length && vs.every(r => r.mano && r.n == null); }
const bVacio = (b) => `<h4>${b.tit}<em class="tag-m">a mano</em></h4><div class="bl-vacio"><span>Todavía no cargaste estos datos.</span>
  <button type="button" class="cd-otra" data-ir="c-pen">Cargarlos en «Antes de que se cierre»</button></div>`;

function vNumeros() {
  const x = ROLES[rol], [tit, pasos, unidad] = x.embudo, tope = pasos[0][1];
  const hero = x.kpis.map(([l, v, prom, f, viz], k) => tarjeta(k, l, v, f,
    delta(v, prom, viz.menosEsMejor, 'vs. tu promedio') + (viz.meta ? metaBar(v, viz.meta, `${Math.round(Math.min(1, v / viz.meta) * 100)}% de la meta (${plano(viz.meta, f)})`) : spark(viz.spark)), '', exp({ l, v, f }))).join('');
  const emb = pasos.map(([l, v], k) => `<div class="st-fila"${exp({ l, v, f: unidad === 'min' ? 'min' : 'n' })}><span>${l}</span><div class="st-barra"><i data-w="${(v / tope * 100).toFixed(0)}" style="transition-delay:${400 + k * 120}ms"></i></div>
    <b>${unidad === 'min' ? plano(v, 'min') : cuenta(v)}${k && unidad !== 'min' ? `<small>${Math.round(v / pasos[k - 1][1] * 100)}%</small>` : ''}</b></div>`).join('');
  // Las cifras sueltas marcadas enEmbudo van dentro de la tarjeta del embudo; las secuencias de varias series ocupan la fila entera.
  const extra = x.bloques.filter(b => b.enEmbudo).map(b => `<div class="cifras chicas">${bCifras(b).replace(/^<h4>.*?<\/h4><div class="cifras">/, '')}`).join('');
  const bloques = x.bloques.filter(b => !b.enEmbudo).map((b, k) => { const d = 250 + k * 90, full = b.t === 'pasos' && b.series.length > 1;
    return `<div class="st-caja bl-${b.t} ${full ? 'full' : ''}" style="animation-delay:${d}ms">${sinCargar(b) ? bVacio(b) : BLOQUE[b.t](b, d)}</div>`; }).join('');
  const tasas = `<div class="st-caja ${x.tasas.length > 4 || x.logros ? 'full' : ''}" style="animation-delay:${300 + x.bloques.length * 90}ms"><h4>Tasas del día</h4><div class="tasas-g">${x.tasas.map(([l, v], k) =>
    `<div class="st-tasa"${exp({ l, v, f: '%' })}>${anillo(v, k)}<span>${l}</span></div>`).join('')}</div>
    ${x.logros ? `<div class="logros-g">${x.logros.map(([l, si], k) => `<div class="st-logro ${si ? 'si' : ''}" style="animation-delay:${900 + k * 150}ms"><span class="med">${ico.medalla}</span><span>${l}</span></div>`).join('')}</div>` : ''}</div>`;
  return `<div class="st-hero">${hero}</div>
    <div class="st-bloques"><div class="st-caja"><h4>${tit}</h4>${emb}${extra}</div>${bloques}${tasas}</div>`;
}
const cNumeros = () => cab(3, 'Tus números', true, `<small>${ROLES[rol].fuente}</small>`) + '<div id="numeros" style="min-height:260px;display:grid;gap:12px"></div>';

function vHoy() {
  if (st.noLab) {
    return `<section class="card ui-panel"><div class="est__listo"><span class="ico">${ico.check(24)}</span><b>Marcaste ${diaSel ? 'este día' : 'hoy'} como no laborable</b>
      <p>No vas a figurar como pendiente. Los números que haya se guardan igual.</p>
      <button class="ui-btn ui-btn--secondary ui-btn--sm" type="button" data-acc="siTrabaje">Sí trabajé</button></div></section>`;
  }
  return `${tienePend() ? `<section class="card ui-panel" id="c-pen">${cPendientes()}</section>` : ''}
    <section class="card ui-panel" id="c-vic">${cVictoria()}</section>
    <section class="card ui-panel" id="c-man">${cManana()}</section>
    <section class="card ui-panel" id="c-num">${cNumeros()}</section>`;
}

// --- Historial ----------------------------------------------------------------------------------
function agg(ds, k) {
  const [, , , modo] = ROLES[rol].hist[k], vals = ds.filter(d => d.est !== 'libre' && d.est !== 'hoy').map(d => d.v[k]);
  if (!vals.length) return 0;
  const s = vals.reduce((a, b) => a + b, 0);
  return modo === 'avg' ? s / vals.length : s;
}
function vHist() {
  const x = ROLES[rol], ds = DIAS.slice(0, periodo), prev = DIAS.slice(periodo, periodo * 2);
  const est = (d) => estadoDe(d.i);
  const lab = ds.filter(d => est(d) !== 'libre' && est(d) !== 'hoy'), comp = lab.filter(d => est(d) === 'ok').length;
  const labP = prev.filter(d => d.est !== 'libre'), compP = labP.filter(d => d.est === 'ok').length;
  const crono = [...ds].reverse();
  const kpis = [tarjeta(0, 'Días completos', comp, 'n', delta(comp / (lab.length || 1), compP / (labP.length || 1), false, 'vs. período anterior') + metaBar(comp, lab.length || 1, `de ${lab.length} días laborables ya cerrados`), `<small> / ${lab.length}</small>`)]
    .concat(x.hist.map(([l, f, , modo], k) => tarjeta(k + 1, l + (modo === 'avg' ? ' (promedio)' : ''), agg(ds, k), f,
      delta(agg(ds, k), agg(prev, k), false, 'vs. período anterior') + spark(crono.filter(d => d.est !== 'libre').map(d => d.v[k])), '',
      exp({ l, v: agg(ds, k), f, pct: modo === 'avg' && f === '%', ctx: 'Historial · ' + periodo + ' días' }))));
  const max = Math.max(...ds.map(d => d.v[0])) || 1, [l0, f0] = x.hist[0];
  const barras = crono.map((d, k) => `<div class="${d.est === 'libre' ? 'vacio' : ''}"${d.est === 'libre' ? '' : exp({ l: l0, v: d.v[0], f: f0, ctx: 'Historial · ' + nomDia(d) })} data-t="${nomDia(d)}: ${d.est === 'libre' ? 'no laborable' : plano(d.v[0], f0)}">
    <i data-h="${d.est === 'libre' ? 3 : Math.max(3, d.v[0] / max * 100).toFixed(0)}" style="transition-delay:${200 + k * (600 / crono.length)}ms"></i></div>`).join('');
  const CHIP = { hoy: ['pend', 'En curso'], ok: ['ok', 'Completo'], inc: ['venc', 'Incompleto'], libre: ['libre', 'No laborable'] };
  const filas = ds.map((d, k) => {
    const e = est(d), [c, t] = CHIP[e], s = d.i === diaSel ? st : estados[d.i];
    const vic = s ? (s.noLab ? '' : !okVictoria(s) ? '—' : s.sinGente ? s.motivo : `<b>${x.gente[s.elegido][1]}</b>: ${s.que}`)
      : e === 'ok' ? `<b>${d.quien}</b>: ${d.vic}` : e === 'inc' ? 'Se cerró sin victoria ni «mañana»' : '';
    const cuerpo = (e === 'libre' ? '<p>No laborable.</p>'
      : `${e === 'inc' && !s ? '<p style="color:var(--mal)">Se cerró a las 10:00 del día siguiente sin la victoria ni el «mañana». Los números quedaron guardados.</p>'
        : `<p><b>Victoria</b> · ${vic.replace(/<\/?b>/g, '')}</p><p><b>Mañana</b> · ${s ? (s.mejor || '—') : d.man}</p>`}
        <p>${x.hist.map(([l, f], j) => `<b>${plano(d.v[j], f)}</b> ${l.toLowerCase()}`).join(' · ')}</p>`)
      + `<p><button class="cd-otra" data-dia="${d.i}">${d.i ? 'Editar este día' : 'Ir a hoy'}</button></p>`;
    return `<details class="dia" style="animation-delay:${Math.min(k, 12) * 40}ms" ${d.i === abierto ? 'open' : ''} id="dia-${d.i}">
      <summary><b>${nomDia(d)}</b><span class="chip ${c}">${t}</span><span class="txt">${vic}</span><span class="num">${d.est === 'libre' ? '' : plano(d.v[0], f0)}</span></summary>
      <div class="dia__cuerpo">${cuerpo}</div></details>`;
  }).join('');
  const cls = (d) => ({ hoy: 'hoy', ok: 'ok', inc: 'venc', libre: 'libre' })[est(d)];
  return `<section class="card ui-panel"><div class="hi-top"><h3>Tu historial</h3>
      <div class="tabs">${[[7, '7 días'], [23, 'Este mes'], [30, '30 días']].map(([n, t]) => `<button data-per="${n}" class="${periodo === n ? 'on' : ''}">${t}</button>`).join('')}</div></div>
    <div class="st-hero">${kpis.join('')}</div>
    <div class="st-bajo">
      <div class="st-caja"><h4>${l0} por día</h4><div class="barras">${barras}</div><div class="ejes"><span>${nomDia(crono[0])}</span><span>${nomDia(crono[crono.length - 1])}</span></div></div>
      <div class="st-caja"><h4>Constancia</h4><div class="consta">${crono.map((d, k) => `<i class="${cls(d)}" title="${nomDia(d)}" style="animation-delay:${k * 25}ms"></i>`).join('')}</div>
        <div class="leyenda"><span style="--c:var(--ok)">Completo</span><span style="--c:var(--mal)">Incompleto</span><span style="--c:var(--warn)">En curso</span><span style="--c:var(--ln-border-subtle)">No laborable</span></div></div>
    </div></section>
    <section class="card ui-panel"><div class="card__cab"><h3>Día por día</h3><small>Tocá un día para ver el cierre completo</small></div><div class="dias">${filas}</div></section>`;
}

// --- Pintar -------------------------------------------------------------------------------------
function pintarCab() {
  $('semana').innerHTML = DIAS.slice(0, 7).reverse().map(d => {
    const cls = { hoy: 'pend', ok: 'ok', inc: 'venc', libre: '' }[estadoDe(d.i)];
    return `<button class="sd ${cls} ${tab === 'hoy' && d.i === diaSel ? 'sel' : ''}" data-dia="${d.i}" title="${nomDia(d)}">${NDIA[d.f.getDay()]}<b>${d.f.getDate()}</b><i></i></button>`;
  }).join('');
  const f = faltan(), e = estadoDe(diaSel), fecha = DIAS[diaSel].f.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  const chip = st.noLab ? '<span class="estado ok">No laborable</span>' : e === 'hoy' ? '<span class="estado curso">En curso</span> hasta mañana 10:00'
    : e === 'ok' ? '<span class="estado ok">Completo</span>' : '<span class="estado inc">Incompleto</span>';
  $('cabSub').innerHTML = `${fecha[0].toUpperCase() + fecha.slice(1)} · ${chip}${!st.noLab && f.length ? ' · falta ' + f.join(', ') : ''}`
    + (diaSel ? ' · <button class="cd-otra" type="button" data-dia="0">Volver a hoy</button>' : '');
  $('rielPto').classList.toggle('ok', !faltan(stDe(0)).length || stDe(0).noLab);
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  $('tabs').querySelector('[data-tab="hoy"]').textContent = diaSel ? nomDia(DIAS[diaSel]) : 'Hoy';
  $('noLab').classList.toggle('oculto', st.noLab || tab !== 'hoy');
  $('noLab').textContent = diaSel ? 'No trabajé ese día' : 'Hoy no trabajé';
  $('simular').textContent = cerrado ? 'Volver a antes de las 10:00' : 'Simular las 10:00 de mañana';
}
function pintar() {
  $('vistaHoy').classList.toggle('oculto', tab !== 'hoy');
  $('vistaHist').classList.toggle('oculto', tab !== 'hist');
  if (tab === 'hoy') {
    $('vistaHoy').innerHTML = vHoy();
    const caja = $('numeros'); if (caja) alVerse(caja, () => { caja.innerHTML = vNumeros(); enlazar(); });
  } else {
    $('vistaHist').innerHTML = vHist();
    animar($('vistaHist'));
    if (abierto > 0) $('dia-' + abierto)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  }
  pintarCab();
  enlazar();
}
function pintarCard(id, fn) { const c = $(id); if (c) c.innerHTML = fn(); pintarCab(); enlazar(); }
function repintarNumeros() { const n = $('numeros'); if (n && n.innerHTML) { n.innerHTML = vNumeros(); quieto(n); } }

function enlazar() {
  document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; abierto = -1; pintar(); window.scrollTo({ top: 0 }); });
  document.querySelectorAll('[data-per]').forEach(b => b.onclick = () => { periodo = +b.dataset.per; pintar(); });
  document.querySelectorAll('[data-dia]').forEach(b => b.onclick = () => { verDia(+b.dataset.dia); pintar(); window.scrollTo({ top: 0 }); });
  document.querySelectorAll('.cd-persona').forEach(b => b.onclick = () => { st.elegido = +b.dataset.k; pintarCard('c-vic', cVictoria); $('que')?.focus(); });
  document.querySelectorAll('[data-res]').forEach(s => s.onchange = () => { st.res[s.dataset.res] = s.value; pintarCard('c-pen', cPendientes); });
  document.querySelectorAll('[data-mano]').forEach(e => {
    e.oninput = () => { st.mano[e.dataset.mano] = e.value.trim(); refrescarPend(e.dataset.mano); repintarNumeros(); };
  });
  document.querySelectorAll('[data-ir]').forEach(b => b.onclick = () => { const c = $(b.dataset.ir); c?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); c?.querySelector('input:placeholder-shown')?.focus({ preventScroll: true }); });
  document.querySelectorAll('[data-corr]').forEach(b => b.onclick = () => { st.corr[b.dataset.corr] = !st.corr[b.dataset.corr]; repintarNumeros(); enlazar(); });
  document.querySelectorAll('[data-acc]').forEach(b => b.onclick = () => {
    const a = b.dataset.acc, x = ROLES[rol];
    if (a === 'siTrabaje') { st.noLab = false; pintar(); return; }
    if (a === 'sinGente') st.sinGente = true;
    if (a === 'conGente') st.sinGente = false;
    if (a === 'cambiar') st.elegido = null;
    if (a === 'captura') st.captura = !st.captura;
    if (a === 'link') st.link = !st.link;
    if (a === 'sumar') { const l = x.gente.findIndex((_, k) => k !== st.elegido && !st.mas.includes(k)); if (l >= 0) st.mas.push(l); }
    pintarCard('c-vic', cVictoria);
  });
  ['motivo', 'que', 'por', 'mejor', 'traba', 'flujo'].forEach(k => { const e = $(k); if (e) e.oninput = () => {
    const antes = okVictoria() + '' + okManana(); st[k] = e.value;
    if (okVictoria() + '' + okManana() !== antes) {
      $('c-vic').querySelector('.card__n').outerHTML = badge(1, okVictoria());
      $('c-man').querySelector('.card__n').outerHTML = badge(2, okManana());
      pintarCab();
    }
  }; });
}
// Al tipear un dato a mano no se repinta el input (no pierde el foco): solo su mosaico, el encabezado de la tarjeta y la cabecera.
function refrescarPend(id) {
  const inp = document.querySelector(`[data-mano="${CSS.escape(id)}"]`), tile = inp?.closest('.tile'), lleno = st.mano[id] !== '';
  if (tile) { tile.classList.toggle('lleno', lleno); tile.querySelector('em').textContent = lleno ? 'Cargado' : 'A mano'; }
  const c = $('c-pen'); if (c) { const tmp = document.createElement('div'); tmp.innerHTML = cPendientes(); c.querySelector('.card__cab').outerHTML = tmp.querySelector('.card__cab').outerHTML; }
  pintarCab();
}

$('noLab').onclick = () => { st.noLab = true; pintar(); };
$('simular').onclick = () => { cerrado = !cerrado; pintar(); window.scrollTo({ top: 0 }); };
$('rol').onchange = (e) => { rol = e.target.value; tab = 'hoy'; cerrado = false; abierto = -1; generarDias(); reset(); pintar(); };
// ?rol=setter abre el mockup directo en ese rol.
rol = new URLSearchParams(location.search).get('rol') || rol; $('rol').value = rol;
generarDias();
reset();
// ?dia=3 abre ese día para editar; ?detalle=Show up abre el detalle de ese número (para revisar el mockup).
const q = new URLSearchParams(location.search);
if (q.get('dia')) verDia(+q.get('dia'));
pintar();
if (q.has('detalle')) abrirDetalle({ l: q.get('detalle') || 'Show up', v: 80, f: '%' });
