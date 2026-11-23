// Marca de la sección «Reporte» en el dock: ✓ si hoy está completo, punto ámbar si hoy o ayer
// quedan incompletos. Sale de GET /api/reporte/dia (`estado`, `faltan`, `semana`); la sección la
// actualiza en vivo con `actualizar(diaJson)` (prop `onDia` de ReporteSeccion).
import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../services/api';

export default function useMarcaReporte(activo = true) {
    const [dia, setDia] = useState(null);
    useEffect(() => {
        if (!activo) return undefined;
        let vivo = true;
        api.get('/reporte/dia', { skipBugReport: true })
            .then((res) => { if (vivo) setDia(res.data || null); })
            .catch(() => { /* sin marca: no se inventa un estado */ });
        return () => { vivo = false; };
    }, [activo]);

    // Un día de hoy pisa todo; uno pasado solo trae la semana al día (su estado puede haber cambiado).
    const actualizar = useCallback((d) => {
        if (!d) return;
        if (d.fecha === d.hoy) setDia(d);
        else if (d.semana) setDia((prev) => (prev ? { ...prev, semana: d.semana } : prev));
    }, []);

    const marcas = useMemo(() => {
        if (!dia) return [];
        const previos = (dia.semana || []).filter((s) => s.fecha < dia.hoy).sort((a, b) => b.fecha.localeCompare(a.fecha));
        const ayerInc = previos[0]?.estado === 'incompleto';
        const hoyListo = ['completo', 'no_laborable'].includes(dia.estado);
        const hoyFalta = !hoyListo && (dia.faltan || []).length > 0;
        return [
            (ayerInc || hoyFalta) && { tipo: 'aviso', texto: '', titulo: ayerInc ? 'ayer quedó incompleto' : `hoy falta ${dia.faltan.join(', ')}` },
            hoyListo && { texto: '✓', titulo: 'el reporte de hoy está completo' },
        ].filter(Boolean);
    }, [dia]);

    return { marcas, actualizar };
}
