// Los archivos de la próxima pregunta a Learnito (ADR-W252): imágenes (también pegadas con Ctrl+V o arrastradas), PDF
// o texto. Viajan en base64 a la Academia, que los lee con el modelo; no se guardan (para volver a analizar uno, se
// adjunta de nuevo). Hasta 3, de 5 MB cada uno.
import { useCallback, useState } from 'react';

export const TIPOS = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'text/csv'];
const MAX = 3;
const MAX_MB = 5;

const leer = (archivo) => new Promise((ok, mal) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => mal(r.error);
    r.readAsDataURL(archivo);
});

export function useAdjuntos() {
    const [adjuntos, setAdjuntos] = useState([]);
    const [aviso, setAviso] = useState(null);

    const sumar = useCallback(async (lista) => {
        setAviso(null);
        const nuevos = [];
        for (const a of Array.from(lista || [])) {
            const tipo = a.type || (a.name?.endsWith('.csv') ? 'text/csv' : '');
            if (!TIPOS.includes(tipo)) { setAviso(`«${a.name}» no se puede leer: imagen, PDF, texto o CSV.`); continue; }
            if (a.size > MAX_MB * 1024 * 1024) { setAviso(`«${a.name}» pasa de ${MAX_MB} MB.`); continue; }
            const url = await leer(a);
            nuevos.push({ id: `${Date.now()}-${Math.random()}`, nombre: a.name || `captura.${tipo.split('/')[1]}`, tipo, datos: url.split(',')[1], url });
        }
        setAdjuntos((antes) => {
            const todos = [...antes, ...nuevos];
            if (todos.length > MAX) setAviso(`Hasta ${MAX} archivos por pregunta.`);
            return todos.slice(0, MAX);
        });
    }, []);

    // Ctrl+V con una imagen copiada (una captura): se adjunta en vez de pegar texto.
    const alPegar = useCallback((e) => {
        const archivos = Array.from(e.clipboardData?.files || []);
        if (!archivos.length) return;
        e.preventDefault();
        sumar(archivos);
    }, [sumar]);

    const quitar = useCallback((id) => setAdjuntos((l) => l.filter((a) => a.id !== id)), []);
    const vaciar = useCallback(() => { setAdjuntos([]); setAviso(null); }, []);
    return { adjuntos, aviso, sumar, alPegar, quitar, vaciar, poner: setAdjuntos };
}
