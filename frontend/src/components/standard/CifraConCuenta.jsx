/**
 * Una cifra (un %, un ROAS, un costo) que se muestra SOLA, con su cuenta en un tooltip (Kerwin, 28/10/2026):
 * «163 de 2.448 leads». Cada parte de la cuenta es un botón que abre la lista que la suma, y la cifra misma abre la
 * del numerador. Sin `cuenta` es solo la cifra, que abre la lista de `metrica` si la tiene.
 *
 * `cuenta`: `{ a, b }` con numerador y denominador, cada uno `{ t: texto, m: lista que lo suma, titulo }`. Una parte
 * sin `m` (un número que no tiene lista) se ve en el tooltip pero no se toca.
 * `onVer(metrica, titulo)`: la pantalla abre esa lista (`useVerRegistros`); sin ella la cifra queda quieta.
 * `metrica` / `titulo`: la lista de una cifra sin cuenta. `lado="der"`: el tooltip se abre hacia la izquierda
 * (para una cifra pegada al borde derecho de la pantalla).
 */
const CifraConCuenta = ({ children, cuenta = null, metrica = null, titulo = null, onVer = null, lado = 'izq', className = '' }) => {
    const lista = onVer ? (cuenta?.a?.m || metrica) : null;
    const tituloDe = (m, t) => t || (m === metrica && titulo) || m;
    const abrir = (m, t) => onVer && m && onVer(m, tituloDe(m, t));
    const clases = `ui-cifra${lado === 'der' ? ' ui-cifra--der' : ''} ${className}`;
    if (!lista && !cuenta) return <span className={`ui-cifra ui-cifra--quieta ${className}`}>{children}</span>;

    const parte = (p) => (onVer && p.m
        ? <button type="button" onClick={() => abrir(p.m, p.titulo)}>{p.t}</button>
        : <b>{p.t}</b>);
    return (
        <span className={clases}>
            {lista ? (
                <button type="button" className="ui-cifra__valor" onClick={() => abrir(lista, cuenta?.a?.titulo)}
                    aria-label={`${typeof children === 'string' ? `${children}: ` : ''}ver la lista de ${String(tituloDe(lista, cuenta?.a?.titulo)).toLowerCase()}`}>
                    {children}
                </button>
            ) : <span className="ui-cifra__valor ui-cifra__valor--quieta" tabIndex={0}>{children}</span>}
            {cuenta && (
                <span className="ui-cifra__cuenta" role="tooltip">
                    {parte(cuenta.a)}
                    <span> de </span>
                    {parte(cuenta.b)}
                    {lista && <small>Tocá una cifra para ver su lista</small>}
                </span>
            )}
        </span>
    );
};

export default CifraConCuenta;
