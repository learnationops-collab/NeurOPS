// Evento abierto: barra con estado, copiar link, probar, descartar y publicar; pestañas Configuración y Flujo.
// La barra va en la fila del título de la página (HeaderActions, en la cabecera de ThalamusApp) para no gastar alto.


import { buscar } from '../../core/datos';
import { camposPublicados, configDe, estadoEvento, sinPublicar } from '../../core/eventos';
import { almacen, useDatos, usePermisos } from '../../data/hooks';
import { Icono } from '../../ui/base';
import { Button, HeaderActions, IconButton } from '../../../../components/standard';
import { ui } from '../../ui/estadoUi';
import { toast } from '../../ui/toast';
import ConfigEvento from './ConfigEvento';
import Flujo from './Flujo';
import { EstadoEv, copiarLink, probarEvento, probarSegmento } from './comun';

export default function DetalleEvento({ e, ev }) {
    const { d } = useDatos();
    const { puede, modoCloser, lectura } = usePermisos();
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
                <Button icon={<Icono n="volver" />} data-nav="" onClick={cerrar}>Funnels</Button>
                <div className="seg" role="group" aria-label="Vista" style={{ marginInline: 'auto' }}>
                    <button type="button" data-nav="" aria-pressed={ev.tab !== 'flujo'} onClick={() => tab('config')}><Icono n="ajustes" />Configuración</button>
                    <button type="button" data-nav="" aria-pressed={ev.tab === 'flujo'} onClick={() => tab('flujo')}><Icono n="flujo" />Flujo</button>
                </div>
                <div className="barra-der ev-acc">
                    <EstadoEv est={estadoEvento(e, fo)} />
                    <IconButton label="Copiar link" icon={<Icono n="copiar" s={15} />} size="sm" data-nav="" title="Copiar link" onClick={() => copiarLink(d, e)} />
                    <Button icon={<Icono n="play" />} data-nav="" onClick={() => probarEvento(d, e)}>Probar borrador</Button>
                    {!lectura && <Button icon={<Icono n="users" />} data-nav="" title="Saltear el formulario y ver lo que vería el lead de cada segmentación" onClick={() => probarSegmento(e)}>Probar segmento</Button>}
                    {evCambio && !lectura && (
                        <Button icon={<Icono n="rotar" />} onClick={descartar} disabled={!puedePublicar} title={sinPermiso}>
                            Descartar
                        </Button>
                    )}
                    {!lectura && (
                        <Button variant="primary" icon={<Icono n="publicar" />} onClick={publicar} disabled={!pendiente || !puedePublicar} title={sinPermiso}>
                            Publicar
                        </Button>
                    )}
                </div>
            </div>
    );
    return (
        <>
            <HeaderActions replaceTitle>{barra}</HeaderActions>
            <div data-id={e.id}>
                {ev.tab === 'flujo' ? <Flujo e={e} ev={ev} /> : <ConfigEvento e={e} />}
            </div>
        </>
    );
}
