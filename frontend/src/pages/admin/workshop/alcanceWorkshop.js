import { esFecha, textoRango } from '../../comercial/components/RangoFechas';
import { PERIODOS, PERIODO_POR_DEFECTO, rangoDePeriodo } from '../marketing/anuncios/metricas';
import { filtrarTalleres, filtroDeParams } from './filtroTalleres';

/**
 * De qué habla cada pestaña de Workshop (Kerwin, auditoría del 28/10/2026): Resumen, Talleres y Planificar
 * cuentan los talleres realizados; Anuncios de Meta y Tráfico, un período de Meta. Mismo nombre, dos
 * universos, y ninguna lo decía. Devuelve el renglón que va bajo la cabecera, o null mientras faltan datos.
 */
const corta = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;

const periodoDe = (params) => {
    const periodo = PERIODOS.some((p) => p.key === params.get('periodo')) ? params.get('periodo') : PERIODO_POR_DEFECTO;
    const desde = params.get('desde');
    const hasta = params.get('hasta');
    const rango = periodo === 'personalizado' && esFecha(desde) && esFecha(hasta)
        ? { desde, hasta } : rangoDePeriodo(periodo === 'personalizado' ? PERIODO_POR_DEFECTO : periodo);
    const nombre = periodo === 'personalizado' ? 'período elegido' : PERIODOS.find((x) => x.key === periodo)?.label?.toLowerCase();
    return `${nombre} (${textoRango(rango)})`;
};

const fechasDe = (talleres) => {
    const dias = talleres.map((t) => t.date).filter(Boolean).sort();
    return dias.length ? `del ${corta(dias[0])} al ${corta(dias[dias.length - 1])}` : '';
};

export const alcanceDeWorkshop = (pestana, realizados, params) => {
    const total = realizados?.length;
    const sobreTalleres = (texto) => (total == null ? null : texto);
    switch (pestana) {
        case 'resumen': {
            if (total == null) return null;
            const analizados = filtrarTalleres(realizados, filtroDeParams(params));
            return `${analizados.length} de ${total} talleres realizados${analizados.length ? `, ${fechasDe(analizados)}` : ''}.`;
        }
        case 'talleres':
            return sobreTalleres(`Los ${total} talleres realizados, ${fechasDe(realizados || [])}.`);
        case 'planificar':
            return sobreTalleres(`Los talleres que vienen, con los ${total} realizados como base.`);
        case 'correlaciones':
            return sobreTalleres(`Los ${total} talleres realizados.`);
        case 'rendimiento':
            return `El gasto y los anuncios de Meta de Workshop, no por taller: ${periodoDe(params)}.`;
        case 'trafico':
            return `Visitas y clics de las landings: ${periodoDe(params)}.`;
        default:
            return null;
    }
};

export default alcanceDeWorkshop;
