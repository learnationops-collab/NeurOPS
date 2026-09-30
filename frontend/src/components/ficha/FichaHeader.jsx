import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronDown, ChevronRight, ClipboardCopy, MessageCircle, Pencil, X } from 'lucide-react';
import useMovimiento from './piezas/useMovimiento';
import usePopover from './piezas/usePopover';
import FranjaBaja from './piezas/FranjaBaja';
import { instanteLegible, soloDia } from './piezas/fecha';
import { opciones } from './estadoFicha';
import { mensajeDeError } from './fichaApi';
import { CAMPOS_DATOS, cambiosDe, valoresIniciales } from './datosCliente';

/**
 * Cabecera de la ficha: una FRANJA, no un bloque de metadatos apilados.
 *
 * El nombre en h2 y al lado, separados por divisores de 1px, los cuatro datos que
 * se miran antes de hacer cualquier cosa. El de Closer no es texto: es el botón
 * para pasarle el lead a otro, que es la acción más frecuente sobre esta franja y
 * hoy vive escondida en el mazo.
 *
 * El lápiz pone la franja en modo edición EN EL LUGAR: el título se vuelve el campo
 * del nombre y los cuatro datos, los campos de examen, teléfono, correo e instagram.
 * Antes el lápiz existía solo en el mazo del closer —que lo pasaba por `onEditar` y
 * abría un modal aparte encima de este— y desde el dashboard comercial no había
 * ninguno. Ahora aparece donde sea que se abra la ficha, si `permisos.editar_datos`
 * lo deja.
 */
// Sin divisor propio: los datos viven en una rejilla y un separador suelto ocuparia una
// columna, que es lo que descuadraba las dos filas.
const Dato = ({ rotulo, valor, mono = false }) => (
    <div className="fi-dato">
        <small className="t-rotulo">{rotulo}</small>
        <span className={`t-sm trunc${mono ? ' num' : ''}`} style={{ fontWeight: 600 }}>
            {valor || '—'}
        </span>
    </div>
);

/** El error del backend, pegado al campo que lo causó (`campo` en la respuesta). */
const ErrorDeCampo = ({ id, texto }) => (
    <span id={id} role="alert" className="fi-dato-error">{texto}</span>
);

