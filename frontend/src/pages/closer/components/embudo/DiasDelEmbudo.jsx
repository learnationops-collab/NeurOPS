import { useState } from 'react';

const DIA_MAXIMO = 14;

/**
 * Los días del embudo (después de la llamada). Para todo el equipo: solo la dirección los cambia
 * (`editable`); los demás los ven fijos. `enDia(d)` dice cuántos leads hay hoy en ese día, para
 * avisar a dónde pasan si se quita.
 */
const DiasDelEmbudo = ({ dias, editable, enDia, onGuardar }) => {
    const [agregando, setAgregando] = useState(false);
    const [aviso, setAviso] = useState('');

    const quitar = async (d) => {
        if (dias.length <= 1) return;
        const quedan = dias.filter(x => x !== d);
        const destino = quedan.find(x => x > d);
        const movidos = enDia(d);
        if (await onGuardar(quedan)) {
            setAviso(!movidos ? `Quitaste el Día ${d}.`
                : destino ? `Quitaste el Día ${d}: ${movidos} ${movidos === 1 ? 'lead pasó' : 'leads pasaron'} al Día ${destino}.`
                    : `Quitaste el Día ${d}: ${movidos} ${movidos === 1 ? 'lead terminó' : 'leads terminaron'} el embudo.`);
        }
    };

    const agregar = async (d) => {
        setAgregando(false);
        if (await onGuardar([...dias, d].sort((a, b) => a - b))) setAviso('');
    };

    const libres = Array.from({ length: DIA_MAXIMO }, (_, i) => i + 1).filter(d => !dias.includes(d));

    return (
        <div className="emb-dias">
            <small className="emb-rotulo">Días del embudo</small>
            {dias.map(d => (
                <span key={d} className="emb-dia">
                    Día {d}
                    {editable && (
                        <button type="button" className="emb-dia-x" aria-label={`Quitar Día ${d}`} title={`Quitar Día ${d}`}
                            disabled={dias.length <= 1} onClick={() => quitar(d)}>×</button>
                    )}
                </span>
            ))}
            {editable && libres.length > 0 && (
                <button type="button" className="emb-dia emb-dia--mas" onClick={() => setAgregando(v => !v)}>+ Agregar día</button>
            )}
            {!editable && <span className="emb-pista">Los define la dirección</span>}
            {agregando && (
                <div className="emb-libres">
                    <span className="emb-pista">¿Cuántos días después de la llamada?</span>
                    {libres.map(d => (
                        <button key={d} type="button" className="emb-dia emb-dia--opcion" onClick={() => agregar(d)}>Día {d}</button>
                    ))}
                </div>
            )}
            {aviso && <span className="emb-pista">{aviso}</span>}
        </div>
    );
};

export default DiasDelEmbudo;
