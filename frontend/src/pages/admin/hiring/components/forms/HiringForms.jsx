import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    FileText, Globe, Copy, Trash2, Eye, Pencil, Plus, ArrowLeft, Monitor, Smartphone, RotateCcw, AlertTriangle,
    CheckCircle2, Loader2,
} from 'lucide-react';
import api from '../../../../../services/api';
import { Humo } from '../../../../comercial/components/Shared';
import { Chip } from '../Piezas';
import { URL_FORMULARIO, resumen } from '../../lib/formularios';
import EditorPreguntas from './EditorPreguntas';

// Forms: los formularios de postulación. Uno solo está activo —es el que publica
// la página de la vacante—; los demás son borradores o versiones guardadas. Cada
// uno se edita (preguntas, opciones, excluyentes) y se prueba tal como lo ve la
// postulante, con el formulario real en un marco.

const HUMO_MARCA = ['var(--brand-secondary)', 'var(--brand-primary)', 'var(--brand-secondary-light)', 'var(--focus-blue)'];
const HUMO_APAGADO = ['var(--idle)', 'var(--brand-primary)', 'var(--idle)', 'var(--brand-navy)'];

const fecha = (iso) => {
    if (!iso) return '';
    const d = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
};

const Switch = ({ on, onClick, etiqueta, ok = false, disabled }) => (
    <button type="button" role="switch" aria-checked={on} aria-label={etiqueta} title={etiqueta}
        className={`tl-switch${ok ? ' tl-switch--ok' : ''}`} onClick={onClick} disabled={disabled} />
);

const Tarjeta = ({ f, onActivar, onDuplicar, onBorrar, onAbrir, borrando, onPedirBorrar, onCancelarBorrar }) => {
    const r = f.resumen || {};
    return (
        <article className={`tl-fcard${f.activo ? ' tl-fcard--on caja' : ''}`}>
            {f.activo && <Humo colores={HUMO_MARCA} tarjeta />}
            <div className="tl-fcard-cab">
                <span className="tl-icono-m"><FileText size={20} /></span>
                <button type="button" className="tl-fcard-nom" onClick={() => onAbrir(f.id, 'preguntas')}>
                    <b>{f.nombre}</b>
                    <small>Creado el {fecha(f.created_at)}</small>
                </button>
                {f.activo ? <Chip c="var(--success)" icono={Globe}>En la página</Chip> : <Chip c="var(--idle)">Inactivo</Chip>}
            </div>
            <div className="tl-datos">
                <div className="tl-dato"><b>{r.activas ?? '—'}<small> / {r.total ?? '—'}</small></b><span>Preguntas activas</span></div>
                <div className="tl-dato tl-dato--ko"><b>{r.excluyentes ?? '—'}</b><span>Excluyentes</span></div>
                <div className="tl-dato"><b>{r.respuestas ?? 0}</b><span>Respuestas</span></div>
            </div>
            {borrando ? (
                <div className="tl-fcard-aviso">
                    <span>¿Eliminar <b>{f.nombre}</b>? No se puede recuperar.</span>
                    <div className="der">
                        <button type="button" className="btn btn--sm btn--linea" onClick={onCancelarBorrar}>Cancelar</button>
                        <button type="button" className="btn btn--sm btn--tono" style={{ '--c': 'var(--error)' }} onClick={() => onBorrar(f.id)}>
                            <Trash2 /> Eliminar
                        </button>
                    </div>
                </div>
            ) : (
                <div className="tl-fcard-pie">
                    <span className="tl-sw">
                        <Switch ok on={f.activo} onClick={() => onActivar(f.id, !f.activo)} etiqueta="Activo en la página" />
                        {f.activo ? 'Activo' : 'Inactivo'}
                    </span>
                    <div className="der">
                        <button type="button" className="ibtn ibtn--sm" onClick={() => onDuplicar(f.id)} title="Duplicar" aria-label={`Duplicar ${f.nombre}`}><Copy /></button>
                        <button type="button" className="ibtn ibtn--sm ibtn--peligro" onClick={() => onPedirBorrar(f.id)}
                            disabled={f.activo || (r.respuestas || 0) > 0}
                            title={f.activo ? 'El activo no se borra: primero activá otro' : (r.respuestas || 0) > 0 ? 'Tiene respuestas: desactivalo en vez de borrarlo' : 'Eliminar'}
                            aria-label={`Eliminar ${f.nombre}`}>
                            <Trash2 />
                        </button>
                        <button type="button" className="btn btn--sm btn--linea" onClick={() => onAbrir(f.id, 'previa')}><Eye /> Probar</button>
                        <button type="button" className="btn btn--sm btn--linea" onClick={() => onAbrir(f.id, 'preguntas')}><Pencil /> Editar</button>
                    </div>
                </div>
            )}
        </article>
    );
};

