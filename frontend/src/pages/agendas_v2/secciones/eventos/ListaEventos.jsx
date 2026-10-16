// Lista de eventos (el eje de Agendamiento, como Thalamus): agrupada por funnel, por formulario o toda
// junta, con la caja para crear uno. Cada tarjeta dice lo que le falta y, en un funnel de setting, los
// links de cada setter. El funnel se crea y se edita desde acá (ModalFunnel).
// En la vista de closer solo aparecen sus eventos propios, sin agrupar. En solo lectura (el setter) no
// se crea ni se edita nada: quedan los eventos, sus links y la prueba.

import React, { useRef, useState } from 'react';
import { buscar, colorVar, nombreGrupo, ord } from '../../core/datos';
import { estadoEvento, linkEvento } from '../../core/eventos';
import { gruposDeForm } from '../../core/formulario';
import { useDatos, usePermisos, useUi } from '../../data/hooks';
import { HUMO_MARCA, Humo, Icono } from '../../ui/base';
import { ui } from '../../ui/estadoUi';
import { Button, Card, Chip, EmptyState, FieldError, Grid, HeaderActions, IconButton, InputGroup, Segmented } from '../../../../components/standard';
import { EstadoEv, LinksSetters, PasosPendientes, abrirEvento, copiarLink, crearEvento, probarEvento, probarSegmento, settersDe, useSetters } from './comun';
import { urlPrueba } from '../../reserva/segmentos';
import { copiarTexto } from '../../ui/toast';

const AGRUPAR = [['funnel', 'Funnels', 'funnel'], ['formulario', 'Forms', 'form'], ['nada', 'All', 'lista']];
const TIPO = { workshop: 'Workshop', vsl: 'VSL', setting: 'Setting', otro: 'Otro' };

function ErrNuevo({ err, clase }) {
    return (
        <p className={clase} id="nuevo-err" role="alert" hidden={!err}>
            {err && <><Icono n="alerta" s={14} /><span>{err}</span></>}
        </p>
    );
}

// Caja grande para crear el primer evento.
function Compo({ cm, onCrear, err }) {
    const inp = useRef(null);
    return (
        <section className="compo caja compo--solo">
            <Humo clase="humo--hero" cols={HUMO_MARCA} />
            <div className="compo-txt">
                <span className="compo-icono"><Icono n="plus" s={19} /></span>
                <div style={{ display: 'grid', gap: 4 }}><h2 className="t-h3">{cm ? 'Creá tu primer evento propio' : 'Creá tu primer evento'}</h2></div>
            </div>
            <div className="compo-accion">
                <InputGroup as="form" noValidate onSubmit={ev => { ev.preventDefault(); onCrear(inp.current.value); }}>
                    <label className="sr" htmlFor="nuevo-nombre">Nuevo evento</label>
                    <input ref={inp} id="nuevo-nombre" type="text" maxLength={80} autoComplete="off" placeholder="Nombre, ej. Diagnóstico Workshop"
                        aria-describedby="nuevo-err" aria-invalid={!!err} />
                    <Button variant="primary" icon={<Icono n="plus" />} type="submit">Crear</Button>
                </InputGroup>
                <FieldError id="nuevo-err" hidden={!err}>{err && <span>{err}</span>}</FieldError>
            </div>
        </section>
    );
}

