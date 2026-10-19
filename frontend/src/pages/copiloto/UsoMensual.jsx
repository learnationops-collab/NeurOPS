// Cuánto gastó la persona en el mes contra su tope (app/api/copiloto.py: TOPE_MENSUAL_USD). Desde el
// 80% se pone ámbar y dice cuándo se renueva; en el tope, rojo.

const plata = (n) => `US$${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const diaDeRenovacion = (iso) => {
    const [, mes, dia] = (iso || '').split('-');
    return dia ? `${Number(dia)}/${Number(mes)}` : '';
};

export default function UsoMensual({ uso }) {
    if (!uso) return null;
    const { gastado_usd: gastado, tope_usd: tope, porcentaje, renueva } = uso;
    const nivel = porcentaje >= 100 ? 'agotado' : porcentaje >= 80 ? 'alto' : 'normal';
    return (
        <div className={`cp-uso cp-uso--${nivel}`}>
            <div className="cp-uso__txt">
                <span>Uso del mes</span>
                <span>{plata(gastado)} de {plata(tope)}</span>
            </div>
            <div className="cp-uso__barra" role="meter" aria-label="Uso del mes de Learnito"
                aria-valuemin={0} aria-valuemax={100} aria-valuenow={porcentaje}
                aria-valuetext={`${plata(gastado)} de ${plata(tope)}`}>
                <span style={{ width: `${Math.max(porcentaje, porcentaje > 0 ? 2 : 0)}%` }} />
            </div>
            {nivel !== 'normal' && (
                <p className="cp-uso__nota">
                    {nivel === 'agotado' ? 'Llegaste al tope de este mes.' : 'Te queda poco uso este mes.'}
                    {' '}Se renueva el {diaDeRenovacion(renueva)}.
                </p>
            )}
        </div>
    );
}
