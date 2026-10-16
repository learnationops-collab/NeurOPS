// Forms: la grilla de formularios con la caja para crear uno nuevo.

import { useState } from 'react';
import { almacen, useDatos, usePermisos } from '../../data/hooks';
import { FIN_DEF } from '../../core/catalogos';
import { maxOrden, ord } from '../../core/datos';
import { duplicarForm, resumenForm } from '../../core/formulario';
import { clonar } from '../../core/util';
import { HUMO_MARCA, Icono } from '../../ui/base';
import { ui } from '../../ui/estadoUi';
import { toast } from '../../ui/toast';
import Compo from './Compo';
import { Button, Card, ConfirmDelete, EmptyState, IconButton } from '../../../../components/standard';

export function abrirForm(id) {
    almacen.flush();
    ui.set({ seccion: 'preguntas', form: { id, vista: 'preguntas', sel: null } });
    window.scrollTo({ top: 0 });
}

// Crea un formulario vacío: contacto con Instagram opcional, y lo que no cumpla ninguna regla va a la última prioridad.
export function crearForm(nombre) {
    nombre = String(nombre || '').replace(/\s+/g, ' ').trim();
    if (!nombre) return 'Escribí un nombre.';
    const { d } = almacen.getState();
    const ultima = ord(d, 'grupos').slice(-1)[0];
    const id = almacen.crear('formularios', {
        nombre, contacto: { nombre: true, telefono: true, email: true, instagram: false }, preguntas: [], reglas: [],
        resto: ultima ? ultima.id : '', fin: clonar(FIN_DEF), orden: maxOrden(d, 'formularios') + 1,
    });
    abrirForm(id);
    return '';
}

// Borra el formulario y lo saca de los eventos que lo usaban.
export function borrarForm(f) {
    const { d } = almacen.getState();
    d.eventos.forEach(ev => { if (ev.formulario === f.id) almacen.editar('eventos', ev.id, { formulario: '' }); });
    almacen.flush();
    almacen.borrar('formularios', f.id);
    toast(f.nombre + ' eliminado');
}

function ConfirmarBorrar({ f, d, onCancelar }) {
    const n = d.eventos.filter(e => e.formulario === f.id).length;
    return (
        <ConfirmDelete name={f.nombre} detail={n ? 'Lo usa' + (n > 1 ? 'n ' + n + ' eventos' : ' 1 evento') + '.' : null} style={{ marginTop: 'auto' }}
            icon={<Icono n="basura" />} onCancel={onCancelar} onConfirm={() => borrarForm(f)} />
    );
}

function Tarjeta({ f, d, borrando, setBorrando }) {
    const { lectura } = usePermisos();
    const r = resumenForm(f);
    const duplicar = () => {
        const { d: d0 } = almacen.getState();
        almacen.crear('formularios', { ...duplicarForm(f), orden: maxOrden(d0, 'formularios') + 1 });
        toast('Duplicado');
    };
    return (
        <Card as="article" className="fcard" data-id={f.id} aura={HUMO_MARCA}>
            <div className="fcard-cab">
                <span className="icono-m"><Icono n="form" s={19} /></span>
                <button type="button" className="fcard-nom" data-nav="" onClick={() => abrirForm(f.id)}>{f.nombre}</button>
            </div>
            <div className="datos">
                <div className="dato"><b>{r.n}</b><span>Preguntas</span></div>
                <div className="dato"><b>{r.puntua}</b><span>Puntúan</span></div>
                <div className={'dato' + (r.filtra ? ' dato--alerta' : '')}><b>{r.filtra}</b><span>Filtran</span></div>
            </div>
            {borrando ? <ConfirmarBorrar f={f} d={d} onCancelar={() => setBorrando(null, f.id)} /> : (
                <div className="fcard-pie">
                    <Button icon={<Icono n="play" />} data-nav="" onClick={() => ui.set({ prueba: { form: f } })}>Probar</Button>
                    <div className="der">
                        {!lectura && (
                            <>
                                <IconButton label={'Duplicar ' + f.nombre} icon={<Icono n="copiar" s={15} />} size="sm" title="Duplicar" onClick={duplicar} />
                                <IconButton label={'Eliminar ' + f.nombre} icon={<Icono n="basura" s={15} />} size="sm" danger data-borrar={f.id} title="Eliminar" onClick={() => setBorrando(f.id)} />
                            </>
                        )}
                        <Button icon={<Icono n={lectura ? 'ojo' : 'edit'} />} data-nav="" onClick={() => abrirForm(f.id)}>
                            {lectura ? 'Ver' : 'Editar'}
                        </Button>
                    </div>
                </div>
            )}
        </Card>
    );
}

export default function ListaForms() {
    const { d } = useDatos();
    const { lectura } = usePermisos();
    const [borrar, setBorrar] = useState(null);
    const fs = ord(d, 'formularios');
    // Al cancelar, el foco vuelve al botón de eliminar de esa tarjeta.
    const setBorrando = (id, volver) => {
        setBorrar(id);
        if (volver) requestAnimationFrame(() => document.querySelector('[data-borrar="' + volver + '"]')?.focus());
    };
    return (
        <>
            {lectura
                ? !fs.length && <EmptyState>Todavía no hay formularios.</EmptyState>
                : <Compo vacio={!fs.length} tit="Nuevo formulario" soloTit="Armá tu primer formulario" ph="Nombre, ej. Calificación Workshop" onCrear={crearForm} />}
            {fs.length > 0 && (
                <div className="grilla">
                    {fs.map(f => <Tarjeta key={f.id} f={f} d={d} borrando={borrar === f.id} setBorrando={setBorrando} />)}
                </div>
            )}
        </>
    );
}
