// Modal de detalle: al tocar cualquier número o estadística se abre la explicación con los datos que se tomaron en cuenta.
// exp({l, v, f, mano, pct}) registra el número y devuelve los atributos para el elemento clickeable.
const EXP = [];
function exp(o) { EXP.push(o); return ` data-exp="${EXP.length - 1}" tabindex="0" role="button" aria-label="Ver detalle de ${o.l}"`; }

const NOMBRES = ['María Rodríguez', 'Juan Pérez', 'Laura Álvarez', 'Tomás Ruiz', 'Ana Gómez', 'Pablo Fernández', 'Diego Martínez', 'Carla Suárez',
  'Lucía Benítez', 'Martín Sosa', 'Sofía Herrera', 'Nicolás Vega', 'Valentina Ríos', 'Joaquín Paz', 'Camila Ortiz', 'Federico Luna'];
const FUENTE = { closer: 'Agendas y ventas de Work', setter: 'Inbox de Work', triage: 'Agendas de Work', fulfillment: 'Academia', dev: 'Leadership' };
// Base de los porcentajes (denominador) por rol, solo para el mockup.
const BASE = { closer: 10, setter: 25, triage: 17, fulfillment: 6, dev: 8 };
const COMO = {
  'Cash del día': 'Suma de lo cobrado hoy en tus ventas, por la fecha del pago (no la de la venta).',
  'Ventas': 'Cada venta cargada hoy a tu nombre, de cualquier tipo: PIF, split, seña, cuotas, renovación o upsell.',
  'Show up': 'Agendas a las que el lead se presentó ÷ agendas del día (sin contar las reprogramadas).',
  'Show': 'Agendas a las que el lead se presentó ÷ agendas del día.',
  'Pitch': 'Llamadas con presentación de la oferta ÷ llamadas con el lead presente.',
  'Close promesa': 'Ventas ÷ presentaciones.',
  'Close operativo': 'Ventas ÷ llamadas con el lead presente.',
  'No show': 'Agendas en las que el lead no se presentó ÷ agendas del día.',
  'Canc. + reprog.': '(Canceladas + reprogramadas) ÷ agendas del día.',
  'Slots ocupados': 'Agendas del día ÷ slots que ofreciste.',
  'Cualificación': 'Entrantes cualificados ÷ nuevos mensajes.',
  'Apertura': 'Aperturas ÷ entrantes cualificados.',
  'Respuesta': 'Leads que respondieron a una apertura ÷ aperturas.',
  'Confirmación hoy': 'Agendas confirmadas ÷ agendas del día.',
  'Tiempo enfocado': 'Suma de tus sprints y pomodoros registrados en Leadership.',
};
// Cómo se nombra lo que suma y lo que no en cada porcentaje.
const SINO = { 'Show up': ['Asistió', 'No show'], 'Show': ['Asistió', 'No show'], 'No show': ['No show', 'Asistió'], 'Pitch': ['Presentó', 'Sin presentación'],
  'Close promesa': ['Compró', 'No compró'], 'Close operativo': ['Compró', 'No compró'], 'Confirmación hoy': ['Confirmada', 'Sin confirmar'],
  'Cualificación': ['Cualificado', 'No califica'], 'Respuesta': ['Respondió', 'Sin respuesta'], 'Apertura': ['Abierta', 'Sin abrir'] };
const PAGOS = [['María Rodríguez', 'PIF', 'US$ 2.000', '16:12', 'En llamada'], ['Juan Pérez', 'Seña', 'US$ 1.000', '11:48', 'En llamada']];
const ESTADO = [[/no show/i, 'No show'], [/reprog|reagend/i, 'Reprogramó'], [/cancel/i, 'Canceló'], [/confirm/i, 'Confirmada'], [/asist|asistieron|present/i, 'Asistió'], [/contact/i, 'Contactada']];
const hora = (k) => `${String(9 + Math.floor(k * 47 / 60) % 10).padStart(2, '0')}:${String((k * 47) % 60).padStart(2, '0')}`;
const nombre = (k) => NOMBRES[(k * 5 + 3) % NOMBRES.length];

function filasDe(o, n) {
  const l = o.l, tipo = { closer: 'agendas', triage: 'agendas', setter: 'conv', fulfillment: 'alumnos', dev: 'tareas' }[rol];
  if (rol === 'closer' && (o.f === 'usd' || /venta|pif|seña|llamada/i.test(l))) {
    const p = PAGOS.filter(r => !/pif|seña/i.test(l) || l.includes(r[1]));
    return { cols: ['Lead', 'Tipo', 'Monto', 'Hora', 'Dónde'], filas: p };
  }
  if (o.f === 'min') {
    const bloques = Math.max(1, Math.round(o.v / 50));
    return { cols: ['Bloque', 'Área', 'Duración'], filas: Array.from({ length: bloques }, (_, k) => [`Sprint ${k + 1} · ${hora(k * 2)}`, ['Work', 'Academia', 'Leadership'][k % 3], k === bloques - 1 ? `${Math.round(o.v - 50 * (bloques - 1))} min` : '50 min']) };
  }
  const est = (ESTADO.find(([re]) => re.test(l)) || [, 'Cuenta'])[1];
  if (tipo === 'agendas') return { cols: ['Lead', 'Hora', 'Llamada', 'Estado'], filas: Array.from({ length: n }, (_, k) => [nombre(k), hora(k), k % 3 ? '1.ª' : '2.ª', est]) };
  if (tipo === 'conv') return { cols: ['Lead', 'Canal', 'Último mensaje', 'Etapa'], filas: Array.from({ length: n }, (_, k) => [nombre(k), k % 3 ? 'Anuncios' : 'Inbound', hora(k), l]) };
  if (tipo === 'alumnos') return { cols: ['Alumno', 'Qué', 'Hora'], filas: Array.from({ length: n }, (_, k) => [nombre(k), l, hora(k)]) };
  return { cols: ['Tarea', 'Proyecto', 'Hora'], filas: Array.from({ length: n }, (_, k) => [`#${1440 + k * 7} ${['Ajuste del deck', 'Bug de agendas', 'Reporte de clases', 'Pedido de Marlon'][k % 4]}`, ['Work', 'Academia', 'Leadership'][k % 3], hora(k)]) };
}