function TarjetaEvento({ d, e }) {
    const { lectura } = usePermisos();
    const f = buscar(d, 'funnels', e.funnel), fo = buscar(d, 'formularios', e.formulario);
    const pfx = e.persona && buscar(d, 'personas', e.persona);
    let rut = pfx ? [pfx.nombre + ' (fijo)'] : gruposDeForm(fo).map(id => nombreGrupo(d, id));
    if (!rut.length) rut = ['Sin segmentación'];
    const cc = f ? colorVar(f.color) : 'var(--brand-secondary)';
    return (
        <Card as="article" className="ev-card" data-id={e.id} aura={[cc, 'var(--brand-primary)', cc, 'var(--brand-navy)']} soft>
            <div className="ev-fila">
                <button type="button" className="ev-nom" data-nav="" onClick={() => abrirEvento(e.id)}>{e.nombre}</button>
                <EstadoEv est={estadoEvento(e, fo)} />
            </div>
            <div className="ev-fila"><span className="ev-link"><Icono n="link" /><span>{linkEvento(d, e)}</span></span></div>
            {f && f.setting && <LinksSetters d={d} e={e} compacto />}
            <PasosPendientes d={d} e={e} />
            <div className="ev-fila">
                {f ? <Chip color={colorVar(f.color)} subtle>{f.nombre}</Chip>
                    : <Chip color="var(--warning)">Sin funnel</Chip>}
                {fo ? <Chip color="var(--info)" subtle icon={<Icono n="form" />}>{fo.nombre}</Chip>
                    : <Chip color="var(--warning)">Sin formulario</Chip>}
                <Chip color="var(--brand-secondary)" subtle icon={<Icono n="rayo" />}>{rut.join(' · ')}</Chip>
                <Chip color="var(--idle)" subtle>{e.duracion} min</Chip>
                <div className="barra-der">
                    <IconButton label={'Copiar link de ' + e.nombre} icon={<Icono n="copiar" s={15} />} size="sm" data-nav="" title="Copiar link" onClick={() => copiarLink(d, e)} />
                    <IconButton label={'Probar ' + e.nombre} icon={<Icono n="play" s={15} />} size="sm" data-nav="" title="Probar" onClick={() => probarEvento(d, e)} />
                    {!lectura && (
                        <>
                            <IconButton label={'Copiar enlace de prueba de ' + e.nombre} icon={<Icono n="link" s={15} />} size="sm" data-nav="" title="Copiar enlace de prueba por segmento"
                                onClick={() => copiarTexto(urlPrueba(e.id), 'Enlace de prueba copiado')} />
                            <Button icon={<Icono n="users" />} data-nav="" title="Saltear el formulario y ver lo que vería el lead de cada segmentación" onClick={() => probarSegmento(e)}>
                                Probar segmento
                            </Button>
                        </>
                    )}
                    <Button icon={<Icono n={lectura ? 'ojo' : 'edit'} />} data-nav="" onClick={() => abrirEvento(e.id)}>Abrir</Button>
                </div>
            </div>
        </Card>
    );
}

// En el título de cada funnel: si recibe agendas y, si es de setting, quiénes son sus setters.
function EstadoFunnel({ f }) {
    const sts = useSetters();
    const suyos = f.setting ? settersDe(f, sts) : null;
    return (
        <>
            <EstadoEv est={f.activo ? { n: 'Activo', c: 'var(--success)' } : { n: 'Pausado', c: 'var(--idle)' }} />
            {f.setting && (
                <Chip color="var(--brand-secondary)" subtle icon={<Icono n="users" s={13} />} title="Setters de este funnel">
                    
                    {suyos === null ? 'Setters…' : !suyos.length ? 'Sin setters' : suyos.length > 3 ? suyos.length + ' setters' : suyos.map(x => x.nombre).join(', ')}
                </Chip>
            )}
        </>
    );
}

