// Un gráfico adjunto a una respuesta de Learnito: lo calcula el conector de Work (learnito_conector.card) cuando un
// cálculo agrupa o mide, y el texto lo ubica con su marcador ([[A]]). Se dibuja con CSS y los tokens del tema, sin
// librería: un número, un anillo (un porcentaje), barras (por valor) o columnas (por período).

const numero = (n, pct) => {
    if (n == null) return '—';
    const v = Number(n);
    const texto = v.toLocaleString('es-AR', { maximumFractionDigits: Number.isInteger(v) ? 0 : 1 });
    return pct ? `${texto} %` : texto;
};

function Barras({ filas, pct }) {
    const max = Math.max(...filas.map((f) => Number(f.valor) || 0), pct ? 100 : 0) || 1;
    return (
        <ul className="cp-graf__barras">
            {filas.map((f) => (
                <li key={f.label}>
                    <span className="cp-graf__rotulo" title={f.label}>{f.label}</span>
                    <span className="cp-graf__pista">
                        <span style={{ width: `${Math.max(1, (100 * (Number(f.valor) || 0)) / max)}%` }} />
                    </span>
                    <span className="cp-graf__valor" title={f.ic95 ? `IC 95 %: ${f.ic95[0]} a ${f.ic95[1]} %` : undefined}>
                        {numero(f.valor, pct)}{pct && <small> ({f.filas})</small>}
                    </span>
                </li>
            ))}
        </ul>
    );
}

function Columnas({ filas, pct }) {
    const max = Math.max(...filas.map((f) => Number(f.valor) || 0)) || 1;
    return (
        <div className="cp-graf__columnas" role="list">
            {filas.map((f) => (
                <div key={f.label} className="cp-graf__columna" role="listitem">
                    <span className="cp-graf__valor">{numero(f.valor, pct)}</span>
                    <span className="cp-graf__alto"><span style={{ height: `${Math.max(2, (100 * (Number(f.valor) || 0)) / max)}%` }} /></span>
                    <span className="cp-graf__rotulo">{f.label}</span>
                </div>
            ))}
        </div>
    );
}

export default function Grafico({ adjunto }) {
    const { titulo, w = {}, data = {} } = adjunto || {};
    const filas = data.filas || [];
    let cuerpo = null;
    if (w.tipo === 'barras' && filas.length) cuerpo = <Barras filas={filas} pct={w.pct} />;
    else if (w.tipo === 'linea' && filas.length) cuerpo = <Columnas filas={filas} pct={w.pct} />;
    else if (w.tipo === 'anillo') {
        cuerpo = (
            <div className="cp-graf__anillo" style={{ '--p': `${Math.min(100, Math.max(0, Number(data.valor) || 0))}%` }}>
                <span>{numero(data.valor, true)}</span>
            </div>
        );
    } else if (w.tipo === 'numero') cuerpo = <p className="cp-graf__numero">{numero(data.valor)}</p>;
    if (!cuerpo) return null;
    return (
        <figure className="cp-graf">
            <figcaption>{titulo}</figcaption>
            {cuerpo}
            <p className="cp-graf__pie">
                {numero(data.total)} filas{data.otros > 0 ? ` · ${numero(data.otros)} en otros grupos` : ''}
            </p>
        </figure>
    );
}
