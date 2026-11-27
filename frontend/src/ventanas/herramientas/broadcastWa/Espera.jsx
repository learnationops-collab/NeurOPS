// Cuánto espera un mensaje antes de salir, en segundos o minutos (guarda segundos, hasta 60 min). Lo usan la
// respuesta a un botón y el mensaje que sale al abrir su link.
import { useState } from 'react';
import { Input, Select } from '../../../components/standard';

const MAX_DEMORA = 3600;
const UNIDADES = [{ value: '1', label: 'segundos' }, { value: '60', label: 'minutos' }];

export const espera = (s) => (!s ? '' : s % 60 === 0 ? ` a los ${s / 60} min` : ` a los ${s} s`);

export default function Espera({ segundos, onChange, despues = 'después del toque' }) {
    const [unidad, setUnidad] = useState(segundos && segundos % 60 === 0 ? 60 : 1);
    const poner = (cifra, u) => onChange(Math.min(MAX_DEMORA, Math.max(0, Math.round((Number(cifra) || 0) * u))));
    return (
        <div className="bw-fila">
            <span className="bw-s">Sale</span>
            <Input variant="number" type="number" min="0" value={segundos ? segundos / unidad : 0} aria-label="Espera"
                onChange={(e) => poner(e.target.value, unidad)} />
            <Select size="sm" label="Unidad" value={String(unidad)} options={UNIDADES}
                onChange={(u) => { setUnidad(Number(u)); poner(segundos / unidad, Number(u)); }} />
            <span className="bw-s">{segundos ? despues : '0 = al instante'}</span>
        </div>
    );
}