const Lista = ({ onAbrir }) => {
    const [forms, setForms] = useState(null);
    const [error, setError] = useState('');
    const [nombre, setNombre] = useState('');
    const [borrando, setBorrando] = useState(null);
    const [creando, setCreando] = useState(false);

    const cargar = useCallback(() => {
        api.get('/hiring/forms')
            .then((res) => { setForms(res.data.forms || []); setError(''); })
            .catch((err) => setError(err.response?.data?.message || 'No se pudieron cargar los formularios.'));
    }, []);
    useEffect(() => { cargar(); }, [cargar]);

    const accion = async (fn, msg) => {
        try {
            await fn();
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || msg);
        }
        cargar();
    };

    const crear = async (e) => {
        e.preventDefault();
        const n = nombre.trim();
        if (!n) return;
        setCreando(true);
        try {
            const res = await api.post('/hiring/forms', { nombre: n });
            setNombre('');
            onAbrir(res.data.id, 'preguntas');
        } catch (err) {
            setError(err.response?.data?.message || 'No se pudo crear el formulario.');
        } finally {
            setCreando(false);
        }
    };

    if (!forms) {
        return error
            ? <div className="tl-aviso-error"><AlertTriangle size={16} />{error}</div>
            : <p className="t-cap mut40">Cargando formularios…</p>;
    }

    return (
        <>
            {error && <div className="tl-aviso-error"><AlertTriangle size={16} />{error}</div>}
            <div className="tl-f-grid">
                {forms.map((f) => (
                    <Tarjeta
                        key={f.id}
                        f={f}
                        borrando={borrando === f.id}
                        onPedirBorrar={setBorrando}
                        onCancelarBorrar={() => setBorrando(null)}
                        onAbrir={onAbrir}
                        onActivar={(id, activo) => accion(() => api.post(`/hiring/forms/${id}/activar`, { activo }), 'No se pudo cambiar el formulario activo.')}
                        onDuplicar={(id) => accion(() => api.post(`/hiring/forms/${id}/duplicar`), 'No se pudo duplicar.')}
                        onBorrar={(id) => { setBorrando(null); accion(() => api.delete(`/hiring/forms/${id}`), 'No se pudo eliminar.'); }}
                    />
                ))}
                <section className="tl-fnuevo">
                    <p className="tl-rotulo" style={{ color: 'var(--brand-secondary)' }}>Nuevo formulario</p>
                    <p className="t-cap mut">Arranca como copia del formulario activo. Después prendés, apagás o editás las preguntas.</p>
                    <form onSubmit={crear}>
                        <input className="tl-input" maxLength={80} autoComplete="off" placeholder="Nombre, ej. Asistente · Brasil"
                            value={nombre} onChange={(e) => setNombre(e.target.value)} aria-label="Nombre del formulario nuevo" />
                        <button type="submit" className="btn btn--cta" disabled={!nombre.trim() || creando}><Plus /> Crear</button>
                    </form>
                </section>
            </div>
        </>
    );
};

const ESTADO = {
    guardando: { c: 'var(--text-muted)', t: 'Guardando…', i: Loader2 },
    ok: { c: 'var(--success)', t: 'Guardado', i: CheckCircle2 },
    error: { c: 'var(--error)', i: AlertTriangle },
};

