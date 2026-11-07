import toast from 'react-hot-toast';
import { Button } from '../../../../components/standard';
import { telefonoLegible } from '../../../../components/ficha/FichaHeader';
import { inversionCorta, inversionDe, decisionDe, TONO_SEGMENTO, fmtPuntos } from '../../datosDelLead';
import { escalonDe } from '../../../../components/huesos/Huesos';

// Qué pasó en la llamada, solo cuando no la tomó: una tomada es el caso normal y no lleva chip.
const LLAMADA = {
    'no show': { texto: 'No asistió', tono: 'var(--cl-warning)' },
    cancelado: { texto: 'Canceló', tono: 'var(--cl-warning)' },
    cancelada: { texto: 'Canceló', tono: 'var(--cl-warning)' },
    reagendado: { texto: 'Reagendó', tono: 'var(--cl-lila)' },
    reagendada: { texto: 'Reagendó', tono: 'var(--cl-lila)' },
    '2da call': { texto: '2ª llamada', tono: 'var(--cl-info)' },
};

// «18 h 13 min», «1 d 2 h».
export const hace = (minutos) => {
    if (minutos == null) return '—';
    const d = Math.floor(minutos / 1440), h = Math.floor((minutos % 1440) / 60), m = minutos % 60;
    if (d > 0) return h ? `${d} d ${h} h` : `${d} d`;
    if (h > 0) return m ? `${h} h ${m} min` : `${h} h`;
    return `${m} min`;
};

