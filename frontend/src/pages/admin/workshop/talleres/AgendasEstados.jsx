import React, { useState } from 'react';
import { EsqueletoFilas, PanelCab, Segmented } from '../../../comercial/components/Shared';
import { useAgendasEstados } from './datosTaller';
import { numero, porcentaje } from './formato';

/**
 * Qué pasó con las personas que agendaron en el taller (Talleres › detalle › Embudo): cuántas
 * asistieron, cuántas no, cuántas quedaron sin reporte y cuántas se cayeron. Cada persona cuenta
 * una vez, en el estado del libro de agendas del closer (`workshop_agenda_estados_service`).
 *
 * Arriba los cinco grupos; debajo, una barra con su proporción y el detalle de los estados que
 * tienen gente. El número de agendas todavía no abre la lista.
 */

const ENTRADAS = [
    { key: 'todas', label: 'Todas' },
    { key: 'vivo', label: 'En vivo' },
    { key: 'landing', label: 'Grabación' },
];

const pct = (n, total) => (total ? porcentaje((n / total) * 100) : '—');

const Cuerpo = ({ datos }) => {
    const total = datos.total;
    if (!total) {
        return <p className="t-cap mut wt-mini-vacio">Nadie agendó en los días de este taller.</p>;
    }
    const conGente = datos.estados.filter((e) => e.n > 0);
    return (
        <div className="wt-agendas">
            <dl className="wt-agendas-grupos">
                {datos.grupos.map((g) => (
                    <div key={g.key} className="wt-agendas-grupo" style={{ '--c': `var(--${g.tono})` }} title={g.desc}>
                        <dt>{g.label}</dt>
                        <dd className="num">{numero(g.n)}</dd>
                        <small className="num">{pct(g.n, total)}</small>
                    </div>
                ))}
            </dl>
            <div className="wt-apilada" role="img"
                aria-label={datos.grupos.filter((g) => g.n).map((g) => `${g.label} ${g.n}`).join(', ')}>
                {datos.grupos.filter((g) => g.n > 0).map((g) => (
                    <i key={g.key} style={{ flexGrow: g.n, background: `var(--${g.tono})` }} title={`${g.label}: ${g.n}`} />
                ))}
            </div>
            <ul className="wt-agendas-estados" aria-label="Detalle por estado">
                {conGente.map((e) => (
                    <li key={e.key} title={e.desc}>
                        <i aria-hidden="true" style={{ background: e.color }} />
                        {e.label} <b className="num">{e.n}</b>
                    </li>
                ))}
            </ul>
        </div>
    );
};

const AgendasEstados = ({ evento }) => {
    const { datos, error } = useAgendasEstados(evento?.id);
    const [entrada, setEntrada] = useState('todas');
    const hayGrabacion = (datos?.por_entrada?.landing?.total || 0) > 0;
    const vista = datos && (entrada === 'todas' || !hayGrabacion ? datos : datos.por_entrada[entrada]);

    return (
        <section className="panel wt-panel" aria-label="Agendas del taller">
            <PanelCab titulo="Agendas" tip="Personas que agendaron y en qué quedó cada una.">
                {vista && (
                    <span className="t-cap mut num">
                        {numero(vista.total)} {vista.total === 1 ? 'persona' : 'personas'}
                        {vista === datos && datos.llamadas > datos.total ? ` · ${numero(datos.llamadas)} llamadas` : ''}
                    </span>
                )}
                {hayGrabacion && (
                    <Segmented chico opciones={ENTRADAS} valor={entrada} onChange={setEntrada} ariaLabel="Entrada de las agendas" />
                )}
            </PanelCab>
            {error ? (
                <p className="t-cap mut wt-mini-vacio">No se pudieron traer las agendas.</p>
            ) : !vista ? (
                <EsqueletoFilas rotulo="Cargando las agendas…" lineas={3} alto={34} />
            ) : (
                <Cuerpo datos={vista} />
            )}
        </section>
    );
};

export default AgendasEstados;
