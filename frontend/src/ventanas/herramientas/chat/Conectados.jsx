// Quién está conectado (usó Work, la Academia o Leadership en los últimos 5 minutos, ADR-W171): la fila de
// fotos de la lista y la columna de la derecha, agrupada por servicio. La letra en la foto dice dónde está.
import { Avatar, Skeleton, SkeletonRow } from '../../../components/standard';
import { SISTEMAS, colorDe } from './formato';

const ROLES = {
    admin: 'Admin', operator: 'Operador', director_comercial: 'Director comercial', director_marketing: 'Marketing',
    closer: 'Closer', setter: 'Setter', triage: 'Triage', hiring: 'Hiring', fulfillment: 'Fulfillment',
};

function Foto({ p, size = 'sm' }) {
    const s = SISTEMAS[p.sistema];
    return (
        <span className="ch-foto">
            <Avatar size={size} name={p.nombre} photo={p.foto} color={colorDe(p.nombre)} />
            <i className="ch-foto__punto" aria-hidden="true" />
            {s && <i className={`ch-foto__donde ch-tag--${p.sistema}`} title={`En ${s.nombre}`}>{s.letra}</i>}
        </span>
    );
}

export function FilaConectados({ conectados }) {
    const otros = (conectados || []).filter(p => !p.yo);
    if (!otros.length) return null;
    return (
        <>
            <p className="ch-sec">Conectados · {otros.length}</p>
            <div className="ch-fotos">
                {otros.map(p => (
                    <span key={p.email} className="ch-fotos__p" title={`${p.nombre} · en ${SISTEMAS[p.sistema]?.nombre || 'la Academia'}`}>
                        <Foto p={p} /><small>{p.nombre.split(' ')[0]}</small>
                    </span>
                ))}
            </div>
        </>
    );
}

export function Conectados({ conectados }) {
    if (conectados === null) {
        return <Skeleton label="Cargando quién está conectado…">{[0, 1, 2, 3].map(i => <SkeletonRow key={i} avatar cells={['70%']} step={i} />)}</Skeleton>;
    }
    const grupos = Object.keys(SISTEMAS).map(k => [k, conectados.filter(p => p.sistema === k)]).filter(([, g]) => g.length);
    return (
        <div className="ch-conectados">
            <p className="ch-lado__tit">Conectados<small>Usaron un servicio en los últimos 5 minutos</small></p>
            {grupos.length === 0 && <p className="ch-lado__vacio">No hay nadie más por ahora.</p>}
            {grupos.map(([k, gente]) => (
                <div key={k}>
                    <p className="ch-sec"><span className={`ch-tag ch-tag--${k}`}>{SISTEMAS[k].letra}</span> En {SISTEMAS[k].nombre} · {gente.length}</p>
                    {gente.map(p => (
                        <div key={p.email} className="ch-persona">
                            <Foto p={p} />
                            <span>{p.nombre}{p.yo && ' (vos)'}<small>{ROLES[p.rol] || (p.rol ? p.rol : 'Equipo')}</small></span>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}
