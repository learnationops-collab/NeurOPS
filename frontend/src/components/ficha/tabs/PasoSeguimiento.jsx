// El paso «Seguimiento» del reporte: cuándo se retoma el contacto, a qué hora llega el aviso, si
// llega por WhatsApp y el ángulo (opcional). Mario (26/10/2026) cambió el formulario de rótulos y
// campos por dos modos con menos texto: Snap (chips con indicador que se desliza + calendario +
// hora tipeable) y Flow (una oración donde cada parte es un desplegable). Los dos leen y escriben
// las mismas respuestas del árbol (`fecha_seguimiento`, `followup_reminder_time`,
// `followup_reminder_enabled`, `notes`), así que cambiar de modo no pierde nada.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight, Calendar, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Inbox, Plus, X,
} from 'lucide-react';
import { Aura, Button, IconButton, TextArea } from '../../standard';
import './paso-seguimiento.css';

const DIAS = [
  { label: 'Hoy', dias: 0 },
  { label: 'Mañana', dias: 1 },
  { label: 'En 3 días', dias: 3 },
  { label: 'Próx. semana', dias: 7 },
];
const HORAS = ['09:00', '10:45', '14:00', '18:30'];
const HORA_PROPIA = '16:15';
const MODO_KEY = 'fi.seguimiento.modo';

const AURA_DIA = ['var(--brand-secondary-light)', 'var(--info)', 'var(--warning)'];
const AURA_HORA = ['var(--brand-secondary)', 'var(--info)', 'var(--success)'];
const AURA_MODO = ['var(--brand-secondary)', 'var(--brand-primary)', 'var(--info)'];
const AURA_WA = ['var(--success)', 'var(--brand-secondary)', 'var(--info)'];
const AURA_RESUMEN = ['var(--brand-secondary)', 'var(--success)', 'var(--info)'];
const AURA_FRASE = ['var(--brand-secondary)', 'var(--brand-primary)', 'var(--success)', 'var(--info)'];

// --- fechas ------------------------------------------------------------------------------------

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hoy = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const enDias = (n) => { const d = hoy(); d.setDate(d.getDate() + n); return d; };
const deIso = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const diasHasta = (s) => Math.round((deIso(s) - hoy()) / 864e5);
const sinPunto = (s) => s.replace(/[.,]/g, '');

// «lun 26», o «lun 2 nov» si cae en otro mes.
function corta(d) {
  const otroMes = d.getMonth() !== hoy().getMonth();
  return sinPunto(d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', ...(otroMes ? { month: 'short' } : {}) }));
}
// «hoy», «mañana», «el jueves 29», «el lunes 2 de nov».
function frase(s) {
  const n = diasHasta(s);
  if (n === 0) return 'hoy';
  if (n === 1) return 'mañana';
  const d = deIso(s);
  const mes = d.getMonth() !== hoy().getMonth() ? ` de ${sinPunto(d.toLocaleDateString('es-AR', { month: 'short' }))}` : '';
  return `el ${d.toLocaleDateString('es-AR', { weekday: 'long' })} ${d.getDate()}${mes}`;
}
const mayuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// --- horas -------------------------------------------------------------------------------------

function sumarMinutos(hhmm, m) {
  const [h, mm] = hhmm.split(':').map(Number);
  const t = ((h * 60 + mm + m) % 1440 + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}
// Lo tipeado: solo dígitos y «:», y con 3 o 4 dígitos pone los dos puntos (930 → 9:30).
function limpiarHora(v) {
  let s = v.replace(/[^0-9:]/g, '');
  if (/^\d{3,4}$/.test(s)) s = `${s.slice(0, -2)}:${s.slice(-2)}`;
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  const valida = m && Number(m[1]) < 24 && Number(m[2]) < 60 ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
  return { texto: s, valida };
}

// --- el indicador que se desliza ---------------------------------------------------------------

// Mide el hijo marcado `data-activo` del contenedor: así el indicador sigue al chip aunque la fila
// se parta en dos renglones en una pantalla angosta.
function useIndicador(clave) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    const cont = ref.current;
    if (!cont) return undefined;
    const medir = () => {
      const el = cont.querySelector('[data-activo="true"]');
      setPos(el ? { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight } : null);
    };
    medir();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(medir);
    ro.observe(cont);
    return () => ro.disconnect();
  }, [clave]);
  const estilo = pos
    ? { transform: `translate(${pos.x}px, ${pos.y}px)`, width: pos.w, height: pos.h, opacity: 1 }
    : { opacity: 0 };
  return [ref, estilo];
}

