// Los botones del lienzo cuando se trabaja con una propuesta (ADR-W147). `modo="proponer"`: el setter cambió
// la estructura y la manda a aprobar con una nota. `modo="revisar"`: quien aprueba la publica o la rechaza
// diciendo por qué. Cada acción pide su texto en un modal.
import { useState } from 'react';
import { Check, Send, X } from 'lucide-react';
import { Button, Chip, Modal, ModalHeader, TextArea } from '../../../components/standard';

function Pedir({ titulo, subtitulo, rotulo, placeholder, accion, variante = 'primary', obligatorio = true, onCerrar, onHecho }) {
    const [texto, setTexto] = useState('');
    const [enviando, setEnviando] = useState(false);
    const hecho = async () => {
        setEnviando(true);
        const ok = await onHecho(texto.trim());
        setEnviando(false);
        if (ok) onCerrar();
    };
    return (
        <Modal onClose={onCerrar} labelledBy="ap-t">
            <ModalHeader titleId="ap-t" title={titulo} subtitle={subtitulo} onClose={onCerrar} />
            <TextArea value={texto} onChange={(e) => setTexto(e.target.value)} aria-label={rotulo} placeholder={placeholder} maxLength={1000} />
            <div className="barra">
                <Button onClick={onCerrar}>Cancelar</Button>
                <div className="barra-der">
                    <Button variant={variante} disabled={enviando || (obligatorio && !texto.trim())} onClick={hecho}>{accion}</Button>
                </div>
            </div>
        </Modal>
    );
}

export default function AccionesPropuesta({ modo, propuesta, sucio, ocupado, onProponer, onAprobar, onRechazar }) {
    const [abierto, setAbierto] = useState(null);
    const cerrar = () => setAbierto(null);
    if (modo === 'proponer') {
        return (
            <div className="barra-der">
                <Button variant="primary" icon={<Send />} disabled={ocupado || !sucio} onClick={() => setAbierto('proponer')}
                    data-tip={sucio ? 'Proponer cambios|Quedan pendientes hasta que los aprueben' : 'Sin cambios|Mové, agregá o conectá pasos para proponer'}>
                    Proponer cambios
                </Button>
                {abierto && (
                    <Pedir titulo="Proponer cambios" subtitulo="Los aprueba admin, operador o dirección comercial; hasta entonces corre lo publicado."
                        rotulo="Qué cambiaste" placeholder="Qué cambiaste y por qué" accion="Mandar a aprobar" onCerrar={cerrar} onHecho={onProponer} />
                )}
            </div>
        );
    }
    return (
        <div className="barra-der">
            <Chip subtle data-tip={`Propuesta de ${propuesta.autor || 'un setter'}|${propuesta.nota || ''}`}>Propuesta de {propuesta.autor || 'un setter'}</Chip>
            <Button icon={<X />} disabled={ocupado} onClick={() => setAbierto('rechazar')}>Rechazar</Button>
            <Button variant="primary" icon={<Check />} disabled={ocupado || propuesta.desactualizada} onClick={() => setAbierto('aprobar')}
                data-tip={propuesta.desactualizada ? 'Desactualizada|Se publicó otra versión después: rechazala y pedí que la rehagan' : 'Aprobar|Se publica como versión nueva'}>
                Aprobar y publicar
            </Button>
            {abierto === 'aprobar' && (
                <Pedir titulo="Aprobar y publicar" subtitulo={propuesta.nota} rotulo="Comentario" placeholder="Comentario para quien la propuso (opcional)"
                    accion="Aprobar y publicar" obligatorio={false} onCerrar={cerrar} onHecho={onAprobar} />
            )}
            {abierto === 'rechazar' && (
                <Pedir titulo="Rechazar la propuesta" subtitulo={propuesta.nota} rotulo="Por qué" placeholder="Por qué no, para que la rehaga"
                    accion="Rechazar" variante="dangerSolid" onCerrar={cerrar} onHecho={onRechazar} />
            )}
        </div>
    );
}