const iniciales = (n) => (n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

const copiar = (e, tel) => {
    e.stopPropagation();
    const btn = e.currentTarget;
    navigator.clipboard?.writeText(tel).then(() => {
        btn.dataset.ok = '1';
        setTimeout(() => { delete btn.dataset.ok; }, 1400);
        toast.success('Teléfono copiado');
    }).catch(() => toast.error('No se pudo copiar'));
};

/**
 * Una tarjeta del embudo, con las piezas de la tarjeta del mazo (`kcard-v6`). `respondio` la
 * dibuja en la columna Respondieron. `abierta` muestra «¿Qué pasó con el mensaje?».
 */
const TarjetaEmbudo = ({ t, respondio = false, abierta, enfocada, siguienteDia, orden = 0, escalonar,
    ocupado, onAbrir, onCerrar, onRegistrar, onDevolver, onFicha }) => {
    const tel = (t.phone || '').trim();
    const invTxt = inversionDe(t);
    const inversion = invTxt ? inversionCorta(invTxt) : null;
    const decision = decisionDe(t) || (t.with_decision_maker == null ? null
        : { texto: t.with_decision_maker ? 'Decisor' : 'No decisor', solo: t.with_decision_maker });
    const llamada = LLAMADA[(t.closer_result || '').trim().toLowerCase()];
    const tono = respondio ? 'var(--cl-success)' : t.atrasado ? 'var(--cl-warning)' : t.proximo ? 'var(--cl-info)' : 'var(--cl-success)';
    const etiquetas = [
        t.segmento && {
            texto: t.segmento_puntos != null ? `${t.segmento} · ${fmtPuntos(t.segmento_puntos)} pts` : t.segmento,
            tono: TONO_SEGMENTO[t.segmento] || 'var(--cl-info)',
        },
        llamada,
        t.examen && { texto: t.examen, tono: 'var(--cl-lila)' },
    ].filter(Boolean);

    const banda = respondio
        ? { lbl: `Respondió · Día ${t.dia}`, val: '' }
        : t.proximo
            ? { lbl: 'Le toca', val: t.vence ? new Date(`${t.vence}T00:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }) : '' }
            : { lbl: t.atrasado ? 'Atrasado · llamada hace' : 'Llamada hace', val: hace(t.minutos_desde_llamada) };

    return (
        <div className={`kcard-v6 kcard-franja emb-card${enfocada ? ' emb-foco' : ''}${t.proximo ? ' emb-proximo' : ''}`}
            data-embudo={t.id}
            style={{ animationDelay: `${escalonar ? escalonDe(orden) : 0}ms`, '--c': tono, '--t': tono }}
            onClick={() => onFicha(t)}>
            <div className="kc-banda">
                <span className="kc-banda-lbl">
                    <svg className="kc-ic" viewBox="0 0 24 24" aria-hidden="true">
                        {respondio
                            ? <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" /></>
                            : <><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" /></>}
                    </svg>
                    {banda.lbl}
                </span>
                <span className="kc-banda-t">{banda.val}</span>
            </div>

            <div className="kc-cuerpo">
                <div className="kc-top">
                    <span className="kc-av" aria-hidden="true">{iniciales(t.lead_name)}</span>
                    <div className="kc-id">
                        <b className="kc-nombre"><span className="kc-nombre-t" title={t.lead_name}>{t.lead_name}</span></b>
                        {tel && (
                            <div className="kc-tel">
                                <span className="kc-tel-n">{telefonoLegible(tel)}</span>
                                <button type="button" className="kc-copiar" title="Copiar teléfono" aria-label="Copiar teléfono"
                                    onClick={(e) => copiar(e, tel)}>
                                    <svg viewBox="0 0 24 24" aria-hidden="true" className="kc-copiar-i"><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15" /></svg>
                                    <svg viewBox="0 0 24 24" aria-hidden="true" className="kc-copiar-ok"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {(inversion || decision || t.setter_name) && (
                    <div className="kc-datos">
                        {inversion && (
                            <span className={`kc-dato kc-plata${inversion.sin ? ' kc-plata--sin' : ''}`} title={`Inversión: ${invTxt}`}>
                                <span className="kc-dato-ic" aria-hidden="true">$</span>
                                <span className="kc-plata-n">{inversion.texto}</span>
                            </span>
                        )}
                        {decision && (
                            <span className={`kc-dato kc-decide${decision.solo === false ? ' kc-decide--con' : ''}`} title={decision.title}>
                                <span className="kc-dato-tx">{decision.texto}</span>
                            </span>
                        )}
                        {t.setter_name && (
                            <span className="kc-dato kc-origen" title={`Agendó: ${t.setter_name}`}>
                                <span className="kc-origen-ini" aria-hidden="true">{t.setter_name[0]?.toUpperCase()}</span>
                                <span className="kc-dato-tx">{t.setter_name}</span>
                            </span>
                        )}
                    </div>
                )}

                {etiquetas.length > 0 && (
                    <div className="kc-etiquetas">
                        {etiquetas.map(e => <span key={e.texto} className="ktag-v6" style={{ '--c': e.tono }}>{e.texto}</span>)}
                    </div>
                )}

                {t.nota && <div className="nt-v6 text-[10px]" title={t.closer_notes}>{t.nota}</div>}

                {respondio ? (
                    <div className="emb-fila" onClick={e => e.stopPropagation()}>
                        <span className="klisto-v6">
                            <svg className="kc-check" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M7.5 12.5l3 3 6-6.5" /></svg>
                            <span className="kc-ok-tx">Respondió</span>
                        </span>
                        <button type="button" className="emb-link" disabled={ocupado} onClick={() => onDevolver(t)}>Devolver</button>
                    </div>
                ) : t.proximo ? null : abierta ? (
                    <div className="emb-registro" onClick={e => e.stopPropagation()}>
                        <span className="emb-pregunta">¿Qué pasó con el mensaje?</span>
                        <div className="emb-botones">
                            <Button variant="primary" disabled={ocupado} onClick={() => onRegistrar(t, 'respondio')}>Respondió</Button>
                            <Button disabled={ocupado} onClick={() => onRegistrar(t, 'no_respondio')}>No respondió</Button>
                        </div>
                        <div className="emb-fila">
                            <span className="emb-pista">{siguienteDia ? `Si no respondió, pasa al Día ${siguienteDia}` : 'Si no respondió, vuelve al pool'}</span>
                            <button type="button" className="emb-link" onClick={onCerrar}>Cancelar</button>
                        </div>
                    </div>
                ) : (
                    <button type="button" className="kadv-v6" onClick={(e) => { e.stopPropagation(); onAbrir(t); }}>
                        Registrar
                    </button>
                )}
            </div>
        </div>
    );
};

export default TarjetaEmbudo;
