// El lead ya tiene una agenda futura abierta: como en Thalamus, no se suma otra sin decidir si se mueve
// esa o se crea una adicional (app/agendas_v2/manual.py, código 'ya_tiene').
import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '../../../components/standard';
import { formatAgendaDateTime } from '../../../utils/datetime';

export default function YaTieneAgenda({ aviso, onElegir, onCancelar, cargando = false }) {
    if (!aviso) return null;
    const cuando = aviso.inicio ? formatAgendaDateTime(aviso.inicio) : '';
    return (
        <div role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-3">
            <p className="flex gap-2 text-xs font-bold text-amber-500">
                <AlertCircle size={16} className="shrink-0" />
                <span>
                    Este lead ya tiene una agenda{cuando ? ` el ${cuando}` : ''}{aviso.closer ? ` con ${aviso.closer}` : ''}.
                    ¿La reprogramás a este horario{aviso.closer ? ` (sigue con ${aviso.closer})` : ''} o creás una llamada adicional?
                </span>
            </p>
            <div className="flex flex-wrap justify-end gap-2">
                <Button variant="ghost" onClick={onCancelar} disabled={cargando}>Cancelar</Button>
                <Button onClick={() => onElegir('adicional')} disabled={cargando}>Crear adicional</Button>
                <Button variant="primary" onClick={() => onElegir('reprogramar')} disabled={cargando}>Reprogramar esa</Button>
            </div>
        </div>
    );
}
