import React, { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CalendarPlus, Edit2, Trash2, Video, MessageCircle, Radio, AlertTriangle, X, Loader2, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../../services/api';
import {
    aInicioUtc, enLaLanding, esProximo, formatearInicio, nombreZona, sugerenciaProgramar, zonaNavegador,
} from '../agendaTaller';

/*
 * Próximos talleres: lo que antes se editaba en workshops.csv de institute-site.
 *
 * Las landings leen de /api/public/workshops/proximos la fecha, el Google Meet y el grupo de
 * WhatsApp de cada taller. Acá se ven y se cargan en la hora de quien mira el panel; el que
 * está «en la landing» es el primero con hora que todavía no terminó.
 */

const MAX_SEMANAS = 26;

const Enlace = ({ url, icon: Icon, heredado }) => {
    if (!url) {
        return heredado
            ? <span className="prox-heredado">El del anterior</span>
            : <span className="prox-falta">Sin link</span>;
    }
    return (
        <a className="prox-enlace" href={url} target="_blank" rel="noreferrer" title={url}>
            <Icon size={13} aria-hidden="true" /> {url.replace(/^https?:\/\//, '')}
        </a>
    );
};

/** Fechas (en la hora del navegador) que crearía «Programar». */
const fechasProgramadas = (fecha, hora, semanas) => {
    const n = Math.min(Math.max(parseInt(semanas, 10) || 0, 0), MAX_SEMANAS);
    const primero = aInicioUtc(fecha, hora);
    if (!primero || n < 1) return [];
    return Array.from({ length: n }, (_, i) => {
        const d = new Date(`${fecha}T${hora}`);
        d.setDate(d.getDate() + 7 * i);
        return d.toISOString();
    });
};

const ProgramarModal = ({ eventos, onClose, onProgramado }) => {
    const sugerencia = useMemo(() => sugerenciaProgramar(eventos), [eventos]);
    const [form, setForm] = useState({ ...sugerencia, semanas: 4 });
    const [enviando, setEnviando] = useState(false);
    const fechas = fechasProgramadas(form.fecha, form.hora, form.semanas);
    const ocupadas = new Set(eventos.map((e) => e.date));

    const campo = (clave) => ({
        value: form[clave],
        onChange: (e) => setForm((prev) => ({ ...prev, [clave]: e.target.value })),
    });

    const programar = async (e) => {
        e.preventDefault();
        if (!fechas.length || enviando) return;
        setEnviando(true);
        try {
            const res = await api.post('workshop/events/programar', {
                inicio_local: `${form.fecha}T${form.hora}`,
                zona: zonaNavegador(),
                semanas: parseInt(form.semanas, 10),
                meet_url: form.meet_url || null,
                whatsapp_url: form.whatsapp_url || null,
            });
            const { creados = [], existentes = [] } = res.data || {};
            toast.success(creados.length === 1 ? 'Se programó 1 taller' : `Se programaron ${creados.length} talleres`);
            if (existentes.length) {
                toast(`${existentes.length === 1 ? 'Una fecha ya tenía' : `${existentes.length} fechas ya tenían`} taller: no se tocaron`);
            }
            onProgramado();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.error || 'No se pudieron programar los talleres');
        } finally {
            setEnviando(false);
        }
    };

    return (
        <div className="modal-overlay">
            <button type="button" className="modal-backdrop" aria-label="Cerrar" onClick={onClose} />
            <div className="action-modal" role="dialog" aria-modal="true" aria-label="Programar talleres">
                <header>
                    <div>
                        <p className="eyebrow">Un taller por semana</p>
                        <h2>Programar talleres</h2>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
                </header>
                <div className="modal-body">
                    <form onSubmit={programar}>
                        <div className="form-grid">
                            <label className="form-field">
                                <span>Primer taller</span>
                                <span className="field-control"><input type="date" required {...campo('fecha')} /></span>
                            </label>
                            <label className="form-field">
                                <span>Hora <small className="hora-zona">· tu hora ({nombreZona()})</small></span>
                                <span className="field-control"><input type="time" required {...campo('hora')} /></span>
                            </label>
                            <label className="form-field wide">
                                <span>Cuántas semanas</span>
                                <span className="field-control"><input type="number" min="1" max={MAX_SEMANAS} required {...campo('semanas')} /></span>
                            </label>
                            <label className="form-field wide">
                                <span>Link de Google Meet</span>
                                <span className="field-control"><input type="url" placeholder="https://meet.google.com/..." {...campo('meet_url')} /></span>
                            </label>
                            <label className="form-field wide">
                                <span>Link del grupo de WhatsApp</span>
                                <span className="field-control"><input type="url" placeholder="https://chat.whatsapp.com/..." {...campo('whatsapp_url')} /></span>
                            </label>
                        </div>

                        {fechas.length > 0 && (
                            <ul className="prox-vista" aria-label="Talleres que se van a crear">
                                {fechas.map((iso) => {
                                    const dia = iso && new Date(iso);
                                    const clave = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`;
                                    const ya = ocupadas.has(clave);
                                    return (
                                        <li key={iso} className={ya ? 'ocupada' : ''}>
                                            {formatearInicio(iso)}{ya && <small> · ya tiene taller, no se toca</small>}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}

                        <div className="wizard-footer">
                            <div>
                                <button type="button" className="secondary-action" onClick={onClose}>Cancelar</button>
                            </div>
                            <div className="wizard-acciones">
                                <button type="submit" className="primary-action" disabled={!fechas.length || enviando}>
                                    {enviando ? <Loader2 size={15} className="animate-spin" /> : <Check size={16} />} Programar
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

const WorkshopProximosView = ({ events, onEdit, onDelete, onProgramado }) => {
    const [programando, setProgramando] = useState(false);
    const reducir = useReducedMotion();
    const ahora = new Date();
    const vigente = enLaLanding(events, ahora);
    const proximos = events
        .filter((e) => esProximo(e, ahora))
        .sort((a, b) => (a.inicio_at || `${a.date}T23:59`).localeCompare(b.inicio_at || `${b.date}T23:59`));
    const hayProximoConHora = proximos.some((e) => e.inicio_at);

    return (
        <section className="panel prox-panel" aria-labelledby="prox-titulo">
            <div className="section-heading">
                <div>
                    <p className="eyebrow">Lo que ven las landings</p>
                    <h2 id="prox-titulo">Próximos talleres</h2>
                    <p className="secondary-copy">
                        Horas en tu zona ({nombreZona()}). Lo que cambies se ve en las landings de institute en un minuto;
                        quien entre desde otro país lo ve en su hora.
                    </p>
                </div>
                <button type="button" className="primary-action" onClick={() => setProgramando(true)}>
                    <CalendarPlus size={16} /> Programar semanas
                </button>
            </div>

            {vigente ? (
                <article className="prox-vigente">
                    <span className="prox-vigente-tag"><Radio size={13} aria-hidden="true" /> En la landing ahora</span>
                    <strong>{formatearInicio(vigente.inicio_at)}</strong>
                    <span className="prox-vigente-nombre">{vigente.name}</span>
                    <div className="prox-vigente-links">
                        <Enlace url={vigente.meet_url} icon={Video} heredado />
                        <Enlace url={vigente.whatsapp_url} icon={MessageCircle} heredado />
                    </div>
                </article>
            ) : null}

            {!hayProximoConHora && (
                <p className="trafico-aviso">
                    <AlertTriangle size={14} aria-hidden="true" />
                    No hay ningún taller con hora por delante: las landings repiten el último cada semana con sus links.
                    Programá los próximos para que muestren la fecha y el grupo correctos.
                </p>
            )}

            {proximos.length > 0 && (
                <div className="comparison-scroll prox-tabla">
                    <table>
                        <thead>
                            <tr>
                                <th scope="col">Fecha y hora</th>
                                <th scope="col">Taller</th>
                                <th scope="col">Google Meet</th>
                                <th scope="col">Grupo de WhatsApp</th>
                                <th scope="col"><span className="sr-only">Acciones</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {proximos.map((e, i) => (
                                <motion.tr
                                    key={e.id}
                                    initial={reducir ? false : { opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.22, delay: Math.min(i, 8) * 0.04 }}
                                >
                                    <th scope="row">
                                        {e.inicio_at
                                            ? formatearInicio(e.inicio_at)
                                            : <><span>{e.date.split('-').reverse().join('/')}</span> <span className="prox-falta">Sin hora: no sale en las landings</span></>}
                                    </th>
                                    <td>{e.name}</td>
                                    <td><Enlace url={e.meet_url} icon={Video} heredado={i > 0 || Boolean(vigente)} /></td>
                                    <td><Enlace url={e.whatsapp_url} icon={MessageCircle} heredado={i > 0 || Boolean(vigente)} /></td>
                                    <td className="prox-acciones">
                                        <button type="button" className="icon-button" onClick={() => onEdit(e)} title="Editar taller" aria-label={`Editar ${e.name}`}>
                                            <Edit2 size={14} />
                                        </button>
                                        <button type="button" className="icon-button" onClick={() => onDelete(e.id)} title="Eliminar taller" aria-label={`Eliminar ${e.name}`}>
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {programando && (
                <ProgramarModal eventos={events} onClose={() => setProgramando(false)} onProgramado={onProgramado} />
            )}
        </section>
    );
};

export default WorkshopProximosView;