export default function ListaEventos() {
    const { d } = useDatos();
    const { evAgrupar } = useUi();
    const { modoCloser: cm, lectura } = usePermisos();
    const [err, setErr] = useState('');
    const inp = useRef(null);
    const es = ord(d, 'eventos').filter(e => !cm || e.persona === cm.id);
    const crear = (v) => {
        const m = crearEvento(d, v, { cm }) ? '' : 'Escribí un nombre.';
        setErr(m);
        if (!m && inp.current) inp.current.value = '';
    };

    if (!es.length) {
        return lectura ? <EmptyState>Todavía no hay eventos.</EmptyState>
            : <Compo cm={cm} onCrear={crear} err={err} />;
    }

    const agrupar = cm ? 'nada' : (evAgrupar || 'funnel');
    const grupos = new Map();
    es.forEach(e => {
        const k = agrupar === 'funnel' ? e.funnel : agrupar === 'formulario' ? e.formulario : 'todo';
        if (!grupos.has(k)) grupos.set(k, []);
        grupos.get(k).push(e);
    });
    // Un funnel sin agendamientos no genera agendas: aparece igual, con lo que le falta como acción.
    if (agrupar === 'funnel') ord(d, 'funnels').forEach(f => { if (!grupos.has(f.id)) grupos.set(f.id, []); });

    return (
        <>
            <HeaderActions>
                <div className="ev-top">
                    {cm && <span className="ev-mios"><Icono n="user" s={14} />Tus eventos</span>}
                    <Segmented hidden={!!cm} size="sm" className="ev-agr" label="Agrupar" itemProps={{ 'data-nav': '' }} value={agrupar} onChange={v => ui.set({ evAgrupar: v })}
                        prefix={<span className="ev-agr-ico" title="Agrupar"><Icono n="capas" s={15} /></span>}
                        options={AGRUPAR.map(o => ({ value: o[0], label: o[1], icon: <Icono n={o[2]} s={13} /> }))} />
                    {!cm && !lectura && <Button icon={<Icono n="funnel" />} onClick={() => ui.set({ funnel: {} })}>Nuevo funnel</Button>}
                    <InputGroup as="form" className="ev-nuevo" prefix={<Icono n="plus" />} hidden={lectura} noValidate onSubmit={ev => { ev.preventDefault(); crear(inp.current.value); }}>
                        <label className="sr" htmlFor="nuevo-nombre">Nuevo evento</label>
                        <input ref={inp} id="nuevo-nombre" type="text" maxLength={80} autoComplete="off" placeholder="Nuevo evento, ej. Diagnóstico Workshop"
                            aria-describedby="nuevo-err" aria-invalid={!!err} onChange={() => { if (err) setErr(''); }} />
                        <Button variant="primary" type="submit">Crear</Button>
                    </InputGroup>
                </div>
            </HeaderActions>
            <ErrNuevo err={err} clase="err-nuevo" />
            {[...grupos.entries()].map(([k, lista]) => {
                const ref = agrupar === 'nada' ? null : buscar(d, agrupar === 'funnel' ? 'funnels' : 'formularios', k);
                return (
                    <React.Fragment key={k || '-'}>
                        {agrupar !== 'nada' && (
                            <div className="ev-grupo-tit">
                                {agrupar === 'funnel' && ref ? <span className="cf-punto" style={{ '--c': colorVar(ref.color) }} /> : <Icono n={agrupar === 'funnel' ? 'funnel' : 'form'} />}
                                <span className="t-rotulo">{ref ? ref.nombre : 'Sin ' + agrupar}</span>
                                {agrupar === 'funnel' && ref && <Chip color="var(--idle)" subtle>{TIPO[ref.tipo] || 'Otro'}</Chip>}
                                {agrupar === 'funnel' && ref && <EstadoFunnel f={ref} />}
                                <span className="t-cap mut40">{lista.length}</span>
                                {agrupar === 'funnel' && ref && !lectura && (
                                    <IconButton label={'Editar funnel ' + ref.nombre} icon={<Icono n="ajustes" s={15} />} size="sm" title="Editar funnel"
                                        onClick={() => ui.set({ funnel: { id: ref.id } })} />
                                )}
                            </div>
                        )}
                        {lista.length ? <Grid variant="list">{lista.map(e => <TarjetaEvento key={e.id} d={d} e={e} />)}</Grid> : (
                            <Card className="ev-card ev-fila">
                                <span className="t-sm mut">Sin agendamientos: este funnel no genera agendas.</span>
                                <div className="barra-der" hidden={lectura}>
                                    <Button variant="primary" icon={<Icono n="plus" />} onClick={() => ui.set({ funnel: { id: ref.id } })}>
                                        Agregar agendamiento
                                    </Button>
                                </div>
                            </Card>
                        )}
                    </React.Fragment>
                );
            })}
        </>
    );
}
