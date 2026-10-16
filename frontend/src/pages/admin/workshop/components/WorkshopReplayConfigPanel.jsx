import React, { useEffect, useState } from 'react';
import { ExternalLink, PlayCircle, Save, StopCircle } from 'lucide-react';
import { PanelCab, Tip } from '../../../comercial/components/Shared';
import { extractLoomId, urlLoom } from '../../../../utils/loom';
import { usePublicacion } from '../talleres/datosTaller';
import useAhora from '../talleres/useAhora';
import {
    ESTADOS_GRABACION, estadoGrabacion, estaPublicada, REPLAY_URL, restante,
} from '../talleres/formato';

/*
 * La grabación de UN taller y su publicación en la landing (institute-site/replay/), como dos
 * decisiones separadas (16/10/2026, pedido de Kerwin):
 *
 * 1. «Grabación del taller»: el link de Loom se guarda en el taller para tener el registro de lo
 *    que se hizo (si un taller rinde bien, poder verlo). Guardarlo NO lo publica.
 * 2. «Landing de la grabación»: publicar es explícito, con «Publicar ahora (N h)», que le pone
 *    desde y vence. El endpoint público solo sirve talleres publicados (el último que se publicó).
 *
 * Vive en el detalle de cada taller (Talleres › detalle › Grabación); el interruptor rápido de la
 * tarjeta hace lo mismo que «Publicar ahora (48 h)» / «Dejar de publicar».
 */

const minutos = (seg, porDefecto) => (seg != null ? Math.round((seg / 60) * 10) / 10 : porDefecto);

