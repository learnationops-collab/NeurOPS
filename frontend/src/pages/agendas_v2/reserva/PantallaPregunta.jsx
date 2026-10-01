import React, { useEffect, useRef, useState } from 'react';
import { Check, CornerDownLeft } from 'lucide-react';

const LETRAS = 'ABCDEFGHIJ';

export const PREFIJOS = [
    { cod: '+54', pais: 'AR' }, { cod: '+591', pais: 'BO' }, { cod: '+55', pais: 'BR' }, { cod: '+56', pais: 'CL' },
    { cod: '+57', pais: 'CO' }, { cod: '+506', pais: 'CR' }, { cod: '+593', pais: 'EC' }, { cod: '+52', pais: 'MX' },
    { cod: '+595', pais: 'PY' }, { cod: '+51', pais: 'PE' }, { cod: '+598', pais: 'UY' }, { cod: '+58', pais: 'VE' },
    { cod: '+34', pais: 'ES' }, { cod: '+1', pais: 'US' },
];

// Una pantalla estilo Typeform: una sola pregunta, atajos de teclado (letra para elegir, Enter
// para seguir) y avance automático al elegir una opción.
export default function PantallaPregunta({ paso, valor, onCambio, onSiguiente, titulo }) {
    const [error, setError] = useState(null);
    const inputRef = useRef(null);
    const esOpciones = paso.tipo === 'opciones';

    useEffect(() => {
        setError(null);
        const t = setTimeout(() => inputRef.current?.focus(), 350);
        return () => clearTimeout(t);
    }, [paso.id]);

    const intentarSeguir = () => {
        const v = paso.tipo === 'telefono' ? (valor?.numero || '') : (valor || '');
        if (!paso.opcional) {
            const problema = paso.validar ? paso.validar(v) : (!String(v).trim() ? 'Completá este campo para seguir.' : null);
            if (problema) { setError(problema); return; }
        }
        onSiguiente();
    };

    const elegir = (opcion) => {
        onCambio(opcion);
        setTimeout(onSiguiente, 320);
    };

    useEffect(() => {
        const onKey = (e) => {
            const escribiendo = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); intentarSeguir(); return; }
            if (esOpciones && !escribiendo && !e.metaKey && !e.ctrlKey) {
                const i = LETRAS.indexOf(e.key.toUpperCase());
                if (i >= 0 && i < paso.opciones.length) elegir(paso.opciones[i]);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    return (
        <div className="ag2-screen">
            <h2 className="ag2-q">{titulo}</h2>
            {paso.ayuda && <p className="ag2-help">{paso.ayuda}</p>}

            {esOpciones && (
                <div className="ag2-opts" role="radiogroup" aria-label={paso.texto}>
                    {paso.opciones.map((op, i) => (
                        <button key={op} type="button" role="radio" aria-checked={valor === op}
                            className={`ag2-opt ${valor === op ? 'sel' : ''}`} onClick={() => elegir(op)}>
                            <span className="ag2-key">{LETRAS[i]}</span>
                            <span>{op}</span>
                            {valor === op && <Check size={18} className="ag2-check" />}
                        </button>
                    ))}
                </div>
            )}

            {paso.tipo === 'campo' && (
                <input ref={inputRef} className="ag2-field" type={paso.inputType || 'text'} value={valor || ''}
                    placeholder={paso.placeholder} autoComplete={paso.autoComplete}
                    onChange={(e) => { setError(null); onCambio(e.target.value); }} />
            )}

            {paso.tipo === 'texto' && (
                <textarea ref={inputRef} className="ag2-field" value={valor || ''} placeholder={paso.placeholder}
                    onChange={(e) => { setError(null); onCambio(e.target.value); }} />
            )}

            {paso.tipo === 'telefono' && (
                <div className="ag2-phone">
                    <select aria-label="Código de país" value={valor?.prefijo || '+54'}
                        onChange={(e) => onCambio({ ...valor, prefijo: e.target.value })}>
                        {PREFIJOS.map(p => <option key={p.pais} value={p.cod}>{p.pais} {p.cod}</option>)}
                    </select>
                    <input ref={inputRef} className="ag2-field" type="tel" inputMode="tel" autoComplete="tel-national"
                        placeholder="11 2345 6789" value={valor?.numero || ''}
                        onChange={(e) => { setError(null); onCambio({ prefijo: valor?.prefijo || '+54', numero: e.target.value.replace(/[^\d\s]/g, '') }); }} />
                </div>
            )}

            {error && <p className="ag2-error" role="alert">{error}</p>}

            {!esOpciones && (
                <div className="ag2-actions">
                    <button type="button" className="ag2-btn" onClick={intentarSeguir}>
                        {paso.opcional && !valor ? 'Saltear' : 'Seguir'} <Check size={16} />
                    </button>
                    <span className="ag2-hint">o apretá <kbd>Enter</kbd> <CornerDownLeft size={12} style={{ display: 'inline', verticalAlign: '-2px' }} /></span>
                </div>
            )}
        </div>
    );
}
