import React from 'react';
import { PlayCircle, Radio } from 'lucide-react';
import { EsqueletoFilas, PanelCab } from '../../../comercial/components/Shared';
import { dinero, diaMes, numero } from '../talleres/formato';

/**
 * Cuánto aporta la clase en vivo y cuánto la grabación de la landing.
 *
 * Los dos son el MISMO taller (por eso suman en los totales), pero separarlos es lo único que
 * responde «¿vale la pena dejar la grabación publicada?». Las agendas de las dos fuentes se cuentan
 * desde el día del taller hasta el día anterior al siguiente taller registrado (abierta hasta hoy si
 * todavía no hay uno). Si una persona aparece en las dos, cuenta una vez, del lado del vivo.
 */

const FILAS = [
    { key: 'aplicaciones_form', label: 'Aplicaciones' },
    { key: 'agendas', label: 'Agendas' },
    { key: 'show_up', label: 'Asistieron' },
    { key: 'no_show', label: 'No asistieron', de: (d) => d?.breakdown?.['No Show'] },
    { key: 'sales', label: 'Compradores' },
    { key: 'cash_collected', label: 'Cobrado', dinero: true },
];

const Columna = ({ titulo, Icono, datos, color }) => (
    <article className="tarjeta wt-fuente" style={{ '--c': color }}>
        <p className="wt-fuente-titulo"><Icono aria-hidden="true" /> {titulo}</p>
        {!datos ? (
            <p className="t-cap mut40">Sin datos.</p>
        ) : (
            <dl className="wt-fuente-datos">
                {FILAS.map((f) => {
                    const v = f.de ? f.de(datos) : datos[f.key];
                    return (
                        <div key={f.key}>
                            <dt>{f.label}</dt>
                            <dd className="num">{f.dinero ? dinero(v) : numero(v)}</dd>
                        </div>
                    );
                })}
            </dl>
        )}
    </article>
);

const WorkshopSourceSplit = ({ desglose, ventana, cargando }) => {
    if (cargando && !desglose) {
        return <section className="panel wt-panel"><EsqueletoFilas rotulo="Calculando el aporte de cada entrada…" lineas={4} /></section>;
    }
    if (!desglose) return null;

    const tip = 'Clase en vivo vs. grabación. Quien está en las dos cuenta en vivo.';

    return (
        <section className="panel wt-panel" aria-label="Clase en vivo contra grabación">
            <PanelCab titulo="Vivo vs. grabación" tip={tip}>
                {ventana && (
                    <span className="t-cap mut num">
                        Del {diaMes(ventana.desde)} al {diaMes(ventana.hasta)} · {ventana.dias} {ventana.dias === 1 ? 'día' : 'días'}
                        {ventana.abierta && <span className="chip wt-chip-sm" style={{ '--c': 'var(--warning)' }}>Abierta hasta hoy</span>}
                    </span>
                )}
            </PanelCab>
            <div className="pareja" style={{ '--min': '210px', '--g': 'var(--s3)' }}>
                <Columna titulo="Clase en vivo" Icono={Radio} datos={desglose.vivo} color="var(--info)" />
                <Columna titulo="Grabación (landing)" Icono={PlayCircle} datos={desglose.landing} color="var(--brand-secondary)" />
            </div>
        </section>
    );
};

export default WorkshopSourceSplit;
