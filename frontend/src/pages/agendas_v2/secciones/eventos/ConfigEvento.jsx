// Configuración de un evento: General, Disponibilidad, Sesiones de cada closer, Página de reserva, eliminar,
// la Revisión al costado y, abajo, los turnos de la semana de cada closer en este evento.
// En un funnel de setting el link muestra los de cada setter; en los otros, los links por procedencia.

import { useState } from 'react';
import { TZ_DEF, ZONAS } from '../../core/catalogos';
import { buscar, closers, colorVar, horasSemana, nombreOrigen, ord } from '../../core/datos';
import { linkEvento, revision, slugLibre } from '../../core/eventos';
import { fechaOk, urlOk } from '../../core/normalizar';
import { claveDia, gmtTxt } from '../../core/tiempo';
import { clonar, entero, slugify } from '../../core/util';
import { almacen, useDatos, usePermisos } from '../../data/hooks';
import { Avatar, HUMO_MARCA, Humo, Icono, Seg, Sx } from '../../ui/base';
import { ui } from '../../ui/estadoUi';
import { copiarTexto, toast } from '../../ui/toast';
import { ModalNoCalifica } from '../forms/Modales';
import { CampoMinutos, SesionesDelEvento } from '../team/Sesiones';
import TablaTurnos from '../team/Turnos.jsx';
import { abrirGracias } from '../forms/ListaGracias';
import { InputVivo, LinksSetters, slugOrigen, urlPublica, useBorrador } from './comun';
import { Button, ConfirmDelete, Input, InputGroup, LinkButton } from '../../../../components/standard';

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
        <InputVivo variant="number" className="num" type="number" inputMode="numeric" id={id} min={min} max={max} aria-label={label}
            valor={String(valor)} guardar={t => { const v = t.trim(); if (v === '') return false; onGuardar(entero(v, min, max, min)); }} />
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
                <CampoMinutos id="ev-dur" label="Duración" valor={e.duracion} onCambio={v => almacen.editar('eventos', e.id, { duracion: v }, true)} />
                {!e.persona && <span className="t-sm mut">Propuesta: cada closer la puede ajustar.</span>}
            </Fila>
            <Fila l="Margen">
                <CampoMinutos margen id="ev-margen" label="Margen" valor={e.margen} onCambio={v => almacen.editar('eventos', e.id, { margen: v }, true)} />
                <span className="t-sm mut">Después de cada sesión, para poder extenderla. Bloquea la agenda; el lead no lo ve.</span>
            </Fila>
            <Fila l="Link" cls="ffila--top">
                <InputGroup prefix={<><Icono n="link" />/agenda/{f ? f.slug + '/' : ''}</>} style={{ flex: '1 1 100%', minWidth: 0 }}>
                    <InputVivo bare id="ev-slug" maxLength={60} spellCheck={false} aria-label="Link" valor={e.slug}
                        guardar={t => {
                            const sl = slugify(t); if (!sl) return false;
                            const libre = slugLibre(d, e, sl);
                            almacen.editar('eventos', e.id, { slug: libre });
                            if (libre !== sl) toast('Ese link ya existe: quedó /' + libre);
                        }} />
                </InputGroup>
                {f && f.setting ? <LinksSetters d={d} e={e} /> : f && f.origenes.length ? (
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
                    <LinkButton icon={<Icono n="plus" />} onClick={() => ui.set({ funnel: { id: e.funnel } })}>
                        Links por procedencia
                    </LinkButton>
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
        </>
    );
}

function Disponibilidad({ e }) {
    const r = e.reservas;
    const rangoMal = !!(r.desde && r.hasta && r.hasta < r.desde);
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
                        <Input variant="date" invalid={rangoMal} type="date" id="ev-rdesde" value={r.desde} aria-label="Desde"
                            onChange={ev => setEv(e.id, 'reservas', 'desde', fechaOk(ev.target.value), true)} />
                        <span className="combo-t">a</span>
                        <Input variant="date" invalid={rangoMal} type="date" id="ev-rhasta" value={r.hasta} aria-label="Hasta"
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
            <Fila l="Horarios">
                <span className="t-sm mut">Uno tras otro, con la sesión y el margen de cada closer: así le entran la mayor cantidad de agendas.</span>
            </Fila>
        </>
    );
}

