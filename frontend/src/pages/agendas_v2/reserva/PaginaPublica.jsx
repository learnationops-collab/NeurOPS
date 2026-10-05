// Página pública de reserva: /agendas-v2/agenda/:funnel/:evento (o /agenda/:evento), con ?o=origen.
// Usa solo la versión publicada del evento (evento + copia del formulario). Si el link no existe,
// nunca se publicó o está pausado, muestra un aviso tranquilo con el mismo lenguaje visual.
//
// Es pública: no carga el estado de gestión (que pide sesión) ni el almacén de Thalamus.
//   - Con la API (lo normal): pide el evento a /api/agendas-v2/publico y el servidor da horarios y agenda.
//   - En modo local (tests o VITE_AGENDAS_LOCAL=1): lee los datos de este navegador y calcula todo acá.

import '../thalamus.css';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { buscar, nombreOrigen } from '../core/datos';
import { versionPublicada } from '../core/eventos';
import { COLECCIONES, NORM } from '../core/normalizar';
import { slugify } from '../core/util';
import { crearAdaptadorLocal } from '../data/adaptadorLocal';
import { MODO_LOCAL } from '../data/modo';
import { Humo, Icono } from '../ui/base';
import PantallaLead from './PantallaLead';
import { proveedorApi, proveedorLocal } from './proveedores';

const HUMO_RV = ['var(--rv-humo-a)', 'var(--rv-humo-b)', 'var(--rv-humo-b)', 'var(--rv-humo-a)'];

// Evento publicado que corresponde al link. Sin funnel en la ruta, prefiere el evento sin funnel.
export function buscarPublicado(d, funnelSlug, eventoSlug) {
    const cands = [];
    (d.eventos || []).forEach(e => {
        const v = versionPublicada(e);
        if (!v || v.evento.slug !== eventoSlug) return;
        const f = buscar(d, 'funnels', v.evento.funnel) || null;
        if (funnelSlug && (!f || f.slug !== funnelSlug)) return;
        cands.push({ e, v, funnel: f });
    });
    if (!cands.length) return null;
    return (!funnelSlug && cands.find(c => !c.funnel)) || cands[0];
}

function NoDisponible({ sinRed = false }) {
    return (
        <div className="reserva">
            <Humo cols={HUMO_RV} />
            <header className="rv-top"><span className="rv-marca">Learnation</span></header>
            <main className="rv-cuerpo">
                <div className="rv-paso rv-paso--entra">
                    <span className="rv-listo-ico rv-listo-ico--no"><Icono n={sinRed ? 'alerta' : 'link'} s={30} /></span>
                    {sinRed ? (
                        <>
                            <h1 className="rv-q rv-q--l1">No pudimos abrir la agenda</h1>
                            <p className="rv-ayuda">Revisá tu conexión y volvé a cargar la página.</p>
                        </>
                    ) : (
                        <>
                            <h1 className="rv-q rv-q--l1">Este link no está disponible</h1>
                            <p className="rv-ayuda">Puede que lo hayan pausado o cambiado. Si te lo pasó alguien del equipo, pedile el link nuevo.</p>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}

// Lo que necesita la pantalla: {cargando, evento, form, setter, proveedor, sinRed}. evento null = no disponible.
function useEventoLocal(funnelSlug, eventoSlug, origen) {
    const [datos, setDatos] = useState({ cargando: true, d: null, reservas: [] });
    const ad = useMemo(() => crearAdaptadorLocal(), []);
    useEffect(() => {
        let vivo = true;
        const cargar = () => ad.cargar().then(({ cols, reservas }) => {
            if (!vivo) return;
            const d = {};
            COLECCIONES.forEach(c => { d[c] = (cols[c] || []).map(x => NORM[c](x.id, x)); });
            setDatos({ cargando: false, d, reservas: Array.isArray(reservas) ? reservas : [] });
        }, () => { if (vivo) setDatos({ cargando: false, d: null, reservas: [] }); });
        cargar();
        const fin = ad.alCambiar(cargar);
        return () => { vivo = false; fin(); };
    }, [ad]);

    const { cargando, d, reservas } = datos;
    const encontrado = useMemo(() => (d ? buscarPublicado(d, funnelSlug, eventoSlug) : null), [d, funnelSlug, eventoSlug]);
    const disponible = !!(encontrado && encontrado.v.form && encontrado.e.activo !== false && encontrado.v.evento.activo !== false
        && !(encontrado.funnel && encontrado.funnel.activo === false));
    // Setter del origen (?o=): el origen cuyo nombre, en slug, coincide.
    const setter = useMemo(() => {
        if (!disponible || !encontrado.funnel || !origen) return null;
        const o = encontrado.funnel.origenes.find(x => slugify(nombreOrigen(d, x)) === origen);
        return o && o.setter ? o.setter : null;
    }, [disponible, encontrado, origen, d]);
    const proveedor = useMemo(() => (d ? proveedorLocal(d, reservas, (payload) => ad.crearReserva(payload)) : null), [d, reservas, ad]);
    return {
        cargando, setter, proveedor, sinRed: false,
        evento: disponible ? encontrado.v.evento : null, form: disponible ? encontrado.v.form : null,
    };
}

function useEventoApi(funnelSlug, eventoSlug) {
    const proveedor = useMemo(() => proveedorApi(), []);
    // Lo cargado vale para el link de su clave; mientras no coincide con el link actual, está cargando.
    const clave = eventoSlug ? funnelSlug + '/' + eventoSlug : '';
    const [r, setR] = useState({ clave: null, evento: null, form: null, sinRed: false });
    useEffect(() => {
        if (!clave) return undefined;
        let vivo = true;
        proveedor.cargarEvento(funnelSlug, eventoSlug).then(
            (data) => { if (vivo) setR({ clave, evento: data.evento, form: data.form, sinRed: false }); },
            (e) => { if (vivo) setR({ clave, evento: null, form: null, sinRed: e.code !== 'no_disponible' }); },
        );
        return () => { vivo = false; };
    }, [proveedor, clave, funnelSlug, eventoSlug]);
    const vale = !!clave && r.clave === clave;
    // El setter del origen lo resuelve el servidor a partir de ?o=.
    return {
        cargando: !!clave && !vale, evento: vale ? r.evento : null, form: vale ? r.form : null,
        sinRed: vale && r.sinRed, setter: null, proveedor,
    };
}

const useEvento = MODO_LOCAL ? useEventoLocal : useEventoApi;

export default function PaginaPublica() {
    const { funnel: funnelSlug, evento: eventoSlug } = useParams();
    const [sp] = useSearchParams();
    const origen = slugify(sp.get('o') || '');
    const { cargando, evento, form, setter, proveedor, sinRed } = useEvento(funnelSlug || '', eventoSlug || '', origen);
    const fuente = useMemo(() => ({ evento, form }), [evento, form]);

    useEffect(() => {
        if (cargando) return;
        document.title = evento ? evento.nombre : 'Learnation';
    }, [cargando, evento]);

    return (
        <div className="thalamus">
            {cargando ? <div className="reserva" aria-busy="true" />
                : evento && form && proveedor ? <PantallaLead fuente={fuente} proveedor={proveedor} modo="publico" origen={origen} setter={setter} />
                    : <NoDisponible sinRed={sinRed} />}
        </div>
    );
}
