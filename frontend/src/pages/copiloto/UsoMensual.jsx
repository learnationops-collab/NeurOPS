// El uso de Learnito (app/api/copiloto.py: `_uso`), en porcentajes: la plata no se muestra. La barra
// es la de HOY contra una referencia diaria aproximada (el tope del mes repartido en sus días): orienta,
// no corta. El que corta es el tope del mes, que va abajo en texto. La barra se pone ámbar al pasar lo
// del día; la línea del mes, ámbar desde el 80% y roja en el tope.

const pct = (n) => {
    const v = Number(n || 0);
    return v > 0 && v < 1 ? 'menos del 1%' : `${Math.round(v)}%`;
};

const diaDeRenovacion = (iso) => {
    const [, mes, dia] = (iso || '').split('-');
    return dia ? `${Number(dia)}/${Number(mes)}` : '';
};

export default function UsoMensual({ uso }) {
    if (!uso) return null;
    const { porcentaje, renueva, porcentaje_hoy: porcentajeHoy } = uso;
    const mes = porcentaje >= 100 ? 'agotado' : porcentaje >= 80 ? 'alto' : 'normal';
    const dia = porcentajeHoy > 100 ? 'pasado' : 'normal';
    const ancho = Math.min(100, Math.max(porcentajeHoy, porcentajeHoy > 0 ? 2 : 0));
    return (
        <div className={`cp-uso cp-uso--${mes === 'agotado' ? 'agotado' : dia === 'pasado' ? 'alto' : 'normal'}`}>
            <div className="cp-uso__txt">
                <span>Hoy</span>
                <span>{pct(porcentajeHoy)} de lo diario</span>
            </div>
            <div className="cp-uso__barra" role="meter" aria-label="Uso de hoy de Learnito"
                aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, porcentajeHoy)}
                aria-valuetext={`${pct(porcentajeHoy)} de lo diario`}>
                <span style={{ width: `${ancho}%` }} />
            </div>
            <p className={`cp-uso__mes cp-uso__mes--${mes}`}>
                {mes === 'agotado'
                    ? `Llegaste al tope del mes. Se renueva el ${diaDeRenovacion(renueva)}.`
                    : `Mes: ${pct(porcentaje)} usado${mes === 'alto' ? ` · se renueva el ${diaDeRenovacion(renueva)}` : ''}`}
            </p>
        </div>
    );
}
