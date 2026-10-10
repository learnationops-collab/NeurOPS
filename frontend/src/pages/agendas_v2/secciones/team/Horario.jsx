// Horario semanal de una persona: zona, atajos (L a V 9–18, copiar de otro closer, vaciar) y
// hasta 6 franjas por día de a 30 min, con "copiar a otros días". También la ventana emergente
// con las pestañas Horario y Semana.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DIAS, HORAS, ZONAS, aMin } from '../../core/catalogos';
import { closers, colorVar, horasSemana, ord } from '../../core/datos';
import { normalHorario } from '../../core/normalizar';
import { nombreSim, puedeHorarioDe } from '../../core/permisos';
import { gmtTxt } from '../../core/tiempo';
import { clonar, fmt, mayus } from '../../core/util';
import { almacen, useDatos, useUi } from '../../data/hooks';
import { Avatar, Humo, Icono, Modal, Seg, Sx } from '../../ui/base';
import { toast } from '../../ui/toast';
import Available from './Available';
import { MAX_FRANJAS, horarioLaV } from './cobertura';
import { HUMO_PERSONA, SemanaMini, setTeam } from './comun';
import { EditorSesiones } from './Sesiones';

const OPS_DESDE = HORAS.slice(0, -1).map(h => ({ v: h, n: h }));
const OPS_HASTA = HORAS.slice(1).map(h => ({ v: h, n: h }));
const OPS_ZONA = ZONAS.map(z => ({ v: z.tz, n: z.n + ' · ' + gmtTxt(z.tz) }));

// Popover "Copiar horas a…": cierra con Escape o con un clic afuera.
function CopiarA({ desde, onAplicar, onCerrar }) {
    const ref = useRef(null);
    const [sel, setSel] = useState({});
    const cerrarRef = useRef(onCerrar);
    useEffect(() => { cerrarRef.current = onCerrar; });
    useEffect(() => {
        const fuera = (e) => { if (!ref.current?.contains(e.target) && !e.target.closest('[data-copiar-btn]')) cerrarRef.current(false); };
        document.addEventListener('mousedown', fuera, true);
        ref.current?.querySelector('input:not(:disabled)')?.focus();
        return () => document.removeEventListener('mousedown', fuera, true);
    }, []);
    return (
        <div className="pop" role="dialog" aria-label="Copiar horas a" ref={ref}
            onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCerrar(true); } }}>
            <span className="t-rotulo" style={{ padding: '4px 6px' }}>Copiar horas a…</span>
            {DIAS.map(x => (
                <label key={x.d}>{mayus(x.n)}
                    <input type="checkbox" checked={x.d === desde || !!sel[x.d]} disabled={x.d === desde} onChange={e => setSel({ ...sel, [x.d]: e.target.checked })} />
                </label>
            ))}
            <button type="button" className="btn btn--cta btn--sm" style={{ marginTop: 6 }}
                onClick={() => onAplicar(Object.keys(sel).filter(k => sel[k]).map(Number))}>Aplicar</button>
        </div>
    );
}

/**
 * Editor del horario. `bloqueado`: solo lectura (todo deshabilitado).
 * onGuardar({horario?, tz?}): fuera de Thalamus (la Configuración del closer) guarda ahí en vez de en
 * la persona de Team, y no ofrece copiar de otro closer.
 */
