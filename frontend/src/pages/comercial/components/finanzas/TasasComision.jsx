import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { EsqueletoFilas, Segmented, Tip } from '../Shared';
import { mesActual, nombreDelMes } from './comun';
import * as apiFz from './finanzasApi';

/**
 * Los % de comisión de la nómina, editables (08/10/2026). Los edita quien entra a Finanzas: admin o
 * dirección comercial con «ver finanzas».
 *
 * Cada guardado es un juego completo que vale DESDE el mes elegido: los meses anteriores siguen con
 * el % que tenían (ver `comision_tasas_service`). Al elegir el mes, los campos arrancan con los %
 * que valen ese mes, así que cambiar uno solo no obliga a reescribir el resto.
 */

const FUENTES = [['renovacion', 'Renovación'], ['upsell', 'Upsell'], ['conversion', 'Conversión'], ['cuota', 'Cuota']];
const PROGRAMAS = [{ key: 'AL', label: 'Ace Learners' }, { key: 'RR', label: 'Residency Roadmap' },
    { key: 'SI', label: 'Specialist Initiative' }];

/** De 12 meses atrás a 3 adelante: se puede dejar listo el cambio del mes que viene. */
const mesesElegibles = () => {
    const hoy = new Date();
    return Array.from({ length: 16 }, (_, i) => {
        const f = new Date(hoy.getFullYear(), hoy.getMonth() + 3 - i, 1);
        return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`;
    });
};

const CampoPct = ({ valor, onCambiar, etiqueta }) => (
    <label className="fz-monto fz-pct">
        <input type="number" inputMode="decimal" min="0" max="100" step="0.5" value={valor}
            aria-label={etiqueta} onChange={(e) => onCambiar(e.target.value)} />
        <span aria-hidden="true">%</span>
    </label>
);

const TasasComision = ({ onCerrar, onGuardado }) => {
    const [mes, setMes] = useState(mesActual());
    const [datos, setDatos] = useState(null);      // lo que manda el backend para ese mes
    const [tasas, setTasas] = useState(null);      // lo que se está editando
    const [programa, setPrograma] = useState('AL');
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        let vigente = true;
        setTasas(null);
        apiFz.getTasas(mes).then((d) => {
            if (!vigente) return;
            setDatos(d);
            setTasas(d.tasas);
        }).catch(() => toast.error('No se pudieron cargar los porcentajes'));
        return () => { vigente = false; };
    }, [mes]);

    const poner = (grupo, clave, valor) => setTasas(t => ({ ...t, [grupo]: { ...t[grupo], [clave]: valor } }));
    const ponerFulfillment = (clave, prog, i, valor) => setTasas(t => {
        const fila = [...t.fulfillment[clave][prog]];
        fila[i] = valor;
        return { ...t, fulfillment: { ...t.fulfillment, [clave]: { ...t.fulfillment[clave], [prog]: fila } } };
    });

    const guardar = async () => {
        setGuardando(true);
        try {
            await apiFz.guardarTasas(mes, tasas);
            toast.success(`Porcentajes guardados desde ${nombreDelMes(mes)}`);
            onGuardado();
        } catch (error) {
            toast.error(error?.response?.data?.error || 'No se pudieron guardar los porcentajes');
            setGuardando(false);
        }
    };

    const personas = datos?.personas;
    const grupoSimple = (titulo, filas) => (
        <div className="fz-bloque">
            <p className="t-rotulo">{titulo}</p>
            <div className="fz-tabla" style={{ '--cols': 'minmax(0,1fr) 120px' }}>
                {filas.map(({ grupo, clave, nombre, ayuda }) => (
                    <div key={clave} className="fz-fila">
                        <span className="fila" style={{ gap: 6 }}>
                            <b style={{ fontWeight: 700 }}>{nombre}</b>
                            {ayuda && <Tip titulo={nombre} texto={ayuda} />}
                        </span>
                        <CampoPct valor={tasas[grupo][clave]} etiqueta={`Porcentaje de ${nombre}`}
                            onCambiar={(v) => poner(grupo, clave, v)} />
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
            <div className="modal" role="dialog" aria-modal="true" aria-label="Porcentajes de comisión"
                style={{ width: 'min(820px, 100%)' }}>
                <div className="modal-cab" style={{ alignItems: 'center' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="t-eyebrow">Payroll</p>
                        <h2 className="t-h3">Porcentajes de comisión</h2>
                    </div>
                    <button type="button" className="ibtn" onClick={onCerrar} aria-label="Cerrar"><X /></button>
                </div>

                <div className="fila" style={{ flexWrap: 'wrap', gap: 'var(--s3)', marginBottom: 'var(--s4)' }}>
                    <label className="fila" style={{ gap: 'var(--s2)' }}>
                        <span className="t-rotulo">Vigente desde</span>
                        <select className="fz-select" value={mes} onChange={(e) => setMes(e.target.value)}>
                            {mesesElegibles().map(m => <option key={m} value={m}>{nombreDelMes(m)}</option>)}
                        </select>
                    </label>
                    <Tip titulo="Vigente desde"
                        texto="Los porcentajes que guardes valen desde este mes en adelante, hasta el próximo cambio. Los meses anteriores siguen con los suyos." />
                    {datos && (
                        <span className="t-cap mut40">
                            {datos.vigente_desde
                                ? `Hoy para ${nombreDelMes(mes)} valen los cargados desde ${nombreDelMes(datos.vigente_desde)}.`
                                : `Para ${nombreDelMes(mes)} valen los de fábrica.`}
                        </span>
                    )}
                </div>

                {!tasas ? <EsqueletoFilas rotulo="Cargando los porcentajes…" lineas={6} /> : (
                    <div style={{ display: 'grid', gap: 'var(--s6)' }}>
                        <div className="fz-grid fz-grid--2" style={{ alignItems: 'start' }}>
                            {grupoSimple('Setting', personas.setters.map(p => ({ grupo: 'setters', clave: p.clave, nombre: p.nombre })))}
                            {grupoSimple('Closing', [
                                ...personas.closers.map(p => ({ grupo: 'closers', clave: p.clave, nombre: p.nombre })),
                                ...personas.director.map(p => ({
                                    grupo: 'director', clave: p.clave, nombre: `${p.nombre} · director`,
                                    ayuda: 'Sobre lo que venden los closers, sin renovaciones.',
                                })),
                            ])}
                        </div>

                        <div className="fz-bloque">
                            <div className="fila" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                                <p className="t-rotulo">Fulfillment · por programa y fuente</p>
                                <Segmented chico opciones={PROGRAMAS} valor={programa} onChange={setPrograma}
                                    ariaLabel="Programa" />
                            </div>
                            <div className="fz-scroll">
                                <div className="fz-tabla" style={{ '--cols': 'minmax(90px,1fr) repeat(4, 104px)', '--min': '520px' }}>
                                    <div className="fz-cab">
                                        <span>Persona</span>
                                        {FUENTES.map(([k, label]) => <span key={k} className="fz-der">{label}</span>)}
                                    </div>
                                    {personas.fulfillment.map(p => (
                                        <div key={p.clave} className="fz-fila">
                                            <b style={{ fontWeight: 700 }}>{p.nombre}</b>
                                            {FUENTES.map(([k, label], i) => (
                                                <CampoPct key={k} valor={tasas.fulfillment[p.clave][programa][i]}
                                                    etiqueta={`${p.nombre} · ${programa} · ${label}`}
                                                    onCambiar={(v) => ponerFulfillment(p.clave, programa, i, v)} />
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {datos.historial.length > 0 && (
                            <div className="fz-bloque">
                                <p className="t-rotulo">Cambios guardados</p>
                                <div className="fila" style={{ flexWrap: 'wrap', gap: 'var(--s2)' }}>
                                    {datos.historial.map(h => (
                                        <button key={h.vigente_desde} type="button" className="chip"
                                            style={{ '--c': h.vigente_desde === mes ? 'var(--brand-secondary)' : 'var(--info)' }}
                                            onClick={() => setMes(h.vigente_desde)}
                                            title={h.editado_por ? `Lo guardó ${h.editado_por}` : undefined}>
                                            Desde {nombreDelMes(h.vigente_desde)}{h.editado_por ? ` · ${h.editado_por}` : ''}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="fila" style={{ justifyContent: 'flex-end', marginTop: 'var(--s6)' }}>
                    <button type="button" className="btn btn--linea btn--sm" onClick={onCerrar}>Cancelar</button>
                    <button type="button" className="btn btn--cta btn--sm" disabled={!tasas || guardando} onClick={guardar}>
                        {guardando ? 'Guardando…' : `Guardar desde ${nombreDelMes(mes)}`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TasasComision;
