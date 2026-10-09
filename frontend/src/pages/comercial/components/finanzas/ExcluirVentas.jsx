import React, { useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Segmented, Tip } from '../Shared';
import { dinero } from './comun';
import * as apiFz from './finanzasApi';

/**
 * Sacar ventas de la nómina (08/10/2026). Antes era la casilla de cada fila de la auditoría de
 * Payroll; esa lista se sacó y la casilla volvió acá, a pedido. La misma casilla está en las ventas
 * de cada persona (`VentasDePersona`, al tocar su tile), con el mismo endpoint.
 *
 * Es UNA lista de ventas y no una por persona: sacar una venta la saca de la comisión de todos los
 * que cobran sobre ella (setter, closer, director y Fulfillment), así que cada fila dice quiénes
 * son y cuánto suma entre todos. Cada clic guarda en el momento y Payroll se recalcula detrás
 * (`onCambio`), sin botón de guardar.
 */

const fecha = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—');
const VISTAS = [{ key: 'todas', label: 'Todas' }, { key: 'excluidas', label: 'Excluidas' }];

/** Las ventas que pagan comisión en el período, una vez cada una, con quiénes cobran sobre ella. */
export const ventasDeLaNomina = (datos, personas) => {
    const porId = new Map();
    personas.forEach((p) => {
        (datos[p.id]?.sales || []).forEach((venta) => {
            const fila = porId.get(venta.id) || { ...venta, cobran: [], comision: 0 };
            fila.cobran.push(p.nombre);
            fila.comision += venta.comision || 0;
            porId.set(venta.id, fila);
        });
    });
    return [...porId.values()].sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.id - a.id);
};

const ExcluirVentas = ({ datos, personas, onCerrar, onCambio }) => {
    const [cambios, setCambios] = useState({});   // id -> excluida, hasta que vuelve la nómina
    const [enCurso, setEnCurso] = useState(() => new Set());
    const [buscar, setBuscar] = useState('');
    const [vista, setVista] = useState('todas');

    const ventas = useMemo(() => ventasDeLaNomina(datos, personas)
        .map(v => ({ ...v, excluida: cambios[v.id] ?? v.is_excluded_from_payroll })), [datos, personas, cambios]);
    const excluidas = ventas.filter(v => v.excluida).length;
    const texto = buscar.trim().toLowerCase();
    const visibles = ventas.filter(v => (vista === 'todas' || v.excluida) && (!texto
        || [v.nombre_cliente, v.instagram, v.tipo_pago, ...v.cobran].some(c => (c || '').toLowerCase().includes(texto))));

    const alternar = async (venta) => {
        const excluir = !venta.excluida;
        setCambios(c => ({ ...c, [venta.id]: excluir }));
        setEnCurso(s => new Set(s).add(venta.id));
        try {
            await apiFz.marcarExclusion(venta.id, excluir);
            onCambio();
        } catch {
            setCambios(c => ({ ...c, [venta.id]: !excluir }));
            toast.error('No se pudo cambiar la venta en la nómina');
        } finally {
            setEnCurso((s) => { const n = new Set(s); n.delete(venta.id); return n; });
        }
    };

    return (
        <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
            <div className="modal" role="dialog" aria-modal="true" aria-label="Excluir ventas de la nómina"
                style={{ width: 'min(880px, 100%)' }}>
                <div className="modal-cab" style={{ alignItems: 'center' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="t-eyebrow">Payroll</p>
                        <span className="fila" style={{ gap: 6 }}>
                            <h2 className="t-h3">Excluir ventas de la nómina</h2>
                            <Tip titulo="Excluir una venta"
                                texto="Destildada, la venta deja de sumar en la comisión de todos los que cobran sobre ella. Se guarda al tocarla; el cash del período no cambia." />
                        </span>
                    </div>
                    <button type="button" className="ibtn" onClick={onCerrar} aria-label="Cerrar"><X /></button>
                </div>

                <div className="fila" style={{ flexWrap: 'wrap', gap: 'var(--s3)', marginBottom: 'var(--s4)' }}>
                    <Segmented chico opciones={VISTAS.map(o => (o.key === 'excluidas' ? { ...o, label: `Excluidas · ${excluidas}` } : o))}
                        valor={vista} onChange={setVista} ariaLabel="Qué ventas ver" />
                    <label className="busca busca--sm" style={{ flex: '1 1 220px' }}>
                        <span className="mut40" style={{ display: 'flex' }}><Search size={14} /></span>
                        <input type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)}
                            placeholder="Buscar cliente, programa, persona…" aria-label="Buscar venta" />
                    </label>
                </div>

                <div className="fz-scroll">
                    <div className="fz-tabla" style={{ '--cols': '48px 56px minmax(140px,1fr) minmax(120px,.9fr) minmax(130px,1fr) 96px 104px', '--min': '780px' }}>
                        <div className="fz-cab">
                            <span className="fz-centro">Nómina</span>
                            <span>Fecha</span>
                            <span>Cliente</span>
                            <span>Programa</span>
                            <span>Cobran</span>
                            <span className="fz-der">Neto</span>
                            <span className="fz-der">Comisiones</span>
                        </div>
                        {visibles.map(venta => (
                            <div key={venta.id} className={`fz-fila${venta.excluida ? ' fz-excluida' : ''}`}>
                                <span className="fz-centro" style={{ display: 'flex' }}>
                                    <button type="button" className="fz-check" aria-pressed={!venta.excluida}
                                        disabled={enCurso.has(venta.id)}
                                        aria-label={`${venta.excluida ? 'Volver a sumar' : 'Sacar de la nómina'} la venta de ${venta.nombre_cliente}`}
                                        onClick={() => alternar(venta)}>
                                        <Check />
                                    </button>
                                </span>
                                <span className="num mut">{fecha(venta.date)}</span>
                                <span className="trunc fz-tachable" style={{ fontWeight: 700 }} title={venta.nombre_cliente}>
                                    {venta.nombre_cliente}
                                </span>
                                <span className="trunc mut" title={venta.tipo_pago}>{venta.tipo_pago}</span>
                                <span className="trunc mut" title={venta.cobran.join(', ')}>{venta.cobran.join(', ')}</span>
                                <span className="fz-n fz-der mut">{dinero(venta.monto_neto)}</span>
                                <span className="fz-n fz-der fz-tachable" style={{ color: 'var(--success)' }}>{dinero(venta.comision)}</span>
                            </div>
                        ))}
                        {visibles.length === 0 && (
                            <p className="fz-vacio">
                                {ventas.length === 0 ? 'No hay ventas que paguen comisión en este período.'
                                    : vista === 'excluidas' && !texto ? 'No hay ventas excluidas en este período.'
                                        : 'Ninguna venta coincide con la búsqueda.'}
                            </p>
                        )}
                    </div>
                </div>

                <div className="fila" style={{ justifyContent: 'space-between', marginTop: 'var(--s6)' }}>
                    <span className="t-cap mut40 num">
                        {ventas.length} {ventas.length === 1 ? 'venta' : 'ventas'} · {excluidas} {excluidas === 1 ? 'excluida' : 'excluidas'}
                    </span>
                    <button type="button" className="btn btn--linea btn--sm" onClick={onCerrar}>Listo</button>
                </div>
            </div>
        </div>
    );
};

export default ExcluirVentas;