const FichaHeader = ({ ficha, onAccion, onCerrar, puedeEditar = true }) => {
    const { abierto, alternar, cerrar, caja } = usePopover();
    const mov = useMovimiento();
    const id = ficha?.identidad || {};
    const closerActual = id.closer?.nombre || null;
    const closers = opciones(ficha, 'closers');
    const puedeReasignar = ficha?.permisos?.reasignar !== false && puedeEditar && closers.length > 0;
    // Mismo criterio que el resto de los permisos de la ficha: solo un `false` explícito
    // esconde. El backend lo manda siempre, y la ruta lo vuelve a comprobar.
    const puedeCorregir = puedeEditar && ficha?.permisos?.editar_datos !== false;

    // Desde el instante (`iso`, UTC) y no desde `fecha`/`hora`, que el backend arma en UTC: la
    // cabecera decía otra hora que la fila de esa misma agenda en el historial.
    const llamada = id.llamada?.iso
        ? instanteLegible(id.llamada.iso)
        : id.llamada ? [id.llamada.fecha, id.llamada.hora].filter(Boolean).join(' · ') : null;
    // Ya vendido: el programa reemplaza al examen, que pasa a ser un dato de origen.
    const esCliente = !!id.programa;

    // El telefono del lead es, en la practica, su WhatsApp: el modal del mazo ya abria el chat
    // desde aca y esa era la forma real de contactarlo.
    const enlaceWhatsapp = (() => {
        const digitos = (id.telefono || '').replace(/\D/g, '');
        if (!digitos) return null;
        const saludo = `Hola ${id.nombre || ''}, te saluda tu asesor de NeurOPS. ¿Cómo estás?`
            .replace(/\s+/g, ' ').trim();
        return `https://wa.me/${digitos}?text=${encodeURIComponent(saludo)}`;
    })();

    const [copiado, setCopiado] = useState(false);

    // --- Edición en el lugar ---------------------------------------------------------
    const [editando, setEditando] = useState(false);
    const [borrador, setBorrador] = useState({});
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState(null);   // { campo, texto } del último rechazo
    const lapiz = useRef(null);
    const abiertoAntes = useRef(false);
    const iniciales = useMemo(() => valoresIniciales(ficha?.identidad), [ficha?.identidad]);

    // Al salir de la edición el foco vuelve al lápiz: sin esto, con teclado, Guardar o
    // Escape dejaban el foco en un campo que acaba de desaparecer (o sea, en el body).
    useEffect(() => {
        if (abiertoAntes.current && !editando) lapiz.current?.focus?.();
        abiertoAntes.current = editando;
    }, [editando]);

    const abrirEdicion = () => {
        cerrar();
        setBorrador(iniciales);
        setError(null);
        setEditando(true);
    };

    const cancelar = () => {
        if (guardando) return;
        setEditando(false);
        setError(null);
    };

    // Escape cancela la edición esté donde esté el foco. El cascarón escucha Escape en
    // `document` para cerrar la ficha, y un `onKeyDown` en la cabecera solo lo ve si el foco
    // está adentro: con el foco en el body —un clic en una zona que no toma foco, o Guardar
    // en Safari, que no enfoca el botón— el Escape cerraba la ficha con lo tipeado adentro.
    // En captura sobre `document` y cortando la propagación, como `usePopover`; mientras
    // guarda no cancela, pero tampoco deja cerrar.
    useEffect(() => {
        if (!editando) return undefined;
        const escape = (e) => {
            if (e.key !== 'Escape') return;
            if (e.target?.closest?.('[data-escape-propio="1"]')) return;
            e.stopPropagation();
            cancelar();
        };
        document.addEventListener('keydown', escape, true);
        return () => document.removeEventListener('keydown', escape, true);
        // `cancelar` cambia en cada render; lo que decide lo que hace es `guardando`.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editando, guardando]);

    const guardar = async () => {
        if (guardando) return;
        const cambios = cambiosDe(iniciales, borrador);
        // Nada que mandar: Guardar sin tocar nada es cerrar, no un pedido vacío al backend.
        if (!Object.keys(cambios).length) {
            setEditando(false);
            return;
        }
        setGuardando(true);
        setError(null);
        try {
            // El cascarón recarga la ficha y deja el aviso de éxito, como con cualquier acción.
            await onAccion?.('editar_datos', cambios);
            setEditando(false);
        } catch (err) {
            // Si el backend dice qué campo fue, el error va al lado de ese campo, que es donde
            // está mirando quien edita, y el cascarón no lo repite en su aviso. Sin campo, lo
            // muestra solo el aviso del cascarón.
            setError({ campo: err?.response?.data?.campo || null, texto: mensajeDeError(err) });
        } finally {
            setGuardando(false);
        }
    };

    // Enter guarda desde cualquier campo. El Escape no pasa por acá: lo escucha el efecto de
    // arriba en todo el documento.
    const teclas = (e) => {
        if (editando && e.key === 'Enter' && e.target?.tagName === 'INPUT') {
            e.preventDefault();
            guardar();
        }
    };

    const cambiar = (clave) => (e) => {
        const valor = e.target.value;
        setBorrador(b => ({ ...b, [clave]: valor }));
        if (error?.campo === clave) setError(null);
    };

    const errorDe = (clave) => (error?.campo === clave ? error.texto : null);

    // El "Descargar lead" del mazo: en vez de un archivo, un resumen listo para pegar en
    // WhatsApp o en una nota. Para un closer en movimiento sirve mas que un archivo que
    // despues hay que abrir en otro lado.
    const copiarResumen = async () => {
        const lineas = [
            `Lead: ${id.nombre || 'Sin nombre'}`,
            id.instagram ? `Instagram: @${String(id.instagram).replace('@', '')}` : null,
            id.telefono ? `Teléfono: ${id.telefono}` : null,
            id.email ? `Correo: ${id.email}` : null,
            id.examen ? `Examen: ${id.examen}` : null,
            llamada ? `Agendada: ${llamada}` : null,
            id.setter?.nombre ? `Setter: ${id.setter.nombre}` : null,
            ficha?.confirmacion?.nota ? `Notas: ${ficha.confirmacion.nota}` : null,
        ].filter(Boolean).join('\n');
        try {
            await navigator.clipboard.writeText(lineas);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
        } catch {
            // Sin portapapeles (permiso denegado, contexto inseguro) no hay nada que hacer
            // salvo no romper: el dato sigue visible en la cabecera.
        }
    };

    const pasarA = (closer) => {
        cerrar();
        if (closer.nombre === closerActual) return;
        // El error lo muestra el cascarón en su aviso: acá solo hay que no dejar
        // un rechazo sin manejar.
        onAccion?.('reasignar_closer', { closer_id: closer.id, closer: closer.nombre })?.catch?.(() => {});
    };

    return (
        <div className="fi-cab" onKeyDown={teclas}>
            <div className={`fi-cab-titulo${editando ? ' fi-cab-titulo--editando' : ''}`}>
                {editando ? (
                    <motion.span {...mov.campo(0)}
                        style={{ display: 'grid', gap: 4, flex: '1 1 260px', minWidth: 0 }}>
                        <span className={`ln-field fi-cab-nombre${errorDe('nombre') ? ' ln-field--invalid' : ''}`}>
                            <input value={borrador.nombre ?? ''} autoFocus
                                aria-label="Nombre del lead" placeholder="Nombre y apellido"
                                aria-invalid={!!errorDe('nombre')}
                                aria-describedby={errorDe('nombre') ? 'fi-error-nombre' : undefined}
                                onChange={cambiar('nombre')} />
                        </span>
                        {errorDe('nombre') && <ErrorDeCampo id="fi-error-nombre" texto={errorDe('nombre')} />}
                    </motion.span>
                ) : (
                    <h2 className="t-h2">{id.nombre || 'Lead sin nombre'}</h2>
                )}
                <div className="fi-cab-acciones">
                    {editando ? (
                        <>
                            <button type="button" className="btn btn--linea btn--sm"
                                disabled={guardando} onClick={cancelar}>
                                Cancelar
                            </button>
                            <button type="button" className="btn btn--cta btn--sm"
                                disabled={guardando} onClick={guardar}>
                                {guardando ? 'Guardando…' : 'Guardar'}
                            </button>
                        </>
                    ) : (
                        <>
                            <button type="button" className="ibtn" onClick={copiarResumen}
                                aria-label="Copiar los datos del lead"
                                title={copiado ? 'Copiado' : 'Copiar los datos del lead'}>
                                {copiado ? <Check size={16} style={{ color: 'var(--success)' }} /> : <ClipboardCopy size={16} />}
                            </button>
                            {puedeCorregir && (
                                <button type="button" className="ibtn" ref={lapiz}
                                    aria-label="Editar los datos del lead"
                                    title="Corregir nombre, teléfono, correo, instagram y examen"
                                    onClick={abrirEdicion}>
                                    <Pencil size={16} />
                                </button>
                            )}
                        </>
                    )}
                    <button type="button" className="ibtn" aria-label="Cerrar" onClick={onCerrar}>
                        <X size={17} />
                    </button>
                </div>
            </div>

            {editando ? (
                <div className="fi-cab-datos fi-cab-editor">
                    {CAMPOS_DATOS.map((c, i) => {
                        const fallo = errorDe(c.clave);
                        return (
                            <motion.div key={c.clave} className="fi-dato" {...mov.campo(i + 1)}>
                                {/* `label` con `htmlFor` y no envolviendo el campo: envuelto, el
                                    error de abajo pasaba a ser parte del nombre del campo. */}
                                <label className="t-rotulo" htmlFor={`fi-campo-${c.clave}`}>{c.rotulo}</label>
                                <span className={`ln-field${fallo ? ' ln-field--invalid' : ''}`}>
                                    {c.prefijo && <span className="ln-unit" aria-hidden="true">{c.prefijo}</span>}
                                    <input id={`fi-campo-${c.clave}`} value={borrador[c.clave] ?? ''}
                                        type={c.tipo || 'text'} placeholder={c.placeholder}
                                        aria-invalid={!!fallo}
                                        aria-describedby={fallo ? `fi-error-${c.clave}` : undefined}
                                        onChange={cambiar(c.clave)} />
                                </span>
                                {fallo && <ErrorDeCampo id={`fi-error-${c.clave}`} texto={fallo} />}
                            </motion.div>
                        );
                    })}
                </div>
            ) : (
                <div className="fi-cab-datos">
                    <Dato rotulo={esCliente ? 'Programa' : 'Examen'} valor={esCliente ? id.programa : id.examen} />
                    <Dato rotulo={esCliente ? 'Ingresó' : 'Llamada'} valor={esCliente ? soloDia(id.ingreso) : llamada} />

                    <div className="fi-dato" ref={caja} style={{ position: 'relative' }}>
                        <small className="t-rotulo">Closer</small>
                        {puedeReasignar ? (
                            <>
                                <button type="button" className="fi-closer-btn"
                                    aria-haspopup="listbox" aria-expanded={abierto}
                                    onClick={alternar}>
                                    <span>{closerActual || 'Sin asignar'}</span>
                                    <span className="t-cap" style={{ color: 'var(--brand-secondary)', fontWeight: 700 }}>
                                        Pasar
                                    </span>
                                    <span className="mut" style={{ display: 'flex' }}>
                                        {abierto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </span>
                                </button>
                                {abierto && (
                                    <motion.div className="fi-pop" role="listbox"
                                        aria-label="Pasar el lead a"
                                        {...mov.popover}
                                        style={{ ...(mov.popover.style || {}), minWidth: 240,
                                            padding: 'var(--s2)', gap: 2,
                                            left: 'calc(-1 * var(--s3))' }}>
                                        <small className="t-rotulo" style={{ padding: 'var(--s2) var(--s3)' }}>
                                            Pasar el lead a
                                        </small>
                                        {closers.map(c => {
                                            const on = c.nombre === closerActual;
                                            return (
                                                <button key={c.id ?? c.nombre} type="button" className="fi-opcion"
                                                    role="option" aria-selected={on}
                                                    onClick={() => pasarA(c)}>
                                                    <span>{c.nombre}</span>
                                                    <span className="t-cap mut">{on ? 'Actual' : c.pista}</span>
                                                </button>
                                            );
                                        })}
                                    </motion.div>
                                )}
                            </>
                        ) : (
                            <span className="t-sm trunc" style={{ fontWeight: 600 }}>{closerActual || '—'}</span>
                        )}
                    </div>

                    <div className="fi-dato">
                        <small className="t-rotulo">Teléfono</small>
                        {enlaceWhatsapp ? (
                            <a className="t-sm trunc num fi-wa" href={enlaceWhatsapp}
                                target="_blank" rel="noreferrer"
                                title={`Escribirle por WhatsApp a ${id.nombre || 'el lead'}`}>
                                <MessageCircle size={13} />
                                {id.telefono}
                            </a>
                        ) : (
                            <span className="t-sm trunc num" style={{ fontWeight: 600 }}>{id.telefono || '—'}</span>
                        )}
                    </div>
                </div>
            )}

            {/* Se fue del programa: se ve desde cualquier pestaña, no solo desde el cobro. */}
            {!editando && <FranjaBaja baja={id.baja} />}
        </div>
    );
};

export default FichaHeader;
