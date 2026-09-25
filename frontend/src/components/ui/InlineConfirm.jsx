import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, RotateCcw, Trash2 } from 'lucide-react';

// Anchos de cada fase: el ancho ES la animación (el botón se convierte en su propio diálogo en
// vez de abrir uno encima). Valores y curva del bloque original de bencho.dev, MIT.
const ANCHOS = { idle: 148, asking: 218, done: 206 };
// En una fila de tabla no entra un botón de 148px: en reposo queda solo el ícono y se ensancha
// al preguntar, que es cuando de verdad necesita lugar.
const ANCHOS_COMPACTO = { idle: 34, asking: 172, done: 158 };
const TRANSICION_ANCHO = 'width 340ms cubic-bezier(0.24, 1.34, 0.38, 1)';

// Dos paletas: `oscuro` para los modales del mazo del closer, que son oscuros pase lo que pase
// con el tema, y `tema` para las pantallas que sí siguen el tema claro/oscuro del usuario.
const PALETAS = {
    oscuro: { borde: 'rgba(255,255,255,.14)', fondo: 'rgba(255,255,255,.04)',
              texto: '#fff', apagado: 'rgba(255,255,255,.55)', hecho: 'rgba(255,255,255,.65)' },
    tema: { borde: 'var(--border-color)', fondo: 'transparent',
            texto: 'var(--text-main)', apagado: 'var(--text-muted)', hecho: 'var(--text-muted)' },
};

const PELIGRO = '#E85C4A';
const PELIGRO_SUAVE = '#F5A99C';

/**
 * Botón destructivo que pregunta en su propio lugar.
 *
 * Tres razones para que sea así y no un `window.confirm` ni un modal encima:
 *   · El diálogo nativo lo dibuja el navegador, no la app: se puede bloquear, se ve distinto en
 *     cada uno, y cuando no aparece el botón simplemente "no hace nada".
 *   · Un modal encima mueve la atención a otro lado para contestar una pregunta que hiciste acá.
 *   · **El deshacer solo es posible si el borrado se difiere.** No hay endpoint para restaurar un
 *     lead borrado: la única forma honesta de ofrecer "deshacer" es no haber borrado todavía. Por
 *     eso `onConfirm` corre recién cuando se agota la ventana, y la barra que se consume es
 *     literalmente el tiempo que queda para arrepentirse.
 *
 * Si el componente se desmonta con un borrado pendiente (se cerró el modal durante la ventana),
 * el borrado se ejecuta igual: ya se le dijo al usuario que estaba hecho.
 */
const InlineConfirm = ({
    label = 'Eliminar',
    question = '¿Seguro?',
    cancelLabel = 'No',
    confirmLabel = 'Sí, borrar',
    doneLabel = 'Eliminado',
    undoLabel = 'Deshacer',
    onConfirm,
    undoMs = 5000,
    corner = 16,
    disabled = false,
    title,
    compacto = false,
    tema = 'oscuro',
}) => {
    const paleta = PALETAS[tema] || PALETAS.oscuro;
    const anchos = compacto ? ANCHOS_COMPACTO : ANCHOS;
    const [fase, setFase] = useState('idle');
    const [corriendo, setCorriendo] = useState(false);
    const temporizador = useRef(null);
    const pendiente = useRef(null);
    const yaDisparado = useRef(false);

    const limpiarTemporizador = () => {
        if (temporizador.current) {
            clearTimeout(temporizador.current);
            temporizador.current = null;
        }
    };

    const ejecutar = useCallback(async () => {
        if (yaDisparado.current) return;
        yaDisparado.current = true;
        const accion = pendiente.current;
        pendiente.current = null;
        limpiarTemporizador();
        if (!accion) return;
        setCorriendo(true);
        try {
            await accion();
        } finally {
            setCorriendo(false);
        }
    }, []);

    useEffect(() => () => {
        // Desmontado con un borrado pendiente: se cumple lo que ya se le prometió al usuario.
        if (pendiente.current && !yaDisparado.current) {
            const accion = pendiente.current;
            pendiente.current = null;
            limpiarTemporizador();
            Promise.resolve(accion()).catch(() => {});
        }
        limpiarTemporizador();
    }, []);

    const confirmar = () => {
        pendiente.current = onConfirm;
        yaDisparado.current = false;
        setFase('done');
        temporizador.current = setTimeout(ejecutar, undoMs);
    };

    const deshacer = () => {
        pendiente.current = null;
        limpiarTemporizador();
        setFase('idle');
    };

    const base = {
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        height: 38,
        width: anchos[fase],
        transition: TRANSICION_ANCHO,
        borderRadius: corner,
        border: `1px solid ${paleta.borde}`,
        background: paleta.fondo,
        overflow: 'hidden',
        flexShrink: 0,
    };

    const textoBoton = {
        background: 'transparent',
        border: 0,
        cursor: 'pointer',
        fontSize: 11,
        fontWeight: 800,
        whiteSpace: 'nowrap',
        padding: '0 10px',
        height: '100%',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
    };

    if (fase === 'idle') {
        return (
            <div style={base} title={title}>
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setFase('asking')}
                    style={{ ...textoBoton, width: '100%', justifyContent: 'center',
                             padding: compacto ? 0 : textoBoton.padding,
                             opacity: disabled ? 0.4 : 1,
                             color: PELIGRO_SUAVE,
                             cursor: disabled ? 'not-allowed' : 'pointer' }}
                >
                    <Trash2 size={14} />
                    {!compacto && label}
                </button>
            </div>
        );
    }

    if (fase === 'asking') {
        return (
            <div style={{ ...base, borderColor: 'rgba(232,92,74,.4)', background: 'rgba(232,92,74,.08)' }}>
                <small style={{ flex: 1, paddingLeft: compacto ? 8 : 12, fontSize: 10, fontWeight: 900,
                                letterSpacing: '.06em', textTransform: 'uppercase', color: PELIGRO_SUAVE }}>
                    {question}
                </small>
                <button type="button" onClick={() => setFase('idle')}
                        style={{ ...textoBoton, color: paleta.apagado }}>
                    {cancelLabel}
                </button>
                <button type="button" onClick={confirmar}
                        style={{ ...textoBoton, color: '#fff', background: PELIGRO,
                                 borderTopRightRadius: corner, borderBottomRightRadius: corner }}>
                    {confirmLabel}
                </button>
            </div>
        );
    }

    return (
        <div style={{ ...base }}>
            <small style={{ flex: 1, paddingLeft: compacto ? 8 : 12, fontSize: 10, fontWeight: 900,
                            letterSpacing: '.06em', textTransform: 'uppercase',
                            color: paleta.hecho }}>
                {corriendo ? '' : doneLabel}
            </small>
            {corriendo ? (
                <span style={{ ...textoBoton, color: paleta.hecho }}>
                    <Loader2 size={13} className="animate-spin" />
                </span>
            ) : (
                <button type="button" onClick={deshacer}
                        style={{ ...textoBoton, color: paleta.texto }}>
                    <RotateCcw size={13} />
                    {undoLabel}
                </button>
            )}
            {!corriendo && (
                // Cuánto queda para que el borrado deje de ser reversible.
                <span
                    aria-hidden="true"
                    style={{ position: 'absolute', left: 0, bottom: 0, height: 2,
                             background: PELIGRO,
                             animation: `inlineConfirmBurn ${undoMs}ms linear forwards` }}
                />
            )}
        </div>
    );
};

export default InlineConfirm;
