import { Radio, PlayCircle, Loader2 } from 'lucide-react';
import InfoTooltip from '../../../../components/ui/InfoTooltip';

const Metrica = ({ label, valor, ayuda, formato }) => (
    <div className="bg-slate-950/60 border border-slate-900 rounded-xl p-2.5">
        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
            {label}
            {ayuda && <InfoTooltip label={label} text={ayuda} size={10} />}
        </p>
        <p className="text-sm font-black text-white italic tracking-tighter">
            {formato ? formato(valor) : (valor ?? 0).toLocaleString()}
        </p>
    </div>
);

const Columna = ({ titulo, subtitulo, icono: Icono, color, datos, formatCurrency }) => (
    <div className="flex-1 min-w-[240px] space-y-3">
        <div className="flex items-center gap-2">
            <span className={`p-2 rounded-xl bg-slate-950 border border-slate-800 ${color}`}>
                <Icono size={14} />
            </span>
            <div>
                <p className="text-[10px] font-black text-white uppercase tracking-widest leading-none">{titulo}</p>
                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">{subtitulo}</p>
            </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
            <Metrica label="Aplicaciones" valor={datos?.aplicaciones_form}
                     ayuda="Personas que completaron el formulario de calificación." />
            <Metrica label="Agendas" valor={datos?.agendas}
                     ayuda="Llamadas de venta que quedaron agendadas." />
            <Metrica label="Asistieron" valor={datos?.show_up}
                     ayuda="De esas agendas, cuántas personas se presentaron a la llamada." />
            <Metrica label="Compradores" valor={datos?.sales}
                     ayuda="Personas distintas que terminaron comprando." />
            <Metrica label="Cobrado" valor={datos?.cash_collected} formato={formatCurrency}
                     ayuda="Plata efectivamente cobrada a esas personas." />
            <Metrica label="No asistieron" valor={datos?.breakdown?.['No Show']}
                     ayuda="Agendas en las que la persona no se presentó." />
        </div>
    </div>
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
            <div className="flex items-center gap-2 text-slate-500 text-[10px] font-black uppercase tracking-widest py-6">
                <Loader2 size={14} className="animate-spin" /> Calculando el aporte de cada embudo...
            </div>
        );
    }
    if (!desglose) return null;

    return (
        <div className="bg-slate-950/40 border border-slate-900 rounded-[2rem] p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h4 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                    Aporte de cada entrada
                    <InfoTooltip
                        label="Aporte de cada entrada"
                        text="Un workshop tiene dos puertas de entrada: la clase en vivo y la grabación que queda publicada después. Las dos cuentan como el mismo workshop en los totales de arriba; acá se ven separadas para saber cuánto aporta cada una."
                    />
                </h4>
                {ventana && (
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                        Grabación contada del {ventana.landing_desde} al {ventana.landing_hasta}
                        {ventana.landing_recortada && (
                            <span className="ml-2 px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                recortada: hay otro workshop antes
                            </span>
                        )}
                    </span>
                )}
            </div>

            <div className="flex flex-wrap gap-6">
                <Columna
                    titulo="Clase en vivo"
                    subtitulo="El día del workshop"
                    icono={Radio}
                    color="text-indigo-400"
                    datos={desglose.vivo}
                    formatCurrency={formatCurrency}
                />
                <Columna
                    titulo="Grabación (landing)"
                    subtitulo={ventana ? `${ventana.landing_dias} día(s) publicada` : 'Replay'}
                    icono={PlayCircle}
                    color="text-emerald-400"
                    datos={desglose.landing}
                    formatCurrency={formatCurrency}
                />
            </div>

            <p className="text-[9px] text-slate-500 font-medium leading-relaxed">
                Si una misma persona aparece en la clase en vivo y también en la grabación, se cuenta una sola
                vez (del lado del vivo), así los dos bloques suman exactamente el total del workshop.
            </p>
        </div>
    );
};

export default WorkshopSourceSplit;
