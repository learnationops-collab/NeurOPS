// «Antes de que se cierre»: agendas sin resultado (con su select), avisos y datos a mano por grupo.
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Button, Input, Select } from '../../components/standard';
import { CabCard } from './piezas';
import { aNumero } from './bloques/comun';

export const manoVacio = (m) => m.valor == null || m.valor === '';

function Tile({ m, k, onCambio }) {
    const [txt, setTxt] = useState(m.valor == null ? '' : String(m.valor));
    const [tocado, setTocado] = useState(false);
    const foco = useRef(false);
    // Lo que trae el servidor entra solo si la persona no está escribiendo en este campo.
    useEffect(() => { if (!foco.current) setTxt(m.valor == null ? '' : String(m.valor)); }, [m.valor]);
    const lleno = txt.trim() !== '';
    const rotulo = !lleno ? 'A mano' : m.sugerido && !tocado ? 'Sugerido · confirmalo' : 'Cargado';
    return (
        <label className={clsx('rp-tile mano', lleno && 'lleno')} style={{ animationDelay: `${k * 40}ms` }}>
            <em>{rotulo}</em>
            <input inputMode="numeric" value={txt} placeholder="—" aria-label={`${m.grupo}: ${m.campo}`}
                onFocus={() => { foco.current = true; }} onBlur={() => { foco.current = false; }}
                onChange={(e) => { setTxt(e.target.value); setTocado(true); onCambio(aNumero(e.target.value)); }} />
            <span>{m.campo}</span>
        </label>
    );
}

// Pide el motivo en la misma fila cuando el resultado lo exige (misma regla que el mazo).
function PedirMotivo({ pedido, onGuardar, onCancelar }) {
    const [txt, setTxt] = useState('');
    return (
        <div className="rp-rv__motivo">
            <Input autoFocus value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={pedido.pregunta} aria-label={pedido.pregunta}
                onKeyDown={(e) => { if (e.key === 'Enter' && txt.trim()) onGuardar(txt.trim()); }} />
            <Button size="sm" variant="primary" disabled={!txt.trim()} onClick={() => onGuardar(txt.trim())}>Guardar</Button>
            <Button size="sm" variant="secondary" onClick={onCancelar}>Cancelar</Button>
        </div>
    );
}

export default function Pendientes({ pendientes, resueltas, pasado, editar, cargarResultado: cargar }) {
    const [pedido, setPedido] = useState(null);
    const cargarResultado = async (a, resultado, motivo) => {
        const r = await cargar(a, resultado, motivo);
        setPedido(r?.pregunta ? { id: a.id, agenda: a, resultado, pregunta: r.pregunta } : null);
    };
    const agendas = pendientes?.agendas || [], avisos = pendientes?.avisos || [], mano = pendientes?.mano || [];
    const hechas = Object.values(resueltas).filter((r) => !agendas.some((a) => a.id === r.agenda.id));
    const p = agendas.filter((a) => !resueltas[a.id]).length + mano.filter(manoVacio).length;
    const grupos = [...new Set(mano.map((m) => m.grupo))];
    return (
        <section className="rp-card ui-panel" id="rp-c-pen">
            <CabCard n="!" titulo="Antes de que se cierre" ok={!p} warn={p > 0}>
                <small>{p
                    ? `${p} pendiente${p > 1 ? 's' : ''} · ${pasado ? 'mientras falten, el día queda incompleto' : 'si quedan a las 10:00, el día se cierra incompleto'}`
                    : 'Todo cargado'}</small>
            </CabCard>
            {(agendas.length > 0 || avisos.length > 0 || hechas.length > 0) && (
                <div className="rp-rv">
                    {agendas.map((a) => {
                        const r = resueltas[a.id];
                        return (
                            <div key={a.id} className={clsx('rp-rv__i', r ? 'hecho' : 'bloquea')}>
                                <span className="tag">{r ? 'Listo' : 'Falta'}</span>
                                <span>{a.nombre}{a.hora ? ` · ${a.hora}` : ''}<small>{r ? `Resultado: ${r.resultado}` : a.detalle}</small></span>
                                <Select size="sm" label={`Resultado de ${a.nombre}`} value={r?.resultado || ''}
                                    options={[{ value: '', label: 'Cargar resultado' }, ...(a.opciones || []).map((o) => ({ value: o, label: o }))]}
                                    onChange={(v) => cargarResultado(a, v)} />
                                {pedido?.id === a.id && (
                                    <PedirMotivo pedido={pedido} onCancelar={() => setPedido(null)}
                                        onGuardar={(m) => cargarResultado(a, pedido.resultado, m)} />
                                )}
                            </div>
                        );
                    })}
                    {hechas.map(({ agenda: a, resultado }) => (
                        <div key={a.id} className="rp-rv__i hecho">
                            <span className="tag">Listo</span>
                            <span>{a.nombre}{a.hora ? ` · ${a.hora}` : ''}<small>Resultado: {resultado}</small></span>
                        </div>
                    ))}
                    {avisos.map((v, i) => (
                        <div key={`${v.titulo}-${i}`} className="rp-rv__i aviso">
                            <span className="tag">Aviso</span>
                            <span>{v.titulo}<small>{v.detalle}</small></span>
                        </div>
                    ))}
                </div>
            )}
            {grupos.map((g) => (
                <div key={g} className="rp-pend-sec">
                    <h4>{g}</h4>
                    <div className="rp-tiles">
                        {mano.filter((m) => m.grupo === g).map((m, k) => (
                            <Tile key={m.clave} m={m} k={k} onCambio={(v) => editar({ mano: { [m.clave]: v } })} />
                        ))}
                    </div>
                </div>
            ))}
        </section>
    );
}
