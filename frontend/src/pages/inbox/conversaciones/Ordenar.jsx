// Ordenar la bandeja (ADR-W184): por espera, cierre de la ventana, etapa, último mensaje, sin leer o tarea. Va al
// lado del filtro y se guarda con él.
import { useEffect, useRef, useState } from 'react';
import { ArrowUpDown, Check } from 'lucide-react';
import useEnPantalla from '../../../components/ui/useEnPantalla';
import { IconButton } from '../../../components/standard';
import { ORDENES, ordenDe } from './colas';

export default function Ordenar({ filtro, onCambiar }) {
    const [abierto, setAbierto] = useState(false);
    const caja = useRef(null);
    const pop = useEnPantalla();
    useEffect(() => {
        if (!abierto) return undefined;
        const fuera = (e) => { if (caja.current && !caja.current.contains(e.target)) setAbierto(false); };
        document.addEventListener('mousedown', fuera);
        return () => document.removeEventListener('mousedown', fuera);
    }, [abierto]);
    const actual = ordenDe(filtro);
    return (
        <div className="cv-macro" ref={caja}>
            <IconButton label="Ordenar" data-tip={`Ordenar|${actual.label}: ${actual.detalle}`} pressed={abierto}
                icon={<ArrowUpDown size={16} />} onClick={() => setAbierto((a) => !a)} />
            {abierto && (
                <div className="cv-orden-pop" ref={pop} role="menu" aria-label="Ordenar por">
                    <span className="t-rotulo">Ordenar por</span>
                    {ORDENES.map((o) => (
                        <button key={o.value} type="button" role="menuitemradio" aria-checked={o === actual} className="cv-orden-op"
                            onClick={() => { onCambiar({ ...filtro, orden: o.value }); setAbierto(false); }}>
                            <span>{o.label}</span><span className="t-cap mut40">{o.detalle}</span>
                            {o === actual && <Check size={14} aria-hidden="true" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
