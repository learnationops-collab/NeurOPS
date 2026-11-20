// Etiquetar varias conversaciones de una vez (1426, ADR-W184): los mismos grupos que «+ Etiqueta». Se suman a las
// que ya tienen; en un grupo exclusivo, reemplaza la del grupo (lo resuelve el servidor).
import { useEffect, useState } from 'react';
import { Tag } from 'lucide-react';
import { Button, Chip, Modal, ModalHeader, toast } from '../../../components/standard';
import { inboxApi } from '../api';
import { recordado, recordar } from '../recuerdo';

export default function EtiquetarVarias({ conversaciones, onCerrar, onHecho }) {
    const [catalogo, setCatalogo] = useState(() => recordado('etiquetas'));
    const [elegidas, setElegidas] = useState([]);
    const [enviando, setEnviando] = useState(false);
    useEffect(() => { inboxApi.etiquetas().then((c) => setCatalogo(recordar('etiquetas', c))).catch(() => setCatalogo({ grupos: [], sueltas: [] })); }, []);

    const clave = (gid, n) => `${gid || ''}:${n}`;
    const yaTienen = (gid, n) => conversaciones.filter((c) => (c.etiquetas || []).some((e) => (e.group_id || null) === gid && e.name === n)).length;
    const alternar = (g, n) => {
        const k = clave(g?.id, n);
        setElegidas((xs) => {
            if (xs.some((x) => x.k === k)) return xs.filter((x) => x.k !== k);
            const sinElGrupo = g?.exclusive ? xs.filter((x) => x.group_id !== g.id) : xs;
            return [...sinElGrupo, { k, group_id: g?.id || null, name: n }];
        });
    };
    const poner = async () => {
        setEnviando(true);
        try {
            const r = await inboxApi.etiquetarVarias(conversaciones.map((c) => c.id), elegidas.map(({ group_id, name }) => ({ group_id, name })));
            toast(`Etiquetadas ${r.etiquetadas} conversaciones`);
            onHecho();
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudieron etiquetar', 'error');
            setEnviando(false);
        }
    };
    const grupos = catalogo ? [...catalogo.grupos, ...(catalogo.sueltas.length ? [{ id: null, name: 'Sin grupo', tags: catalogo.sueltas }] : [])] : [];
    const n = conversaciones.length;
    return (
        <Modal onClose={onCerrar} className="cv-masivo" labelledBy="cv-masivo-t">
            <ModalHeader icon={<Tag size={18} />} titleId="cv-masivo-t" title={`Etiquetar ${n} ${n === 1 ? 'conversación' : 'conversaciones'}`}
                subtitle="Se suman a las que ya tienen. En un grupo de una sola, reemplaza la que tenían." onClose={onCerrar} />
            <div className="cv-masivo-cuerpo">
                {!catalogo && <p className="t-cap mut">Cargando…</p>}
                {grupos.map((g) => (
                    <div key={g.id ?? 'sueltas'} className="cv-tag-grupo">
                        <span className="t-rotulo">{g.name}{g.exclusive && <span className="mut40"> · una sola</span>}</span>
                        {g.tags.map((t) => {
                            const ya = yaTienen(g.id ?? null, t.name);
                            const on = elegidas.some((x) => x.k === clave(g.id, t.name));
                            return (
                                <button key={t.name} type="button" className={`cv-masivo-op${on ? ' cv-masivo-op--on' : ''}`} aria-pressed={on} onClick={() => alternar(g.id ? g : null, t.name)}>
                                    <Chip subtle color={g.color}>{t.name}</Chip>
                                    {ya > 0 && <span className="t-cap mut">{ya === n ? 'ya la tienen todas' : `${ya} ya la ${ya === 1 ? 'tiene' : 'tienen'}`}</span>}
                                </button>
                            );
                        })}
                        {!g.tags.length && <span className="t-cap mut40">Todavía sin etiquetas</span>}
                    </div>
                ))}
            </div>
            <div className="barra">
                <Button onClick={onCerrar}>Cancelar</Button>
                <div className="barra-der">
                    <Button variant="primary" icon={<Tag />} disabled={!elegidas.length || enviando} onClick={poner}>
                        {elegidas.length ? `Poner a ${n}` : 'Elegí etiquetas'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
