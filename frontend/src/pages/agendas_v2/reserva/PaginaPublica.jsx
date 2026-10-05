// Página pública de reserva: /agendas-v2/agenda/:funnel/:evento (o /agenda/:evento), con ?o=origen.
// Usa solo la versión publicada del evento (evento + copia del formulario). Si el link no existe,
// nunca se publicó o está pausado, muestra un aviso tranquilo con el mismo lenguaje visual.

import '../thalamus.css';
import { useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { buscar, nombreOrigen } from '../core/datos';
import { versionPublicada } from '../core/eventos';
import { slugify } from '../core/util';
import { useDatos, useIniciarAlmacen } from '../data/hooks';
import { Humo, Icono } from '../ui/base';
import PantallaLead from './PantallaLead';

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

function NoDisponible() {
    return (
        <div className="reserva">
            <Humo cols={HUMO_RV} />
            <header className="rv-top"><span className="rv-marca">Learnation</span></header>
            <main className="rv-cuerpo">
                <div className="rv-paso rv-paso--entra">
                    <span className="rv-listo-ico rv-listo-ico--no"><Icono n="link" s={30} /></span>
                    <h1 className="rv-q rv-q--l1">Este link no está disponible</h1>
                    <p className="rv-ayuda">Puede que lo hayan pausado o cambiado. Si te lo pasó alguien del equipo, pedile el link nuevo.</p>
                </div>
            </main>
        </div>
    );
}

export default function PaginaPublica() {
    useIniciarAlmacen();
    const { cargando, d } = useDatos();
    const { funnel: funnelSlug, evento: eventoSlug } = useParams();
    const [sp] = useSearchParams();
    const origen = slugify(sp.get('o') || '');

    const encontrado = useMemo(() => (cargando ? null : buscarPublicado(d, funnelSlug || '', eventoSlug || '')), [cargando, d, funnelSlug, eventoSlug]);
    const disponible = !!(encontrado && encontrado.v.form && encontrado.e.activo !== false && encontrado.v.evento.activo !== false
        && !(encontrado.funnel && encontrado.funnel.activo === false));

    // Setter del origen (?o=): el origen cuyo nombre, en slug, coincide.
    const setter = useMemo(() => {
        if (!encontrado || !encontrado.funnel || !origen) return null;
        const o = encontrado.funnel.origenes.find(x => slugify(nombreOrigen(d, x)) === origen);
        return o && o.setter ? o.setter : null;
    }, [encontrado, origen, d]);

    const evento = encontrado ? encontrado.v.evento : null, form = encontrado ? encontrado.v.form : null;
    const fuente = useMemo(() => ({ evento, form }), [evento, form]);

    useEffect(() => {
        if (cargando) return;
        document.title = disponible && evento ? evento.nombre : 'Learnation';
    }, [cargando, disponible, evento]);

    return (
        <div className="thalamus">
            {cargando ? <div className="reserva" aria-busy="true" />
                : disponible ? <PantallaLead fuente={fuente} modo="publico" origen={origen} setter={setter} />
                    : <NoDisponible />}
        </div>
    );
}
