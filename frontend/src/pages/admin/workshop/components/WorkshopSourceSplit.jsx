import { Radio, PlayCircle, Loader2 } from 'lucide-react';
import InfoTooltip from '../../../../components/ui/InfoTooltip';

const Columna = ({ titulo, subtitulo, icono: Icono, datos, formatCurrency }) => (
    <article>
        <div className="source-title">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Icono size={14} /> {titulo}</span>
            {!datos && <b>Sin datos</b>}
        </div>
        <p style={{ margin: '-10px 0 12px', color: 'var(--text-muted)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em' }}>{subtitulo}</p>
        <dl>
            <div><dt>Aplicaciones</dt><dd>{datos?.aplicaciones_form ?? '—'}</dd></div>
            <div><dt>Agendas</dt><dd>{datos?.agendas ?? '—'}</dd></div>
            <div><dt>Asistieron</dt><dd>{datos?.show_up ?? '—'}</dd></div>
            <div><dt>Compradores</dt><dd>{datos?.sales ?? '—'}</dd></div>
            <div><dt>Cobrado</dt><dd>{datos ? formatCurrency(datos.cash_collected) : '—'}</dd></div>
            <div><dt>No asistieron</dt><dd>{datos?.breakdown?.['No Show'] ?? '—'}</dd></div>
        </dl>
    </article>
);

/**
 * Cuánto aporta la clase en vivo y cuánto la grabación de la landing.
 *
 * Los dos son el MISMO workshop (por eso suman en los totales de arriba), pero
 * separarlos es lo único que responde "¿vale la pena dejar la grabación
 * publicada?". La grabación queda arriba 2 días, así que sus agendas caen
 * después del día de la clase.
 */
const WorkshopSourceSplit = ({ desglose, ventana, cargando, formatCurrency }) => {
    if (cargando) {
        return (
            <p style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', padding: '20px 0' }}>
                <Loader2 size={14} className="animate-spin" /> Calculando el aporte de cada embudo…
            </p>
        );
    }
    if (!desglose) return null;

    return (
        <section className="panel source-panel" aria-labelledby="source-title">
            <div className="section-heading">
                <div>
                    <p className="eyebrow">Aporte por entrada</p>
                    <h2 id="source-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        Vivo vs. grabación
                        <InfoTooltip
                            label="Aporte de cada entrada"
                            text="Un workshop tiene dos puertas de entrada: la clase en vivo y la grabación que queda publicada después. Las dos cuentan como el mismo workshop en los totales de arriba; acá se ven separadas para saber cuánto aporta cada una."
                        />
                    </h2>
                </div>
                {ventana && (
                    <p className="secondary-copy">
                        Grabación contada del {ventana.landing_desde} al {ventana.landing_hasta}
                        {ventana.landing_recortada && <span className="status warning" style={{ marginLeft: 10 }}>Recortada</span>}
                    </p>
                )}
            </div>

            <div className="source-grid">
                <Columna titulo="Clase en vivo" subtitulo="El día del workshop" icono={Radio} datos={desglose.vivo} formatCurrency={formatCurrency} />
                <Columna
                    titulo="Grabación (landing)"
                    subtitulo={ventana ? `${ventana.landing_dias} día(s) publicada` : 'Replay'}
                    icono={PlayCircle}
                    datos={desglose.landing}
                    formatCurrency={formatCurrency}
                />
            </div>

            <p className="secondary-copy" style={{ marginTop: 18, fontSize: 10 }}>
                Si una misma persona aparece en la clase en vivo y también en la grabación, se cuenta una sola
                vez (del lado del vivo), así los dos bloques suman exactamente el total del workshop.
            </p>
        </section>
    );
};

export default WorkshopSourceSplit;
