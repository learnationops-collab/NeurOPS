import { Copy, List, Trash2 } from 'lucide-react';
import { IconButton, Input, Select } from '../../../../components/standard';

/**
 * Un grupo de WhatsApp del taller: su conjunto de anuncios, su nombre y su enlace. El conjunto se elige
 * de los que Meta ya trajo o, si todavía no llegó, se pega su id (`fila.manual`). Dibuja las cuatro celdas
 * de la fila; el `<li>` que las acomoda lo pone la lista.
 */
const FilaGrupo = ({ fila, numero, opciones, enlace, onCambio, onConjunto, onCopiar, onQuitar }) => {
    const campo = (clave) => ({
        value: fila[clave],
        onChange: (e) => onCambio({ [clave]: e.target.value }),
    });
    const cual = fila.nombre.trim() || `grupo ${numero}`;

    return (
        <>
            <div className="wp-grupo-conj">
                {fila.manual ? (
                    <>
                        <Input inputMode="numeric" placeholder="Id del conjunto" autoFocus
                            aria-label={`Id del conjunto de anuncios de ${cual}`} {...campo('conjunto_id')} />
                        <IconButton size="xs" icon={<List aria-hidden="true" />} label="Elegir el conjunto de la lista"
                            data-tip="Elegir de la lista" onClick={() => onConjunto('')} />
                    </>
                ) : (
                    <Select value={fila.conjunto_id} options={opciones} onChange={onConjunto}
                        label={`Conjunto de anuncios de ${cual}`} />
                )}
            </div>
            <Input className="wp-grupo-nom" maxLength={80} placeholder="CG1 21/11"
                aria-label={`Nombre del grupo ${numero}`} {...campo('nombre')} />
            <Input className="wp-grupo-url" type="url" placeholder="https://chat.whatsapp.com/..."
                aria-label={`Enlace de ${cual}`} {...campo('whatsapp_url')} />
            <div className="wp-grupo-btns">
                <IconButton size="sm" icon={<Copy aria-hidden="true" />} label={`Copiar el enlace de prueba de ${cual}`}
                    data-tip={enlace ? 'Copia el link de la landing que lleva a este grupo' : 'Elegí el conjunto para tener su link de prueba'}
                    disabled={!enlace} onClick={onCopiar} />
                <IconButton size="sm" danger icon={<Trash2 aria-hidden="true" />} label={`Quitar ${cual}`} onClick={onQuitar} />
            </div>
        </>
    );
};

export default FilaGrupo;
