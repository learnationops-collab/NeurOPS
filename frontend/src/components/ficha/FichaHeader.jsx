import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CalendarClock, Check, ChevronDown, ChevronRight, ClipboardCopy, Contact, Copy, GraduationCap, Megaphone, Pencil, Phone, User, Video, X } from 'lucide-react';
import { IconButton } from '../standard';
import IdentidadesPersona from './piezas/IdentidadesPersona';
import useMovimiento from './piezas/useMovimiento';
import usePopover from './piezas/usePopover';
import FranjaBaja from './piezas/FranjaBaja';
import { instanteLegible, soloDia } from './piezas/fecha';
import { parseUtcIso } from '../../utils/datetime';
import { opciones } from './estadoFicha';
import { mensajeDeError } from './fichaApi';
import { CAMPOS_DATOS, cambiosDe, valoresIniciales } from './datosCliente';
import { esDeFathom } from './fathom';
import { gruposDeFuente } from './fuentes';
import Desplegable from './historial/Desplegable';

/**
 * Cabecera de la ficha: una FRANJA, no un bloque de metadatos apilados.
 *
 * El nombre en h2 y al lado, separados por divisores de 1px, los cinco datos que
 * se miran antes de hacer cualquier cosa (la fuente se sumó el 02/10/2026). El de Closer no es texto: es el botón
 * para pasarle el lead a otro, que es la acción más frecuente sobre esta franja y
 * hoy vive escondida en el mazo.
 *
 * El lápiz pone la franja en modo edición EN EL LUGAR: el título se vuelve el campo
 * del nombre y los datos, los campos de examen, teléfono, correo, instagram y fuente (esta
 * desde el 09/10/2026, un desplegable con el catálogo del historial).
 * Antes el lápiz existía solo en el mazo del closer —que lo pasaba por `onEditar` y
 * abría un modal aparte encima de este— y desde el dashboard comercial no había
 * ninguno. Ahora aparece donde sea que se abra la ficha, si `permisos.editar_datos`
 * lo deja.
 */
// Sin divisor propio: los datos viven en una rejilla y un separador suelto ocuparia una
// columna, que es lo que descuadraba las dos filas.
/** El rótulo de un dato, con su ícono (pedido del 23/10/2026: «un poquito más de íconos»). */
const Rotulo = ({ icono: Icono, children }) => (
    <small className="t-rotulo fi-rot">
        {Icono && <Icono size={11} strokeWidth={2.4} aria-hidden="true" />}
        {children}
    </small>
);

/** Cada dato entra de a uno (`orden`), en el orden en que se leen. */
const Dato = ({ rotulo, icono, valor, mono = false, orden = 0, children }) => {
    const mov = useMovimiento();
    return (
        <motion.div className="fi-dato" {...mov.campo(orden)}>
            <Rotulo icono={icono}>{rotulo}</Rotulo>
            {children ?? (
                <span className={`fi-val trunc${mono ? ' num' : ''}`}>{valor || '—'}</span>
            )}
        </motion.div>
    );
};

/** `+52 771 396 6588`: el número partido como se dicta. Sin un formato conocido, tal cual. */
const CODIGOS = ['591', '593', '595', '598', '502', '503', '504', '505', '506', '507',
    '52', '54', '55', '56', '57', '58', '51', '53', '34', '1'];
export const telefonoLegible = (tel) => {
    const t = String(tel || '').trim();
    const dig = t.replace(/\D/g, '');
    if (!t.startsWith('+') || dig.length < 8) return t;
    const cod = CODIGOS.find(c => dig.startsWith(c) && dig.length - c.length >= 7);
    if (!cod) return t;
    const resto = dig.slice(cod.length);
    const partes = resto.length === 10 ? [resto.slice(0, 3), resto.slice(3, 6), resto.slice(6)]
        : resto.length === 11 ? [resto.slice(0, 1), resto.slice(1, 4), resto.slice(4, 7), resto.slice(7)]
            : [resto.slice(0, resto.length - 4), resto.slice(-4)];
    return `+${cod} ${partes.join(' ')}`;
};

