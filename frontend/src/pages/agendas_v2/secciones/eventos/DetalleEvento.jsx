// Evento abierto: barra con estado, copiar link, probar, descartar y publicar; pestañas Configuración y Flujo.
// La barra va en la fila del título de la página (#tope-acc en ThalamusApp) para no gastar alto.


import { buscar } from '../../core/datos';
import { camposPublicados, configDe, estadoEvento, sinPublicar } from '../../core/eventos';
import { almacen, useDatos, usePermisos } from '../../data/hooks';
import { Icono } from '../../ui/base';
import EnTope from '../../ui/EnTope';
import { ui } from '../../ui/estadoUi';
import { toast } from '../../ui/toast';
import ConfigEvento from './ConfigEvento';
import Flujo from './Flujo';
import { EstadoEv, copiarLink, probarEvento } from './comun';

export default function DetalleEvento({ e, ev }) {
    const { d } = useDatos();
    const { puede, modoCloser } = usePermisos();
    const fo = buscar(d, 'formularios', e.formulario);
    const pendiente = sinPublicar(e, fo);
    // Descartar vuelve los campos del evento a lo publicado; si solo cambió el formulario no hay nada que descartar acá.
    const pub = e.publicado ? camposPublicados(e) : null;
    const evCambio = !!pub && configDe({ ...e, ...pub }, fo) !== configDe(e, fo);
    const puedePublicar = modoCloser || puede('events.publicar');
    const sinPermiso = puedePublicar ? undefined : 'Este rol no puede publicar cambios';

    // El evento se abre después de que la página ya está montada: la fila del título ya existe.
    const cerrar = () => { almacen.flush(); ui.set({ ev: null }); };
    const tab = (t) => { almacen.flush(); ui.set({ ev: { ...ev, tab: t, nodo: null } }); };
    const publicar = () => {
        almacen.flush();
        const actual = buscar(almacen.getState().d, 'eventos', e.id);
        almacen.editar('eventos', e.id, { publicado: configDe(actual, buscar(almacen.getState().d, 'formularios', actual.formulario)) }, true);
        toast('Publicado');
    };
    const descartar = () => {
        if (!pub) return;
        almacen.editar('eventos', e.id, pub, true);
        toast('Volviste a la versión publicada');
    };

    const barra = (
            <div className="barra">
                <button type="button" className="btn btn--linea btn--sm" data-nav="" onClick={cerrar}><Icono n="volver" />Funnels</button>
                <div className="seg" role="group" aria-label="Vista" style={{ marginInline: 'auto' }}>
                    <button type="button" data-nav="" aria-pressed={ev.tab !== 'flujo'} onClick={() => tab('config')}><Icono n="ajustes" />Configuración</button>
                    <button type="button" data-nav="" aria-pressed={ev.tab === 'flujo'} onClick={() => tab('flujo')}><Icono n="flujo" />Flujo</button>
                </div>
                <div className="barra-der ev-acc">
                    <EstadoEv est={estadoEvento(e, fo)} />
                    <button type="button" className="ibtn ibtn--sm" data-nav="" aria-label="Copiar link" title="Copiar link" onClick={() => copiarLink(d, e)}>
                        <Icono n="copiar" s={15} />
                    </button>
                    <button type="button" className="btn btn--linea btn--sm" data-nav="" onClick={() => probarEvento(d, e)}><Icono n="play" />Probar borrador</button>
                    {evCambio && (
                        <button type="button" className="btn btn--linea btn--sm" onClick={descartar} disabled={!puedePublicar} title={sinPermiso}>
                            <Icono n="rotar" />Descartar
                        </button>
                    )}
                    <button type="button" className="btn btn--cta btn--sm" onClick={publicar} disabled={!pendiente || !puedePublicar} title={sinPermiso}>
                        <Icono n="publicar" />Publicar
                    </button>
                </div>
            </div>
    );
    return (
        <>
            <EnTope reemplaza>{barra}</EnTope>
            <div data-id={e.id}>
                {ev.tab === 'flujo' ? <Flujo e={e} ev={ev} /> : <ConfigEvento e={e} />}
            </div>
        </>
    );
}
