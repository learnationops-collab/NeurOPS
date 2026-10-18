import { ExternalLink, Instagram } from 'lucide-react';

/**
 * El Instagram de una tarjeta de «Mis agendas» (agenda o cliente con ventas): es la llave de la
 * atribución, así que si ya está se muestra como link con «Cambiar», y si falta el campo aparece
 * abierto con el aviso. El estado (si se edita, qué se escribió) es de la tarjeta.
 */
const CampoInstagram = ({ id, nombre, guardado, editando, valor, deshabilitado, inputRef,
    onCambiar, onEditar, onEnter }) => (
    <div className="ma-ig">
        {editando ? (
            <>
                <label className="sr" htmlFor={id}>Instagram de {nombre}</label>
                <span className={`ma-ig-campo${!valor.trim() ? ' ma-ig-campo--falta' : ''}`}>
                    <Instagram size={14} aria-hidden="true" />
                    <input id={id} ref={inputRef} type="text" value={valor} placeholder="usuario de Instagram"
                        autoComplete="off" spellCheck={false} disabled={deshabilitado}
                        onChange={(e) => onCambiar(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter(); } }} />
                </span>
                {!guardado && (
                    <span className="ma-ig-nota" title="Sin Instagram, Marketing no encuentra su conversación.">
                        Falta el Instagram
                    </span>
                )}
            </>
        ) : (
            <>
                <a className="ma-ig-link" href={`https://instagram.com/${guardado}`} target="_blank" rel="noopener noreferrer"
                    title="Abrir su perfil">
                    <Instagram size={14} aria-hidden="true" />@{guardado}<ExternalLink size={12} aria-hidden="true" />
                </a>
                <button type="button" className="ma-ig-cambiar" disabled={deshabilitado} onClick={onEditar}>
                    Cambiar
                </button>
            </>
        )}
    </div>
);

export default CampoInstagram;
