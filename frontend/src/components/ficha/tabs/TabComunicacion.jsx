import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { instanteLegible } from '../piezas/fecha';
import CampoConMenciones from '../piezas/CampoConMenciones';
import useComentariosAcademia, { comoNota } from '../useComentariosAcademia';

// El color del avatar dice el rol sin leer nada: el hilo se escanea por bloques.
const TONO_ROL = { Triage: 'info', Setter: 'success', Closer: 'brand-secondary', Dirección: 'warning', Academia: 'brand-primary' };
const tonoDe = (rol) => TONO_ROL[rol] || 'idle';

/** El texto de una nota con cada «@Nombre» de a quienes se avisó resaltado. */
const conMencionesResaltadas = (texto, nombres = []) => {
    const lista = [...nombres].filter(Boolean).sort((a, b) => b.length - a.length)
        .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (!lista.length) return texto;
    return String(texto).split(new RegExp(`(@(?:${lista.join('|')}))`, 'u')).map((parte, i) => (
        i % 2 ? <strong key={i} style={{ color: 'var(--brand-secondary)' }}>{parte}</strong> : parte
    ));
};

/**
 * Hilo de notas del equipo sobre el lead.
 *
 * Reemplaza la nota suelta que hoy cada rol guarda en su propio campo y que nadie
 * más ve: acá el setter le deja el contexto al closer y queda el rastro de a quién
 * se le avisó. «Notificar a» es la parte que faltaba — sin eso una nota importante
 * depende de que el otro entre a mirar la ficha.
 */
const TabComunicacion = ({ ficha, onAccion, puedeEditar = true }) => {
    const com = ficha?.comunicacion || {};
    // Un solo hilo: las notas de Work (closers, setters, triage) y lo que anotó el equipo de la Academia
    // (Dari, consultores), por fecha. Lo de la Academia se lee acá y se escribe allá.
    const { datos: academia } = useComentariosAcademia(ficha);
    const notas = [...(com.notas || []), ...(academia?.comentarios || []).map(comoNota)]
        .sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')));
    const equipo = com.equipo || [];
    const [texto, setTexto] = useState('');
    // Las personas elegidas con «@»: a las que sigan nombradas en el texto al enviar se les avisa.
    const [nombrados, setNombrados] = useState([]);
    const [enviando, setEnviando] = useState(false);
    const bloqueado = !puedeEditar || ficha?.permisos?.comentar === false;

    const enviar = async () => {
        const limpio = texto.trim();
        if (!limpio || enviando || bloqueado) return;
        setEnviando(true);
        try {
            const notificar = nombrados.filter(p => limpio.includes(`@${p.nombre}`)).map(p => p.id);
            await onAccion('enviar_nota', { texto: limpio, notificar });
            setTexto('');
            setNombrados([]);
        } catch {
            // El error lo muestra el cascarón; la nota se queda escrita en el campo para
            // que no haya que volver a tipearla.
        } finally {
            setEnviando(false);
        }
    };

    const elegir = (persona) => setNombrados(prev => (prev.some(p => p.id === persona.id) ? prev : [...prev, persona]));

    return (
        <div className="fi-sec">
            <div className="fi-hilo">
                {notas.length === 0 && (
                    <p className="t-sm mut40">Todavía no hay notas sobre este lead.</p>
                )}
                {notas.map((n, i) => (
                    <div key={i} className="fi-nota">
                        <span className="fi-avatar" aria-hidden="true"
                            style={{ '--c': `var(--${tonoDe(n.rol)})` }}>
                            {(n.autor || '?').trim().charAt(0).toUpperCase()}
                        </span>
                        <div style={{ display: 'grid', gap: 'var(--s2)', minWidth: 0, flex: 1 }}>
                            <div className="fila" style={{ flexWrap: 'wrap', gap: 'var(--s1) var(--s3)' }}>
                                <span className="t-sm" style={{ fontWeight: 700 }}>{n.autor}</span>
                                {/* La fecha llega como `isoformat()` del `created_at` en UTC: cruda se leía
                                    «2026-10-09T21:19:05.691000», y en otro huso que el del servidor. */}
                                <span className="t-cap mut">{[n.rol, instanteLegible(n.fecha)].filter(Boolean).join(' · ')}</span>
                            </div>
                            <div className="t-sm fi-globo">{conMencionesResaltadas(n.texto, n.notificados)}</div>
                            {n.notificados?.length > 0 && (
                                <span className="t-cap mut">Notificó a {n.notificados.join(', ')}</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {!bloqueado && (
                <>
                    <div className="fila" style={{ gap: 'var(--s3)', padding: 'var(--s4) var(--s6)', alignItems: 'flex-end',
                        borderTop: '1px solid var(--border-subtle)' }}>
                        <CampoConMenciones value={texto} onChange={setTexto} onEnviar={enviar} equipo={equipo}
                            onElegir={elegir} ariaLabel="Escribí una nota"
                            placeholder="Escribí una nota… con @ avisás a alguien" />
                        <button type="button" className="ibtn" aria-label="Enviar nota"
                            disabled={!texto.trim() || enviando}
                            style={{ background: 'var(--brand-secondary)', borderColor: 'var(--brand-secondary)',
                                color: 'var(--on-brand)', width: 48, height: 48 }}
                            onClick={enviar}>
                            <Send size={18} />
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default TabComunicacion;
