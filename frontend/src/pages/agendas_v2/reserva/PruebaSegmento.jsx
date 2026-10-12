// Prueba por segmento (ui.prueba.porSegmento, o el enlace /agendas-v2?probar=<evento>&seg=<segmento>):
// se elige con qué segmentación llega el lead y se saltea el formulario. Un lead de prueba ya completó
// su contacto y la pantalla queda en lo que vería él: el calendario de esa prioridad (con la API, los
// horarios del servidor), la página a la que lo manda una regla o el «no califica». No se agenda nada.

import { useEffect, useMemo, useRef } from 'react';
import { buscar } from '../core/datos';
import { preguntasFlujo } from '../core/normalizar';
import { letra } from '../core/util';
import { almacen } from '../data/hooks';
import { Humo, Icono } from '../ui/base';
import { ui } from '../ui/estadoUi';
import { copiarTexto } from '../ui/toast';
import PantallaLead from './PantallaLead';
import { proveedorPrueba } from './proveedores';
import { respDePrueba, segmentosDe, urlPrueba, versionParaPrueba } from './segmentos';

const HUMO_RV = ['var(--rv-humo-a)', 'var(--rv-humo-b)', 'var(--rv-humo-b)', 'var(--rv-humo-a)'];

function Selector({ e, version, segmentos, cel, onElegir, onSalir }) {
    const rootRef = useRef(null);
    // Letras eligen (como en el formulario) y Escape cierra.
    useEffect(() => {
        const fn = (ev) => {
            if (ev.key === 'Escape') { ev.preventDefault(); onSalir(); return; }
            if (!/^[a-z]$/i.test(ev.key) || ev.metaKey || ev.ctrlKey || ev.altKey || /INPUT|TEXTAREA|SELECT/.test(ev.target.tagName)) return;
            const x = segmentos[ev.key.toUpperCase().charCodeAt(0) - 65];
            if (x) { ev.preventDefault(); onElegir(x.k); }
        };
        document.addEventListener('keydown', fn);
        return () => document.removeEventListener('keydown', fn);
    }, [segmentos, onElegir, onSalir]);
    useEffect(() => {
        const b = rootRef.current && rootRef.current.querySelector('.rv-op');
        if (b) b.focus({ preventScroll: true });
    }, []);

    return (
        <div ref={rootRef} className={'reserva' + (cel ? ' reserva--cel' : '')} role="dialog" aria-modal="true" aria-label="Probar por segmento">
            <Humo cols={HUMO_RV} />
            <header className="rv-top"><span className="rv-marca">Learnation</span><span className="rv-evento">{e.nombre}</span></header>
            <main className="rv-cuerpo">
                <div className="rv-paso rv-paso--entra">
                    <h1 className="rv-q rv-q--l1" id="prueba-seg-q">¿Con qué segmentación llega el lead?</h1>
                    <p className="rv-ayuda">
                        Se saltea el formulario con un lead de prueba y ves lo que vería él.
                        {version === 'borrador' ? ' El evento no está publicado: se prueba el borrador.' : ' Se prueba la versión publicada.'}
                    </p>
                    <div className="rv-ops" role="radiogroup" aria-labelledby="prueba-seg-q">
                        {segmentos.map((x, j) => (
                            <button key={x.k} type="button" className="rv-op" role="radio" aria-checked={false} onClick={() => onElegir(x.k)}>
                                <kbd>{letra(j)}</kbd><span>{x.n}<small className="rv-op-sub">{x.sub}</small></span><Icono n="chevron-right" s={18} />
                            </button>
                        ))}
                    </div>
                </div>
            </main>
            <div className="rv-control">
                <span className="rv-prueba"><Icono n="play" s={13} />Prueba<span className="rv-prueba-largo">&nbsp;· no se agenda nada</span></span>
                <div className="rv-nav">
                    <button type="button" className="rv-salir" onClick={() => copiarTexto(urlPrueba(e.id), 'Enlace de prueba copiado')}>
                        <Icono n="copiar" s={16} /><span>Copiar enlace</span>
                    </button>
                    <button type="button" className="rv-salir" onClick={onSalir}><Icono n="x" s={16} /><span>Salir</span></button>
                </div>
            </div>
        </div>
    );
}

function NoExiste({ onSalir }) {
    return (
        <div className="reserva" role="dialog" aria-modal="true" aria-label="Probar por segmento">
            <Humo cols={HUMO_RV} />
            <header className="rv-top"><span className="rv-marca">Learnation</span></header>
            <main className="rv-cuerpo">
                <div className="rv-paso rv-paso--entra">
                    <span className="rv-listo-ico rv-listo-ico--no"><Icono n="link" s={30} /></span>
                    <h1 className="rv-q rv-q--l1">Ese evento ya no existe</h1>
                    <p className="rv-ayuda">Puede que lo hayan borrado. Abrí la prueba desde el evento en Funnels.</p>
                    <div className="rv-acc"><button type="button" className="rv-seguir" onClick={onSalir}>Volver a Thalamus</button></div>
                </div>
            </main>
        </div>
    );
}

/** prueba: {evento (id), segmento ('' = elegir)}. */
export default function PruebaSegmento({ prueba, d, reservas, cargando, prevModo, onSalir }) {
    const e = d ? buscar(d, 'eventos', typeof prueba.evento === 'string' ? prueba.evento : prueba.evento && prueba.evento.id) : null;
    const v = useMemo(() => (e ? versionParaPrueba(d, e) : null), [d, e]);
    const segmentos = useMemo(() => (v ? segmentosDe(d, v.evento, v.form) : []), [d, v]);
    const seg = segmentos.find(x => x.k === prueba.segmento) || null;
    const conApi = almacen.adaptador.tipo === 'api';
    const grupo = seg && seg.tipo === 'grupo' ? seg.grupo : '';
    // Los datos se recargan solos: la prueba sigue mientras no cambie el evento ni el segmento.
    const proveedor = useMemo(() => (e && seg ? proveedorPrueba(d, reservas, e.id, grupo, conApi) : null),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [e && e.id, seg && seg.k, grupo, conApi, conApi ? null : d, conApi ? null : reservas]);
    const fuente = useMemo(() => {
        if (!v || !seg) return null;
        const preguntas = v.form ? preguntasFlujo(v.form) : [];
        return {
            evento: v.evento, form: v.form, desde: preguntas.length, resp: respDePrueba(preguntas),
            fin: seg.tipo !== 'grupo', finUrl: seg.tipo === 'url' ? seg.url : '', etiqueta: seg.n,
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [v && v.evento.id, v && v.version, seg && seg.k]);

    const elegir = (k) => ui.set({ prueba: { ...ui.getState().prueba, segmento: k } });
    const volver = () => elegir('');

    if (cargando || !d) return <div className="reserva" aria-busy="true" />;
    if (!e || !v) return <NoExiste onSalir={onSalir} />;
    if (!seg || !fuente || !proveedor) {
        return <Selector e={e} version={v.version} segmentos={segmentos} cel={prevModo === 'celular'} onElegir={elegir} onSalir={onSalir} />;
    }
    // La key reinicia la pantalla al cambiar de segmento.
    return <PantallaLead key={seg.k} fuente={fuente} proveedor={proveedor} modo="prueba" prevModo={prevModo} onSalir={onSalir} onReiniciar={volver} />;
}