export function HorarioEditor({ p, bloqueado = false, onGuardar = null }) {
    const { d } = useDatos();
    const [copiar, setCopiar] = useState(null);   // día con el popover abierto
    const raiz = useRef(null);
    const otros = onGuardar ? [] : closers(d).filter(x => x.id !== p.id && horasSemana(x) > 0);
    const editarPersona = (campos) => (onGuardar ? onGuardar(campos) : almacen.editar('personas', p.id, campos, true));
    const guardar = (horario, extra) => editarPersona({ horario, ...extra });
    const h = (dow) => clonar(p.horario[dow] || []);
    const dis = bloqueado || undefined;

    const sumar = (dow) => {
        const hz = clonar(p.horario), dia = hz[dow] || [], ult = dia[dia.length - 1];
        if (dia.length >= MAX_FRANJAS) return;
        if (ult) {
            const ini = ult[1] < '22:00' ? ult[1] : '20:00';
            dia.push([ini, HORAS[Math.min(HORAS.length - 1, HORAS.indexOf(ini) + 4)]]);
        } else dia.push(['09:00', '18:00']);
        hz[dow] = dia;
        guardar(hz);
        // El foco va al "Desde" de la franja nueva.
        requestAnimationFrame(() => { const el = raiz.current?.querySelector('[data-dia="' + dow + '"] [data-r="' + (dia.length - 1) + '"] .sx'); if (el) el.focus(); });
    };
    const quitar = (dow, j) => {
        const hz = clonar(p.horario); hz[dow].splice(j, 1); guardar(hz);
        requestAnimationFrame(() => { const el = raiz.current?.querySelector('[data-dia="' + dow + '"] button:not(:disabled)'); if (el) el.focus(); });
    };
    const fijar = (dow, j, k, v) => { const hz = clonar(p.horario); hz[dow][j][k] = v; guardar(hz); };
    const cerrarCopiar = (foco) => {
        const dia = copiar; setCopiar(null);
        if (foco) requestAnimationFrame(() => raiz.current?.querySelector('[data-dia="' + dia + '"] [data-copiar-btn]')?.focus());
    };

    return (
        <div className="horario" ref={raiz}>
            <div className="horario-barra">
                <Sx sm label="Zona horaria" valor={p.tz} opciones={OPS_ZONA} disabled={dis} onChange={v => editarPersona({ tz: v })} />
                <div className="barra-der">
                    <button type="button" className="sug" disabled={dis} onClick={() => guardar(horarioLaV())}><Icono n="rayo" />L a V 9–18</button>
                    {otros.length > 0 && (
                        <Sx sm label="Copiar de" valor="" disabled={dis}
                            opciones={[{ v: '', n: 'Copiar de…' }, ...otros.map(o => ({ v: o.id, n: o.nombre }))]}
                            onChange={v => { const o = otros.find(x => x.id === v); if (!o) return; guardar(clonar(o.horario), { tz: o.tz }); toast('Horario copiado de ' + o.nombre); }} />
                    )}
                    <button type="button" className="btn btn--linea btn--sm" disabled={dis} onClick={() => guardar(normalHorario({}))}>Vaciar</button>
                </div>
            </div>
            <div className="dias">
                {DIAS.map(dd => {
                    const rs = p.horario[dd.d] || [];
                    return (
                        <div key={dd.d} className={'dia' + (rs.length ? '' : ' dia--off')} data-dia={dd.d}>
                            <span className="dia-l" title={dd.n}>{dd.c}</span>
                            <div className="dia-cuerpo">
                                {!rs.length && (
                                    <div className="dia-no">No disponible
                                        <button type="button" className="ibtn ibtn--xs" disabled={dis} aria-label={'Agregar horario el ' + dd.n} onClick={() => sumar(dd.d)}><Icono n="plus" /></button>
                                    </div>
                                )}
                                {rs.map((r, j) => (
                                    <div key={j} className={'rango' + (aMin(r[1]) <= aMin(r[0]) ? ' mal' : '')} data-r={j}>
                                        <Sx sm label={'Desde, ' + dd.n} valor={r[0]} opciones={OPS_DESDE} disabled={dis} onChange={v => fijar(dd.d, j, 0, v)} />–
                                        <Sx sm label={'Hasta, ' + dd.n} valor={r[1]} opciones={OPS_HASTA} disabled={dis} onChange={v => fijar(dd.d, j, 1, v)} />
                                        <button type="button" className="ibtn ibtn--xs ibtn--peligro" disabled={dis} aria-label={'Quitar ' + r[0] + '–' + r[1] + ', ' + dd.n} onClick={() => quitar(dd.d, j)}><Icono n="x" /></button>
                                        {j === 0 && (
                                            <div className="dia-acc">
                                                <button type="button" className="ibtn ibtn--xs" disabled={dis || rs.length >= MAX_FRANJAS} aria-label="Agregar otro horario" onClick={() => sumar(dd.d)}><Icono n="plus" /></button>
                                                <button type="button" className="ibtn ibtn--xs" data-copiar-btn="" disabled={dis} aria-label="Copiar a otros días" aria-expanded={copiar === dd.d}
                                                    onClick={() => setCopiar(copiar === dd.d ? null : dd.d)}><Icono n="copiar" /></button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {rs.length > 0 && (
                                    <>
                                        {/* Línea de 6 a 24 h: muestra de un vistazo cuándo atiende ese día */}
                                        <div className="linea-dia" aria-hidden="true">
                                            {rs.map((r, j) => {
                                                const a = Math.max(0, (aMin(r[0]) - 360) / 10.8), b = Math.max(0, (aMin(r[1]) - 360) / 10.8);
                                                return <i key={j} style={{ left: a + '%', width: Math.max(0, b - a) + '%' }} />;
                                            })}
                                            <span style={{ left: '33.3%' }} /><span style={{ left: '66.6%' }} />
                                        </div>
                                        <div className="linea-eje" aria-hidden="true"><span>6</span><span>12</span><span>18</span><span>24</span></div>
                                    </>
                                )}
                                {copiar === dd.d && !bloqueado && (
                                    <CopiarA desde={dd.d} onCerrar={cerrarCopiar}
                                        onAplicar={(destinos) => {
                                            const hz = clonar(p.horario);
                                            destinos.forEach(x => { hz[x] = h(dd.d); });
                                            setCopiar(null);
                                            if (destinos.length) { guardar(hz); toast('Horas copiadas'); }
                                        }} />
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// Mantiene el foco dentro de la ventana con Tab.
function atrapar(e) {
    if (e.key !== 'Tab') return;
    const cont = e.currentTarget.closest('.modal');
    const fs = [...cont.querySelectorAll('button,input,textarea,select')].filter(x => !x.disabled && x.offsetParent !== null);
    if (!fs.length) return;
    const a = fs[0], z = fs[fs.length - 1];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
    else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
}

// A dónde vuelve el foco al cerrar la ventana.
let volverA = null;
export function abrirHorario(p, origen) {
    volverA = origen || null;
    setTeam({ horario: p.id, horTab: 'config' });
}

/**
 * Ventana del horario. Se monta en la raíz de Thalamus (fuera de la vista) para que el bloqueo de
 * solo lectura no la toque: los permisos los aplica ella con puedeHorarioDe.
 */
export function ModalHorario() {
    const { d, perfil } = useDatos();
    const { sim, team } = useUi();
    const p = team.horario && d.personas.find(x => x.id === team.horario);
    const [raiz, setRaiz] = useState(null);
    const ancla = useRef(null);
    useEffect(() => { setRaiz(ancla.current ? ancla.current.closest('.thalamus-app') : null); }, []);
    useEffect(() => { if (team.horario && !p) setTeam({ horario: null }); }, [team.horario, p]);

    const cerrar = () => {
        almacen.flush();
        setTeam({ horario: null });
        const v = volverA; volverA = null;
        if (v && document.body.contains(v)) requestAnimationFrame(() => v.focus());
    };
    let modal = null;
    if (p) {
        const tab = ['semana', 'sesiones'].includes(team.horTab) ? team.horTab : 'config', hs = horasSemana(p), puede = puedeHorarioDe(d, sim, perfil, p);
        modal = (
            <Modal onCerrar={cerrar} clase="modal--hor" labelledBy="hor-tit" style={{ '--c': colorVar(p.color) }}>
                <Humo clase="humo--tarjeta humo--suave" cols={HUMO_PERSONA} />
                <div onKeyDown={atrapar}>
                    <div className="hor-cab">
                        <Avatar p={p} clase="avatar--l" />
                        <div className="hor-tit">
                            <h2 className="t-h3" id="hor-tit">{p.nombre}</h2>
                            <span className="pc-sub" style={{ padding: 0 }}><SemanaMini p={p} /><span className="num">{hs ? fmt(hs, 1) + ' h/sem' : 'Sin horario'}</span></span>
                        </div>
                        <Seg sm nav label="Vista" valor={tab} onChange={v => setTeam({ horTab: v })}
                            opciones={[{ v: 'config', n: 'Horario', icono: 'ajustes' }, { v: 'sesiones', n: 'Sesiones', icono: 'clock' }, { v: 'semana', n: 'Semana', icono: 'calendar' }]} />
                        <button type="button" className="ibtn" data-nav="" aria-label="Cerrar" onClick={cerrar}><Icono n="x" /></button>
                    </div>
                    {tab === 'semana'
                        ? <div className="hor-semana"><Available solo={p} /></div>
                        : tab === 'sesiones' ? (
                            <>
                                {!puede && <p className="hor-ro"><Icono n="candado" s={14} />Solo lectura: {nombreSim(d, sim)} no puede cambiar sus sesiones.</p>}
                                <div className="hor-ses">
                                    <p className="t-sm mut">Cuánto dura cada sesión de {p.nombre} y el margen que se deja después, por evento. Lo que no ajustó usa la propuesta del evento.</p>
                                    <EditorSesiones eventos={ord(d, 'eventos').filter(e => !e.persona)} sesiones={p.sesiones} bloqueado={!puede}
                                        onCambio={sesiones => almacen.editar('personas', p.id, { sesiones }, true)} />
                                </div>
                            </>
                        ) : (
                            <>
                                {!puede && <p className="hor-ro"><Icono n="candado" s={14} />Solo lectura: {nombreSim(d, sim)} no puede cambiar este horario.</p>}
                                <HorarioEditor p={p} bloqueado={!puede} />
                            </>
                        )}
                </div>
            </Modal>
        );
    }
    return (
        <>
            <span ref={ancla} hidden />
            {modal && (raiz ? createPortal(modal, raiz) : modal)}
        </>
    );
}
