import { Maximize2, Minimize2 } from 'lucide-react';
import CajaDesplazable from '../../../../components/listas/CajaDesplazable';
import './tablaAnuncios.css';

/**
 * El contenedor de las tablas de Marketing: una caja con alto acotado (el encabezado y la columna del
 * nombre quedan fijos al desplazar, ver `.mk-tabla-caja--alta`) y, arriba, una segunda barra de
 * desplazamiento horizontal sincronizada con la de abajo, para no tener que bajar hasta el final
 * (Kerwin, 23/10/2026). La mecánica es la de `CajaDesplazable`, que comparten todas las tablas.
 */
export const CajaDeTabla = ({ children, completa = false, className = '' }) => (
    <CajaDesplazable claseArriba="mk-scroll-arriba"
        className={`mk-tabla-caja mk-tabla-caja--alta${completa ? ' mk-tabla-caja--completa' : ''} ${className}`.trim()}>
        {children}
    </CajaDesplazable>
);

export const BotonPantallaCompleta = ({ completa, onClick }) => (
    <button type="button" className={`pastilla pastilla--sm${completa ? ' pastilla--on' : ''}`}
        aria-pressed={completa} onClick={onClick}
        title={completa ? 'Volver a la página (Escape)' : 'Ver la tabla a pantalla completa'}>
        {completa ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
        {completa ? 'Salir' : 'Pantalla completa'}
    </button>
);

export default CajaDeTabla;
