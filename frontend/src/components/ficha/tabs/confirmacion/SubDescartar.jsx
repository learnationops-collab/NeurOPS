import React, { useState } from 'react';
import { DesplegableAgrupado, SelectorFecha, SubVista } from '../../piezas';
import { grupos } from '../../estadoFicha';

const SINO = [{ label: 'Sí', valor: true }, { label: 'No', valor: false }];

/**
 * Descartar el lead: motivo agrupado y, si se agenda seguimiento, la fecha.
 *
 * El motivo es obligatorio a propósito: «descartado» sin motivo es exactamente el
 * dato que después nadie puede usar para nada. Los motivos los manda el servidor
 * en `vocabulario.motivos_descarte`, y el grupo «Otros» acepta uno nuevo en línea.
 */
const SubDescartar = ({ ficha, onVolver, onConfirmar, guardando = false }) => {
    const [motivo, setMotivo] = useState(null);
    const [agendar, setAgendar] = useState(true);
    const [fecha, setFecha] = useState(null);
    const listas = grupos(ficha, 'motivos_descarte');

    const listo = !!motivo && (!agendar || !!fecha);

    return (
        <SubVista titulo="Descartar lead" onVolver={onVolver}
            acciones={(
                <button type="button" className="btn btn--cta" disabled={!listo || guardando}
                    onClick={() => onConfirmar({ motivo, seguimiento: agendar, fecha_seguimiento: agendar ? fecha : null })}>
                    {guardando ? 'Descartando…' : 'Descartar lead'}
                </button>
            )}>
            <DesplegableAgrupado rotulo="¿Por qué se descarta?" etiqueta="Motivo del descarte"
                placeholder="Elegí un motivo" grupos={listas}
                valor={motivo} onChange={setMotivo}
                onAgregar={() => {}} />

            <div className="fi-campo">
                <small className="t-rotulo">¿Agendás un seguimiento a futuro?</small>
                <div className="fila" style={{ gap: 'var(--s2)' }}>
                    {SINO.map(o => (
                        <button key={o.label} type="button" className="pastilla"
                            aria-pressed={agendar === o.valor}
                            style={agendar === o.valor
                                ? { borderColor: 'var(--brand-secondary)', background: 'var(--brand-secondary-surface)' }
                                : undefined}
                            onClick={() => setAgendar(o.valor)}>
                            {o.label}
                        </button>
                    ))}
                </div>
            </div>

            {agendar && (
                <div style={{ maxWidth: 360 }}>
                    <SelectorFecha rotulo="Contactar el" etiqueta="Contactar el"
                        valor={fecha} onChange={setFecha} />
                </div>
            )}
        </SubVista>
    );
};

export default SubDescartar;
