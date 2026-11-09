import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Check, SlidersHorizontal } from 'lucide-react';
import { Humo } from '../../../comercial/components/Shared';
import api from '../../../../services/api';
import { haceTxt, horasDesde, pideNum } from '../lib/vista';
import { Bandera, ChipModalidad, Inicial } from './Piezas';
import { porSeccion } from './PanelDecision';

// Arriba del Inbox: la próxima postulación a revisar (la que pide menos entre las
// que nadie miró) y el porcentaje de aprobación y de reserva.

const HUMO_MARCA = ['var(--brand-secondary)', 'var(--brand-primary)', 'var(--brand-secondary-light)', 'var(--focus-blue)'];

// Nombre corto de cada criterio de Clarity, para los chips de «por qué está arriba».
export const CRITERIO_CORTO = {
    criterio: 'Criterio', aporte: 'Aporte', experiencia: 'Experiencia', herramientas: 'Herramientas',
    ia: 'IA', digital: 'Digital y remoto', dinero: 'Dinero y gente', video: 'Video', idiomas: 'Idiomas',
    pretension: 'Pretensión', escritura: 'Escritura',
};

const Foco = ({ p, pesos, onAbrir, onPesos }) => {
    const [criterios, setCriterios] = useState(null);

    // Los valores por criterio salen del detalle: el listado no los trae.
    useEffect(() => {
        let vigente = true;
        setCriterios(null);
        if (!p) return undefined;
        api.get(`/assistant-applications/${p.id}`)
            .then((res) => {
                if (!vigente) return;
                // Con puntos en el formulario, las razones son sus secciones (ver hiring_puntaje).
                const secciones = porSeccion(res.data.puntaje);
                setCriterios(secciones.length
                    ? Object.fromEntries(secciones.map((g) => [`sec:${g.bloque}`, g.ratio]))
                    : res.data.criterios || {});
            })
            .catch(() => { if (vigente) setCriterios({}); });
        return () => { vigente = false; };
    }, [p?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Sin nadie por revisar no hay tarjeta: el aviso animado de la lista ya lo dice.
    if (!p) return null;

    const razones = Object.entries(criterios || {})
        .filter(([id]) => id.startsWith('sec:') || (pesos[id] || 0) > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
    const pide = pideNum(p);

    return (
        <section className="tl-foco caja" aria-label="Próxima a revisar">
            <Humo colores={HUMO_MARCA} tarjeta />
            <div className="tl-foco-id">
                <Inicial nombre={p.nombre} />
                <div>
                    <p className="tl-rotulo" style={{ color: 'var(--brand-secondary)' }}>Próxima a revisar</p>
                    <h2 className="t-h3 trunc">{p.nombre}</h2>
                    <div className="tl-foco-meta">
                        <Bandera de={p.pais} />
                        {[p.provincia || p.pais, p.edad && `${p.edad} años`, haceTxt(horasDesde(p.created_at)).toLowerCase()].filter(Boolean).join(' · ')}
                        <ChipModalidad modalidad={p.modalidad} />
                    </div>
                </div>
            </div>
            <div className="tl-foco-cifras">
                {pide > 0 && (
                    <div className="tl-foco-precio" title="Va primero la que pide menos">
                        <span className="tl-cifra tl-cifra--m">{pide}<small>USD</small></span>
                        <span className="tl-rotulo">La más barata</span>
                    </div>
                )}
                <div className="tl-foco-score">
                    <span className="tl-cifra tl-cifra--m">{p.score ?? '—'}</span>
                    <span className="tl-rotulo">Score</span>
                </div>
            </div>
            <div className="tl-foco-pie">
                <div className="tl-foco-razones">
                    {razones.map(([id, v]) => (
                        <span key={id} className="chip chip--neutro"><Check size={12} />{id.startsWith('sec:') ? id.slice(4) : CRITERIO_CORTO[id] || id} {Math.round(v * 100)}</span>
                    ))}
                </div>
                <div className="tl-foco-acc">
                    <button type="button" className="btn btn--sm btn--linea" onClick={onPesos}><SlidersHorizontal /> Pesos</button>
                    <button type="button" className="btn btn--sm btn--cta" onClick={() => onAbrir(p.id)}>Abrir postulación <ArrowUpRight /></button>
                </div>
            </div>
        </section>
    );
};

// Un porcentaje sobre las postulaciones con decisión, con su anillo.
const pctTxt = (n) => n.toLocaleString('es', { maximumFractionDigits: 1 });

const Tasa = ({ l, n, total, color, onClick }) => {
    const pct = total ? (n / total) * 100 : 0;
    return (
        <button type="button" className="tl-tasa" style={{ '--c': color }} onClick={onClick} title={`${n} de ${total} con decisión`}>
            <svg viewBox="0 0 36 36" className="tl-tasa-aro" aria-hidden="true">
                <circle cx="18" cy="18" r="15.5" pathLength="100" className="fondo" />
                <circle cx="18" cy="18" r="15.5" pathLength="100" className="valor" style={{ strokeDasharray: `${Math.max(pct, 1.5)} 100` }} />
            </svg>
            <span className="tl-tasa-txt">
                <span className="tl-cifra tl-cifra--m">{pctTxt(pct)}<small>%</small></span>
                <span className="tl-tasa-l">{l}</span>
            </span>
        </button>
    );
};

// Lo que importa de un vistazo: qué parte de lo decidido se aprueba y qué parte queda en reserva.
const Avance = ({ c, onIr }) => {
    const total = c.anal + c.fin;
    return (
        <section className="panel tl-avance" aria-label="Aprobación y reserva">
            <Tasa l="Aprobación" n={c.seleccionada + c.fin} total={total} color="var(--success)" onClick={() => onIr('anal', 'seleccionada')} />
            <Tasa l="Reserva" n={c.en_reserva} total={total} color="var(--info)" onClick={() => onIr('anal', 'en_reserva')} />
        </section>
    );
};

const ResumenInbox = ({ proxima, cuentas, pesos, onAbrir, onPesos, onIr }) => (
    <div className="tl-resumen">
        <Foco p={proxima} pesos={pesos} onAbrir={onAbrir} onPesos={onPesos} />
        <Avance c={cuentas} onIr={onIr} />
    </div>
);

export default ResumenInbox;
