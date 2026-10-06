// Configuración de un evento: General, Disponibilidad, Página de reserva, eliminar y la Revisión al costado.

import { useState } from 'react';
import { DURACIONES, TZ_DEF, ZONAS } from '../../core/catalogos';
import { buscar, closers, colorVar, nombreOrigen, ord } from '../../core/datos';
import { linkEvento, revision, slugLibre } from '../../core/eventos';
import { fechaOk, urlOk } from '../../core/normalizar';
import { claveDia, gmtTxt } from '../../core/tiempo';
import { clonar, entero, slugify } from '../../core/util';
import { almacen, useDatos, usePermisos } from '../../data/hooks';
import { Avatar, HUMO_MARCA, Humo, Icono, MeetLogo, Seg, Sx } from '../../ui/base';
import { ui } from '../../ui/estadoUi';
import { copiarTexto, toast } from '../../ui/toast';
import EditorDescripcion from './EditorDescripcion';
import { InputVivo, slugOrigen, urlPublica, useBorrador } from './comun';

const PASOS = [5, 10, 15, 20, 30, 45, 60];
const DIA = 86400000;

// Edita una parte de un campo compuesto (reservas, antel, paso, zona) partiendo del valor más reciente.
function setEv(id, campo, k, v, ya) {
    const e = buscar(almacen.getState().d, 'eventos', id);
    if (!e) return;
    almacen.editar('eventos', id, { [campo]: { ...clonar(e[campo]), [k]: v } }, ya);
}

function Fila({ l, cls, children }) {
    return <div className={'ffila' + (cls ? ' ' + cls : '')}><span>{l}</span><div>{children}</div></div>;
}
function Bloque({ tit, icono, i, children }) {
    const cols = i % 2 ? ['var(--brand-primary)', 'var(--brand-navy)', 'var(--brand-secondary)', 'var(--brand-navy)'] : HUMO_MARCA;
    return (
        <section className="panel caja ev-bloque" style={{ overflow: 'hidden' }}>
            <Humo clase="humo--tarjeta humo--suave" cols={cols} />
            <h2 className="ev-bloque-tit"><Icono n={icono} s={15} />{tit}</h2>
            <div className="form-filas">{children}</div>
        </section>
    );
}
function Num({ id, valor, min, max, label, onGuardar }) {
    return (
        <InputVivo className="input input--num num" type="number" inputMode="numeric" id={id} min={min} max={max} aria-label={label}
            valor={String(valor)} guardar={t => { const v = t.trim(); if (v === '') return false; onGuardar(entero(v, min, max, min)); }} />
    );
}

// Lo que el lead lee en su invitación de Google Calendar: qué tener listo para la sesión. Texto
// plano; vacío usa un texto genérico (operacion.INDICACIONES_POR_DEFECTO). Sus datos y respuestas
// no van en la invitación.
function IndicacionesVivas({ e }) {
    const b = useBorrador(e.indic || '');
    return (
        <div style={{ flex: '1 1 100%', minWidth: 0 }}>
            <textarea id="ev-indic" className="input" rows={4} maxLength={2000} aria-label="Indicaciones para el lead"
                placeholder="Ej.: Tené a mano tu último resumen de ingresos y conectate desde una computadora."
                value={b.value} style={{ width: '100%', resize: 'vertical' }}
                onChange={ev => { b.set(ev.target.value); almacen.editar('eventos', e.id, { indic: ev.target.value }); }}
                onBlur={() => { b.soltar(); almacen.flush(); }} />
            <p className="t-xs mut" style={{ marginTop: 4 }}>Van en la invitación de Google Calendar que recibe el lead.</p>
        </div>
    );
}

