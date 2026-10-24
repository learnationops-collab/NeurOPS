// Las respuestas del cerebro de Learnito (en la Academia) vienen en markdown: títulos, viñetas, negritas, tablas y
// las líneas "> Ojo:" / "> Dato:". Se dibujan con elementos de React (sin HTML crudo): lo que no se reconoce queda
// como texto. Los marcadores de adjunto ([[A]]) se sacan: Work todavía no dibuja gráficos.

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((?:https?:\/\/|\/)[^)\s]+\)|(?<![\w*])[*_](?=\S)[^*_\n]+(?<=\S)[*_](?![\w*]))/g;

function inline(texto, clave) {
    return texto.split(INLINE).filter(Boolean).map((parte, i) => {
        const k = `${clave}-${i}`;
        if (parte.startsWith('**') && parte.endsWith('**')) return <strong key={k}>{parte.slice(2, -2)}</strong>;
        if (parte.startsWith('`') && parte.endsWith('`')) return <code key={k}>{parte.slice(1, -1)}</code>;
        const link = parte.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
        if (link) return <a key={k} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>;
        if (/^[*_].+[*_]$/.test(parte)) return <em key={k}>{parte.slice(1, -1)}</em>;
        return parte;
    });
}

const celdas = (linea) => linea.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

// Bloques: tabla, lista, cita, título o párrafo, en el orden en que aparecen.
function bloques(texto) {
    const lineas = String(texto || '').replace(/^\s*\[\[[A-Z]\]\]\s*$/gm, '').split('\n');
    const out = [];
    for (let i = 0; i < lineas.length; i++) {
        const l = lineas[i];
        if (!l.trim()) continue;
        if (l.trim().startsWith('|') && /^\s*\|?[\s:|-]+\|?\s*$/.test(lineas[i + 1] || '')) {
            const filas = [];
            for (i += 2; i < lineas.length && lineas[i].trim().startsWith('|'); i++) filas.push(celdas(lineas[i]));
            i--;
            out.push({ tipo: 'tabla', cabecera: celdas(l), filas });
        } else if (/^\s*([-*•]|\d+[.)])\s+/.test(l)) {
            const ordenada = /^\s*\d+[.)]/.test(l);
            const items = [];
            for (; i < lineas.length && /^\s*([-*•]|\d+[.)])\s+/.test(lineas[i]); i++) {
                items.push(lineas[i].replace(/^\s*([-*•]|\d+[.)])\s+/, ''));
            }
            i--;
            out.push({ tipo: ordenada ? 'ol' : 'ul', items });
        } else if (l.trim().startsWith('>')) {
            out.push({ tipo: 'cita', texto: l.trim().replace(/^>\s?/, '') });
        } else if (/^#{1,4}\s/.test(l)) {
            out.push({ tipo: 'titulo', texto: l.replace(/^#+\s/, '') });
        } else {
            out.push({ tipo: 'p', texto: l });
        }
    }
    return out;
}

export default function Markdown({ texto }) {
    return (
        <div className="cp-md">
            {bloques(texto).map((b, i) => {
                const k = `b${i}`;
                if (b.tipo === 'tabla') {
                    return (
                        <div key={k} className="cp-md__tabla">
                            <table>
                                <thead><tr>{b.cabecera.map((c, j) => <th key={j}>{inline(c, `${k}h${j}`)}</th>)}</tr></thead>
                                <tbody>
                                    {b.filas.map((f, r) => (
                                        <tr key={r}>{f.map((c, j) => <td key={j}>{inline(c, `${k}r${r}c${j}`)}</td>)}</tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    );
                }
                if (b.tipo === 'ul' || b.tipo === 'ol') {
                    const Lista = b.tipo;
                    return <Lista key={k}>{b.items.map((it, j) => <li key={j}>{inline(it, `${k}i${j}`)}</li>)}</Lista>;
                }
                if (b.tipo === 'cita') {
                    const ojo = /^ojo:/i.test(b.texto);
                    return <p key={k} className={`cp-md__cita${ojo ? ' cp-md__cita--ojo' : ''}`}>{inline(b.texto, k)}</p>;
                }
                if (b.tipo === 'titulo') return <p key={k} className="cp-md__titulo">{inline(b.texto, k)}</p>;
                return <p key={k}>{inline(b.texto, k)}</p>;
            })}
        </div>
    );
}
