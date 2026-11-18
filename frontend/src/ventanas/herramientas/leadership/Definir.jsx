// Crear, ajustar o definir un quick o un project con un arquetipo (el Simpler Clarity de Leadership): una sola
// pantalla con preguntas cortas. Lo que falte no frena: sale «Al Inbox» y se termina después en Leadership.
import { useMemo, useState } from 'react';
import { ArrowLeft, Check, Inbox, Plus, Send } from 'lucide-react';
import { Button, FieldError, LinkButton, Segmented, Select } from '../../../components/standard';
import { DURACIONES, ENTREGAS, NOMBRE_R, atajosDeFecha, diasHasta, rDe } from './formato';
import { Arquetipos, RChip } from './piezas';

const TITULOS = { nuevo: 'Nuevo', ajustar: 'Ajustar', definir: 'Definir lo que te pasaron' };

export default function Definir({ opciones, base, modo, onVolver, onGuardar, onAbrir }) {
    const [f, setF] = useState(() => ({
        titulo: '', tipo: 'quick', arquetipo: '', minutos: null, minAuto: false, fecha: '', para: '', entrega: 'nada',
        area: '', areaTocada: false, actividad: '', pasos: [{ titulo: '', para: '' }, { titulo: '', para: '' }], ...base,
    }));
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState(null);
    const set = (cambios) => { setF(prev => ({ ...prev, ...cambios })); setError(null); };

    const arq = opciones.arquetipos.find(a => a.clave === f.arquetipo) || null;
    const r = rDe(arq, f.fecha || null);
    const esOtro = Boolean(f.para);
    const conTipo = modo !== 'ajustar';
    const conClarity = f.clase !== 'tarea';
    const pasosOk = f.pasos.filter(p => p.titulo.trim()).length >= 2;
    const areaPuesto = opciones.area_puesto?.clave || '';

    const faltan = [
        !f.titulo.trim() && 'el nombre',
        conClarity && !f.arquetipo && 'cómo es',
        f.tipo === 'quick' && !f.minutos && 'cuánto lleva',
        f.tipo === 'project' && modo !== 'ajustar' && !pasosOk && '2 pasos',
    ].filter(Boolean);

    const areas = useMemo(() => [
        { value: '', label: areaPuesto ? `${opciones.area_puesto.nombre} (tu puesto)` : 'Sin área' },
        ...opciones.areas.flatMap(g => g.areas.filter(a => a.clave !== areaPuesto).map(a => ({ value: a.clave, label: a.nombre }))),
    ], [opciones, areaPuesto]);
    const actividades = [{ value: '', label: 'Según el título' }, ...opciones.actividades.map(a => ({ value: a.clave, label: a.nombre }))];
    const personas = [{ value: '', label: 'Yo' }, ...opciones.personas.map(p => ({ value: p.email, label: p.nombre }))];

    const elegirArquetipo = (clave) => {
        const a = opciones.arquetipos.find(x => x.clave === clave);
        set({ arquetipo: clave, ...(!f.minutos || f.minAuto ? { minutos: a?.minutos_sugeridos || null, minAuto: true } : {}) });
    };
    const cambiarPaso = (i, cambios) => set({ pasos: f.pasos.map((p, j) => (j === i ? { ...p, ...cambios } : p)) });

    const datos = () => {
        const d = { titulo: f.titulo.trim() };
        if (conTipo) d.tipo = f.tipo;
        if (conClarity && f.arquetipo) d.arquetipo = f.arquetipo;
        if (f.tipo === 'quick' && f.minutos) d.minutos = f.minutos;
        if (f.fecha || modo !== 'nuevo') d.fecha = f.fecha || null;
        // Sin tocarla, la del puesto (la de quien la hace, si es otra persona, la pone Leadership).
        if (f.areaTocada || modo === 'definir' || (modo === 'nuevo' && !esOtro)) d.area = f.area || areaPuesto || null;
        if (f.tipo === 'quick' && f.actividad) d.actividad = f.actividad;
        if (f.tipo === 'project' && modo !== 'ajustar') {
            d.pasos = f.pasos.filter(p => p.titulo.trim()).map(p => ({ titulo: p.titulo.trim(), ...(p.para ? { para: p.para } : {}) }));
        }
        if (modo === 'nuevo' && esOtro) { d.para = f.para; d.entrega = f.entrega; }
        return d;
    };

    const guardar = async () => {
        if (!f.titulo.trim() || guardando) return;
        setGuardando(true);
        try {
            await onGuardar(datos());
        } catch (e) {
            const ocupan = e.datos?.ocupan?.map(o => o.titulo).join(', ');
            setError(ocupan ? `${e.message} Hoy están: ${ocupan}.` : e.message);
        } finally {
            setGuardando(false);
        }
    };

    const quien = esOtro ? opciones.personas.find(p => p.email === f.para)?.nombre : null;
    const resumen = faltan.length
        ? <><b className="lr-falta">Falta {faltan.join(', ')}.</b> Si lo guardás así, va a tu Inbox y lo terminás después.</>
        : <>{conClarity && r && <RChip r={r} largo />} {esOtro ? <>le llega a <b>{quien}</b> ya definida</> : modo === 'nuevo' ? 'va a tu Momentum' : 'queda en tu Momentum'}</>;

    return (
        <div className="lr-definir">
            <div className="lr-cuerpo">
                <div className="lr-definir__top">
                    <Button variant="ghost" icon={<ArrowLeft size={15} />} onClick={onVolver}>Volver</Button>
                    <span className="lr-sec">{TITULOS[modo]}</span>
                </div>
                <input className="lr-titulo" value={f.titulo} placeholder="¿Qué hay que hacer?" autoFocus={modo === 'nuevo'}
                    onChange={e => set({ titulo: e.target.value })} aria-label="Qué hay que hacer" />
                {f.de && <p className="lr-de">{f.de.nombre} te la pasó{f.entregaDe ? ` y pide ${f.entregaDe}` : ''}.</p>}

                {conTipo && (
                    <>
                        <p className="lr-paso">¿Es una cosa o varias?</p>
                        <div className="lr-tipos">
                            {[['quick', 'Quick', 'Una sola cosa, se hace de una'], ['project', 'Project', 'Varios pasos, quizás con otros']].map(([v, t, d]) => (
                                <button key={v} type="button" className="lr-tipo" aria-pressed={f.tipo === v} onClick={() => set({ tipo: v })}>
                                    <b>{t}</b><span>{d}</span>
                                </button>
                            ))}
                        </div>
                    </>
                )}

                {conClarity && (
                    <>
                        <p className="lr-paso">¿Cómo es? <small>Con esto Leadership le pone el Clarity</small></p>
                        <Arquetipos arquetipos={opciones.arquetipos} valor={f.arquetipo} fecha={f.fecha || null} onElegir={elegirArquetipo} />
                    </>
                )}

                {f.tipo === 'project' && modo !== 'ajustar' ? (
                    <>
                        <p className="lr-paso">Los pasos <small>Mínimo 2. Cada uno puede hacerlo otra persona.</small></p>
                        <div className="lr-pasos">
                            {f.pasos.map((p, i) => (
                                <div className="lr-paso-fila" key={i}>
                                    <span className="lr-paso-fila__n">{i + 1}</span>
                                    <input value={p.titulo} placeholder={i === 0 ? 'Primer paso' : 'Después…'} aria-label={`Paso ${i + 1}`}
                                        onChange={e => cambiarPaso(i, { titulo: e.target.value })} />
                                    <Select size="sm" value={p.para} options={personas} label={`Quién hace el paso ${i + 1}`}
                                        onChange={v => cambiarPaso(i, { para: v })} />
                                </div>
                            ))}
                            <LinkButton icon={<Plus size={14} />} onClick={() => set({ pasos: [...f.pasos, { titulo: '', para: '' }] })}>Otro paso</LinkButton>
                        </div>
                    </>
                ) : f.tipo === 'quick' && (
                    <>
                        <p className="lr-paso">¿Cuánto lleva? {f.minAuto && <small>Sugerido por el arquetipo</small>}</p>
                        <Segmented size="sm" value={f.minutos} options={DURACIONES} label="Duración"
                            onChange={v => set({ minutos: v, minAuto: false })} />
                    </>
                )}

                <p className="lr-paso">¿Para cuándo?</p>
                <Segmented size="sm" value={f.fecha} label="Fecha"
                    options={[...atajosDeFecha(), ...(f.fecha && !atajosDeFecha().some(o => o.value === f.fecha) ? [{ value: f.fecha, label: f.fecha }] : [])]}
                    onChange={v => set({ fecha: v })} />
                {arq && !arq.urgente && diasHasta(f.fecha) !== null && diasHasta(f.fecha) <= 7 && (
                    <p className="lr-ayuda">Con fecha en 7 días o menos pasa a R1 · {NOMBRE_R.R1}, aunque el arquetipo no sea urgente.</p>
                )}

                {modo === 'nuevo' && (
                    <>
                        <p className="lr-paso">¿Quién la hace?</p>
                        <Select value={f.para} options={personas} label="Quién la hace" onChange={v => set({ para: v })} />
                        {esOtro && (
                            <>
                                <p className="lr-paso">¿Qué te tiene que devolver?</p>
                                <Segmented size="sm" value={f.entrega} options={ENTREGAS} label="Entrega" onChange={v => set({ entrega: v })} />
                            </>
                        )}
                    </>
                )}

                <div className="lr-extra">
                    {f.clase !== 'tarea' && (
                        <Select size="sm" value={f.area} options={areas} label="Área" onChange={v => set({ area: v, areaTocada: true })} />
                    )}
                    {f.tipo === 'quick' && (
                        <Select size="sm" value={f.actividad} options={actividades} label="Actividad" onChange={v => set({ actividad: v })} />
                    )}
                    {onAbrir && <LinkButton onClick={onAbrir}>Más opciones en Leadership</LinkButton>}
                </div>
                {error && <FieldError>{error}</FieldError>}
            </div>

            <footer className="lr-barra">
                <span className="lr-barra__res">{resumen}</span>
                <Button variant="primary" size="md" disabled={!f.titulo.trim() || guardando} onClick={guardar}
                    icon={faltan.length ? <Inbox size={15} /> : esOtro ? <Send size={15} /> : <Check size={15} />}>
                    {faltan.length ? 'Al Inbox' : esOtro ? 'Pasársela' : modo === 'nuevo' ? 'Crear' : 'Listo'}
                </Button>
            </footer>
        </div>
    );
}
