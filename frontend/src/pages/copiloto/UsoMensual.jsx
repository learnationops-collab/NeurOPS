// El uso de Learnito (app/api/copiloto.py: `_uso`). La barra es la de HOY contra una referencia
// diaria aproximada (el tope del mes repartido en sus días): orienta, no corta. El que corta es el
// tope del mes, que va abajo en texto. La barra se pone ámbar al pasar lo del día; la línea del mes,
// ámbar desde el 80% y roja en el tope.

const plata = (n) => `US$${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const diaDeRenovacion = (iso) => {
    const [, mes, dia] = (iso || '').split('-');
    return dia ? `${Number(dia)}/${Number(mes)}` : '';
};

export default function UsoMensual({ uso }) {
    if (!uso) return null;
    const { gastado_usd: gastado, tope_usd: tope, porcentaje, renueva } = uso;
    const { hoy_usd: hoy, tope_diario_usd: diario, porcentaje_hoy: porcentajeHoy } = uso;
    const mes = porcentaje >= 100 ? 'agotado' : porcentaje >= 80 ? 'alto' : 'normal';
    const dia = porcentajeHoy > 100 ? 'pasado' : 'normal';
    const ancho = Math.min(100, Math.max(porcentajeHoy, porcentajeHoy > 0 ? 2 : 0));
    return (
        <div className={`cp-uso cp-uso--${mes === 'agotado' ? 'agotado' : dia === 'pasado' ? 'alto' : 'normal'}`}>
            <div className="cp-uso__txt">
                <span>Hoy</span>
                <span>{plata(hoy)} de ~{plata(diario)} por día</span>
            </div>
            <div className="cp-uso__barra" role="meter" aria-label="Uso de hoy de Learnito"
                aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, porcentajeHoy)}
                aria-valuetext={`${plata(hoy)} de unos ${plata(diario)} por día`}>
                <span style={{ width: `${ancho}%` }} />
            </div>
            <p className={`cp-uso__mes cp-uso__mes--${mes}`}>
                {mes === 'agotado'
                    ? `Llegaste al tope del mes (${plata(tope)}). Se renueva el ${diaDeRenovacion(renueva)}.`
                    : `Mes: ${plata(gastado)} de ${plata(tope)}${mes === 'alto' ? ` · se renueva el ${diaDeRenovacion(renueva)}` : ''}`}
            </p>
        </div>
    );
}
