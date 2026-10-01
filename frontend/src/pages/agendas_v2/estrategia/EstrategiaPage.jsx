import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ExternalLink, RotateCcw, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import SeccionPuntaje from './SeccionPuntaje';
import SeccionSegmentos from './SeccionSegmentos';
import SeccionReparto from './SeccionReparto';
import { PanelLectura, PanelPrueba, PanelSimulacion } from './PanelLateral';
import { FUNNELS } from '../shared/mockData';
import { cargarEstrategia, guardarEstrategia, restablecerEstrategia } from '../shared/labStore';
import './estrategia.css';

// Laboratorio del constructor de estrategia del director comercial. Edita una estrategia por embudo,
// la muestra leída en castellano y la prueba con el mismo motor que usa la página de reserva.
export default function EstrategiaPage() {
    const params = useParams();
    const [funnelId, setFunnelId] = useState(params.funnel || 'workshop');
    const [estrategia, setEstrategia] = useState(() => cargarEstrategia(funnelId));
    const [cambios, setCambios] = useState(false);

    useEffect(() => { setEstrategia(cargarEstrategia(funnelId)); setCambios(false); }, [funnelId]);

    const editar = useCallback((fn) => {
        setEstrategia(prev => {
            const next = structuredClone(prev);
            fn(next);
            guardarEstrategia(funnelId, next);
            return next;
        });
        setCambios(true);
    }, [funnelId]);

    const orden = [...estrategia.segmentos].sort((a, b) => b.desde - a.desde);

    return (
        <div className="bg-v6 ag2-dir">
            <header className="top-v6">
                <div className="topin" style={{ flexWrap: 'wrap' }}>
                    <div className="brand-v6">
                        <div className="logo-v6">A</div>
                        <div><h1>Agendas 2.0</h1><small>Estrategia · laboratorio</small></div>
                    </div>
                    <nav className="ag2-tabs" aria-label="Embudos">
                        {FUNNELS.map(f => (
                            <button key={f.id} type="button" className={`ag2-tab ${f.id === funnelId ? 'on' : ''}`} aria-current={f.id === funnelId ? 'page' : undefined}
                                onClick={() => setFunnelId(f.id)}>{f.nombre}</button>
                        ))}
                    </nav>
                    <div className="ag2-top-actions">
                        <span className={`ag2-pill ${cambios ? 'warn' : ''}`}>v{estrategia.version}{cambios ? ' · borrador' : ' · publicada'}</span>
                        <button type="button" className="ag2-b" onClick={() => { setEstrategia(restablecerEstrategia(funnelId)); setCambios(false); }}>
                            <RotateCcw size={14} /> Restablecer
                        </button>
                        <Link className="ag2-b" to={`/agendas-v2/reserva/${funnelId}`} target="_blank" rel="noreferrer">
                            <ExternalLink size={14} /> Probar reserva
                        </Link>
                        <button type="button" className="ag2-b pri" disabled={!cambios}
                            onClick={() => toast('En el laboratorio no se publica: la versión queda guardada solo en este navegador.')}>
                            <Upload size={14} /> Publicar v{estrategia.version + 1}
                        </button>
                    </div>
                </div>
            </header>

            <div className="ag2-body">
                <div className="ag2-col">
                    <SeccionPuntaje estrategia={estrategia} editar={editar} />
                    <SeccionSegmentos estrategia={estrategia} editar={editar} />
                    {orden.filter(s => estrategia.enrutamiento[s.id]).map(s => (
                        <SeccionReparto key={s.id} segmento={s} estrategia={estrategia} editar={editar} />
                    ))}
                    <section className="ag2-card" aria-labelledby="ag2-oferta">
                        <div className="ag2-card-h">
                            <div>
                                <h2 id="ag2-oferta">Horarios que ve el lead</h2>
                                <p>Mínimo de horarios a ofrecer en las próximas 48 h. Si los closers preferidos no llegan, se suma el siguiente de la cola. Más alto: agenda más rápido. Más bajo: respeta más el orden.</p>
                            </div>
                            <b style={{ fontSize: 28, fontWeight: 900 }}>{estrategia.oferta.minHorarios48h}</b>
                        </div>
                        <input className="ag2-range" type="range" min={1} max={20} value={estrategia.oferta.minHorarios48h}
                            aria-label="Mínimo de horarios en 48 horas"
                            onChange={(e) => editar(x => { x.oferta.minHorarios48h = Number(e.target.value); })} />
                    </section>
                </div>

                <aside className="ag2-side">
                    <PanelLectura estrategia={estrategia} />
                    <PanelPrueba estrategia={estrategia} />
                    <PanelSimulacion estrategia={estrategia} />
                </aside>
            </div>
        </div>
    );
}
