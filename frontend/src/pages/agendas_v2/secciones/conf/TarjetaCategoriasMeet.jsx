// Categorías de las notas de Meet (Operaciones › Integraciones): cada reunión recurrente («Educational Team»,
// «Scale Session») con la categoría que Work le puso sola; se cambia una vez y vale para todas sus notas,
// también las que vengan (app/services/notas_meet/categorias.py).

import { useEffect, useMemo, useState } from 'react';
import api from '../../../../services/api';
import { Input, Select } from '../../../../components/standard';
import { Mensajes, Tarjeta } from './cuenta';

const MAS_COMUN = (cats) => Object.entries(cats || {}).sort((a, b) => b[1] - a[1])[0]?.[0];

function FilaSerie({ s, nombres, ocupado, onElegir }) {
    const auto = nombres[MAS_COMUN(s.categorias)] || 'Otra';
    const opciones = [{ value: '', label: `Automática: ${auto}` },
        ...Object.entries(nombres).map(([value, label]) => ({ value, label }))];
    return (
        <div className="cu-fila">
            <p className="t-sm" style={{ flex: '2 1 240px' }}>
                <b>{s.serie || 'Sin nombre'}</b> · {s.notas} {s.notas === 1 ? 'nota' : 'notas'}
            </p>
            <Select value={s.regla || ''} options={opciones} disabled={ocupado || !s.serie}
                label={`Categoría de ${s.serie || 'las notas sin nombre'}`} onChange={(v) => onElegir(s.serie, v || null)} />
        </div>
    );
}

export default function TarjetaCategoriasMeet() {
    const [datos, setDatos] = useState(null);
    const [buscar, setBuscar] = useState('');
    const [msg, setMsg] = useState({});
    const [ocupado, setOcupado] = useState(false);

    const leer = () => api.get('/notas-meet/series').then(r => setDatos(r.data)).catch(() => setMsg({ error: 'No se pudieron leer las reuniones.' }));
    useEffect(() => { leer(); }, []);

    const elegir = async (serie, categoria) => {
        setOcupado(true); setMsg({});
        try {
            const r = await api.put('/notas-meet/series', { serie, categoria });
            await leer();
            setMsg({ aviso: `Listo: ${r.data.cambiadas} notas de «${serie}» cambiaron de categoría.` });
        } catch (e) {
            setMsg({ error: e.response?.data?.error || 'No se pudo guardar. Probá de nuevo.' });
        } finally { setOcupado(false); }
    };

    const visibles = useMemo(() => {
        const q = buscar.trim().toLowerCase();
        return (datos?.series || []).filter(s => !q || (s.serie || '').toLowerCase().includes(q));
    }, [datos, buscar]);

    return (
        <Tarjeta icono="capas" titulo="Categorías de las reuniones"
            texto="Cada reunión que se repite, con la categoría que Work le puso sola. Si alguna está mal, elegí otra: vale para todas sus notas y para las que vengan.">
            {!datos ? <p className="t-sm mut">Cargando…</p> : (
                <>
                    <Input type="search" placeholder="Buscar una reunión" value={buscar} onChange={e => setBuscar(e.target.value)} aria-label="Buscar una reunión" />
                    <div style={{ maxHeight: 460, overflowY: 'auto', display: 'grid', gap: 'var(--s2)' }}>
                        {visibles.map(s => <FilaSerie key={s.serie || '-'} s={s} nombres={datos.categorias} ocupado={ocupado} onElegir={elegir} />)}
                    </div>
                </>
            )}
            <Mensajes error={msg.error} aviso={msg.aviso} />
        </Tarjeta>
    );
}
