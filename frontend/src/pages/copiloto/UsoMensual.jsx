// El uso de Learnito, en porcentaje (la plata no se muestra; lo lleva la Academia y llega con cada respuesta):
// - la barra de esta conversación contra su tope (`uso.conversacion`: {porcentaje, agotada}). Al llenarse no se sigue
//   escribiendo en ella;
// - la línea del mes, contra lo que le toca a cada persona ({porcentaje, renueva}).
// Ámbar desde el 80% y rojo en el tope.

const pct = (n) => {
    const v = Number(n || 0);
    return v > 0 && v < 1 ? 'menos del 1%' : `${Math.round(v)}%`;
};

const diaDeRenovacion = (iso) => {
    const [, mes, dia] = (iso || '').split('-');
    return dia ? `${Number(dia)}/${Number(mes)}` : '';
};

const nivel = (p, tope) => (tope || p >= 100 ? 'agotado' : p >= 80 ? 'alto' : 'normal');

export default function UsoMensual({ uso }) {
    if (!uso) return null;
    const { porcentaje, renueva, conversacion } = uso;
    const mes = nivel(porcentaje);
    const conv = conversacion ? nivel(conversacion.porcentaje, conversacion.agotada) : null;
    const p = Math.min(100, Number(conversacion?.porcentaje || 0));
    return (
        <div className={`cp-uso cp-uso--${conv === 'agotado' || mes === 'agotado' ? 'agotado' : conv || mes}`}>
            {conversacion && (
                <>
                    <div className="cp-uso__txt">
                        <span>{conv === 'agotado' ? 'Esta conversación llegó a su tope: calificala y empezá otra.' : 'Esta conversación'}</span>
                        <span>{pct(p)}</span>
                    </div>
                    <div className="cp-uso__barra" role="meter" aria-label="Uso de esta conversación"
                        aria-valuemin={0} aria-valuemax={100} aria-valuenow={p} aria-valuetext={pct(p)}>
                        <span style={{ width: `${Math.max(p, p > 0 ? 2 : 0)}%` }} />
                    </div>
                </>
            )}
            <p className={`cp-uso__mes cp-uso__mes--${mes}`}>
                {mes === 'agotado'
                    ? `Llegaste al tope del mes. Se renueva el ${diaDeRenovacion(renueva)}.`
                    : `Mes: ${pct(porcentaje)} usado${mes === 'alto' ? ` · se renueva el ${diaDeRenovacion(renueva)}` : ''}`}
            </p>
        </div>
    );
}
