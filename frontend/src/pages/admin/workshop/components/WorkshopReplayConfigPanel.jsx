import React, { useState, useEffect, useMemo } from 'react';
import { PlayCircle, Save, ExternalLink, Video, Globe, StopCircle } from 'lucide-react';
import api from '../../../../services/api';
import toast from 'react-hot-toast';
import InfoTooltip from '../../../../components/ui/InfoTooltip';
import { extractLoomId, urlLoom } from '../../../../utils/loom';
import { esProximo } from '../agendaTaller';

/*
 * La grabación de cada taller y su publicación en la landing (institute-site/replay/), como dos
 * decisiones separadas (16/10/2026, pedido de Kerwin):
 *
 * 1. «Grabación del taller»: el link de Loom se guarda en el taller para tener el registro de lo
 *    que se hizo (si un taller rinde bien, poder verlo). Guardarlo NO lo publica.
 * 2. «Landing de la grabación»: publicar es explícito, con «Publicar ahora (N h)», que le pone
 *    desde y vence. El endpoint público solo sirve talleres publicados (el último que se publicó);
 *    antes alcanzaba con el Loom y la landing lo mostraba con su ciclo semanal genérico.
 *
 * El taller se elige: por defecto el último que ya se hizo (antes era `events[0]`, que con talleres
 * programados en «Próximos» caía en uno que todavía no pasó).
 */

const REPLAY_URL = 'https://institute.thelearnation.com/replay/';

const pad = (n) => String(Math.max(0, Math.trunc(n))).padStart(2, '0');

const formatearRestante = (ms) => {
    if (ms <= 0) return '00:00:00';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
};

