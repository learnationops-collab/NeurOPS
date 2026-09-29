import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronDown, ChevronRight, ClipboardCopy, MessageCircle, Pencil, X } from 'lucide-react';
import useMovimiento from './piezas/useMovimiento';
import usePopover from './piezas/usePopover';
import { soloDia } from './piezas/fecha';
import { opciones } from './estadoFicha';

/**
 * Cabecera de la ficha: una FRANJA, no un bloque de metadatos apilados.
 *
 * El nombre en h2 y al lado, separados por divisores de 1px, los cuatro datos que
 * se miran antes de hacer cualquier cosa. El de Closer no es texto: es el botón
 * para pasarle el lead a otro, que es la acción más frecuente sobre esta franja y
 * hoy vive escondida en el mazo.
 */
const Dato = ({ rotulo, valor, mono = false }) => (
    <>
        <div className="fi-dato">
            <small className="t-rotulo">{rotulo}</small>
            <span className={`t-sm trunc${mono ? ' num' : ''}`} style={{ fontWeight: 600 }}>
                {valor || '—'}
            </span>
        </div>
        <span className="fi-div" aria-hidden="true" />
    </>
);

const FichaHeader = ({ ficha, onAccion, onEditar = null, onCerrar, puedeEditar = true }) => {
    const { abierto, alternar, cerrar, caja } = usePopover();
    const mov = useMovimiento();
    const id = ficha?.identidad || {};
    const closerActual = id.closer?.nombre || null;
    const closers = opciones(ficha, 'closers');
    const puedeReasignar = ficha?.permisos?.reasignar !== false && puedeEditar && closers.length > 0;

    const llamada = id.llamada
        ? [id.llamada.fecha, id.llamada.hora].filter(Boolean).join(' · ')
        : null;
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
        <div className="fi-cab">
            <div className="fi-cab-datos">
                <h2 className="t-h2 trunc" style={{ flexShrink: 0 }}>{id.nombre || 'Lead sin nombre'}</h2>
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
                    <span className="fi-div" aria-hidden="true" />

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
            </div>

            <div style={{ display: 'flex', gap: 'var(--s2)', flexShrink: 0, marginLeft: 'auto' }}>
                <button type="button" className="ibtn" onClick={copiarResumen}
                    aria-label="Copiar los datos del lead"
                    title={copiado ? 'Copiado' : 'Copiar los datos del lead'}>
                    {copiado ? <Check size={16} style={{ color: 'var(--success)' }} /> : <ClipboardCopy size={16} />}
                </button>
                {onEditar && (
                    <button type="button" className="ibtn" aria-label="Editar lead"
                        onClick={() => onEditar(ficha)}>
                        <Pencil size={16} />
                    </button>
                )}
                <button type="button" className="ibtn" aria-label="Cerrar" onClick={onCerrar}>
                    <X size={17} />
                </button>
            </div>
        </div>
    );
};

export default FichaHeader;
