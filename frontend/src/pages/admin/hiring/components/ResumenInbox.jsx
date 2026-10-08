import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Check, Layers, SlidersHorizontal } from 'lucide-react';
import { Humo } from '../../../comercial/components/Shared';
import api from '../../../../services/api';
import { haceTxt, horasDesde, pideNum } from '../lib/vista';
import { Bandera, ChipModalidad, Inicial } from './Piezas';

// Arriba del Inbox: la próxima postulación a revisar (la de mejor score entre las
// que nadie miró) y el avance de la revisión entera. Las dos tarjetas de la
// referencia.

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
            .then((res) => { if (vigente) setCriterios(res.data.criterios || {}); })
            .catch(() => { if (vigente) setCriterios({}); });
        return () => { vigente = false; };
    }, [p?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!p) {
        return (
            <section className="tl-foco caja" aria-label="Próxima a revisar">
                <Humo colores={HUMO_MARCA} tarjeta />
                <div className="tl-foco-id">
                    <span className="tl-vacio-ico"><Check size={22} /></span>
                    <div>
                        <p className="tl-rotulo">Al día</p>
                        <h2 className="t-h3">No queda nadie completo por revisar</h2>
                    </div>
                </div>
            </section>
        );
    }

    const razones = Object.entries(criterios || {})
        .filter(([id]) => (pesos[id] || 0) > 0)
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
            <div className="tl-foco-score">
                <span className="tl-cifra tl-cifra--m">{p.score ?? '—'}</span>
                <span className="tl-rotulo">Score</span>
            </div>
            <div className="tl-foco-pie">
                <div className="tl-foco-razones">
                    {razones.map(([id, v]) => (
                        <span key={id} className="chip chip--neutro"><Check size={12} />{CRITERIO_CORTO[id] || id} {Math.round(v * 100)}</span>
                    ))}
                    {pide > 0 && <span className="chip chip--neutro">{pide} USD / mes</span>}
                </div>
                <div className="tl-foco-acc">
                    <button type="button" className="btn btn--sm btn--linea" onClick={onPesos}><SlidersHorizontal /> Pesos</button>
                    <button type="button" className="btn btn--sm btn--cta" onClick={() => onAbrir(p.id)}>Abrir postulación <ArrowUpRight /></button>
                </div>
            </div>
        </section>
    );
};

const Avance = ({ c, onIr }) => {
    const partes = [
        { id: 'seleccionada', l: 'Seleccionadas', n: c.seleccionada, color: 'var(--success)', ir: ['anal', 'seleccionada'] },
        { id: 'en_reserva', l: 'En reserva', n: c.en_reserva, color: 'var(--info)', ir: ['anal', 'en_reserva'] },
        { id: 'descartado', l: 'Descartadas', n: c.descartado, color: 'var(--idle)', ir: ['anal', 'descartado'] },
        { id: 'fin', l: 'Finalistas', n: c.fin, color: 'var(--warning)', ir: ['fin', 'testeo'] },
        { id: 'sin', l: 'Sin analizar', n: c.sin_analizar, color: 'var(--border-control)', ir: ['pend', null] },
    ];
    const conDecision = c.anal + c.fin;
    const universo = conDecision + c.sin_analizar;
    return (
        <section className="panel tl-avance" aria-label="Avance de la revisión">
            <div className="tl-cab"><span className="tl-rotulo"><Layers size={14} />Avance de la revisión</span></div>
            <div className="tl-avance-n">
                <span className="tl-cifra tl-cifra--m">{conDecision}</span>
                <span>de {universo} postulaciones con decisión{c.incompletas ? ` · ${c.incompletas} incompletas` : ''}</span>
            </div>
            <div className="tl-segmentada" aria-hidden="true">
                {partes.filter((x) => x.n).map((x, i) => (
                    <i key={x.id} style={{ flex: x.n, background: x.color, animationDelay: `${i * 70}ms` }} />
                ))}
            </div>
            <div className="tl-leyenda">
                {partes.map((x) => (
                    <button key={x.id} type="button" className="tl-ley" onClick={() => onIr(...x.ir)}>
                        <i style={{ background: x.color }} />{x.l}<b>{x.n}</b>
                    </button>
                ))}
            </div>
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