const Editor = ({ id, modo, onModo, onVolver }) => {
    const [form, setForm] = useState(null);
    const [error, setError] = useState('');
    const [estado, setEstado] = useState('');
    const [pantalla, setPantalla] = useState('escritorio');
    const [version, setVersion] = useState(0);
    const [tasaBrl, setTasaBrl] = useState(null);
    const espera = useRef(null);
    const pendiente = useRef(null);

    useEffect(() => {
        api.get(`/hiring/forms/${id}`)
            .then((res) => setForm(res.data))
            .catch((err) => setError(err.response?.data?.message || 'No se pudo abrir el formulario.'));
        api.get('/hiring/config').then((res) => setTasaBrl(res.data.tasa_brl)).catch(() => {});
    }, [id]);

    // Cada cambio se guarda solo, medio segundo después del último toque.
    const guardarYa = useCallback(async () => {
        const cuerpo = pendiente.current;
        if (!cuerpo) return;
        pendiente.current = null;
        setEstado('guardando');
        try {
            const res = await api.put(`/hiring/forms/${id}`, cuerpo);
            setForm((prev) => ({ ...prev, resumen: res.data.resumen, updated_at: res.data.updated_at }));
            setEstado('ok');
            setError('');
            setVersion((v) => v + 1);
        } catch (err) {
            setEstado('error');
            setError(err.response?.data?.message || 'No se pudo guardar el cambio.');
        }
    }, [id]);

    useEffect(() => () => { clearTimeout(espera.current); if (pendiente.current) guardarYa(); }, [guardarYa]);

    const cambiar = (cambio) => {
        setForm((prev) => {
            const nuevo = { ...prev, ...cambio };
            pendiente.current = { nombre: nuevo.nombre, preguntas: nuevo.preguntas };
            return nuevo;
        });
        setEstado('');
        clearTimeout(espera.current);
        espera.current = setTimeout(guardarYa, 550);
    };

    const activar = async () => {
        try {
            await api.post(`/hiring/forms/${id}/activar`, { activo: !form.activo });
            setForm((prev) => ({ ...prev, activo: !prev.activo }));
        } catch (err) {
            setError(err.response?.data?.message || 'No se pudo cambiar el formulario activo.');
        }
    };

    if (!form) {
        return error ? <div className="tl-aviso-error"><AlertTriangle size={16} />{error}</div> : <p className="t-cap mut40">Abriendo el formulario…</p>;
    }

    const r = resumen(form.preguntas);
    const E = ESTADO[estado];
    // En local se puede apuntar el marco a un formulario servido aparte (ver institute-site).
    const api0 = import.meta.env.VITE_TALENT_FORM_API ? `&api=${encodeURIComponent(import.meta.env.VITE_TALENT_FORM_API)}` : '';
    const src = `${URL_FORMULARIO}?preview=${id}&v=${version}${api0}`;

    return (
        <>
            <div className="tl-fe-barra">
                <button type="button" className="btn btn--sm btn--linea" onClick={onVolver}><ArrowLeft /> Formularios</button>
                <div className="seg" role="group" aria-label="Modo">
                    <button type="button" aria-pressed={modo === 'preguntas'} onClick={() => onModo('preguntas')}>Preguntas</button>
                    <button type="button" aria-pressed={modo === 'previa'} onClick={() => onModo('previa')}>Vista previa</button>
                </div>
                {E && (
                    <span className="tl-estado" style={{ color: E.c }}>
                        <E.i size={15} className={estado === 'guardando' ? 'animate-spin' : undefined} />{E.t || error}
                    </span>
                )}
                <div className="der">
                    {modo === 'previa' && (
                        <>
                            <div className="seg" role="group" aria-label="Pantalla">
                                <button type="button" aria-pressed={pantalla === 'escritorio'} onClick={() => setPantalla('escritorio')} title="Computadora" aria-label="Computadora"><Monitor size={15} /></button>
                                <button type="button" aria-pressed={pantalla === 'celular'} onClick={() => setPantalla('celular')} title="Celular" aria-label="Celular"><Smartphone size={15} /></button>
                            </div>
                            <button type="button" className="btn btn--sm btn--linea" onClick={() => setVersion((v) => v + 1)}><RotateCcw /> Reiniciar</button>
                        </>
                    )}
                    <span className="tl-sw">
                        <Switch ok on={form.activo} onClick={activar} etiqueta="Activo en la página" />
                        {form.activo ? 'Activo en la página' : 'Inactivo'}
                    </span>
                </div>
            </div>

            {estado !== 'error' && error && <div className="tl-aviso-error"><AlertTriangle size={16} />{error}</div>}

            {modo === 'previa' ? (
                <div className="tl-previa">
                    <div className="tl-pv-marco" data-modo={pantalla}>
                        <iframe key={`${version}-${pantalla}`} title={`Vista previa de ${form.nombre}`} src={src} />
                    </div>
                    <p className="t-cap mut40">Así la ve la postulante, con la última versión guardada. Solo aparecen las preguntas activas; nada de lo que respondas acá se guarda.</p>
                </div>
            ) : (
                <>
                    <section className="tl-fe-cab caja">
                        <Humo colores={form.activo ? HUMO_MARCA : HUMO_APAGADO} clase="humo--hero" />
                        <input className="tl-fe-nombre" maxLength={80} autoComplete="off" value={form.nombre}
                            onChange={(e) => cambiar({ nombre: e.target.value })} aria-label="Nombre del formulario" />
                        <p className="tl-fe-meta">
                            <b>{r.activas}</b> de {r.total} preguntas activas<i />
                            <b style={{ color: 'var(--error)' }}>{r.excluyentes}</b> con excluyentes<i />
                            {form.activo
                                ? <a className="tl-fe-url" href={URL_FORMULARIO} target="_blank" rel="noreferrer"><Globe size={13} />{URL_FORMULARIO.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a>
                                : 'No está en la página'}
                        </p>
                    </section>
                    <EditorPreguntas preguntas={form.preguntas || []} tasaBrl={tasaBrl} onCambiar={(preguntas) => cambiar({ preguntas })} />
                </>
            )}
        </>
    );
};

const HiringForms = () => {
    const [abierto, setAbierto] = useState(null);

    if (abierto) {
        return (
            <Editor
                key={abierto.id}
                id={abierto.id}
                modo={abierto.modo}
                onModo={(modo) => setAbierto((a) => ({ ...a, modo }))}
                onVolver={() => setAbierto(null)}
            />
        );
    }
    return <Lista onAbrir={(id, modo) => setAbierto({ id, modo })} />;
};

export default HiringForms;
