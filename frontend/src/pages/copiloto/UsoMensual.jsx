// El uso de Learnito en el mes, en porcentaje de lo que le toca a cada persona (lo lleva la Academia y llega con
// cada respuesta: {porcentaje, renueva}). La plata no se muestra. Ámbar desde el 80% y rojo en el tope.

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
    const { porcentaje, renueva } = uso;
    const mes = porcentaje >= 100 ? 'agotado' : porcentaje >= 80 ? 'alto' : 'normal';
    return (
        <div className={`cp-uso cp-uso--${mes}`}>
            <p className={`cp-uso__mes cp-uso__mes--${mes}`}>
                {mes === 'agotado'
                    ? `Llegaste al tope del mes. Se renueva el ${diaDeRenovacion(renueva)}.`
                    : `Mes: ${pct(porcentaje)} usado${mes === 'alto' ? ` · se renueva el ${diaDeRenovacion(renueva)}` : ''}`}
            </p>
        </div>
    );
}