const inicialesDe = (nombre) => String(nombre || '').trim().split(/\s+/).slice(0, 2)
    .map(p => p[0]?.toUpperCase() || '').join('') || '?';

/**
 * La llamada leída de un vistazo (pedido del 23/10/2026): «Hoy · 17:35» en vez de
 * «23 oct 2026 · 17:35», y al lado del rótulo cuánto falta, que se mueve solo.
 * Tonos: ahora (±15 min) magenta con pulso, pronto (< 2 h) ámbar, ya pasó apagado.
 */
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const dos = (n) => String(n).padStart(2, '0');

const lecturaDeLlamada = (d, ahora) => {
    const dia = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const delta = Math.round((dia(d) - dia(ahora)) / 86400000);
    const cuando = delta === 0 ? 'Hoy' : delta === 1 ? 'Mañana' : delta === -1 ? 'Ayer'
        : `${DIAS[d.getDay()]} ${d.getDate()} ${MESES_CORTOS[d.getMonth()]}${d.getFullYear() !== ahora.getFullYear() ? ` ${d.getFullYear()}` : ''}`;
    const min = Math.round((d.getTime() - ahora.getTime()) / 60000);
    const abs = Math.abs(min);
    const largo = abs < 60 ? `${abs} min` : abs < 1440 ? `${Math.floor(abs / 60)} h${abs % 60 ? ` ${abs % 60} m` : ''}` : `${Math.round(abs / 1440)} d`;
    const tono = abs <= 15 ? 'ahora' : min < 0 ? 'paso' : min < 120 ? 'pronto' : 'luego';
    const falta = abs <= 15 ? (min >= 0 ? `en ${largo}` : 'en curso') : min > 0 ? `en ${largo}` : `hace ${largo}`;
    return { cuando, hora: `${dos(d.getHours())}:${dos(d.getMinutes())}`, falta, tono };
};

const DatoLlamada = ({ iso, respaldo }) => {
    const quieto = useReducedMotion();
    const [ahora, setAhora] = useState(() => new Date());
    useEffect(() => {
        const t = setInterval(() => setAhora(new Date()), 30000);
        return () => clearInterval(t);
    }, []);
    const d = iso ? parseUtcIso(String(iso)) : null;
    if (!d) return <Dato rotulo="Llamada" icono={CalendarClock} valor={respaldo} orden={1} />;
    const l = lecturaDeLlamada(d, ahora);
    const entra = (i) => (quieto ? {} : {
        initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 },
        transition: { delay: 0.06 * i, duration: 0.32, ease: [0.22, 1, 0.36, 1] },
    });
    return (
        <motion.div className="fi-dato fi-llamada" data-tono={l.tono} title={instanteLegible(iso)}
            {...(quieto ? {} : { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 },
                transition: { duration: 0.22, delay: 0.04 } })}>
            <Rotulo icono={CalendarClock}>Llamada</Rotulo>
            <span className="fi-llamada-val">
                <motion.b {...entra(1)}>{l.cuando}</motion.b>
                <motion.b className="num" {...entra(2)}>{l.hora}</motion.b>
                <motion.span className="fi-llamada-falta" {...entra(3)}>
                    <i aria-hidden="true" />
                    <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span key={l.falta}
                            initial={quieto ? false : { opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={quieto ? undefined : { opacity: 0, y: 6 }}
                            transition={{ duration: 0.25 }}>
                            {l.falta}
                        </motion.span>
                    </AnimatePresence>
                </motion.span>
            </span>
        </motion.div>
    );
};

/** El error del backend, pegado al campo que lo causó (`campo` en la respuesta). */
const ErrorDeCampo = ({ id, texto }) => (
    <span id={id} role="alert" className="fi-dato-error">{texto}</span>
);

