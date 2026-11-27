// La marca de seguimiento a mano (ADR-W255). Antes de mandar, la casilla «Seguimiento» al lado de Enviar: viene
// tildada sola si lo último de la conversación es del equipo y el lead no contesta hace más de SUGERIR_H. Ya
// mandado, en el pie del mensaje: «Seguimiento N» (tocarlo lo desmarca) o «Marcar como seguimiento».
// Lo marcado cuenta en el filtro y en el reporte del setter (`seguimientos_hechos.py`).
import { useState } from 'react';
import { Check, ChevronDown, PlayCircle, Repeat } from 'lucide-react';
import { toast } from '../../../components/standard';
import useDesplegable from './useDesplegable';
import { abrirTourSeguimientos } from '../tour/TourSeguimientos';
import { inboxApi } from '../api';
import './marcaSeguimiento.css';

const SUGERIR_H = 1;

// {sugerida, n}: si la casilla viene tildada y qué número de seguimiento sería (desde la última respuesta del lead).
export function sugerencia(mensajes, ahora = Date.now()) {
    const propios = (mensajes || []).filter((m) => m.origen !== 'motor');
    const ultimo = propios[propios.length - 1];
    let n = 1;
    for (let i = propios.length - 1; i >= 0 && propios[i].direccion !== 'entrante'; i -= 1) if (propios[i].seguimiento) n += 1;
    const sugerida = Boolean(ultimo && ultimo.direccion === 'saliente' && ahora - new Date(ultimo.en) >= SUGERIR_H * 3600000);
    return { sugerida, n };
}

// `marca`: null sin tocar (vale lo sugerido), o lo que eligió. `valor()`: lo que va al servidor (sin tocar y sin
// sugerir, nada: decide la regla de las 12 h).
export function useMarca(contactoId) {
    const [marca, setMarca] = useState({ contacto: contactoId, v: null });
    const actual = marca.contacto === contactoId ? marca.v : null;
    return {
        actual,
        cambiar: (v) => setMarca({ contacto: contactoId, v }),
        reiniciar: () => setMarca({ contacto: contactoId, v: null }),
    };
}

// La casilla, más chica y con su desplegable (Mario, 27/11/2026): la flechita abre «Marcar como seguimiento» y «Cómo
// hacer un seguimiento» (el recorrido), que antes era un «?» suelto al lado.
export function CasillaSeguimiento({ mensajes, marca }) {
    const d = useDesplegable();
    const { sugerida, n } = sugerencia(mensajes);
    const on = marca.actual ?? sugerida;
    const tip = on
        ? `Seguimiento ${n}|${sugerida ? 'El lead no contestó tu último mensaje. ' : ''}Destildala si no es un seguimiento`
        : 'Seguimiento|Tildala si este mensaje es un seguimiento: cuenta en tu reporte';
    const elegir = (accion) => { d.setAbierto(false); accion(); };
    return (
        <span className={`cv-seg-grupo cv-tarjeta-pop-caja${on ? ' cv-seg-grupo--on' : ''}`} ref={d.caja}>
            <button type="button" role="checkbox" aria-checked={on} className={`cv-seg-casilla${on ? ' cv-seg-casilla--on' : ''}`}
                data-tip={tip} onClick={() => marca.cambiar(!on)}>
                <span className="cv-seg-casilla-box" aria-hidden="true">{on && <Check size={9} strokeWidth={3} />}</span>
                {on ? `Seguimiento ${n}` : 'Seguimiento'}
            </button>
            <button type="button" className="cv-seg-mas" aria-label="Opciones de seguimiento" aria-expanded={d.abierto} onClick={() => d.setAbierto((a) => !a)}>
                <ChevronDown size={12} aria-hidden="true" />
            </button>
            {d.abierto && (
                <div className="cv-seg-pop" role="menu" aria-label="Seguimiento">
                    <button type="button" role="menuitemcheckbox" aria-checked={on} className="cv-seg-op" onClick={() => elegir(() => marca.cambiar(!on))}>
                        <span className="cv-seg-op-ico"><Repeat size={14} aria-hidden="true" /></span>
                        <span><b>{on ? `Es el seguimiento ${n}` : 'Marcar como seguimiento'}</b><small>{on ? 'Tocá para que no cuente' : 'Cuenta en tu reporte y en el filtro'}</small></span>
                        {on && <Check size={14} className="cv-seg-op-ok" aria-hidden="true" />}
                    </button>
                    <button type="button" role="menuitem" className="cv-seg-op cv-seg-op--tour" onClick={() => elegir(abrirTourSeguimientos)}>
                        <span className="cv-seg-op-ico"><PlayCircle size={14} aria-hidden="true" /></span>
                        <span><b>Cómo hacer un seguimiento</b><small>Recorrido de 1 minuto</small></span>
                    </button>
                </div>
            )}
        </span>
    );
}

// Lo que se manda con el mensaje: true/false si se tocó o vino sugerida; undefined si no (regla de las 12 h).
export const valorDeMarca = (mensajes, marca) => marca.actual ?? (sugerencia(mensajes).sugerida ? true : undefined);

export function MarcaEnMensaje({ m, onCambio }) {
    const [enviando, setEnviando] = useState(false);
    if (m.direccion !== 'saliente' || m.origen !== 'otro' || !m.id) return null;
    const marcar = async (marca) => {
        setEnviando(true);
        try {
            await inboxApi.marcarSeguimiento(m.id, marca);
            await onCambio?.();
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudo marcar', 'error');
        } finally {
            setEnviando(false);
        }
    };
    if (m.seguimiento) {
        return (
            <button type="button" className="cv-seg-tag" disabled={enviando} data-tip={`Seguimiento ${m.seguimiento}|Tocalo si no fue un seguimiento`}
                onClick={() => marcar(false)}>
                <Repeat size={11} aria-hidden="true" />Seguimiento {m.seguimiento}
            </button>
        );
    }
    return (
        <button type="button" className="cv-seg-marcar" disabled={enviando} aria-label="Marcar como seguimiento"
            data-tip="Marcar como seguimiento|Cuenta en tu reporte y en el filtro" onClick={() => marcar(true)}>
            <Repeat size={11} aria-hidden="true" />
        </button>
    );
}
