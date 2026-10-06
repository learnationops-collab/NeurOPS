// Funnels: la pantalla de inicio de Agendamiento. El funnel es el contenedor: cada uno muestra su tipo,
// sus agendamientos (los eventos que viven adentro) y lo que le falta para recibir agendas, en el orden
// en que se arma: formulario → equipo → evento → publicado. Tocar un paso pendiente lleva a resolverlo.
// Los agendamientos se crean adentro de su funnel: no hay eventos sueltos. Los que quedaron sin funnel
// (de antes) se listan aparte para no perderlos.
// Formularios y Team son bibliotecas que se reutilizan entre funnels (sus secciones del dock).

import { useState } from 'react';
import { buscar, colorVar, maxOrden, ord } from '../../core/datos';
import { estadoFunnel, linkEvento, pasosAgendamiento, slugLibre } from '../../core/eventos';
import { slugify } from '../../core/util';
import { almacen, useDatos } from '../../data/hooks';
import { HUMO_MARCA, Humo, Icono } from '../../ui/base';
import { ui } from '../../ui/estadoUi';
import { abrirEvento, copiarLink, probarEvento } from './comun';

const TIPO = { workshop: 'Workshop', vsl: 'VSL', setting: 'Setting', otro: 'Otro' };

function crearAgendamiento(d, f, nombre) {
    nombre = String(nombre || '').replace(/\s+/g, ' ').trim();
    if (!nombre) return;
    const fo = ord(d, 'formularios')[0];
    abrirEvento(almacen.crear('eventos', {
        nombre, funnel: f.id, formulario: fo ? fo.id : '', duracion: 45, activo: true, publicado: '',
        slug: slugLibre(d, { id: null, funnel: f.id }, slugify(nombre) || 'evento'), orden: maxOrden(d, 'eventos') + 1,
    }));
}

// A dónde lleva cada paso pendiente.
function irAlPaso(d, e, k) {
    const fo = buscar(d, 'formularios', e.formulario);
    if (k === 'equipo' && fo) {
        almacen.flush();
        ui.set({ seccion: 'preguntas', form: { id: fo.id, vista: 'ruteo', sel: null } });
        return;
    }
    abrirEvento(e.id);
}

function Agendamiento({ d, e }) {
    const pasos = pasosAgendamiento(d, e);
    return (
        <li className="fu-ag">
            <div className="fu-ag-cab">
                <button type="button" className="fu-ag-nom" data-nav="" onClick={() => abrirEvento(e.id)}>{e.nombre}</button>
                <span className="fu-ag-link t-xs mut">{linkEvento(d, e)}</span>
                <div className="barra-der">
                    <button type="button" className="ibtn ibtn--sm" aria-label={'Copiar link de ' + e.nombre} title="Copiar link" onClick={() => copiarLink(d, e)}><Icono n="copiar" s={15} /></button>
                    <button type="button" className="ibtn ibtn--sm" aria-label={'Probar ' + e.nombre} title="Probar" onClick={() => probarEvento(d, e)}><Icono n="play" s={15} /></button>
                </div>
            </div>
            <ol className="fu-pasos" aria-label={'Pasos de ' + e.nombre}>
                {pasos.map(p => (
                    <li key={p.k}>
                        <button type="button" className={'fu-paso' + (p.ok ? ' fu-paso--ok' : '')} title={p.det} onClick={() => irAlPaso(d, e, p.k)}>
                            <Icono n={p.ok ? 'check' : 'alerta'} s={13} />{p.n}
                        </button>
                    </li>
                ))}
            </ol>
        </li>
    );
}

function NuevoAgendamiento({ d, f }) {
    const [nombre, setNombre] = useState('');
    return (
        <form className="fu-nuevo" noValidate onSubmit={ev => { ev.preventDefault(); crearAgendamiento(d, f, nombre); setNombre(''); }}>
            <label className="sr" htmlFor={'fu-ag-' + f.id}>Nuevo agendamiento en {f.nombre}</label>
            <input id={'fu-ag-' + f.id} className="input" type="text" maxLength={80} autoComplete="off" placeholder="+ Agendamiento, ej. Llamada de diagnóstico"
                value={nombre} onChange={ev => setNombre(ev.target.value)} />
            <button type="submit" className="btn btn--linea btn--sm" disabled={!nombre.trim()}><Icono n="plus" />Crear</button>
        </form>
    );
}

