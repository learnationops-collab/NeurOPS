import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, CalendarPlus, Check, Edit2, Loader2, MessageCircle, Radio, Trash2, Video } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../../services/api';
import { PanelCab } from '../../../comercial/components/Shared';
import ModalPlan from '../planificar/ModalPlan';
import { talleresPorDelante } from '../planificar/plan';
import {
    aInicioUtc, enLaLanding, esProximo, formatearInicio, nombreZona, sugerenciaProgramar, zonaNavegador,
} from '../agendaTaller';

/*
 * Próximos talleres: lo que antes se editaba en workshops.csv de institute-site. Las acciones de cada
 * taller se vieron acá del 16 al 24/10/2026; ahora van todas en el Plan de acciones.
 *
 * Las landings leen de /api/public/workshops/proximos la fecha, el Google Meet y el grupo de
 * WhatsApp de cada taller. Acá se ven y se cargan en la hora de quien mira el panel; el que
 * está «en la landing» es el primero con hora que todavía no terminó.
 */

const MAX_SEMANAS = 26;

/** El link de un taller: el suyo, el que hereda del anterior o ninguno. */
const Enlace = ({ url, icon: Icon, nombre, heredado }) => {
    if (url) {
        return (
            <a className="chip wp-enlace" style={{ '--c': 'var(--success)' }} href={url} target="_blank" rel="noreferrer" title={url}>
                <Icon aria-hidden="true" /> {nombre}
            </a>
        );
    }
    return heredado
        ? <span className="chip" style={{ '--c': 'var(--idle)' }} title="Las landings usan el del taller anterior"><Icon aria-hidden="true" /> {nombre} heredado</span>
        : <span className="chip" style={{ '--c': 'var(--warning)' }}><Icon aria-hidden="true" /> Sin {nombre}</span>;
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

    const programar = async () => {
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
        <ModalPlan titulo="Programar talleres" eyebrow="Un taller por semana" onCerrar={onClose} onSubmit={programar}
            cerrable={!enviando}
            pie={(
                <>
                    <button type="button" className="btn btn--linea btn--sm" onClick={onClose} disabled={enviando}>Cancelar</button>
                    <button type="submit" className="btn btn--cta btn--sm" disabled={!fechas.length || enviando}>
                        {enviando ? <Loader2 className="ws-gira" aria-hidden="true" /> : <Check aria-hidden="true" />} Programar
                    </button>
                </>
            )}>
            <div className="wp-campos-3">
                <label className="wp-campo">
                    <span className="t-rotulo">Primer taller</span>
                    <input type="date" required {...campo('fecha')} />
                </label>
                <label className="wp-campo">
                    <span className="t-rotulo">Hora · {nombreZona()}</span>
                    <input type="time" required {...campo('hora')} />
                </label>
                <label className="wp-campo">
                    <span className="t-rotulo">Semanas</span>
                    <input type="number" min="1" max={MAX_SEMANAS} required {...campo('semanas')} />
                </label>
            </div>
            <label className="wp-campo">
                <span className="t-rotulo">Google Meet</span>
                <input type="url" placeholder="https://meet.google.com/..." {...campo('meet_url')} />
            </label>
            <label className="wp-campo">
                <span className="t-rotulo">Grupo de WhatsApp</span>
                <input type="url" placeholder="https://chat.whatsapp.com/..." {...campo('whatsapp_url')} />
            </label>

            {fechas.length > 0 && (
                <ul className="wp-vista-previa" aria-label="Talleres que se van a crear">
                    {fechas.map((iso) => {
                        const dia = new Date(iso);
                        const clave = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`;
                        const ya = ocupadas.has(clave);
                        return (
                            <li key={iso} data-ocupada={ya ? '1' : undefined}>
                                {formatearInicio(iso)}{ya && <span className="mut40"> · ya tiene taller, no se toca</span>}
                            </li>
                        );
                    })}
                </ul>
            )}
        </ModalPlan>
    );
};

const Cuando = ({ taller }) => {
    if (!taller.inicio_at) {
        return (
            <>
                <span className="wp-dia">{taller.date.split('-').reverse().join('/')}</span>
                <span className="chip" style={{ '--c': 'var(--warning)' }}>Sin hora: no sale en las landings</span>
            </>
        );
    }
    const [dia, hora] = formatearInicio(taller.inicio_at).split(' · ');
    return <><span className="wp-dia">{dia}</span><span className="wp-hora num">{hora}</span></>;
};

const WorkshopProximosView = ({ events, onEdit, onDelete, onProgramado }) => {
    const [programando, setProgramando] = useState(false);
    const reducir = useReducedMotion();
    const ahora = new Date();
    const vigente = enLaLanding(events, ahora);
    const talleres = talleresPorDelante(events, ahora);
    const hayProximoConHora = talleres.some((e) => e.inicio_at && esProximo(e, ahora));

    return (
        <section className="panel wp-panel" id="wp-proximos" aria-label="Próximos talleres">
            <PanelCab titulo="Próximos talleres"
                tip={`Horas en tu zona (${nombreZona()}). Lo que cambies se ve en las landings de institute en un minuto; quien entre desde otro país lo ve en su hora. Un taller sin link usa el del anterior.`}>
                <button type="button" className="btn btn--linea btn--sm" onClick={() => setProgramando(true)}>
                    <CalendarPlus aria-hidden="true" /> Programar semanas
                </button>
            </PanelCab>

            {!hayProximoConHora && (
                <p className="wp-aviso" role="status">
                    <AlertTriangle aria-hidden="true" />
                    <span>Ningún taller con hora por delante: las landings repiten el último con sus links.</span>
                </p>
            )}

            {talleres.length === 0 ? (
                <p className="t-sm mut wp-vacio">No hay talleres programados.</p>
            ) : (
                <ol className="wp-talleres" aria-label="Talleres por delante">
                    {talleres.map((e, i) => {
                        const enLanding = Boolean(vigente && e.id === vigente.id);
                        return (
                            <motion.li key={e.id} className="wp-taller" data-vigente={enLanding ? '1' : undefined}
                                aria-label={e.name}
                                initial={reducir ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.22, delay: Math.min(i, 8) * 0.04 }}>
                                <div className="wp-taller-id">
                                    <div className="wp-cuando">
                                        <Cuando taller={e} />
                                        {enLanding && (
                                            <span className="chip" style={{ '--c': 'var(--brand-secondary)' }}>
                                                <Radio aria-hidden="true" /> En la landing ahora
                                            </span>
                                        )}
                                    </div>
                                    <p className="wp-taller-nom trunc" title={e.name}>{e.name}</p>
                                    <div className="wp-enlaces">
                                        <Enlace url={e.meet_url} icon={Video} nombre="Meet" heredado={i > 0} />
                                        <Enlace url={e.whatsapp_url} icon={MessageCircle} nombre="Grupo" heredado={i > 0} />
                                    </div>
                                </div>

                                <div className="wp-taller-btns">
                                    <button type="button" className="ibtn ibtn--sm" onClick={() => onEdit(e)} title="Editar taller" aria-label={`Editar ${e.name}`}>
                                        <Edit2 aria-hidden="true" />
                                    </button>
                                    <button type="button" className="ibtn ibtn--sm" onClick={() => onDelete(e.id)} title="Eliminar taller" aria-label={`Eliminar ${e.name}`}>
                                        <Trash2 aria-hidden="true" />
                                    </button>
                                </div>
                            </motion.li>
                        );
                    })}
                </ol>
            )}

            {programando && (
                <ProgramarModal eventos={events} onClose={() => setProgramando(false)} onProgramado={onProgramado} />
            )}
        </section>
    );
};

export default WorkshopProximosView;
