// Forms › Páginas de gracias: la grilla de páginas (lo que ve el lead después de agendar) con la caja
// para crear una. Son un recurso como los formularios: cada evento elige la suya.

import { useState } from 'react';
import { almacen, useDatos } from '../../data/hooks';
import { maxOrden, ord } from '../../core/datos';
import { HUMO_MARCA, Icono } from '../../ui/base';
import { ui } from '../../ui/estadoUi';
import { toast } from '../../ui/toast';
import { soltarVideo } from '../../data/videos';
import { VIDEOS_INICIALES, rutaGracias } from '../../reserva/gracias/contenido';
import Compo from './Compo';
import './gracias.css';
import { Button, Card, Chip, ConfirmDelete, Grid, IconButton } from '../../../../components/standard';

export function abrirGracias(id) {
    almacen.flush();
    ui.set({ seccion: 'preguntas', recurso: 'gracias', gracias: { id, pantalla: 'gracias' } });
    window.scrollTo({ top: 0 });
}

// Arranca con los videos de Learnation (los de la referencia) y los casos de la Academia.
export function crearGracias(nombre) {
    nombre = String(nombre || '').replace(/\s+/g, ' ').trim();
    if (!nombre) return 'Escribí un nombre.';
    const { d } = almacen.getState();
    const id = almacen.crear('gracias', {
        nombre, video: { url: VIDEOS_INICIALES.video }, plan: { url: VIDEOS_INICIALES.plan }, segundos: 5, casos: true,
        orden: maxOrden(d, 'gracias') + 1,
    });
    abrirGracias(id);
    return '';
}

// Borra la página, la saca de los eventos que la usaban y suelta sus videos (si no los usa otra).
export function borrarGracias(g) {
    const { d } = almacen.getState();
    d.eventos.forEach(ev => { if (ev.gracias === g.id) almacen.editar('eventos', ev.id, { gracias: '' }); });
    almacen.flush();
    almacen.borrar('gracias', g.id);
    [g.video.archivo, g.plan.archivo].forEach(a => soltarVideo(a, g.id));
    toast(g.nombre + ' eliminada');
}

export function ConfirmarBorrarGracias({ g, d, onCancelar, autoFocus = true }) {
    const n = d.eventos.filter(e => e.gracias === g.id).length;
    return (
        <ConfirmDelete name={g.nombre} detail={n ? 'La usa' + (n > 1 ? 'n ' + n + ' eventos' : ' 1 evento') + '.' : null} style={{ marginTop: 'auto' }}
            icon={<Icono n="basura" />} autoFocusCancel={autoFocus} onCancel={onCancelar} onConfirm={() => borrarGracias(g)} />
    );
}

// De dónde sale un video, para la tarjeta.
export function origenVideo(v) {
    return v.archivo ? { n: 'Subido', c: 'var(--success)' } : v.url ? { n: 'Link', c: 'var(--success)' } : { n: 'Sin video', c: 'var(--text-muted)' };
}

function Tarjeta({ g, d, borrando, setBorrando }) {
    const usan = d.eventos.filter(e => e.gracias === g.id).length;
    const ov = origenVideo(g.video), op = origenVideo(g.plan);
    return (
        <Card as="article" className="fcard" data-id={g.id} aura={HUMO_MARCA}>
            <div className="fcard-cab">
                <span className="icono-m"><Icono n="video" s={19} /></span>
                <button type="button" className="fcard-nom" data-nav="" onClick={() => abrirGracias(g.id)}>{g.nombre}</button>
            </div>
            <div className="gx-chips">
                <Chip color={ov.c} icon={<Icono n="video" s={13} />}>Video · {ov.n}</Chip>
                <Chip color={op.c} icon={<Icono n="play" s={13} />}>Plan · {op.n}</Chip>
                <Chip color={g.casos ? 'var(--success)' : 'var(--text-muted)'} icon={<Icono n="estrella" s={13} />}>{g.casos ? 'Con casos de éxito' : 'Sin casos'}</Chip>
            </div>
            <p className="t-sm mut">{usan ? 'La usa' + (usan > 1 ? 'n ' + usan + ' eventos' : ' 1 evento') : 'Ningún evento la usa todavía'}</p>
            {borrando ? <ConfirmarBorrarGracias g={g} d={d} onCancelar={() => setBorrando(null, g.id)} /> : (
                <div className="fcard-pie">
                    <a className="btn btn--linea btn--sm" href={rutaGracias(g.id)} target="_blank" rel="noopener noreferrer"><Icono n="ojo" />Ver</a>
                    <div className="der">
                        <IconButton label={'Eliminar ' + g.nombre} icon={<Icono n="basura" s={15} />} size="sm" danger data-borrar={g.id} title="Eliminar" onClick={() => setBorrando(g.id)} />
                        <Button icon={<Icono n="edit" />} data-nav="" onClick={() => abrirGracias(g.id)}>Editar</Button>
                    </div>
                </div>
            )}
        </Card>
    );
}

export default function ListaGracias() {
    const { d } = useDatos();
    const [borrar, setBorrar] = useState(null);
    const gs = ord(d, 'gracias');
    const setBorrando = (id, volver) => {
        setBorrar(id);
        if (volver) requestAnimationFrame(() => document.querySelector('[data-borrar="' + volver + '"]')?.focus());
    };
    return (
        <>
            <Compo vacio={!gs.length} id="nueva-gracias" tit="Nueva página de gracias" soloTit="Armá tu primera página de gracias"
                ph="Nombre, ej. Gracias Workshop" onCrear={crearGracias} />
            {gs.length > 0 && (
                <Grid variant="cards">
                    {gs.map(g => <Tarjeta key={g.id} g={g} d={d} borrando={borrar === g.id} setBorrando={setBorrando} />)}
                </Grid>
            )}
        </>
    );
}
