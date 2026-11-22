import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../../services/api';

/** Las notas de Meet sin agenda de un grupo (grupales, alumnos, otras), con búsqueda, serie y «Ver más»,
 *  y el detalle de la elegida (`GET /api/notas-meet/sin-agenda`, app/api/notas_meet.py). */
export default function useNotasSinAgenda() {
    const [grupo, setGrupoCrudo] = useState('grupales');
    const [q, setQ] = useState('');
    const [buscado, setBuscado] = useState('');
    const [serie, setSerieCruda] = useState('');
    const [lista, setLista] = useState(null);
    const [mas, setMas] = useState(false);
    const [error, setError] = useState(null);
    const [elegida, setElegida] = useState(null);
    const [guardada, setGuardada] = useState(null);
    const detalle = guardada && guardada.id === elegida ? guardada : null;
    const pedido = useRef(0);

    // La búsqueda espera a que se deje de tipear.
    useEffect(() => {
        const t = setTimeout(() => setBuscado(q.trim()), 300);
        return () => clearTimeout(t);
    }, [q]);

    const cargar = useCallback(async () => {
        const n = ++pedido.current;
        try {
            const { data } = await api.get('/notas-meet/sin-agenda', { params: { grupo, q: buscado || undefined, serie: serie || undefined } });
            if (n !== pedido.current) return;
            setLista(data);
            setError(null);
        } catch (e) {
            if (n === pedido.current) setError(e.response?.data?.error || 'No se pudieron cargar las reuniones.');
        }
    }, [grupo, buscado, serie]);

    useEffect(() => { cargar(); }, [cargar]);

    const verMas = async () => {
        setMas(true);
        try {
            const { data } = await api.get('/notas-meet/sin-agenda', {
                params: { grupo, q: buscado || undefined, serie: serie || undefined, offset: lista.notas.length },
            });
            setLista(l => ({ ...l, notas: [...l.notas, ...data.notas] }));
        } catch (e) {
            setError(e.response?.data?.error || 'No se pudieron cargar más.');
        } finally { setMas(false); }
    };

    useEffect(() => {
        if (!elegida) return undefined;
        let vivo = true;
        api.get(`/notas-meet/notas/${elegida}`).then(({ data }) => { if (vivo) setGuardada(data); })
            .catch(() => { if (vivo) setGuardada({ id: elegida, error: true }); });
        return () => { vivo = false; };
    }, [elegida]);

    /** Cambia la categoría de la nota (o de toda su serie) y vuelve a leer la lista: puede pasar a otro grupo. */
    const elegirCategoria = async (categoria, todaLaSerie) => {
        const { data } = await api.put(`/notas-meet/notas/${elegida}`, { categoria, serie: todaLaSerie });
        setGuardada(data.nota);
        await cargar();
        return data.cambiadas;
    };

    return {
        grupo, setGrupo: (g) => { setGrupoCrudo(g); setSerieCruda(''); setElegida(null); },
        q, setQ, serie, setSerie: (s) => { setSerieCruda(s); setElegida(null); },
        lista, error, mas, verMas, elegida, setElegida, detalle, elegirCategoria,
    };
}