// El input datetime-local necesita "YYYY-MM-DDTHH:mm" en hora LOCAL tal cual
// la ve el admin -- toISOString() por sí solo convierte a UTC y correría la
// hora mostrada, igual que ya evita WorkshopFormModal con .slice(0, 16).
const aInputLocal = (date) => {
    const offsetMs = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const BADGES = {
    activa: { texto: 'Publicada', tono: 'success' },
    programada: { texto: 'Programada', tono: 'warning' },
    vencida: { texto: 'Ya no se publica', tono: 'error' },
    sin_publicar: { texto: 'No publicada', tono: 'warning' },
};

const WorkshopReplayConfigPanel = ({ events, onSaved, formatDate = (d) => d }) => {
    const ordenados = useMemo(
        () => [...(events || [])].sort((a, b) => (b.date || '').localeCompare(a.date || '')),
        [events]
    );
    const [eventoId, setEventoId] = useState(null);
    const evento = ordenados.find((e) => e.id === eventoId)
        || ordenados.find((e) => !esProximo(e))
        || ordenados[0]
        || null;

    const [loomId, setLoomId] = useState('');
    const [venceHasta, setVenceHasta] = useState('');
    const [infoMin, setInfoMin] = useState(0);
    const [ofertaMin, setOfertaMin] = useState(2);
    const [duracionHoras, setDuracionHoras] = useState(48);
    const [saving, setSaving] = useState(null); // null | 'grabacion' | 'publicar' | 'despublicar' | 'vence'
    const [ahora, setAhora] = useState(Date.now());

    useEffect(() => {
        if (!evento) return;
        setLoomId(evento.replay_loom_id || '');
        setVenceHasta(evento.replay_vence_hasta ? evento.replay_vence_hasta.slice(0, 16) : '');
        setInfoMin(evento.replay_info_segundos != null ? Math.round((evento.replay_info_segundos / 60) * 10) / 10 : 0);
        setOfertaMin(evento.replay_oferta_segundos != null ? Math.round((evento.replay_oferta_segundos / 60) * 10) / 10 : 2);
    }, [evento?.id, evento?.replay_loom_id, evento?.replay_vence_hasta, evento?.replay_info_segundos, evento?.replay_oferta_segundos]);

    useEffect(() => {
        const t = setInterval(() => setAhora(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    const estado = useMemo(() => {
        if (!evento || !evento.replay_loom_id || !evento.replay_activo_desde || !evento.replay_vence_hasta) {
            return { tipo: 'sin_publicar' };
        }
        const desde = new Date(evento.replay_activo_desde).getTime();
        const hasta = new Date(evento.replay_vence_hasta).getTime();
        if (ahora < desde) return { tipo: 'programada', restanteMs: desde - ahora };
        if (ahora >= hasta) return { tipo: 'vencida' };
        return { tipo: 'activa', restanteMs: hasta - ahora };
    }, [evento, ahora]);

    const guardar = async (cuerpo, mensaje, modo) => {
        if (!evento) return;
        setSaving(modo);
        try {
            await api.put(`workshop/events/${evento.id}`, cuerpo);
            toast.success(mensaje);
            if (onSaved) await onSaved();
        } catch (err) {
            console.error('Error guardando la grabación del taller:', err);
            toast.error(err.response?.data?.error || 'No se pudo guardar');
        } finally {
            setSaving(null);
        }
    };

    const tiempos = () => ({
        replay_info_segundos: Math.round((parseFloat(infoMin) || 0) * 60),
        replay_oferta_segundos: Math.round((parseFloat(ofertaMin) || 0) * 60),
    });

    const guardarGrabacion = () => guardar(
        { replay_loom_id: loomId || null },
        loomId ? 'Grabación guardada en el taller (no se publicó)' : 'Grabación quitada del taller',
        'grabacion'
    );

    const publicar = () => {
        const horas = parseFloat(duracionHoras) || 48;
        const desde = new Date();
        const hasta = new Date(desde.getTime() + horas * 3600000);
        const venceStr = aInputLocal(hasta);
        setVenceHasta(venceStr);
        guardar(
            { replay_loom_id: loomId, ...tiempos(), replay_activo_desde: aInputLocal(desde), replay_vence_hasta: venceStr },
            `Grabación publicada en la landing: se cierra en ${horas} horas`,
            'publicar'
        );
    };

    // Dejar de publicar = vence ahora. La landing pasa a «vencido» en vez de mostrar su video por defecto.
    const despublicar = () => {
        const ya = aInputLocal(new Date());
        const cuerpo = { replay_vence_hasta: ya };
        if (estado.tipo === 'programada') cuerpo.replay_activo_desde = ya;
        guardar(cuerpo, 'La grabación ya no se publica en la landing', 'despublicar');
    };

    const guardarPublicacion = () => guardar(
        { ...tiempos(), replay_vence_hasta: venceHasta || null },
        'Publicación actualizada',
        'vence'
    );

    const badge = BADGES[estado.tipo];
    const publicada = estado.tipo === 'activa' || estado.tipo === 'programada';
    const guardadoLoom = evento?.replay_loom_id || '';
    const cambioSinGuardar = (loomId || '') !== guardadoLoom;

    if (!evento) {
        return (
            <article className="panel ws-grabacion">
                <p className="secondary-copy">Registrá un taller en «Historial» antes de cargar su grabación.</p>
            </article>
        );
    }

    return (
        <article className="panel ws-grabacion">
            <div className="section-heading">
                <div>
                    <p className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        Grabación del taller
                        <InfoTooltip
                            label="Grabación del taller"
                            text="El link de Loom de cada taller queda guardado en ese taller, para poder volver a ver qué se hizo en los que rindieron bien. Guardarlo no lo publica: publicar en la landing de la grabación es otra decisión, abajo."
                        />
                    </p>
                    <h2 style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <Video size={18} /> {evento.name}
                    </h2>
                </div>
                <label className="ws-grabacion-taller">
                    <span>Taller</span>
                    <select value={evento.id} onChange={(e) => setEventoId(Number(e.target.value))}>
                        {ordenados.map((e) => (
                            <option key={e.id} value={e.id}>
                                {formatDate(e.date)} · {e.name}{e.replay_loom_id ? ' · con grabación' : ''}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <div className="ws-grabacion-link">
                <label className="form-field">
                    <span>Link o ID del video de Loom</span>
                    <span className="field-control">
                        <input type="text" placeholder="Pegá el link de Loom (https://www.loom.com/share/...) o solo el ID"
                            value={loomId} onChange={(e) => setLoomId(extractLoomId(e.target.value))} />
                    </span>
                </label>
                <div className="ws-grabacion-acciones">
                    <button type="button" className="secondary-action" onClick={guardarGrabacion}
                        disabled={saving !== null || !cambioSinGuardar}>
                        <Save size={16} /> {saving === 'grabacion' ? 'Guardando…' : 'Guardar grabación'}
                    </button>
                    {guardadoLoom && (
                        <a className="secondary-action" href={urlLoom(guardadoLoom)} target="_blank" rel="noopener noreferrer"
                            style={{ textDecoration: 'none' }}>
                            <PlayCircle size={16} /> Ver grabación
                        </a>
                    )}
                </div>
            </div>
            <p className="ws-grabacion-nota">
                {guardadoLoom
                    ? 'Guardada en este taller. No se publica hasta que lo decidas abajo.'
                    : 'Este taller todavía no tiene la grabación guardada.'}
            </p>

            <section className="ws-publicacion" aria-labelledby="ws-publicacion-titulo">
                <div className="ws-publicacion-cabeza">
                    <div>
                        <h3 id="ws-publicacion-titulo"><Globe size={15} /> Publicar en la landing de la grabación</h3>
                        <p>
                            {estado.tipo === 'activa' && `Se está mostrando en la landing. Se cierra en ${formatearRestante(estado.restanteMs)}.`}
                            {estado.tipo === 'programada' && `Se abre en la landing en ${formatearRestante(estado.restanteMs)}.`}
                            {estado.tipo === 'vencida' && 'Se publicó y ya cerró.'}
                            {estado.tipo === 'sin_publicar' && 'No se muestra en la landing. Solo se publica si lo publicás acá.'}
                            {' '}La landing muestra el último taller que se publicó.
                        </p>
                    </div>
                    <span className={`status ${badge.tono}`}>{badge.texto}</span>
                </div>

                <div className="form-grid">
                    <label className="form-field">
                        <span>Mostrar info principal a los (min)</span>
                        <span className="field-control">
                            <input type="number" step="any" min="0" value={infoMin} onChange={(e) => setInfoMin(e.target.value)} />
                        </span>
                    </label>
                    <label className="form-field">
                        <span>Mostrar oferta/agendamiento a los (min)</span>
                        <span className="field-control">
                            <input type="number" step="any" min="0" value={ofertaMin} onChange={(e) => setOfertaMin(e.target.value)} />
                        </span>
                    </label>
                    {publicada ? (
                        <label className="form-field wide">
                            <span>Se cierra (ajuste manual)</span>
                            <span className="field-control">
                                <input type="datetime-local" value={venceHasta} onChange={(e) => setVenceHasta(e.target.value)} />
                            </span>
                        </label>
                    ) : (
                        <label className="form-field wide">
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                Cuánto tiempo publicarla (horas)
                                <InfoTooltip
                                    label="Cuánto tiempo publicarla"
                                    text="Al tocar «Publicar ahora», la grabación aparece en la landing en ese momento y se cierra exactamente esta cantidad de horas después."
                                />
                            </span>
                            <span className="field-control">
                                <input type="number" step="any" min="1" value={duracionHoras} onChange={(e) => setDuracionHoras(e.target.value)} />
                            </span>
                        </label>
                    )}
                </div>

                <div className="ws-grabacion-acciones" style={{ marginTop: 16 }}>
                    {publicada ? (
                        <>
                            <button type="button" className="secondary-action" onClick={guardarPublicacion} disabled={saving !== null}>
                                <Save size={16} /> {saving === 'vence' ? 'Guardando…' : 'Guardar cambios'}
                            </button>
                            <button type="button" className="secondary-action ws-despublicar" onClick={despublicar} disabled={saving !== null}>
                                <StopCircle size={16} /> {saving === 'despublicar' ? 'Quitando…' : 'Dejar de publicar'}
                            </button>
                        </>
                    ) : (
                        <button type="button" className="primary-action" onClick={publicar}
                            disabled={saving !== null || !guardadoLoom || cambioSinGuardar}
                            title={!guardadoLoom || cambioSinGuardar ? 'Primero guardá la grabación del taller' : undefined}>
                            <PlayCircle size={16} /> {saving === 'publicar' ? 'Publicando…' : `Publicar ahora (${duracionHoras} h)`}
                        </button>
                    )}
                    <a className="secondary-action" href={REPLAY_URL} target="_blank" rel="noopener noreferrer"
                        style={{ textDecoration: 'none' }}>
                        <ExternalLink size={16} /> Ver landing
                    </a>
                </div>
            </section>
        </article>
    );
};

export default WorkshopReplayConfigPanel;
