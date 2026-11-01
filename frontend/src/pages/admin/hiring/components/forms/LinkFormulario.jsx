import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Link2, Pencil, X } from 'lucide-react';
import api from '../../../../../services/api';
import { Button, FieldError, IconButton, InputGroup } from '../../../../../components/standard';
import { URL_VACANTES, limpiarSlug, linkDe } from '../../lib/formularios';

// El link público del formulario: se copia de un toque y se cambia la parte final
// (/vacante/<slug>/). El cambio se guarda al confirmar, no con el autoguardado,
// porque el backend puede rechazarlo si otro formulario ya usa ese link.

const corto = (url) => url.replace(/^https?:\/\//, '');

const LinkFormulario = ({ form, onCambio }) => {
    const [editando, setEditando] = useState(false);
    const [valor, setValor] = useState(form.slug || '');
    const [error, setError] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [copiado, setCopiado] = useState(false);
    const espera = useRef(null);
    useEffect(() => () => clearTimeout(espera.current), []);

    const link = linkDe(form.slug);

    const copiar = async () => {
        try {
            await navigator.clipboard.writeText(link);
            setCopiado(true);
            clearTimeout(espera.current);
            espera.current = setTimeout(() => setCopiado(false), 1600);
        } catch (err) {
            setError('No se pudo copiar: copialo a mano.');
        }
    };

    const abrir = () => { setValor(form.slug || ''); setError(''); setEditando(true); };

    const guardar = async (e) => {
        e.preventDefault();
        const slug = valor.replace(/^-+|-+$/g, '');
        if (slug === form.slug) { setEditando(false); return; }
        setGuardando(true);
        try {
            const res = await api.put(`/hiring/forms/${form.id}`, { slug });
            onCambio(res.data.slug);
            setEditando(false);
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || 'No se pudo cambiar el link.');
        } finally {
            setGuardando(false);
        }
    };

    if (editando) {
        return (
            <div className="tl-flink">
                <InputGroup as="form" prefix={corto(URL_VACANTES)} invalid={!!error} onSubmit={guardar}>
                    <input autoFocus maxLength={60} autoComplete="off" spellCheck={false} value={valor}
                        onChange={(e) => setValor(limpiarSlug(e.target.value))}
                        onKeyDown={(e) => { if (e.key === 'Escape') setEditando(false); }}
                        aria-label={`Link de ${form.nombre}`} />
                    <Button type="submit" variant="primary" icon={<Check />} disabled={guardando || valor.length < 3}>Guardar</Button>
                </InputGroup>
                <IconButton size="sm" icon={<X />} label="Cancelar" title="Cancelar" onClick={() => setEditando(false)} />
                {error && <FieldError>{error}</FieldError>}
            </div>
        );
    }

    return (
        <div className="tl-flink">
            <a className="tl-flink-url" href={link} target="_blank" rel="noreferrer" title={form.activo ? 'Abrir la página' : 'Inactivo: el link muestra la búsqueda cerrada'}>
                <Link2 size={14} /><span>{corto(link)}</span>
            </a>
            <IconButton size="sm" icon={copiado ? <Check /> : <Copy />} label={copiado ? 'Copiado' : 'Copiar link'}
                title={copiado ? 'Copiado' : 'Copiar link'} onClick={copiar} disabled={!link} />
            <IconButton size="sm" icon={<Pencil />} label="Cambiar link" title="Cambiar link" onClick={abrir} />
            {error && <FieldError>{error}</FieldError>}
        </div>
    );
};

export default LinkFormulario;