const FichaHeader = ({ ficha, onAccion, onCerrar, puedeEditar = true }) => {
    const { abierto, alternar, cerrar, caja, pop } = usePopover();
    const mov = useMovimiento();
    const id = ficha?.identidad || {};
    const closerActual = id.closer?.nombre || null;
    const closers = opciones(ficha, 'closers');
    const puedeReasignar = ficha?.permisos?.reasignar !== false && puedeEditar && closers.length > 0;
    const puedeTriage = ficha?.permisos?.pasar_triage === true && puedeEditar;
    // Mismo criterio que el resto de los permisos de la ficha: solo un `false` explícito
    // esconde. El backend lo manda siempre, y la ruta lo vuelve a comprobar. Pero sin ficha no
    // hay permisos ni datos: la que no se pudo abrir no tiene nada que corregir, y el editor
    // abría con todos los campos vacíos.
    const puedeCorregir = !!ficha && puedeEditar && ficha.permisos?.editar_datos !== false;

    // Desde el instante (`iso`, UTC) y no desde `fecha`/`hora`, que el backend arma en UTC: la
    // cabecera decía otra hora que la fila de esa misma agenda en el historial.
    const llamada = id.llamada?.iso
        ? instanteLegible(id.llamada.iso)
        : id.llamada ? [id.llamada.fecha, id.llamada.hora].filter(Boolean).join(' · ') : null;
    // Ya vendido: el programa reemplaza al examen, que pasa a ser un dato de origen.
    const esCliente = !!id.programa;
    // Sin examen en la cita, el que eligió en el formulario («¿Qué examen buscás pasar?»):
    // la persona ya lo dijo ahí y la cabecera mostraba un guion (23/10/2026).
    const examen = id.examen || (ficha?.formulario?.respuestas || [])
        .find(r => /examen/i.test(`${r.clave} ${r.pregunta}`) && typeof r.respuesta === 'string')?.respuesta || null;
    // La etiqueta la arma el backend con el mismo vocabulario del historial; la clave cruda queda
    // de respaldo para una ficha vieja que todavía no la traiga.
    const fuente = id.fuente_label || id.fuente || null;

    // El link de Fathom de esta llamada, que el closer pega en Resultado (pedido del 02/10/2026).
    // Va con los botones de arriba a la derecha y no dentro de un dato: es una acción, como copiar.
    const grabacion = id.fathom_url || null;
    const rotuloGrabacion = esDeFathom(grabacion) ? 'Ver grabación en Fathom' : 'Ver grabación de la llamada';

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
    // Todos los datos de la persona (mails, teléfonos, instagrams, con su uso y los dados de baja).
    const [verIdentidades, setVerIdentidades] = useState(false);
    const identidades = id.identidades || [];

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

    const poner = (clave) => (valor) => {
        setBorrador(b => ({ ...b, [clave]: valor }));
        if (error?.campo === clave) setError(null);
    };
    const cambiar = (clave) => (e) => poner(clave)(e.target.value);

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
            examen ? `Examen: ${examen}` : null,
            llamada ? `Agendada: ${llamada}` : null,
            fuente ? `Fuente: ${fuente}` : null,
            id.setter?.nombre ? `Setter: ${id.setter.nombre}` : null,
            ficha?.confirmacion?.nota ? `Notas: ${ficha.confirmacion.nota}` : null,
            grabacion ? `Grabación: ${grabacion}` : null,
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

    const [telCopiado, setTelCopiado] = useState(false);
    const copiarTelefono = async () => {
        try {
            await navigator.clipboard.writeText(id.telefono || '');
            setTelCopiado(true);
            setTimeout(() => setTelCopiado(false), 1600);
        } catch {
            // Sin portapapeles el número sigue a la vista.
        }
    };

    const pasarA = (closer) => {
        cerrar();
        if (closer.nombre === closerActual) return;
        // El error lo muestra el cascarón en su aviso: acá solo hay que no dejar
        // un rechazo sin manejar.
        onAccion?.('reasignar_closer', { closer_id: closer.id, closer: closer.nombre })?.catch?.(() => {});
    };

    const pasarATriage = () => {
        cerrar();
        onAccion?.('pasar_a_triage')?.catch?.(() => {});
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
                            {grabacion && (
                                <a className="ibtn fi-cab-grabacion" href={grabacion}
                                    target="_blank" rel="noopener noreferrer"
                                    aria-label={rotuloGrabacion} title={rotuloGrabacion}>
                                    <Video size={16} />
                                </a>
                            )}
                            <button type="button" className="ibtn" onClick={copiarResumen}
                                aria-label="Copiar los datos del lead"
                                title={copiado ? 'Copiado' : 'Copiar los datos del lead'}>
                                {copiado ? <Check size={16} style={{ color: 'var(--success)' }} /> : <ClipboardCopy size={16} />}
                            </button>
                            {id.person_uuid && (
                                <IconButton icon={<Contact size={16} />} pressed={verIdentidades}
                                    label={verIdentidades ? 'Ocultar todos los datos de la persona' : 'Ver todos los datos de la persona'}
                                    title="Todos sus correos, teléfonos e instagrams, y agregar otro"
                                    aria-expanded={verIdentidades}
                                    onClick={() => setVerIdentidades(v => !v)} />
                            )}
                            {puedeCorregir && (
                                <button type="button" className="ibtn" ref={lapiz}
                                    aria-label="Editar los datos del lead"
                                    title="Corregir nombre, teléfono, correo, instagram, examen y fuente (el dato anterior queda dado de baja)"
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
                        const describe = fallo ? `fi-error-${c.clave}` : undefined;
                        return (
                            <motion.div key={c.clave} className="fi-dato" {...mov.campo(i + 1)}>
                                {/* `label` con `htmlFor` y no envolviendo el campo: envuelto, el
                                    error de abajo pasaba a ser parte del nombre del campo. */}
                                <label className="t-rotulo" htmlFor={`fi-campo-${c.clave}`}>{c.rotulo}</label>
                                {c.catalogo ? (
                                    // La guardada va siempre entre las opciones, aunque sea una
                                    // vieja fuera del catálogo («Venta histórica sin agenda»): sin
                                    // ella el desplegable arrancaría mostrando otra.
                                    <Desplegable id={`fi-campo-${c.clave}`} etiqueta={c.rotulo}
                                        valor={borrador[c.clave] ?? ''} alto={40} invalido={!!fallo}
                                        aria-describedby={describe} onCambiar={poner(c.clave)}>
                                        {!iniciales[c.clave] && <option value="">Sin {c.rotulo.toLowerCase()} · elegí una</option>}
                                        {gruposDeFuente(opciones(ficha, c.catalogo), iniciales[c.clave], id.fuente_label).map(g => (
                                            <optgroup key={g.titulo} label={g.titulo}>
                                                {(g.opciones || []).map(o => (
                                                    <option key={o.clave} value={o.clave}>{o.label}</option>
                                                ))}
                                            </optgroup>
                                        ))}
                                    </Desplegable>
                                ) : (
                                    <span className={`ln-field${fallo ? ' ln-field--invalid' : ''}`}>
                                        {c.prefijo && <span className="ln-unit" aria-hidden="true">{c.prefijo}</span>}
                                        <input id={`fi-campo-${c.clave}`} value={borrador[c.clave] ?? ''}
                                            type={c.tipo || 'text'} placeholder={c.placeholder}
                                            aria-invalid={!!fallo} aria-describedby={describe}
                                            onChange={cambiar(c.clave)} />
                                    </span>
                                )}
                                {fallo && <ErrorDeCampo id={`fi-error-${c.clave}`} texto={fallo} />}
                            </motion.div>
                        );
                    })}
                </div>
            ) : (
                <div className="fi-cab-datos">
                    <Dato rotulo={esCliente ? 'Programa' : 'Examen'} icono={GraduationCap} orden={0}
                        valor={esCliente ? id.programa : examen} />
                    {esCliente
                        ? <Dato rotulo="Ingresó" icono={CalendarClock} valor={soloDia(id.ingreso)} orden={1} />
                        : <DatoLlamada iso={id.llamada?.iso} respaldo={llamada} />}

                    <motion.div className="fi-dato" ref={caja} style={{ position: 'relative' }} {...mov.campo(2)}>
                        <Rotulo icono={User}>Closer</Rotulo>
                        {puedeReasignar ? (
                            <>
                                <button type="button" className="fi-closer-btn"
                                    aria-haspopup="listbox" aria-expanded={abierto}
                                    onClick={alternar}>
                                    {closerActual && <span className="fi-avatar" aria-hidden="true">{inicialesDe(closerActual)}</span>}
                                    <span>{closerActual || 'Sin asignar'}</span>
                                    <span className="t-cap" style={{ color: 'var(--brand-secondary)', fontWeight: 700 }}>
                                        Pasar
                                    </span>
                                    <span className="mut" style={{ display: 'flex' }}>
                                        {abierto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </span>
                                </button>
                                {abierto && (
                                    <motion.div ref={pop} className="fi-pop" role="listbox"
                                        aria-label="Pasar el lead a"
                                        {...mov.popover}
                                        style={{ ...(mov.popover.style || {}), minWidth: 240,
                                            padding: 'var(--s2)', gap: 2,
                                            left: 'calc(-1 * var(--s3))' }}>
                                        <small className="t-rotulo" style={{ padding: 'var(--s2) var(--s3)' }}>
                                            Pasar el lead a
                                        </small>
                                        {puedeTriage && (
                                            <button type="button" className="fi-opcion" role="option"
                                                aria-selected={false} onClick={pasarATriage}>
                                                <span>Triage</span>
                                                <span className="t-cap mut">La que esté libre</span>
                                            </button>
                                        )}
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
                            <span className="fi-val trunc fi-closer-fijo">
                                {closerActual && <span className="fi-avatar" aria-hidden="true">{inicialesDe(closerActual)}</span>}
                                {closerActual || '—'}
                            </span>
                        )}
                    </motion.div>

                    <Dato rotulo="Teléfono" icono={Phone} orden={3}>
                        {enlaceWhatsapp ? (
                            <span className="fi-tel">
                                <a className="fi-val trunc num fi-wa" href={enlaceWhatsapp}
                                    target="_blank" rel="noreferrer"
                                    title={`Escribirle por WhatsApp a ${id.nombre || 'el lead'}`}>
                                    <i className="fi-tel-punto" aria-hidden="true" />
                                    {telefonoLegible(id.telefono)}
                                </a>
                                <button type="button" className="fi-tel-copiar"
                                    aria-label="Copiar el teléfono" title={telCopiado ? 'Copiado' : 'Copiar el teléfono'}
                                    onClick={copiarTelefono}>
                                    <AnimatePresence mode="wait" initial={false}>
                                        <motion.span key={telCopiado ? 'ok' : 'copiar'} style={{ display: 'flex' }}
                                            initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                            exit={{ scale: 0.4, opacity: 0 }} transition={{ duration: 0.16 }}>
                                            {telCopiado ? <Check size={13} /> : <Copy size={13} />}
                                        </motion.span>
                                    </AnimatePresence>
                                </button>
                            </span>
                        ) : (
                            <span className="fi-val trunc num">{id.telefono || '—'}</span>
                        )}
                    </Dato>

                    <Dato rotulo="Fuente" icono={Megaphone} valor={fuente} orden={4} />
                </div>
            )}

            {!editando && verIdentidades && (
                <IdentidadesPersona identidades={identidades} puedeAgregar={puedeCorregir} onAccion={onAccion} />
            )}

            {/* Se fue del programa: se ve desde cualquier pestaña, no solo desde el cobro. */}
            {!editando && <FranjaBaja baja={id.baja} />}
        </div>
    );
};

export default FichaHeader;
