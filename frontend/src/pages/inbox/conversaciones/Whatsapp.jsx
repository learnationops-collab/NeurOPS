// Lo de WhatsApp dentro de una burbuja: el mensaje al que responde (o reacciona) el lead, arriba, y el sticker,
// la foto, el audio, el video o el documento que mandó. Tocar la cita lleva al mensaje citado.
import { useState } from 'react';
import { Reply } from 'lucide-react';

function irA(id) {
    const destino = document.querySelector(`.cv-mensajes [data-mensaje="${id}"]`);
    if (!destino) return;
    destino.scrollIntoView({ block: 'center', behavior: 'smooth' });
    destino.classList.remove('cv-burbuja--marcada');
    void destino.offsetWidth; // reinicia la animación si se toca dos veces
    destino.classList.add('cv-burbuja--marcada');
}

export function Cita({ cita }) {
    const accion = cita.reaccion ? 'Reaccionó a' : 'Respondió a';
    if (!cita.id) {
        return <span className="cv-cita-wa cv-cita-wa--perdida"><Reply size={11} aria-hidden="true" />{accion} un mensaje que no está acá</span>;
    }
    const de = cita.direccion === 'saliente' ? 'tu mensaje' : 'su mensaje';
    return (
        <button type="button" className="cv-cita-wa" onClick={() => irA(cita.id)} data-tip="Ir al mensaje">
            <span className="cv-cita-wa-de"><Reply size={11} aria-hidden="true" />{accion} {de}</span>
            <span className="cv-cita-wa-texto">{cita.texto || '…'}</span>
        </button>
    );
}

export function Medio({ medio }) {
    const [roto, setRoto] = useState(false);
    if (roto) return <p className="mut">WhatsApp ya no tiene este archivo (dura 30 días): miralo en el teléfono</p>;
    const caer = () => setRoto(true);
    if (medio.tipo === 'sticker') return <img className="cv-medio-sticker" src={medio.url} alt="Sticker" loading="lazy" onError={caer} />;
    if (medio.tipo === 'image') {
        return <a href={medio.url} target="_blank" rel="noreferrer"><img className="cv-medio-foto" src={medio.url} alt="Foto" loading="lazy" onError={caer} /></a>;
    }
    if (medio.tipo === 'audio') return <audio className="cv-medio-audio" controls preload="none" src={medio.url} onError={caer} />;
    if (medio.tipo === 'video') return <video className="cv-medio-foto" controls preload="metadata" src={medio.url} onError={caer} />;
    return <a className="cv-medio-doc" href={medio.url} target="_blank" rel="noreferrer">📄 {medio.nombre || 'Documento'}</a>;
}