// --- el paso -----------------------------------------------------------------------------------

export default function PasoSeguimiento({
  respuestas, onCambiar, onContinuar, puede, onAnterior, onReiniciar, reducido,
}) {
  const fecha = respuestas.fecha_seguimiento || '';
  const hora = respuestas.followup_reminder_time || '';
  const pool = !fecha;
  const sinHora = !hora;

  const [modo, setModo] = useState(() => {
    try { return localStorage.getItem(MODO_KEY) === 'flow' ? 'flow' : 'snap'; } catch { return 'snap'; }
  });
  const cambiarModo = (m) => {
    setModo(m);
    try { localStorage.setItem(MODO_KEY, m); } catch { /* sin almacenamiento: solo dura esta vez */ }
  };
  // Lo que el closer eligió para el aviso, aparte de lo que se guarda: sin hora o sin fecha el aviso
  // se apaga, y al volver a elegir una hora vuelve a como estaba.
  const [wa, setWa] = useState(respuestas.followup_reminder_enabled !== false);
  const [horaPropia, setHoraPropia] = useState(hora && !HORAS.includes(hora) ? hora : HORA_PROPIA);
  const [borrador, setBorrador] = useState(null);
  const [calendario, setCalendario] = useState(false);
  const [mes, setMes] = useState(0);
  const [menu, setMenu] = useState(null);
  const [angulo, setAngulo] = useState(Boolean(respuestas.notes));

  const guardar = (parche, waPref = wa) => {
    const f = 'fecha_seguimiento' in parche ? parche.fecha_seguimiento : fecha;
    const h = 'followup_reminder_time' in parche ? parche.followup_reminder_time : hora;
    onCambiar({ ...parche, followup_reminder_enabled: Boolean(waPref && f && h) });
  };

  // Al entrar por primera vez: mañana a las 10:45 con aviso, lo más común. No pisa lo que ya venía
  // (la fecha que sugiere la cadencia, o lo que el closer cargó antes de volver a este paso).
  useEffect(() => {
    const base = {};
    if (respuestas.fecha_seguimiento === undefined) base.fecha_seguimiento = iso(enDias(1));
    if (respuestas.followup_reminder_time === undefined) base.followup_reminder_time = '10:45';
    if (Object.keys(base).length) guardar(base);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const elegirFecha = (valor) => { guardar({ fecha_seguimiento: valor }); setCalendario(false); setMenu(null); };
  const elegirHora = (valor) => { guardar({ followup_reminder_time: valor }); setMenu(null); };
  const alternarWa = (v = !wa) => { setWa(v); guardar({}, v); setMenu(null); };
  const usarHoraPropia = (v) => { setHoraPropia(v); guardar({ followup_reminder_time: v }); };

  const diaActivo = pool ? 'pool' : DIAS.findIndex((d) => iso(enDias(d.dias)) === fecha);
  const fechaPropia = !pool && diaActivo === -1;
  const horaActiva = sinHora ? 'sin' : (HORAS.includes(hora) ? hora : 'propia');
  const avisa = wa && !pool && !sinHora;

  const [refDias, estiloDia] = useIndicador(`${diaActivo}|${fecha}|${modo}`);
  const [refHoras, estiloHora] = useIndicador(`${horaActiva}|${modo}|${pool}`);
  const [refModo, estiloModo] = useIndicador(modo);

  const horaInput = {
    value: borrador ?? horaPropia,
    onChange: (e) => {
      const { texto, valida } = limpiarHora(e.target.value);
      setBorrador(texto);
      if (valida) usarHoraPropia(valida);
    },
    onFocus: (e) => { e.target.select(); if (horaActiva !== 'propia') usarHoraPropia(horaPropia); },
    onBlur: () => setBorrador(null),
    onKeyDown: (e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); setMenu(null); } },
  };
  const pasoHora = (m) => { setBorrador(null); usarHoraPropia(sumarMinutos(horaActiva === 'propia' ? hora : horaPropia, m)); };

  return (
    <div className="fi-sg">
      <div className="fi-sg-cabeza">
        <h3 className="ln-t-h3">Seguimiento</h3>
        <div className="fi-sg-modo" role="radiogroup" aria-label="Modo" ref={refModo}>
          <span className="fi-sg-ind fi-sg-ind--modo" style={estiloModo}><Aura colors={AURA_MODO} className="fi-sg-aura" /></span>
          {[['snap', 'Snap'], ['flow', 'Flow']].map(([v, l]) => (
            <button key={v} type="button" role="radio" aria-checked={modo === v} data-activo={modo === v}
              onClick={() => cambiarModo(v)}>{l}</button>
          ))}
        </div>
      </div>

      {modo === 'snap' ? (
        <div className="fi-sg-cuerpo" key="snap">
          <div className="fi-sg-dias" role="radiogroup" aria-label="Día del próximo contacto" ref={refDias}>
            <span className="fi-sg-ind fi-sg-ind--dia" style={estiloDia}><Aura colors={AURA_DIA} className="fi-sg-aura" /></span>
            {DIAS.map((d, i) => (
              <button key={d.label} type="button" role="radio" className="fi-sg-dia" aria-checked={diaActivo === i}
                data-activo={diaActivo === i} onClick={() => elegirFecha(iso(enDias(d.dias)))}>
                <b>{d.label}</b><small>{corta(enDias(d.dias))}</small>
              </button>
            ))}
            <button type="button" role="radio" className="fi-sg-dia" aria-checked={pool} data-activo={pool}
              onClick={() => elegirFecha('')}>
              <b>Sin fecha</b><small>al pool</small>
            </button>
            <button type="button" role="radio" aria-checked={fechaPropia} aria-expanded={calendario}
              className={`fi-sg-dia fi-sg-dia--cal${calendario || fechaPropia ? ' fi-sg-dia--marcado' : ''}`}
              data-activo={fechaPropia} title="Elegir otra fecha" onClick={() => setCalendario((v) => !v)}>
              <Calendar aria-hidden="true" />
              <small>{fechaPropia ? sinPunto(deIso(fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })) : 'Otra'}</small>
            </button>
          </div>

          <div className={`fi-sg-plegable${calendario ? ' fi-sg-plegable--abierto' : ''}`}>
            {calendario && <Mes mes={mes} setMes={setMes} fecha={fecha} onElegir={elegirFecha} />}
          </div>

          <div className={`fi-sg-fila-hora${pool ? ' fi-sg-fila-hora--oculta' : ''}`} aria-hidden={pool || undefined}>
            <div className="fi-sg-horas" role="radiogroup" aria-label="Hora del aviso" ref={refHoras}>
              <span className="fi-sg-ind fi-sg-ind--hora" style={estiloHora}><Aura colors={AURA_HORA} className="fi-sg-aura" /></span>
              <button type="button" role="radio" className="fi-sg-hora fi-sg-hora--sin" aria-checked={sinHora}
                data-activo={sinHora} onClick={() => elegirHora('')}>Sin hora</button>
              {HORAS.map((h) => (
                <button key={h} type="button" role="radio" className="fi-sg-hora ln-mono" aria-checked={hora === h}
                  data-activo={hora === h} onClick={() => elegirHora(h)}>{h}</button>
              ))}
              <span className="fi-sg-hora fi-sg-hora--propia" data-activo={horaActiva === 'propia'}>
                <button type="button" aria-label="15 minutos menos" onClick={() => pasoHora(-15)}><ChevronLeft /></button>
                <input type="text" inputMode="numeric" maxLength={5} placeholder="hh:mm" aria-label="Hora exacta" {...horaInput} />
                <button type="button" aria-label="15 minutos más" onClick={() => pasoHora(15)}><ChevronRight /></button>
              </span>
            </div>
            <button type="button" className={`fi-sg-wa${avisa ? ' fi-sg-wa--on' : ''}`} aria-pressed={avisa}
              disabled={sinHora} onClick={() => alternarWa()}>
              <Aura colors={AURA_WA} className="fi-sg-aura" />
              <span className="fi-sg-wa-check">{avisa && <Check key="on" aria-hidden="true" />}</span>
              WhatsApp
            </button>
          </div>
        </div>
      ) : (
        <Frase
          key="flow" fecha={fecha} hora={hora} pool={pool} sinHora={sinHora} wa={wa} menu={menu} setMenu={setMenu}
          horaActiva={horaActiva} horaInput={horaInput} pasoHora={pasoHora} reducido={reducido}
          onFecha={elegirFecha} onHora={elegirHora} onWa={alternarWa}
          onOtraFecha={() => { cambiarModo('snap'); setCalendario(true); setMenu(null); }}
        />
      )}

      <div className="fi-sg-resumen" role="status">
        <Aura colors={AURA_RESUMEN} className="fi-sg-aura" />
        <span className="fi-sg-resumen-txt" key={`${fecha}|${hora}|${avisa}`}>
          {pool ? <Inbox className="fi-sg-ico-pool" aria-hidden="true" /> : <CheckCircle2 className="fi-sg-ico-ok" aria-hidden="true" />}
          {pool ? (
            <span><b>Sin fecha:</b> va al pool del equipo.</span>
          ) : sinHora ? (
            <span>Lo retomás <b>{frase(fecha)}</b>, sin hora ni aviso.</span>
          ) : (
            <span>Lo retomás <b>{`${frase(fecha)} a las ${hora}`}</b>{avisa ? ' y te aviso por WhatsApp.' : ', sin aviso.'}</span>
          )}
        </span>
      </div>

      {angulo && (
        <label className="fi-sg-angulo">
          <span className="ln-field-label">Ángulo</span>
          <TextArea rows={2} value={respuestas.notes || ''} placeholder="Qué le vas a decir cuando lo retomes"
            onChange={(e) => onCambiar({ notes: e.target.value })} />
        </label>
      )}

      <div className="fi-botonera fi-sg-pie">
        {onAnterior && <IconButton label="Anterior" icon={<ChevronLeft />} onClick={onAnterior} />}
        {onReiniciar && <IconButton label="Empezar de nuevo" icon={<X />} onClick={onReiniciar} />}
        <Button variant="ghost" icon={<Plus />} aria-pressed={angulo}
          onClick={() => setAngulo((v) => !v)}>
          Ángulo
        </Button>
        <span className="fi-sg-hueco" />
        <motion.button type="button" className="btn btn--cta" disabled={!puede}
          whileTap={reducido || !puede ? undefined : { scale: 0.97 }} onClick={onContinuar}>
          Continuar <ArrowRight />
        </motion.button>
      </div>
    </div>
  );
}

