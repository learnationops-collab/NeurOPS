import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Loader2, RotateCcw, Trash2 } from 'lucide-react';

// El ancho ES la animación: el botón se convierte en su propio diálogo en vez de abrir uno
// encima. Curva del bloque original de bencho.dev, MIT.
const TRANSICION_ANCHO = 'width 340ms cubic-bezier(0.24, 1.34, 0.38, 1)';

// Ancho MÍNIMO de cada fase, ya no el definitivo: el de verdad lo mide el efecto de más abajo
// sobre el contenido dibujado, y estos números sólo marcan el piso.
//
// Antes eran el ancho final, y por eso la línea se veía cortada: en el registro de eventos de
// la ficha, «¿SEGURO? · No · Sí, borrar» mide 180px contra los 172px de la caja, así que
// `overflow:hidden` le comía 8px al botón rojo y el borde derecho quedaba tajeado al ras del
// texto. Con cuatro usos compactos y una etiqueta distinta en cada uno («¿Borrar?»,
// «¿Ocultar?», «Cuota 12»…) ningún número fijo le sirve a todos.
//
// Siguen siendo el piso y no desaparecen porque el botón grande los quiere: «Eliminar lead»
// ocupa unos 90px de contenido, y dejarlo encogerse hasta ahí lo convertiría en una pastillita
// apretada justo donde conviene que sea un botón con aire. El ancho es, entonces, el mayor
// entre lo que el contenido necesita y lo que el diseño ya pedía.
const ANCHO_MINIMO = { idle: 148, asking: 218, done: 206 };
const ANCHO_MINIMO_COMPACTO = { idle: 34, asking: 172, done: 158 };

// El borde entra en el ancho (`box-sizing: border-box` en todos lados: lo pone Tailwind y lo
// repite `.dc-shell`), así que lo medido sobre el contenido hay que devolvérselo a la caja.
const BORDE = 1;

// Dos paletas: `oscuro` para los modales del mazo del closer y del tablero, que son oscuros
// pase lo que pase con el tema del usuario, y `tema` para las pantallas que sí lo siguen.
//
// La paleta `oscuro` NO puede tomar `--bg-input` ni `--text-muted`: los dos existen también en
// `index.css` con valores de tema claro (`--bg-input:#ffffff`), así que un modal siempre oscuro
// se llenaría de blanco apenas el usuario pone el tema claro. Los tokens que sí usa
// (`--border-subtle`, `--border-control`, `--text-on-surface`) viven únicamente en `.dc-shell`,
// que es oscuro por definición, y afuera caen al respaldo.
//
// El respaldo de `texto` en la paleta `tema` arregla de paso algo que se veía francamente mal:
// dentro de `.dc-shell` la variable `--text-main` vale `#0a0e3d`, azul casi negro, así que el
// «Deshacer» del botón de LeadModal salía negro sobre fondo negro. `--text-on-surface` gana
// cuando existe y devuelve el blanco.
const PALETAS = {
    oscuro: { borde: 'var(--border-subtle, rgba(255,255,255,.14))', fondo: 'rgba(255,255,255,.04)',
              texto: 'var(--text-on-surface, #fff)', apagado: 'rgba(255,255,255,.60)',
              hecho: 'rgba(255,255,255,.65)', pregunta: '#F5A99C' },
    tema: { borde: 'var(--border-color)', fondo: 'transparent',
            texto: 'var(--text-on-surface, var(--text-main, #0f172a))', apagado: 'var(--text-muted)',
            hecho: 'var(--text-muted)', pregunta: 'var(--error, #E85C4A)' },
};

// El tono de peligro sale del token del tablero cuando existe y del hexadecimal sólo como
// respaldo, que es la regla de la casa: el tono se pasa por variable, nunca por color suelto.
// Hoy los dos valores coinciden; la gracia es que si el tablero mueve su `--error`, este botón
// se mueve con él en vez de quedar como el único rojo distinto de la pantalla.
const PELIGRO = 'var(--error, #E85C4A)';
const PELIGRO_SUAVE = '#F5A99C';
// Tinta sobre el rojo lleno: blanco sobre #E85C4A da 3.3:1 y la tinta oscura del tablero da
// 7.4:1 en el mismo botón. Afuera de `.dc-shell` no hay token y sigue siendo blanco, como antes.
const SOBRE_PELIGRO = 'var(--on-state, #fff)';

