import React, { useState, useEffect, useMemo } from 'react';
import { PlayCircle, Save, ExternalLink, Settings2 } from 'lucide-react';
import api from '../../../../services/api';
import toast from 'react-hot-toast';
import InfoTooltip from '../../../../components/ui/InfoTooltip';
import { extractLoomId } from '../../../../utils/loom';

/*
 * Control rápido del replay público (institute-site/replay/): qué Loom se
 * muestra, entre qué fechas está disponible y a los cuántos minutos aparecen
 * la información principal y la oferta. Vive acá (en las estadísticas de la
 * landing) para que el director de marketing/admin no tenga que abrir el
 * wizard completo de "Editar taller" solo para cambiar la grabación de la
 * semana -- ese wizard (WorkshopFormModal, paso 3) sigue teniendo los mismos
 * campos para cuando ya se está completando el resto del evento.
 *
 * Se aplica siempre al taller MÁS RECIENTE (mismo criterio que el endpoint
 * público /api/public/workshop-lead/replay-config), así que configurar acá
 * el taller de la semana es lo mismo que hacerlo desde ese wizard.
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
    activa: { texto: 'Activo · aceptando visitas', tono: 'success' },
    programada: { texto: 'Programado, todavía no abrió', tono: 'warning' },
    vencida: { texto: 'Vencido', tono: 'error' },
    sin_configurar: { texto: 'Sin activar', tono: 'warning' },
};

const WorkshopReplayConfigPanel = ({ events, onSaved }) => {
    const evento = events && events.length > 0 ? events[0] : null;

    const [loomId, setLoomId] = useState('');
    const [venceHasta, setVenceHasta] = useState('');
    const [infoMin, setInfoMin] = useState(0);
    const [ofertaMin, setOfertaMin] = useState(2);
    const [duracionHoras, setDuracionHoras] = useState(48);
    const [saving, setSaving] = useState(null); // null | 'activar' | 'guardar'
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
        if (!evento || !evento.replay_activo_desde || !evento.replay_vence_hasta) {
            return { tipo: 'sin_configurar' };
        }
        const desde = new Date(evento.replay_activo_desde).getTime();
        const hasta = new Date(evento.replay_vence_hasta).getTime();
        if (ahora < desde) return { tipo: 'programada', restanteMs: desde - ahora };
        if (ahora >= hasta) return { tipo: 'vencida' };
        return { tipo: 'activa', restanteMs: hasta - ahora };
    }, [evento, ahora]);

    const guardar = async (extra, mensaje, modo) => {
        if (!evento) {
            toast.error('Registrá un workshop primero para poder configurar el replay.');
            return;
        }
        setSaving(modo);
        try {
            await api.put(`workshop/events/${evento.id}`, {
                replay_loom_id: loomId || null,
                replay_info_segundos: Math.round((parseFloat(infoMin) || 0) * 60),
                replay_oferta_segundos: Math.round((parseFloat(ofertaMin) || 0) * 60),
                ...extra,
            });
            toast.success(mensaje);
            if (onSaved) await onSaved();
        } catch (err) {
            console.error('Error guardando config del replay:', err);
            toast.error(err.response?.data?.error || 'No se pudo guardar la configuración del replay');
        } finally {
            setSaving(null);
        }
    };

    const handleActivar = () => {
        const horas = parseFloat(duracionHoras) || 48;
        const desde = new Date();
        const hasta = new Date(desde.getTime() + horas * 3600000);
        const venceStr = aInputLocal(hasta);
        setVenceHasta(venceStr);
        guardar(
            { replay_activo_desde: aInputLocal(desde), replay_vence_hasta: venceStr },
            `Replay activado: se cierra en ${horas} horas`,
            'activar'
        );
    };

    const handleGuardar = () => {
        guardar({ replay_vence_hasta: venceHasta || null }, 'Configuración del replay actualizada', 'guardar');
    };

    const badge = BADGES[estado.tipo];

    return (
        <article className="panel" style={{ padding: 22, marginBottom: 22 }}>
            <div className="section-heading">
                <div>
                    <p className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        Configuración del replay
                        <InfoTooltip
                            label="Configuración del replay"
                            text="Controla qué se muestra en institute-site/replay/: el video de Loom, entre qué fechas está disponible, y a los cuántos minutos de reproducción aparecen la información principal y la oferta con agendamiento. Se aplica siempre al taller más reciente."
                        />
                    </p>
                    <h2 style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <Settings2 size={18} /> {evento ? evento.name : 'Ningún taller registrado'}
                    </h2>
                </div>
                {evento && <span className={`status ${badge.tono}`}>{badge.texto}</span>}
            </div>

            {!evento ? (
                <p className="secondary-copy" style={{ marginTop: 12 }}>
                    Registrá un taller en "Historial" antes de configurar el replay.
                </p>
            ) : (
                <>
                    <p className="secondary-copy" style={{ marginTop: 6, marginBottom: 16 }}>
                        Se aplica al taller más reciente ({evento.date}).
                        {estado.tipo === 'activa' && ` Cierra en ${formatearRestante(estado.restanteMs)}.`}
                        {estado.tipo === 'programada' && ` Abre en ${formatearRestante(estado.restanteMs)}.`}
                    </p>

                    <div className="form-grid">
                        <label className="form-field wide">
                            <span>Link o ID del video de Loom</span>
                            <span className="field-control">
                                <input type="text" placeholder="Pegá el link de Loom (https://www.loom.com/share/...) o solo el ID" value={loomId} onChange={(e) => setLoomId(extractLoomId(e.target.value))} />
                            </span>
                        </label>
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
                        <label className="form-field">
                            <span>Vence (ajuste manual)</span>
                            <span className="field-control">
                                <input type="datetime-local" value={venceHasta} onChange={(e) => setVenceHasta(e.target.value)} />
                            </span>
                        </label>
                        <label className="form-field">
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                Duración al activar (horas)
                                <InfoTooltip
                                    label="Duración al activar"
                                    text="Al tocar Activar, la cuenta regresiva arranca ahora mismo y vence exactamente esta cantidad de horas después. No toca la fecha de 'Vence' hasta que se toque Activar."
                                />
                            </span>
                            <span className="field-control">
                                <input type="number" step="any" min="1" value={duracionHoras} onChange={(e) => setDuracionHoras(e.target.value)} />
                            </span>
                        </label>
                    </div>

                    <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
                        <button type="button" className="primary-action" onClick={handleActivar} disabled={saving !== null}>
                            <PlayCircle size={16} /> {saving === 'activar' ? 'Activando…' : `Activar ahora (${duracionHoras} h)`}
                        </button>
                        <button type="button" className="secondary-action" onClick={handleGuardar} disabled={saving !== null}>
                            <Save size={16} /> {saving === 'guardar' ? 'Guardando…' : 'Guardar cambios'}
                        </button>
                        <a
                            className="secondary-action"
                            href={REPLAY_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                        >
                            <ExternalLink size={16} /> Ver landing
                        </a>
                    </div>
                </>
            )}
        </article>
    );
};

export default WorkshopReplayConfigPanel;
