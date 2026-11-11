// El markdown de una nota de Gemini, dibujado sin librería: títulos, viñetas, separadores, negritas y
// links. Es lo único que trae ese Doc; cualquier otra marca se ve como texto.

const LINEA = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g;

function Linea({ texto }) {
    return texto.split(LINEA).map((parte, i) => {
        const negrita = parte.match(/^\*\*([^*]+)\*\*$/);
        if (negrita) return <strong key={i}>{negrita[1]}</strong>;
        const link = parte.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
        if (link) return <a key={i} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>;
        return parte.replace(/\\([[\]_*])/g, '$1');
    });
}

export default function NotaMarkdown({ texto }) {
    const bloques = [];
    let vinetas = [];
    const cerrarVinetas = () => {
        if (vinetas.length) bloques.push(<ul key={`ul${bloques.length}`}>{vinetas}</ul>);
        vinetas = [];
    };
    (texto || '').split('\n').forEach((crudo, i) => {
        const linea = crudo.trim();
        if (/^\s*[-*]\s+/.test(crudo) && !/^-{3,}$/.test(linea)) {
            vinetas.push(<li key={i}><Linea texto={linea.replace(/^[-*]\s+/, '')} /></li>);
            return;
        }
        cerrarVinetas();
        if (!linea) return;
        if (/^-{3,}$/.test(linea)) bloques.push(<hr key={i} />);
        else if (/^#{1,6}\s/.test(linea)) bloques.push(<h4 key={i} className="t-h4"><Linea texto={linea.replace(/^#+\s*/, '').replace(/\*\*/g, '')} /></h4>);
        else bloques.push(<p key={i} className="t-sm"><Linea texto={linea} /></p>);
    });
    cerrarVinetas();
    return <div className="fi-meet-md">{bloques}</div>;
}