// Superficie y borde del estado «preguntando», con la misma fórmula que los `.chip` del
// tablero (13% y 34% del tono sobre transparente): así la línea se lee como una pieza más de
// la casa y no como un cartel pegado encima.
const TENUE = (pct) => `color-mix(in srgb, ${PELIGRO} ${pct}%, transparent)`;

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
 *
 * `alto`, `corner` y `tamIcono` existen para que el botón pueda ponerse el uniforme de la
 * pantalla donde cae. En una fila de la ficha convive con los `.ibtn` —círculos de 40px con el
 * ícono a 17px—, y un rectángulo de 34x38 con el ícono a 14px al lado de uno de esos se ve como
 * lo que era: una pieza traída de otra pantalla.
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
    alto = 38,
    tamIcono = 14,
    tema = 'oscuro',
}) => {
    const paleta = PALETAS[tema] || PALETAS.oscuro;
    const [fase, setFase] = useState('idle');
    const [corriendo, setCorriendo] = useState(false);
    const [resaltado, setResaltado] = useState(false);
    const temporizador = useRef(null);
    const pendiente = useRef(null);
    const yaDisparado = useRef(false);

    // En reposo y compacto la caja es un cuadrado de lado `alto`: con `corner` grande queda el
    // mismo círculo que el botón de al lado. En las otras fases manda lo que mida el contenido.
    const anchoFijo = compacto && fase === 'idle' ? alto : null;
    const contenido = useRef(null);
    // El piso de esta fase. En compacto y en reposo el piso ES el cuadrado, para que no se lo
    // lleve puesto el mínimo genérico de la tabla.
    const piso = anchoFijo
        || (compacto ? ANCHO_MINIMO_COMPACTO : ANCHO_MINIMO)[fase];
    const [ancho, setAncho] = useState(piso);

    // El ancho se mide, no se adivina. `contenido` se dibuja a `max-content` dentro de la caja
    // recortada, así que su ancho real es exactamente el que la caja necesita para no comerse
    // una letra. `useLayoutEffect` y no `useEffect` para que la corrección entre antes de
    // pintar: si no, se ve el salto del ancho viejo al bueno en cada cambio de fase.
    //
    // `scrollWidth` y no `getBoundingClientRect()` a propósito: el rectángulo viene con los
    // `transform` de los ancestros aplicados, y la ficha entra con `dcModalIn`, que la arranca
    // en `scale(.985)`. Midiendo el rectángulo durante esa animación la caja quedaba a un 98.5%
    // del ancho que necesita —o sea, otra vez con la última letra cortada, que es justo lo que
    // esto viene a arreglar. `scrollWidth` es ancho de maquetado y no lo toca ningún transform.
    useLayoutEffect(() => {
        const el = contenido.current;
        if (!el) return;
        setAncho(Math.max(el.scrollWidth + BORDE * 2, piso));
    }, [fase, corriendo, compacto, alto, tamIcono, corner, piso,
        label, question, cancelLabel, confirmLabel, doneLabel, undoLabel]);

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
        height: alto,
        width: ancho,
        transition: TRANSICION_ANCHO,
        borderRadius: corner,
        // Las tres por separado y no el atajo `border`: la fase de preguntar sólo pisa
        // `borderColor`, y React descarta la propiedad larga cuando conviven con el atajo
        // (avisa por consola y deja el borde gris en vez del rojo).
        borderWidth: BORDE,
        borderStyle: 'solid',
        borderColor: paleta.borde,
        background: paleta.fondo,
        overflow: 'hidden',
        flexShrink: 0,
    };

    // Lo que se mide. `max-content` es lo que hace que la medición sirva: si heredara el ancho
    // de la caja, mediría el ancho viejo y nunca convergería.
    const interior = {
        display: 'flex',
        alignItems: 'center',
        height: '100%',
        width: anchoFijo ? anchoFijo - BORDE * 2 : 'max-content',
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
        flexShrink: 0,
        gap: 6,
    };

    const rotulo = {
        flexShrink: 0,
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: '.06em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        paddingLeft: compacto ? 8 : 12,
        paddingRight: 2,
    };

    if (fase === 'idle') {
        // Compacto vive en una fila junto a otros íconos: ahí el rojo permanente convierte la
        // columna de borrar en lo más gritón de la tabla, cuando es la acción que menos hay que
        // invitar a apretar. Queda apagado como sus vecinos y recién se tiñe cuando lo apuntás.
        // Con etiqueta el color sí es la advertencia, porque no hay nada más que la dé.
        const tono = compacto ? (resaltado ? PELIGRO : paleta.apagado) : PELIGRO_SUAVE;
        return (
            <div style={base} title={title}>
                <div ref={contenido} style={interior}>
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => setFase('asking')}
                        onMouseEnter={() => setResaltado(true)}
                        onMouseLeave={() => setResaltado(false)}
                        onFocus={() => setResaltado(true)}
                        onBlur={() => setResaltado(false)}
                        style={{ ...textoBoton,
                                 ...(compacto ? { width: '100%', justifyContent: 'center', padding: 0 } : {}),
                                 opacity: disabled ? 0.4 : 1,
                                 color: tono,
                                 transition: 'color .18s ease',
                                 cursor: disabled ? 'not-allowed' : 'pointer' }}
                    >
                        <Trash2 size={tamIcono} />
                        {!compacto && label}
                    </button>
                </div>
            </div>
        );
    }

    if (fase === 'asking') {
        return (
            <div style={{ ...base, borderColor: TENUE(34), background: TENUE(13) }}>
                <div ref={contenido} style={interior}>
                    <small style={{ ...rotulo, color: paleta.pregunta }}>
                        {question}
                    </small>
                    <button type="button" onClick={() => setFase('idle')}
                            style={{ ...textoBoton, color: paleta.apagado }}>
                        {cancelLabel}
                    </button>
                    <button type="button" onClick={confirmar}
                            style={{ ...textoBoton, color: SOBRE_PELIGRO, background: PELIGRO,
                                     borderTopRightRadius: corner, borderBottomRightRadius: corner }}>
                        {confirmLabel}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ ...base }}>
            <div ref={contenido} style={interior}>
                {!corriendo && (
                    <small style={{ ...rotulo, color: paleta.hecho }}>{doneLabel}</small>
                )}
                {corriendo ? (
                    <span style={{ ...textoBoton, color: paleta.hecho,
                                   ...(compacto ? { padding: 0, width: alto - BORDE * 2,
                                                    justifyContent: 'center' } : {}) }}>
                        <Loader2 size={13} className="animate-spin" />
                    </span>
                ) : (
                    <button type="button" onClick={deshacer}
                            style={{ ...textoBoton, color: paleta.texto }}>
                        <RotateCcw size={13} />
                        {undoLabel}
                    </button>
                )}
            </div>
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
