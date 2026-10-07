// La foto de la cuenta: la ve el lead en «Tu consultor» y el equipo en Team. Se recorta cuadrada y se
// achica en el navegador (256 px, JPG) antes de subirla: el servidor solo acepta fotos chicas.

import { useEffect, useRef, useState } from 'react';
import api from '../../../../services/api';
import { Icono } from '../../ui/base';

const LADO = 256, MAX = 140000;
const iniciales = (nombre) => (nombre || '?').split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

/** Un archivo de imagen → data URL JPG cuadrada de LADO px, por debajo de MAX caracteres. */
export function achicarFoto(file) {
    return new Promise((resolver, rechazar) => {
        const url = URL.createObjectURL(file), img = new Image();
        img.onload = () => {
            const s = Math.min(img.width, img.height), c = document.createElement('canvas');
            c.width = LADO; c.height = LADO;
            c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, LADO, LADO);
            URL.revokeObjectURL(url);
            let q = 0.86, out = c.toDataURL('image/jpeg', q);
            while (out.length > MAX && q > 0.4) { q -= 0.12; out = c.toDataURL('image/jpeg', q); }
            if (out.length > MAX) rechazar(new Error('grande')); else resolver(out);
        };
        img.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error('imagen')); };
        img.src = url;
    });
}

export default function FotoCuenta({ nombre }) {
    const [foto, setFoto] = useState(null); // null: cargando
    const [ocupado, setOcupado] = useState(false);
    const [error, setError] = useState(null);
    const input = useRef(null);
    useEffect(() => { api.get('/auth/me/foto').then(r => setFoto(r.data?.foto || '')).catch(() => setFoto('')); }, []);

    const guardar = async (valor) => {
        setOcupado(true); setError(null);
        try { const r = await api.put('/auth/me/foto', { foto: valor }); setFoto(r.data?.foto || ''); }
        catch (e) { setError(e?.response?.data?.message || 'No se pudo guardar la foto.'); }
        finally { setOcupado(false); }
    };
    const elegir = async (e) => {
        const f = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!f) return;
        if (!/^image\//.test(f.type)) { setError('Elegí una imagen (JPG, PNG o WEBP).'); return; }
        try { await guardar(await achicarFoto(f)); } catch { setError('No pudimos leer esa imagen. Probá con otra.'); }
    };

    return (
        <div className="cu-foto">
            <span className="avatar-g" style={foto ? { backgroundImage: `url(${foto})`, backgroundSize: 'cover', backgroundPosition: 'center', color: 'transparent' } : undefined}
                role="img" aria-label={foto ? 'Tu foto' : 'Sin foto'}>
                {!foto && iniciales(nombre)}
            </span>
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={elegir} />
            <div className="cu-foto-acc">
                <button type="button" className="btn btn--linea btn--sm" disabled={ocupado || foto === null} onClick={() => input.current?.click()}>
                    <Icono n="user" />{ocupado ? 'Guardando…' : foto ? 'Cambiar foto' : 'Subir foto'}
                </button>
                {foto && <button type="button" className="ibtn ibtn--sm ibtn--peligro" aria-label="Quitar foto" title="Quitar foto" disabled={ocupado} onClick={() => guardar('')}><Icono n="basura" s={15} /></button>}
            </div>
            {error && <p className="campo-err" role="alert"><Icono n="alerta" s={14} />{error}</p>}
        </div>
    );
}
