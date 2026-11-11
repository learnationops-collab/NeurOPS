// Prueba A/B de un mensaje (app/automatizaciones/variantes.py): pestañas para editar cada variante y los
// resultados de la versión publicada. La «A» es el contenido del nodo; las demás, `nodo.variantes`.
// Solo cambia el texto: botones y salidas son de todas.
import { Plus, X } from 'lucide-react';
import { Button, IconButton, LinkButton, Segmented } from '../../../components/standard';
import { porciento } from '../estadoFlujo';

const LETRAS = ['A', 'B', 'C', 'D'];

export function idsVariantes(nodo) {
    const extra = (nodo.variantes || []).map((v) => v.id);
    return extra.length ? ['A', ...extra] : [];
}

export function contenidoDe(nodo, id) {
    if (id === 'A') return nodo.contenido || [];
    return (nodo.variantes || []).find((v) => v.id === id)?.contenido || [];
}

// El nodo con el contenido de esa variante cambiado.
export function conContenido(nodo, id, contenido) {
    if (id === 'A') return { contenido };
    return { variantes: (nodo.variantes || []).map((v) => (v.id === id ? { ...v, contenido } : v)) };
}

export function PestanasVariantes({ nodo, actual, onElegir, cambiar, lectura }) {
    const ids = idsVariantes(nodo);
    const variantes = nodo.variantes || [];
    const libre = LETRAS.find((l) => !ids.includes(l) && l !== 'A');
    const sumar = () => {
        // Arranca como copia de la que se está viendo: casi siempre se cambia una frase, no todo.
        const copia = JSON.parse(JSON.stringify(contenidoDe(nodo, actual)));
        cambiar({ variantes: [...variantes, { id: libre, contenido: copia }] });
        onElegir(libre);
    };
    const quitar = () => {
        const resto = variantes.filter((v) => v.id !== actual);
        const { variantes: _v, ...sin } = nodo;
        cambiar(resto.length ? { ...nodo, variantes: resto } : sin, true);
        onElegir('A');
    };
    // Cierra la prueba: la variante elegida pasa a ser el mensaje y las demás se borran.
    const quedarse = () => {
        const { variantes: _v, ...sin } = nodo;
        cambiar({ ...sin, contenido: contenidoDe(nodo, actual) }, true);
        onElegir('A');
    };
    if (!ids.length) {
        if (lectura) return null;
        return (
            <LinkButton icon={<Plus />} onClick={sumar}
                data-tip="Prueba A/B|A cada persona le llega una variante, parejo dentro de cada setter. Los botones y las salidas son los mismos.">
                Variante para probar
            </LinkButton>
        );
    }
    return (
        <div className="pf-bloque pf-ab">
            <div className="pf-fila">
                <Segmented size="sm" label="Variante" value={actual} onChange={onElegir}
                    options={ids.map((id) => ({ value: id, label: id }))} />
                {!lectura && libre && <IconButton label="Sumar variante" icon={<Plus />} size="xs" onClick={sumar} />}
                {!lectura && actual !== 'A' && <IconButton label={`Quitar variante ${actual}`} icon={<X />} size="xs" danger onClick={quitar} />}
            </div>
            <span className="pf-ayuda">Prueba A/B: a cada persona le llega una, parejo dentro de cada setter. Solo cambia el texto.</span>
            {!lectura && (
                <Button size="sm" onClick={quedarse}
                    data-tip="Cerrar la prueba|Esta variante pasa a ser el mensaje y las demás se borran. Se aplica al publicar.">
                    Quedarme con la {actual}
                </Button>
            )}
        </div>
    );
}

const COLUMNAS = [
    ['respondieron', 'Responden'],
    ['siguieron', 'Siguen'],
    ['calificados', 'Califican'],
    ['agendas', 'Agendan'],
];

function Veredicto({ fila }) {
    if (fila.clara_vs_a == null) return null;
    return (
        <span className={`pf-ab-veredicto${fila.clara_vs_a ? ' pf-ab-veredicto--clara' : ''}`}>
            {fila.clara_vs_a
                ? `${fila.id}: la diferencia en respuestas con la A ya no es azar`
                : `${fila.id}: la diferencia en respuestas con la A todavía puede ser azar`}
        </span>
    );
}

// Los números de la versión publicada: por variante y el reparto por setter.
export function ResultadosPrueba({ prueba }) {
    if (!prueba) return null;
    const filas = prueba.variantes || [];
    const total = filas.reduce((n, f) => n + f.recibieron, 0);
    if (!total) return <p className="t-cap mut">Prueba A/B publicada: todavía no le llegó a nadie.</p>;
    const setters = Object.entries(prueba.por_setter || {});
    return (
        <div className="pf-bloque">
            <span className="t-rotulo">Resultados de la prueba</span>
            <table className="pf-ab-tabla">
                <thead>
                    <tr><th scope="col">Var.</th><th scope="col">Reciben</th>{COLUMNAS.map(([k, r]) => <th key={k} scope="col">{r}</th>)}</tr>
                </thead>
                <tbody>
                    {filas.map((f) => (
                        <tr key={f.id}>
                            <th scope="row">{f.id}</th>
                            <td>{f.recibieron}</td>
                            {COLUMNAS.map(([k]) => (
                                <td key={k} data-tip={`${f[k]} de ${f.recibieron}`}>{f.suficiente ? porciento(f[`tasa_${k}`]) : '–'}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            {filas.filter((f) => f.id !== 'A').map((f) => <Veredicto key={f.id} fila={f} />)}
            {filas.some((f) => !f.suficiente) && (
                <span className="pf-ayuda">Los porcentajes aparecen desde 20 personas por variante.</span>
            )}
            {setters.length > 0 && (
                <ul className="pf-ab-setters">
                    {setters.map(([s, c]) => (
                        <li key={s}><b>{s}</b> {filas.map((f) => `${f.id} ${c[f.id] || 0}`).join(' · ')}</li>
                    ))}
                </ul>
            )}
        </div>
    );
}