function General({ d, e, f, cm }) {
    const fs = ord(d, 'funnels'), fos = ord(d, 'formularios');
    const cambiarFunnel = (v) => {
        // El link cambia de funnel: el slug tiene que seguir siendo único en el nuevo.
        almacen.editar('eventos', e.id, { funnel: v, slug: slugLibre(d, { ...e, funnel: v }, e.slug) }, true);
    };
    const asignar = (v) => {
        if (v === 'persona' && !e.persona) {
            const c0 = closers(d)[0];
            if (!c0) { toast('Primero sumá un closer en Team.', 'error'); return; }
            almacen.editar('eventos', e.id, { persona: c0.id }, true);
        }
        if (v === 'form' && e.persona) almacen.editar('eventos', e.id, { persona: '' }, true);
    };
    return (
        <>
            <Fila l="Nombre">
                <InputVivo id="ev-nombre" maxLength={80} aria-label="Nombre" valor={e.nombre}
                    guardar={t => { almacen.editar('eventos', e.id, { nombre: t.trim() || 'Sin nombre' }); }} />
            </Fila>
            <Fila l="Funnel">
                <Sx id="ev-funnel" label="Funnel" valor={e.funnel} onChange={cambiarFunnel}
                    opciones={[{ v: '', n: 'Elegí funnel', icono: 'funnel', color: 'var(--idle)' }]
                        .concat(fs.map(x => ({ v: x.id, n: x.nombre + (x.activo ? '' : ' (pausado)'), icono: 'funnel', color: colorVar(x.color) })))} />
            </Fila>
            <Fila l="Formulario">
                <Sx id="ev-form" label="Formulario" valor={e.formulario} onChange={v => almacen.editar('eventos', e.id, { formulario: v }, true)}
                    opciones={[{ v: '', n: 'Elegí formulario', icono: 'form', color: 'var(--idle)' }]
                        .concat(fos.map(x => ({ v: x.id, n: x.nombre, icono: 'form', color: 'var(--info)' })))} />
            </Fila>
            <Fila l="Duración">
                <Seg sm label="Duración" valor={e.duracion} onChange={v => almacen.editar('eventos', e.id, { duracion: v }, true)}
                    opciones={DURACIONES.map(m => ({ v: m, n: m + ' min' }))} />
            </Fila>
            <Fila l="Indicaciones" cls="ffila--top">
                <IndicacionesVivas e={e} />
            </Fila>
            <Fila l="Link" cls="ffila--top">
                <div className="entrada" style={{ flex: '1 1 100%', minWidth: 0 }}>
                    <span className="prefijo"><Icono n="link" />/agenda/{f ? f.slug + '/' : ''}</span>
                    <InputVivo className="" id="ev-slug" maxLength={60} spellCheck={false} aria-label="Link" valor={e.slug}
                        guardar={t => {
                            const sl = slugify(t); if (!sl) return false;
                            const libre = slugLibre(d, e, sl);
                            almacen.editar('eventos', e.id, { slug: libre });
                            if (libre !== sl) toast('Ese link ya existe: quedó /' + libre);
                        }} />
                </div>
                {f && f.origenes.length ? (
                    <div className="ev-origenes">
                        {f.origenes.map(o => {
                            const u = linkEvento(d, e) + '?o=' + slugOrigen(d, o), p = o.setter && buscar(d, 'personas', o.setter);
                            return (
                                <button key={o.id} type="button" className="ev-o" data-nav="" title={'Copiar ' + u} onClick={() => copiarTexto(urlPublica(d, e, o))}>
                                    {p ? <Avatar p={p} clase="avatar--xs" /> : <Icono n="link" s={13} />}
                                    <b>{nombreOrigen(d, o)}</b><span>?o={slugOrigen(d, o)}</span><Icono n="copiar" s={13} />
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <button type="button" className="link-btn link-btn--sutil" onClick={() => ui.set({ conf: { tab: 'funnels' } })}>
                        <Icono n="plus" />Links por procedencia
                    </button>
                )}
            </Fila>
            {!cm && (
                <Fila l="Asignación">
                    <Seg sm label="Asignación" valor={e.persona ? 'persona' : 'form'} onChange={asignar}
                        opciones={[{ v: 'form', n: 'Según el formulario', icono: 'form' }, { v: 'persona', n: 'Persona fija', icono: 'user' }]} />
                    {e.persona && (
                        <Sx id="ev-persona" label="Persona" valor={e.persona} onChange={v => almacen.editar('eventos', e.id, { persona: v }, true)}
                            opciones={closers(d).map(x => ({ v: x.id, n: x.nombre }))} />
                    )}
                </Fila>
            )}
            <Fila l="Recibe agendas">
                <button type="button" className="switch" role="switch" aria-checked={e.activo} aria-label="Recibe agendas"
                    onClick={() => almacen.editar('eventos', e.id, { activo: !e.activo }, true)} />
            </Fila>
        </>
    );
}

function Disponibilidad({ e }) {
    const r = e.reservas, pm = e.paso.n * (e.paso.u === 'h' ? 60 : 1);
    const rangoMal = !!(r.desde && r.hasta && r.hasta < r.desde);
    const pasoSel = e.paso.pers || e.paso.u !== 'min' || !PASOS.includes(pm) ? 'pers' : String(pm);
    const modo = (v) => {
        const rr = { ...clonar(r), modo: v };
        if (v === 'rango' && !rr.desde) { rr.desde = claveDia(Date.now(), TZ_DEF); rr.hasta = claveDia(Date.now() + 30 * DIA, TZ_DEF); }
        almacen.editar('eventos', e.id, { reservas: rr }, true);
    };
    return (
        <>
            <Fila l="Reservas">
                <Seg sm label="Hasta cuándo" valor={r.modo} onChange={modo}
                    opciones={[{ v: 'dias', n: 'Próximos días' }, { v: 'rango', n: 'Entre fechas' }, { v: 'siempre', n: 'Sin límite' }]} />
                {r.modo === 'dias' && (
                    <div className="combo">
                        <Num id="ev-rn" valor={r.n} min={1} max={365} label="Días" onGuardar={v => setEv(e.id, 'reservas', 'n', v)} />
                        <Sx sm id="ev-rtipo" label="Tipo de días" valor={r.tipo} onChange={v => setEv(e.id, 'reservas', 'tipo', v, true)}
                            opciones={[{ v: 'corridos', n: 'días corridos' }, { v: 'habiles', n: 'días hábiles' }]} />
                    </div>
                )}
                {r.modo === 'rango' && (
                    <div className="combo">
                        <input className={'input input--fecha' + (rangoMal ? ' mal' : '')} type="date" id="ev-rdesde" value={r.desde} aria-label="Desde"
                            onChange={ev => setEv(e.id, 'reservas', 'desde', fechaOk(ev.target.value), true)} />
                        <span className="combo-t">a</span>
                        <input className={'input input--fecha' + (rangoMal ? ' mal' : '')} type="date" id="ev-rhasta" value={r.hasta} aria-label="Hasta"
                            onChange={ev => setEv(e.id, 'reservas', 'hasta', fechaOk(ev.target.value), true)} />
                    </div>
                )}
            </Fila>
            <Fila l="Antelación">
                <div className="combo">
                    <Num id="ev-an" valor={e.antel.n} min={0} max={999} label="Antelación mínima" onGuardar={v => setEv(e.id, 'antel', 'n', v)} />
                    <Sx sm id="ev-au" label="Unidad" valor={e.antel.u} onChange={v => setEv(e.id, 'antel', 'u', v, true)}
                        opciones={[{ v: 'min', n: 'minutos' }, { v: 'h', n: 'horas' }, { v: 'd', n: 'días' }]} />
                    <span className="combo-t">antes</span>
                </div>
            </Fila>
            <Fila l="Intervalos">
                <Sx id="ev-paso" label="Intervalo entre horarios" valor={pasoSel}
                    onChange={v => almacen.editar('eventos', e.id, { paso: v === 'pers' ? { n: e.paso.n, u: e.paso.u, pers: true } : { n: +v, u: 'min', pers: false } }, true)}
                    opciones={PASOS.map(m => ({ v: String(m), n: 'Cada ' + m + ' min', icono: 'clock', color: 'var(--info)' }))
                        .concat([{ v: 'pers', n: 'Personalizado', icono: 'edit', color: 'var(--brand-secondary)' }])} />
                {pasoSel === 'pers' && (
                    <div className="combo">
                        <span className="combo-t">Cada</span>
                        <Num id="ev-pn" valor={e.paso.n} min={1} max={720} label="Intervalo" onGuardar={v => setEv(e.id, 'paso', 'n', v)} />
                        <Sx sm id="ev-pu" label="Unidad" valor={e.paso.u} onChange={v => setEv(e.id, 'paso', 'u', v, true)}
                            opciones={[{ v: 'min', n: 'minutos' }, { v: 'h', n: 'horas' }]} />
                    </div>
                )}
            </Fila>
        </>
    );
}

function Pagina({ e, integ }) {
    const redir = useBorrador(e.redir);
    const redirMal = redir.escribiendo && !!redir.value.trim() && !urlOk(redir.value.trim());
    return (
        <>
            <Fila l="Zona horaria">
                <Seg sm label="Zona horaria" valor={e.zona.modo} onChange={v => setEv(e.id, 'zona', 'modo', v, true)}
                    opciones={[{ v: 'auto', n: 'La del lead', icono: 'globo' }, { v: 'fija', n: 'Fija', icono: 'candado' }]} />
                {e.zona.modo === 'fija' && (
                    <Sx sm id="ev-ztz" label="Zona fija" valor={e.zona.tz} onChange={v => setEv(e.id, 'zona', 'tz', v, true)}
                        opciones={ZONAS.map(z => ({ v: z.tz, n: z.n + ' · ' + gmtTxt(z.tz) }))} />
                )}
            </Fila>
            <Fila l="Ubicación">
                <span className="meet"><MeetLogo /><b>Google Meet</b></span>
                {integ.meet.activo
                    ? <span className="chip chip--n" style={{ '--c': 'var(--success)' }}><Icono n="check" />Automático</span>
                    : <button type="button" className="link-btn" onClick={() => ui.set({ conf: { tab: 'integraciones' } })}><Icono n="enchufe" />Conectar</button>}
            </Fila>
            <Fila l="Redirigir a">
                <div className={'entrada' + (redirMal ? ' mal' : '')} style={{ flex: 1, minWidth: 0 }}>
                    <span className="prefijo"><Icono n="link" /></span>
                    <input id="ev-redir" type="url" inputMode="url" maxLength={500} spellCheck={false} placeholder="https://… (opcional)"
                        aria-label="Link después de agendar" aria-invalid={redirMal} value={redir.value}
                        onChange={ev => {
                            const t = ev.target.value, u = t.trim();
                            redir.set(t);
                            if (!u || urlOk(u)) almacen.editar('eventos', e.id, { redir: urlOk(u) });
                        }}
                        onBlur={() => { redir.soltar(); almacen.flush(); }} />
                </div>
            </Fila>
            <Fila l="Descripción" cls="ffila--top"><EditorDescripcion e={e} /></Fila>
        </>
    );
}

export default function ConfigEvento({ e }) {
    const { d, integ } = useDatos();
    const { modoCloser: cm } = usePermisos();
    const [borrar, setBorrar] = useState(false);
    const f = buscar(d, 'funnels', e.funnel);
    const eliminar = () => {
        almacen.flush();
        ui.set({ ev: null });
        almacen.borrar('eventos', e.id);
        toast(e.nombre + ' eliminado');
    };
    return (
        <div className="ev-grid">
            <div className="ev-col">
                <Bloque tit="General" icono="ajustes" i={0}><General d={d} e={e} f={f} cm={cm} /></Bloque>
                <Bloque tit="Disponibilidad" icono="calendar" i={1}><Disponibilidad e={e} /></Bloque>
                <Bloque tit="Página de reserva" icono="monitor" i={2}><Pagina e={e} integ={integ} /></Bloque>
                {borrar ? (
                    <div className="ed-pie--borrar">
                        <p className="t-sm">¿Eliminar <b>{e.nombre}</b>? El link deja de funcionar.</p>
                        <div className="der">
                            <button type="button" className="btn btn--linea btn--sm" autoFocus onClick={() => setBorrar(false)}>Cancelar</button>
                            <button type="button" className="btn btn--borrar btn--sm" onClick={eliminar}><Icono n="basura" />Eliminar</button>
                        </div>
                    </div>
                ) : (
                    <div><button type="button" className="btn btn--peligro btn--sm" onClick={() => setBorrar(true)}><Icono n="basura" />Eliminar evento</button></div>
                )}
            </div>
            <aside className="panel panel--sm caja ev-rev" style={{ overflow: 'hidden' }} aria-label="Revisión">
                <Humo clase="humo--tarjeta humo--suave" cols={['var(--success)', 'var(--brand-primary)', 'var(--brand-secondary)', 'var(--brand-navy)']} />
                <div className="panel-cab"><span className="t-rotulo">Revisión</span></div>
                {revision(d, e).map((c, i) => (
                    <div key={i} className="check" style={{ '--c': c[0] ? 'var(--success)' : 'var(--warning)' }}>
                        <Icono n={c[0] ? 'check' : 'alerta'} />
                        <div><b>{c[1]}</b><span>{c[2]}</span></div>
                    </div>
                ))}
            </aside>
        </div>
    );
}
