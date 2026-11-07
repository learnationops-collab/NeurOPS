import { useState } from 'react';

const DIA_MAXIMO = 14;

/**
 * Qué días desde la llamada tienen columna. Para todo el equipo: solo la dirección los cambia
 * (`editable`); al resto no se le muestra nada.
 */
const DiasDelEmbudo = ({ dias, editable, onGuardar }) => {
    const [agregando, setAgregando] = useState(false);
    if (!editable) return null;
    const libres = Array.from({ length: DIA_MAXIMO }, (_, i) => i + 1).filter(d => !dias.includes(d));

    return (
        <div className="emb-dias">
            <small>Columnas del equipo</small>
            {dias.map(d => (
                <span key={d} className="emb-dia">
                    Día {d}
                    <button type="button" className="emb-x" aria-label={`Quitar el día ${d}`} title={`Quitar el día ${d}`}
                        disabled={dias.length <= 1} onClick={() => onGuardar(dias.filter(x => x !== d))}>×</button>
                </span>
            ))}
            {libres.length > 0 && (
                <button type="button" className="emb-dia emb-dia--mas" onClick={() => setAgregando(v => !v)}>+ Agregar día</button>
            )}
            {agregando && (
                <span className="emb-libres">
                    {libres.map(d => (
                        <button key={d} type="button" className="emb-dia emb-dia--mas"
                            onClick={() => { setAgregando(false); onGuardar([...dias, d].sort((a, b) => a - b)); }}>
                            Día {d}
                        </button>
                    ))}
                </span>
            )}
        </div>
    );
};

export default DiasDelEmbudo;
