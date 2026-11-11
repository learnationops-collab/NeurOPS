import React, { useRef, useState } from 'react';
import { FileCheck2, FileWarning, FileQuestion, Paperclip, X } from 'lucide-react';
import { Chip, IconButton, LinkButton } from '../../standard';
import { mensajeDeError, urlComprobante } from '../fichaApi';
import MotivoDelFallo from './MotivoDelFallo';

/**
 * La verificación de un pago con su comprobante (ADR-W088), debajo de la fila del pago.
 *
 * El closer sube la evidencia (captura, PDF o CSV) y Learnito la lee: el pago queda «Verificado» o
 * «No cuadra» con el motivo. Sin archivo queda «Sin comprobante». El neto es el del comprobante o, si
 * no lo muestra, el estimado con la comisión promedio de la plataforma.
 */

export const ESTADOS_VERIFICACION = {
    verified: { texto: 'Verificado', color: 'var(--success)', icono: <FileCheck2 /> },
    unverified: { texto: 'No cuadra', color: 'var(--danger)', icono: <FileWarning /> },
    pending: { texto: 'Sin comprobante', color: 'var(--warning)', icono: <FileQuestion /> },
};

const ACEPTA = 'image/*,application/pdf,text/csv,.csv,.txt';
const plata = (n) => `US$ ${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const VerificacionPago = ({ verificacion: v, agendaId, pagoId, puedeEditar = false, onSubir, onQuitar }) => {
    const input = useRef(null);
    const [subiendo, setSubiendo] = useState(false);
    const [error, setError] = useState(null);
    if (!v) return null;
    const estado = ESTADOS_VERIFICACION[v.estado] || ESTADOS_VERIFICACION.pending;
    const neto = v.neto != null ? `Neto ${plata(v.neto)}` : (v.neto_estimado != null ? `Neto estimado ${plata(v.neto_estimado)}` : null);

    const elegido = async (e) => {
        const archivo = e.target.files?.[0];
        e.target.value = '';
        if (!archivo) return;
        setSubiendo(true);
        setError(null);
        try {
            await onSubir?.(archivo);
        } catch (err) {
            setError(mensajeDeError(err));
        } finally {
            setSubiendo(false);
        }
    };

    return (
        <div className="fi-pago-verif" style={{ display: 'grid', gap: 4, marginTop: 4 }}>
            <span className="fila" style={{ gap: 'var(--s2)', flexWrap: 'wrap', alignItems: 'center' }}>
                <Chip color={estado.color} icon={estado.icono}>{estado.texto}</Chip>
                {neto && <small className="t-cap mut num">{neto}</small>}
                {puedeEditar && agendaId != null && (
                    <>
                        <input ref={input} type="file" accept={ACEPTA} hidden onChange={elegido} />
                        <LinkButton icon={<Paperclip />} disabled={subiendo} onClick={() => input.current?.click()}>
                            {subiendo ? 'Learnito está leyendo…' : (v.comprobantes.length ? 'Otro comprobante' : 'Subir comprobante')}
                        </LinkButton>
                        {subiendo && <span className="ln-spinner" aria-label="Leyendo el comprobante" />}
                    </>
                )}
            </span>
            {v.estado === 'unverified' && v.motivo && <small className="t-cap" style={{ color: 'var(--danger)' }}>{v.motivo}</small>}
            {v.notas.map(n => <small key={n} className="t-cap mut">{n}</small>)}
            {v.comprobantes.length > 0 && agendaId != null && (
                <span className="fila" style={{ gap: 'var(--s2)', flexWrap: 'wrap' }}>
                    {v.comprobantes.map(c => (
                        <span key={c.id} className="fila" style={{ gap: 2, alignItems: 'center' }}>
                            <a className="t-cap trunc" href={urlComprobante(agendaId, pagoId, c.id)} target="_blank"
                                rel="noreferrer" title={`Subido ${c.subido?.slice(0, 10) || ''} por ${c.subido_por || '—'}`}
                                style={{ maxWidth: 180 }}>
                                {c.nombre}
                            </a>
                            {puedeEditar && (
                                <IconButton size="xs" icon={<X />} label={`Quitar ${c.nombre}`}
                                    disabled={subiendo} onClick={() => onQuitar?.(c.id)} />
                            )}
                        </span>
                    ))}
                </span>
            )}
            <MotivoDelFallo motivo={error} />
        </div>
    );
};

export default VerificacionPago;