function Pagina({ d, e }) {
    const redir = useBorrador(e.redir);
    const [fin, setFin] = useState(false);
    const fo = buscar(d, 'formularios', e.formulario);
    const redirMal = redir.escribiendo && !!redir.value.trim() && !urlOk(redir.value.trim());
    const gs = ord(d, 'gracias'), gracias = buscar(d, 'gracias', e.gracias);
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
            {/* La página de gracias va en vivo: elegirla no pide volver a publicar. Si hay una, manda sobre «Redirigir a». */}
            <Fila l="Página de gracias">
                <Sx sm id="ev-gracias" label="Página de gracias" valor={gracias ? e.gracias : ''}
                    style={{ flex: '1 1 200px', minWidth: 0 }}
                    onChange={v => { almacen.editar('eventos', e.id, { gracias: v }); almacen.flush(); }}
                    opciones={[{ v: '', n: 'Ninguna' }, ...gs.map(g => ({ v: g.id, n: g.nombre, icono: 'video' }))]} />
                {gracias
                    ? <Button icon={<Icono n="edit" />} onClick={() => abrirGracias(gracias.id)}>Editar</Button>
                    : !gs.length && <Button icon={<Icono n="plus" />} onClick={() => ui.set({ seccion: 'preguntas', recurso: 'gracias', ev: null })}>Crear una</Button>}
            </Fila>
            <Fila l="Redirigir a">
                <InputGroup invalid={redirMal} prefix={<Icono n="link" />} style={{ flex: 1, minWidth: 0 }}>
                    <input id="ev-redir" type="url" inputMode="url" maxLength={500} spellCheck={false} placeholder="https://… (opcional)"
                        aria-label="Link después de agendar" aria-invalid={redirMal} value={redir.value}
                        onChange={ev => {
                            const t = ev.target.value, u = t.trim();
                            redir.set(t);
                            if (!u || urlOk(u)) almacen.editar('eventos', e.id, { redir: urlOk(u) });
                        }}
                        onBlur={() => { redir.soltar(); almacen.flush(); }} />
                </InputGroup>
                {gracias && e.redir && <span className="t-sm mut">No se usa: el lead va a la página de gracias.</span>}
            </Fila>
            <Fila l="Si no califica">
                {fo ? (
                    <>
                        <span className="t-sm trunc" style={{ flex: '1 1 160px' }}>«{fo.fin.titulo}»</span>
                        <Button icon={<Icono n="edit" />} onClick={() => setFin(true)}>Editar</Button>
                    </>
                ) : <span className="t-sm mut">Elegí un formulario.</span>}
            </Fila>
            {fin && fo && <ModalNoCalifica f={fo} onCerrar={() => setFin(false)} />}
        </>
    );
}

export default function ConfigEvento({ e }) {
    const { d } = useDatos();
    const { modoCloser: cm } = usePermisos();
    const [borrar, setBorrar] = useState(false);
    const f = buscar(d, 'funnels', e.funnel);
    // Si es el único agendamiento del funnel, el funnel quedaría sin generar agendas: se ofrece borrarlo
    // también (el closer no maneja funnels).
    const ultimo = !cm && f && !d.eventos.some(o => o.id !== e.id && o.funnel === f.id);
    const eliminar = (conFunnel) => {
        almacen.flush();
        ui.set({ ev: null });
        almacen.borrar('eventos', e.id);
        if (conFunnel) almacen.borrar('funnels', f.id);
        toast(conFunnel ? e.nombre + ' y ' + f.nombre + ' eliminados' : e.nombre + ' eliminado');
    };
    const personas = e.persona ? [buscar(d, 'personas', e.persona)].filter(Boolean) : closers(d).filter(p => horasSemana(p) > 0);
    return (
        <div className="ev-conf">
            <div className="ev-grid ev-grid--3">
                <div className="ev-col">
                    <Bloque tit="General" icono="ajustes" i={0}><General d={d} e={e} f={f} cm={cm} /></Bloque>
                    {borrar ? (
                        <ConfirmDelete name={e.nombre} detail="El link deja de funcionar." icon={<Icono n="basura" />}
                            onCancel={() => setBorrar(false)} onConfirm={() => eliminar(!!ultimo)} confirmLabel={ultimo ? 'Eliminar evento y funnel' : 'Eliminar'}
                            extraActions={ultimo && <Button onClick={() => eliminar(false)}>Solo el evento</Button>}>
                            {ultimo && <p className="t-sm">Es el único agendamiento de <b>{f.nombre}</b>: sin él, el funnel no genera agendas.</p>}
                        </ConfirmDelete>
                    ) : (
                        <div><Button variant="danger" icon={<Icono n="basura" />} onClick={() => setBorrar(true)}>Eliminar evento</Button></div>
                    )}
                </div>
                <div className="ev-col">
                    <Bloque tit="Disponibilidad" icono="calendar" i={1}><Disponibilidad e={e} /></Bloque>
                    {!e.persona && !cm && (
                        <Bloque tit="Sesiones de cada closer" icono="clock" i={0}>
                            <p className="t-sm mut">Lo que cada uno ajustó sobre la propuesta. Lo podés personalizar acá.</p>
                            <SesionesDelEvento e={e} personas={closers(d)} onCambio={(p, sesiones) => almacen.editar('personas', p.id, { sesiones }, true)} />
                        </Bloque>
                    )}
                    <Bloque tit="Página de reserva" icono="monitor" i={2}><Pagina d={d} e={e} /></Bloque>
                </div>
                <aside className="panel panel--sm caja ev-rev" style={{ overflow: 'hidden' }} aria-label="Revisión">
                    <Humo clase="humo--tarjeta humo--suave" cols={['var(--success)', 'var(--brand-primary)', 'var(--brand-secondary)', 'var(--brand-navy)']} />
                    <div className="panel-cab"><span className="t-rotulo">Revisión</span></div>
                    {revision(d, e).filter((c, i) => i > 0 || !c[0]).map((c, i) => (
                        <div key={i} className="check" style={{ '--c': c[0] ? 'var(--success)' : 'var(--warning)' }}>
                            <Icono n={c[0] ? 'check' : 'alerta'} />
                            <div><b>{c[1]}</b><span>{c[2]}</span></div>
                        </div>
                    ))}
                </aside>
            </div>
            <Bloque tit="Turnos de la semana" icono="users" i={1}>
                <TablaTurnos evento={e} personas={personas} />
            </Bloque>
        </div>
    );
}
