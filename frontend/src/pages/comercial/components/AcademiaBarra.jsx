import React, { useMemo, useState } from 'react';
import { GraduationCap, RefreshCw } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { Tip, fmt } from './Shared';
import { DIAS_DATO_VIEJO, diasDesde, haceCuanto, resumenAcademia } from './academia';

/**
 * La línea que va arriba de las columnas de la Academia: cuántos clientes tienen datos y de cuándo
 * es el más viejo.
 *
 * Existe porque la tabla no le pregunta nada a la Academia en vivo: lee la última foto de cada
 * cliente (ver `academia.js`). Sin esta línea un "Inactivo" de hace tres semanas se leería igual que
 * uno de esta mañana. Se cuenta sobre TODAS las filas de la tabla y no sobre lo filtrado: la
 * pregunta es "¿puedo confiar en estos datos?", y un filtro no cambia la respuesta.
 *
 * `onSincronizar` llega solo para la dirección (ver `DashboardComercial`): corre un lote de fotos y
 * recarga la tabla. Cada lote gasta del límite de la Academia que comparte todo el equipo, por eso
 * el botón queda deshabilitado mientras corre —dos clics seguidos serían dos lotes—.
 */
const AcademiaBarra = ({ filas, onSincronizar = null }) => {
    const r = useMemo(() => resumenAcademia(filas), [filas]);
    const viejo = r.masViejo && diasDesde(r.masViejo) > DIAS_DATO_VIEJO;
    const quieto = useReducedMotion();
    const [corriendo, setCorriendo] = useState(false);

    const actualizar = async () => {
        setCorriendo(true);
        try {
            await onSincronizar();
        } finally {
            setCorriendo(false);
        }
    };

    // Entra con un fundido corto al pasar a las columnas de la Academia, que es cuando aparece.
    return (
        <motion.div className="academia-barra"
            initial={quieto ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={quieto ? { duration: 0 } : { duration: .2, ease: 'easeOut' }}>
            <GraduationCap size={15} aria-hidden="true" />
            <span className="t-sm">
                {r.clientes === 0 ? 'No hay clientes para mirar en la Academia.' : (
                    <>
                        <b className="num">{fmt.num(r.conDatos)}</b>
                        {` de ${fmt.num(r.clientes)} ${r.clientes === 1 ? 'cliente' : 'clientes'} con datos de la Academia`}
                        {r.masViejo && (
                            <span className="mut40" style={viejo ? { color: 'var(--warning)' } : undefined}>
                                {` · el dato más viejo es de ${haceCuanto(r.masViejo)}`}
                            </span>
                        )}
                        {r.sinDatos > 0 && (
                            <span className="mut40">{` · ${fmt.num(r.sinDatos)} sin datos todavía`}</span>
                        )}
                    </>
                )}
            </span>
            <Tip titulo="De dónde salen estos datos"
                texto={'No se le preguntan a la Academia al abrir la tabla: se guarda una foto de cada '
                    + 'alumno cuando alguien abre la pestaña Fulfillment de su ficha, y una sincronización '
                    + 'automática va renovando las más viejas de a poco (la Academia admite 60 consultas '
                    + 'por minuto para todo el equipo).'} />
            {onSincronizar && (
                <button type="button" className="btn btn--linea btn--sm" style={{ marginLeft: 'auto' }}
                    disabled={corriendo} aria-busy={corriendo} onClick={actualizar}>
                    {/* El ícono gira mientras el lote corre; quieto con reduced-motion. */}
                    <motion.span style={{ display: 'inline-flex' }}
                        animate={corriendo && !quieto ? { rotate: 360 } : { rotate: 0 }}
                        transition={corriendo && !quieto
                            ? { repeat: Infinity, duration: 1, ease: 'linear' } : { duration: 0 }}>
                        <RefreshCw size={13} aria-hidden="true" />
                    </motion.span>
                    {corriendo ? 'Actualizando…' : 'Actualizar datos de la Academia'}
                </button>
            )}
        </motion.div>
    );
};

/**
 * Qué columnas se ven: las de siempre de la tabla (`base`: "Cobro" en Clientes, "Venta" en Ventas)
 * o las de la Academia. Dos posiciones, como lista o tarjetas: son las mismas filas y el mismo
 * filtro vistos de otra forma, no otra lista.
 */
export const SelectorColumnas = ({ base, academia, onCambiar }) => (
    <div className="seg" role="group" aria-label="Columnas">
        <button type="button" aria-pressed={!academia} onClick={() => onCambiar('base')}>
            {base}
        </button>
        <button type="button" aria-pressed={academia} onClick={() => onCambiar('academia')}
            title="Actividad de cada alumno en la Academia">
            <GraduationCap size={13} aria-hidden="true" style={{ marginRight: 5, verticalAlign: '-2px' }} />
            Academia
        </button>
    </div>
);

export default AcademiaBarra;