function TarjetaFunnel({ d, f }) {
    const est = estadoFunnel(d, f);
    const eventos = ord(d, 'eventos').filter(e => e.funnel === f.id);
    return (
        <article className="tarjeta caja fu-card" style={{ '--c': colorVar(f.color) }} aria-label={'Funnel ' + f.nombre}>
            <Humo clase="humo--tarjeta humo--suave" cols={[colorVar(f.color), 'var(--brand-primary)', colorVar(f.color), 'var(--brand-navy)']} />
            <header className="fu-cab">
                <span className="cf-punto" aria-hidden="true" />
                <h3 className="t-h3 fu-nom">{f.nombre}</h3>
                <span className="chip chip--n" style={{ '--c': 'var(--brand-secondary)' }}>{TIPO[f.tipo] || 'Otro'}</span>
                {est.listo
                    ? <span className="chip chip--n" style={{ '--c': 'var(--success)' }}><Icono n="check" />Recibe agendas</span>
                    : <span className="chip" style={{ '--c': 'var(--warning)' }}><Icono n="alerta" />Falta configurar</span>}
                <div className="barra-der">
                    <button type="button" className="btn btn--linea btn--sm" onClick={() => ui.set({ funnel: { id: f.id } })}><Icono n="ajustes" />Funnel</button>
                </div>
            </header>
            {est.faltas.length > 0 && <p className="t-sm fu-faltas">{est.faltas.join(' · ')}</p>}
            {eventos.length > 0 && <ul className="fu-ags">{eventos.map(e => <Agendamiento key={e.id} d={d} e={e} />)}</ul>}
            <NuevoAgendamiento d={d} f={f} />
        </article>
    );
}

export default function ListaFunnels() {
    const { d } = useDatos();
    const fs = ord(d, 'funnels');
    const sueltos = ord(d, 'eventos').filter(e => !buscar(d, 'funnels', e.funnel));
    if (!fs.length && !sueltos.length) {
        return (
            <section className="compo caja compo--solo">
                <Humo clase="humo--hero" cols={HUMO_MARCA} />
                <div className="compo-txt">
                    <span className="compo-icono"><Icono n="funnel" s={19} /></span>
                    <div style={{ display: 'grid', gap: 4 }}>
                        <h2 className="t-h3">Creá tu primer funnel</h2>
                        <p className="t-sm mut">Adentro armás sus agendamientos: formulario, equipo y evento. Con IA sale todo de una.</p>
                    </div>
                </div>
                <div className="compo-accion"><button type="button" className="btn btn--cta btn--sm" onClick={() => ui.set({ funnel: {} })}><Icono n="plus" />Nuevo funnel</button></div>
            </section>
        );
    }
    return (
        <>
            <div className="ev-top">
                <button type="button" className="btn btn--cta btn--sm" onClick={() => ui.set({ funnel: {} })}><Icono n="plus" />Nuevo funnel</button>
            </div>
            <div className="fu-lista">
                {fs.map(f => <TarjetaFunnel key={f.id} d={d} f={f} />)}
                {sueltos.length > 0 && (
                    <article className="tarjeta caja fu-card" aria-label="Agendamientos sin funnel">
                        <header className="fu-cab">
                            <h3 className="t-h3 fu-nom">Sin funnel</h3>
                            <span className="chip" style={{ '--c': 'var(--warning)' }}><Icono n="alerta" />Elegiles un funnel</span>
                        </header>
                        <ul className="fu-ags">{sueltos.map(e => <Agendamiento key={e.id} d={d} e={e} />)}</ul>
                    </article>
                )}
            </div>
        </>
    );
}