// --- calendario (Snap) -------------------------------------------------------------------------

const SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function Mes({ mes, setMes, fecha, onElegir }) {
  const base = hoy();
  const primero = new Date(base.getFullYear(), base.getMonth() + mes, 1);
  const hueco = (primero.getDay() + 6) % 7; // la semana empieza el lunes
  const largo = new Date(primero.getFullYear(), primero.getMonth() + 1, 0).getDate();
  const titulo = mayuscula(primero.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }));
  return (
    <div className="fi-sg-mes">
      <div className="fi-sg-mes-cabeza">
        <button type="button" aria-label="Mes anterior" disabled={mes === 0} onClick={() => setMes(mes - 1)}><ChevronLeft /></button>
        <b>{titulo}</b>
        <button type="button" aria-label="Mes siguiente" onClick={() => setMes(mes + 1)}><ChevronRight /></button>
      </div>
      <div className="fi-sg-mes-grilla">
        {SEMANA.map((d, i) => <small key={i}>{d}</small>)}
        {Array.from({ length: hueco }, (_, i) => <span key={`h${i}`} />)}
        {Array.from({ length: largo }, (_, i) => {
          const d = new Date(primero.getFullYear(), primero.getMonth(), i + 1);
          const valor = iso(d);
          const pasado = d < base;
          return (
            <button key={valor} type="button" disabled={pasado} aria-pressed={valor === fecha}
              className={`${valor === fecha ? 'fi-sg-mes-sel' : ''}${valor === iso(base) ? ' fi-sg-mes-hoy' : ''}`}
              onClick={() => onElegir(valor)}>
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --- la oración (Flow) -------------------------------------------------------------------------

function Frase({
  fecha, hora, pool, sinHora, wa, menu, setMenu, horaActiva, horaInput, pasoHora, onFecha, onHora, onWa,
  onOtraFecha,
}) {
  const ref = useRef(null);
  // Un menú abierto se cierra con un clic afuera o con Escape.
  useEffect(() => {
    if (!menu) return undefined;
    const afuera = (e) => { if (!ref.current?.contains(e.target)) setMenu(null); };
    const esc = (e) => { if (e.key === 'Escape') setMenu(null); };
    document.addEventListener('pointerdown', afuera);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', afuera); document.removeEventListener('keydown', esc); };
  }, [menu, setMenu]);

  const presets = [0, 1, 3, 7].map((n) => iso(enDias(n)));
  const fechaPropia = !pool && !presets.includes(fecha);
  const opcionesDia = [
    ...presets.map((v, i) => ({
      l: mayuscula(frase(v).replace(/^el /, '')), s: i < 2 ? corta(deIso(v)) : '', sel: v === fecha, fn: () => onFecha(v),
    })),
    { l: 'Otra fecha…', s: fechaPropia ? corta(deIso(fecha)) : '', sel: fechaPropia, fn: onOtraFecha },
    { l: 'Sin fecha', s: 'va al pool', sel: pool, fn: () => onFecha('') },
  ];
  const opcionesHora = [
    ...HORAS.map((h) => ({ l: h, s: '', sel: hora === h, fn: () => onHora(h) })),
    { l: 'Sin hora', s: 'sin aviso', sel: sinHora, fn: () => onHora('') },
  ];
  const opcionesWa = [
    { l: 'WhatsApp', s: '', sel: wa, fn: () => onWa(true) },
    { l: 'Sin aviso', s: '', sel: !wa, fn: () => onWa(false) },
  ];

  return (
    <div className="fi-sg-frase" ref={ref}>
      <Aura colors={AURA_FRASE} className="fi-sg-aura" />
      <span>Seguimiento</span>
      <Token id="dia" menu={menu} setMenu={setMenu} valor={pool ? 'sin fecha' : frase(fecha)} opciones={opcionesDia} />
      {!pool && (
        <>
          {!sinHora && <span>a las</span>}
          <Token id="hora" menu={menu} setMenu={setMenu} valor={sinHora ? 'sin hora' : hora} opciones={opcionesHora}>
            <div className={`fi-sg-menu-propia${horaActiva === 'propia' ? ' fi-sg-menu-sel' : ''}`}>
              <span>Otra hora</span>
              <span className="fi-sg-menu-paso">
                <button type="button" aria-label="15 minutos menos" onClick={() => pasoHora(-15)}><ChevronLeft /></button>
                <input type="text" inputMode="numeric" maxLength={5} placeholder="hh:mm" aria-label="Hora exacta" {...horaInput} />
                <button type="button" aria-label="15 minutos más" onClick={() => pasoHora(15)}><ChevronRight /></button>
              </span>
            </div>
          </Token>
          {!sinHora && (
            <>
              <span className="ln-muted">{wa ? 'aviso por' : 'y'}</span>
              <Token id="wa" menu={menu} setMenu={setMenu} valor={wa ? 'WhatsApp' : 'sin aviso'} opciones={opcionesWa} />
            </>
          )}
        </>
      )}
    </div>
  );
}

function Token({ id, menu, setMenu, valor, opciones, children }) {
  const abierto = menu === id;
  return (
    <span className="fi-sg-token">
      <button type="button" aria-haspopup="listbox" aria-expanded={abierto} onClick={() => setMenu(abierto ? null : id)}>
        <span className="fi-sg-rueda" key={valor}>{valor}</span>
        <ChevronDown className={abierto ? 'fi-sg-giro' : undefined} aria-hidden="true" />
      </button>
      {abierto && (
        <div className="fi-sg-menu" role="listbox">
          <Aura colors={AURA_RESUMEN} className="fi-sg-aura" />
          {opciones.map((o) => (
            <button key={o.l} type="button" role="option" aria-selected={o.sel}
              className={o.sel ? 'fi-sg-menu-sel' : undefined} onClick={o.fn}>
              <span>{o.l}</span>{o.s && <small>{o.s}</small>}
            </button>
          ))}
          {children}
        </div>
      )}
    </span>
  );
}
