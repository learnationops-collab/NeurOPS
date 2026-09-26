import React, { useState } from 'react';
import { Send } from 'lucide-react';

// El color del avatar dice el rol sin leer nada: el hilo se escanea por bloques.
const TONO_ROL = { Triage: 'info', Setter: 'success', Closer: 'brand-secondary', Dirección: 'warning' };
const tonoDe = (rol) => TONO_ROL[rol] || 'idle';

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
    const notas = com.notas || [];
    const equipo = com.equipo || [];
    const [texto, setTexto] = useState('');
    const [notificar, setNotificar] = useState([]);
    const [enviando, setEnviando] = useState(false);
    const bloqueado = !puedeEditar || ficha?.permisos?.comentar === false;

    const enviar = async () => {
        const limpio = texto.trim();
        if (!limpio || enviando || bloqueado) return;
        setEnviando(true);
        try {
            await onAccion('enviar_nota', { texto: limpio, notificar });
            setTexto('');
            setNotificar([]);
        } finally {
            setEnviando(false);
        }
    };

    const alternar = (id) => setNotificar(prev => (
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    ));

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
                                <span className="t-cap mut">{[n.rol, n.fecha].filter(Boolean).join(' · ')}</span>
                            </div>
                            <div className="t-sm fi-globo">{n.texto}</div>
                            {n.notificados?.length > 0 && (
                                <span className="t-cap mut">Notificó a {n.notificados.join(', ')}</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {!bloqueado && (
                <>
                    {equipo.length > 0 && (
                        <div style={{ display: 'grid', gap: 'var(--s2)', padding: 'var(--s4) var(--s6)',
                            borderTop: '1px solid var(--border-subtle)' }}>
                            <small className="t-rotulo">Notificar a</small>
                            <div className="fila" style={{ flexWrap: 'wrap', gap: 'var(--s2)' }}>
                                {equipo.map(p => (
                                    <button key={p.id} type="button" className="fi-pildora"
                                        aria-pressed={notificar.includes(p.id)}
                                        style={{ '--c': `var(--${tonoDe(p.rol)})` }}
                                        onClick={() => alternar(p.id)}>
                                        <span className="fi-punto" />
                                        <span>{p.nombre}</span>
                                        <span className="t-cap mut">{p.rol}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="fila" style={{ gap: 'var(--s3)', padding: 'var(--s4) var(--s6)',
                        borderTop: '1px solid var(--border-subtle)' }}>
                        <div className="entrada" style={{ flex: 1, height: 48 }}>
                            <input value={texto} aria-label="Escribí una nota"
                                placeholder="Escribí una nota…"
                                onChange={(e) => setTexto(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); enviar(); } }} />
                        </div>
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
