// Quién está conectado (usó Work, la Academia o Leadership en los últimos 5 minutos, ADR-W171): la fila de
// fotos de la lista y la columna de la derecha, agrupada por servicio. La letra en la foto dice dónde está y,
// debajo del nombre, lo que está haciendo según su agenda («En llamada · hasta 16:30», «En sesión con…», ADR-W176).
// Abajo, los desconectados con cuándo se los vio. Tocar a alguien abre la conversación directa (ADR-W175).
import { Avatar, Skeleton, SkeletonRow } from '../../../components/standard';
import { SISTEMAS, colorDe, estadoDe, hace } from './formato';

const ROLES = {
    admin: 'Admin', operator: 'Operador', director_comercial: 'Director comercial', director_marketing: 'Marketing',
    closer: 'Closer', setter: 'Setter', triage: 'Triage', hiring: 'Hiring', fulfillment: 'Fulfillment',
};
const rolDe = (p) => ROLES[p.rol] || p.rol || 'Equipo';

export function Foto({ p, size = 'sm', conectado = true }) {
    const s = conectado ? SISTEMAS[p.sistema] : null;
    return (
        <span className={`ch-foto${conectado ? '' : ' ch-foto--off'}`}>
            <Avatar size={size} name={p.nombre} photo={p.foto} color={colorDe(p.nombre)} />
            {conectado && <i className={`ch-foto__punto${p.estado ? ' ch-foto__punto--ocupado' : ''}`} aria-hidden="true" />}
            {s && <i className={`ch-foto__donde ch-tag--${p.sistema}`} title={`En ${s.nombre}`}>{s.letra}</i>}
        </span>
    );
}

export function FilaConectados({ conectados, onAbrir }) {
    const otros = (conectados || []).filter(p => !p.yo);
    if (!otros.length) return null;
    return (
        <>
            <p className="ch-sec">Conectados · {otros.length}</p>
            <div className="ch-fotos">
                {otros.map(p => (
                    <button type="button" key={p.email} className="ch-fotos__p" onClick={() => onAbrir(p)}
                        title={`Escribirle a ${p.nombre} · en ${SISTEMAS[p.sistema]?.nombre || 'la Academia'}${p.estado ? ` · ${estadoDe(p.estado)}` : ''}`}>
                        <Foto p={p} /><small>{p.nombre.split(' ')[0]}</small>
                    </button>
                ))}
            </div>
        </>
    );
}

export function Conectados({ conectados, desconectados = [], onAbrir }) {
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
                        <button type="button" key={p.email} className="ch-persona" disabled={p.yo} onClick={() => onAbrir(p)}
                            title={p.yo ? undefined : `Escribirle a ${p.nombre}`}>
                            <Foto p={p} />
                            <span>{p.nombre}{p.yo && ' (vos)'}
                                {p.estado ? <small className="ch-persona__estado">{estadoDe(p.estado)}</small> : <small>{rolDe(p)}</small>}
                            </span>
                        </button>
                    ))}
                </div>
            ))}
            {desconectados.length > 0 && (
                <>
                    <p className="ch-sec">Desconectados · {desconectados.length}</p>
                    {desconectados.map(p => (
                        <button type="button" key={p.email} className="ch-persona ch-persona--off" onClick={() => onAbrir(p)} title={`Escribirle a ${p.nombre}`}>
                            <Foto p={p} conectado={false} />
                            <span>{p.nombre}<small>{rolDe(p)} · visto {hace(p.visto)}</small></span>
                        </button>
                    ))}
                </>
            )}
        </div>
    );
}
