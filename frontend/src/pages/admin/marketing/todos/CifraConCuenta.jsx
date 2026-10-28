import { TITULO_DE } from './comparacion';

/**
 * Una cifra (el %, el ROAS, el costo) que muestra SOLA, con su cuenta en un tooltip (Kerwin, 28/10/2026):
 * «163 de 2.448 leads». Cada parte de la cuenta es un botón que abre la lista que la suma, y la cifra misma abre la
 * del numerador. Sin `cuenta` es solo la cifra, que abre la lista de `metrica` si la tiene.
 *
 * `onVer(metrica, titulo)` abre la lista de esa fuente (la pantalla ya sabe de cuál).
 */
const CifraConCuenta = ({ children, cuenta = null, metrica = null, onVer = null, className = '' }) => {
    const abrir = (m) => onVer && m && onVer(m, TITULO_DE[m] || m);
    const lista = cuenta?.a?.m || metrica;
    if (!onVer || !lista) return <span className={`td-cc td-cc--quieta ${className}`}>{children}</span>;
    return (
        <span className={`td-cc ${className}`}>
            <button type="button" className="td-cc-cifra" onClick={() => abrir(lista)}
                aria-label={`${children}: ver la lista de ${(TITULO_DE[lista] || lista).toLowerCase()}`}>
                {children}
            </button>
            {cuenta && (
                <span className="td-tip" role="tooltip">
                    <button type="button" onClick={() => abrir(cuenta.a.m)}>{cuenta.a.t}</button>
                    <span> de </span>
                    <button type="button" onClick={() => abrir(cuenta.b.m)}>{cuenta.b.t}</button>
                    <small>Tocá una cifra para ver su lista</small>
                </span>
            )}
        </span>
    );
};

export default CifraConCuenta;