function explicar(o) {
  if (o.mano) {
    return { como: 'Este dato no lo ve el sistema: lo cargaste a mano en «Antes de que se cierre». Lo podés cambiar ahí.',
      cols: ['Cuándo', 'Quién', 'Valor'], filas: o.v == null ? [] : [['Hoy 18:40', 'Vos', String(o.v)]], vacio: 'Todavía no lo cargaste.' };
  }
  if (o.f === '%' || o.pct) {
    const b = BASE[rol], a = Math.round(o.v * b / 100), base = filasDe({ ...o, l: 'agendas' }, b);
    const [si, no] = SINO[o.l] || ['Cuenta', 'No cuenta'], ag = base.cols.at(-1) === 'Estado';
    return { como: `${COMO[o.l] || 'Porcentaje sobre el total del día.'} ${diaSel ? 'Ese día' : 'Hoy'}: ${a} de ${b} = ${Math.round(o.v)}%.`,
      cols: [...(ag ? base.cols.slice(0, -1) : base.cols), 'Resultado'],
      filas: base.filas.map((r, k) => [...(ag ? r.slice(0, -1) : r), k < a ? `<span class="ex__si">${si}</span>` : `<span class="ex__no">${no}</span>`]) };
  }
  const n = Math.min(Math.round(o.v || 0), 40), r = filasDe(o, n);
  return { como: COMO[o.l] || `Cada registro del día que entra en «${o.l}». Estos son los que se contaron:`, ...r };
}

function abrirDetalle(o) {
  const e = explicar(o), max = 12, extra = e.filas.length - max;
  const valor = o.v == null ? '—' : `<span data-v="${o.v}" data-f="${o.f || 'n'}">${fmt(0, o.f || 'n')}</span>`;
  const scrim = document.createElement('div');
  scrim.className = 'ui-scrim';
  scrim.innerHTML = `<div class="ui-modal ex" role="dialog" aria-modal="true" aria-labelledby="exT">
    <header class="ex__cab"><div><p class="ex__ctx">${o.ctx || 'Tus números · ' + (diaSel ? nomDia(DIAS[diaSel]) : 'hoy')}</p><h2 id="exT">${o.l}</h2></div>
      <button class="ex__x" type="button" aria-label="Cerrar">×</button></header>
    <div class="ex__cuerpo">
      <div class="ex__val">${valor}${o.mano ? '<em class="tag-m">a mano</em>' : ''}</div>
      <div class="ex__como"><b>Cómo se calcula</b><p>${e.como}</p></div>
      ${e.filas.length ? `<table class="ex__tabla"><thead><tr>${e.cols.map(c => `<th>${c}</th>`).join('')}</tr></thead>
        <tbody>${e.filas.slice(0, max).map((f, k) => `<tr style="animation-delay:${120 + k * 35}ms">${f.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>
        ${extra > 0 ? `<p class="ex__mas">y ${extra} más · <button class="cd-otra" type="button">Ver todos</button></p>` : ''}` : `<p class="ex__mas">${e.vacio || 'No hubo registros.'}</p>`}
    </div>
    <footer class="ex__pie"><span>Fuente: ${FUENTE[rol]} · actualizado 18:42</span>${o.corr ? '<button class="ui-btn ui-btn--secondary ui-btn--sm" type="button" data-cerrar>Corregir el número</button>' : ''}</footer></div>`;
  const cerrar = () => { scrim.remove(); document.removeEventListener('keydown', esc); origen?.focus(); };
  const esc = (ev) => { if (ev.key === 'Escape') cerrar(); };
  const origen = document.activeElement;
  scrim.addEventListener('click', (ev) => { if (ev.target === scrim || ev.target.closest('.ex__x,[data-cerrar]')) cerrar(); });
  document.addEventListener('keydown', esc);
  document.body.appendChild(scrim);
  scrim.querySelector('.ex__x').focus();
  animar(scrim);
}

document.addEventListener('click', (ev) => { const t = ev.target.closest('[data-exp]'); if (t && !ev.target.closest('input,button:not([data-exp])')) abrirDetalle(EXP[+t.dataset.exp]); });
document.addEventListener('keydown', (ev) => { const t = ev.target.closest?.('[data-exp]'); if (t && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); abrirDetalle(EXP[+t.dataset.exp]); } });
