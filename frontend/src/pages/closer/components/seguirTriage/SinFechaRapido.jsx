// «Reprogramó sin fecha» desde la tarjeta de Reportar › Atrasadas, sin abrir la ficha (ADR-W241).
// La llamada queda como Reagendado y espera en Seguir › Esperan fecha; no cuenta como cancelación.
import { useState } from 'react';
import { CalendarOff } from 'lucide-react';
import api from '../../../../services/api';
import { Button, Chip, Input, Modal, ModalHeader, toast } from '../../../../components/standard';

const CUANDO = [
    { valor: '', label: 'No dijo' },
    { valor: 'semana', label: 'La semana que viene' },
    { valor: 'fin_mes', label: 'Fin de mes' },
];

export default function SinFechaRapido({ agenda, onListo }) {
    const [abierto, setAbierto] = useState(false);
    const [cuando, setCuando] = useState('');
    const [nota, setNota] = useState('');
    const [guardando, setGuardando] = useState(false);

    const guardar = async () => {
        setGuardando(true);
        try {
            await api.post(`/closer/followups/triage/${agenda.id}`, { accion: 'reprogramo_sin_fecha', cuando: cuando || null, nota });
            toast(`${agenda.lead_name}: espera fecha en Seguir`);
            setAbierto(false);
            onListo?.();
        } catch (e) {
            toast(e?.response?.data?.message || 'No se pudo guardar', 'error');
        } finally {
            setGuardando(false);
        }
    };

    return (
        <>
            <Button size="sm" variant="ghost" icon={<CalendarOff size={14} />}
                onClick={(e) => { e.stopPropagation(); setAbierto(true); }}>Reprogramó sin fecha</Button>
            {abierto && (
                <Modal onClose={() => setAbierto(false)} labelledBy="sfr-titulo">
                    <div onClick={(e) => e.stopPropagation()} style={{ display: 'grid', gap: 14 }}>
                        <ModalHeader titleId="sfr-titulo" icon={<CalendarOff size={18} />} title="Reprogramó sin fecha"
                            subtitle={`${agenda.lead_name}: sale de Atrasadas y espera en Seguir`} onClose={() => setAbierto(false)} />
                        <div style={{ display: 'grid', gap: 8, padding: '0 4px' }}>
                            <small className="ln-field-label">¿Dijo cuándo te escribe?</small>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {CUANDO.map((o) => (
                                    <Chip key={o.valor} as="button" aria-pressed={cuando === o.valor} subtle={cuando !== o.valor}
                                        onClick={() => setCuando(o.valor)}>{o.label}</Chip>
                                ))}
                            </div>
                            <Input placeholder="Qué dijo (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <Button variant="ghost" onClick={() => setAbierto(false)}>Cancelar</Button>
                            <Button variant="primary" disabled={guardando} onClick={guardar}>Guardar</Button>
                        </div>
                    </div>
                </Modal>
            )}
        </>
    );
}