const WorkshopReplayConfigPanel = ({ evento, onSaved }) => {
    const [loomId, setLoomId] = useState('');
    const [venceHasta, setVenceHasta] = useState('');
    const [infoMin, setInfoMin] = useState(0);
    const [ofertaMin, setOfertaMin] = useState(2);
    const [duracionHoras, setDuracionHoras] = useState(48);
    const ahora = useAhora(1000);
    const { guardar, publicar, despublicar, guardando } = usePublicacion(evento, onSaved);

    useEffect(() => {
        if (!evento) return;
        setLoomId(evento.replay_loom_id || '');
        setVenceHasta(evento.replay_vence_hasta ? evento.replay_vence_hasta.slice(0, 16) : '');
        setInfoMin(minutos(evento.replay_info_segundos, 0));
        setOfertaMin(minutos(evento.replay_oferta_segundos, 2));
    }, [evento?.id, evento?.replay_loom_id, evento?.replay_vence_hasta, evento?.replay_info_segundos, evento?.replay_oferta_segundos]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!evento) return null;

    const estado = estadoGrabacion(evento, ahora);
    const badge = ESTADOS_GRABACION[estado.tipo];
    const publicada = estaPublicada(estado);
    const guardadoLoom = evento.replay_loom_id || '';
    const cambioSinGuardar = (loomId || '') !== guardadoLoom;
    const segundos = () => ({
        infoSegundos: Math.round((parseFloat(infoMin) || 0) * 60),
        ofertaSegundos: Math.round((parseFloat(ofertaMin) || 0) * 60),
    });

    const guardarGrabacion = () => guardar(
        { replay_loom_id: loomId || null },
        loomId ? 'Grabación guardada en el taller (no se publicó)' : 'Grabación quitada del taller',
        'grabacion',
    );

    const publicarAhora = () => publicar({ horas: duracionHoras, loomId, ...segundos() });

    const guardarPublicacion = () => {
        const s = segundos();
        return guardar(
            { replay_info_segundos: s.infoSegundos, replay_oferta_segundos: s.ofertaSegundos, replay_vence_hasta: venceHasta || null },
            'Publicación actualizada',
            'vence',
        );
    };

    return (
        <div className="vista wt-vista">
            <section className="panel wt-panel" aria-label="Grabación del taller">
                <PanelCab titulo="Grabación del taller"
                    tip="Guardarlo no lo publica en la landing." />
                <div className="wt-grabacion-link">
                    <label className="campo">
                        <span className="t-rotulo">Link o ID del video de Loom</span>
                        <input type="text" placeholder="https://www.loom.com/share/… o solo el ID"
                            value={loomId} onChange={(e) => setLoomId(extractLoomId(e.target.value))} />
                    </label>
                    <div className="wt-botones">
                        <button type="button" className="btn btn--linea btn--sm" onClick={guardarGrabacion}
                            disabled={guardando !== null || !cambioSinGuardar}>
                            <Save aria-hidden="true" /> {guardando === 'grabacion' ? 'Guardando…' : 'Guardar grabación'}
                        </button>
                        {guardadoLoom && (
                            <a className="btn btn--linea btn--sm" href={urlLoom(guardadoLoom)} target="_blank" rel="noopener noreferrer">
                                <PlayCircle aria-hidden="true" /> Ver grabación
                            </a>
                        )}
                    </div>
                </div>
                <p className="t-cap mut40">
                    {guardadoLoom
                        ? 'Guardada en este taller. No se publica hasta que lo decidas abajo.'
                        : 'Este taller todavía no tiene la grabación guardada.'}
                </p>
            </section>

            <section className="panel wt-panel" aria-label="Landing de la grabación">
                <PanelCab titulo="Landing de la grabación"
                    tip="Se publica ahora y se cierra sola. La landing muestra el último.">
                    <span className="chip" style={{ '--c': `var(--${badge.tono})` }}>{badge.texto}</span>
                </PanelCab>
                <p className="t-cap mut num wt-publicacion-estado">
                    {estado.tipo === 'activa' && `Se está mostrando. Se cierra en ${restante(estado.restanteMs, { segundos: true })}.`}
                    {estado.tipo === 'programada' && `Se abre en ${restante(estado.restanteMs, { segundos: true })}.`}
                    {estado.tipo === 'vencida' && 'Se publicó y ya cerró.'}
                    {(estado.tipo === 'sin_publicar' || estado.tipo === 'sin_grabacion') && 'No se muestra en la landing.'}
                </p>

                <div className="pareja wt-campos" style={{ '--min': '170px', '--g': 'var(--s3)' }}>
                    <label className="campo">
                        <span className="t-rotulo">Info principal a los (min)</span>
                        <input type="number" step="any" min="0" value={infoMin} onChange={(e) => setInfoMin(e.target.value)} />
                    </label>
                    <label className="campo">
                        <span className="t-rotulo">Oferta a los (min)</span>
                        <input type="number" step="any" min="0" value={ofertaMin} onChange={(e) => setOfertaMin(e.target.value)} />
                    </label>
                    {publicada ? (
                        <label className="campo">
                            <span className="t-rotulo">Se cierra</span>
                            <input type="datetime-local" value={venceHasta} onChange={(e) => setVenceHasta(e.target.value)} />
                        </label>
                    ) : (
                        <label className="campo">
                            <span className="t-rotulo">Publicarla por (horas)</span>
                            <input type="number" step="any" min="1" value={duracionHoras} onChange={(e) => setDuracionHoras(e.target.value)} />
                        </label>
                    )}
                </div>

                <div className="wt-botones">
                    {publicada ? (
                        <>
                            <button type="button" className="btn btn--linea btn--sm" onClick={guardarPublicacion} disabled={guardando !== null}>
                                <Save aria-hidden="true" /> {guardando === 'vence' ? 'Guardando…' : 'Guardar cambios'}
                            </button>
                            <button type="button" className="btn btn--linea btn--sm wt-btn-peligro" onClick={() => despublicar(estado)} disabled={guardando !== null}>
                                <StopCircle aria-hidden="true" /> {guardando === 'despublicar' ? 'Quitando…' : 'Dejar de publicar'}
                            </button>
                        </>
                    ) : (
                        <button type="button" className="btn btn--cta btn--sm" onClick={publicarAhora}
                            disabled={guardando !== null || !guardadoLoom || cambioSinGuardar}
                            title={!guardadoLoom || cambioSinGuardar ? 'Primero guardá la grabación del taller' : undefined}>
                            <PlayCircle aria-hidden="true" /> {guardando === 'publicar' ? 'Publicando…' : `Publicar ahora (${duracionHoras} h)`}
                        </button>
                    )}
                    <a className="btn btn--linea btn--sm" href={REPLAY_URL} target="_blank" rel="noopener noreferrer">
                        <ExternalLink aria-hidden="true" /> Ver landing
                    </a>
                    <Tip titulo="Ojo con la hora" texto="Las fechas se arman con la hora de esta compu." />
                </div>
            </section>
        </div>
    );
};

export default WorkshopReplayConfigPanel;
