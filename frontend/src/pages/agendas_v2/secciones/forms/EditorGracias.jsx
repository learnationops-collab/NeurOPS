// Editor de una página de gracias: el nombre, los dos videos (subidos al servidor o por link), cuánto
// video antes de «Ver mi plan», los casos de éxito de la Academia y, al lado, la página real tal como
// la ve el lead (la ruta pública en un iframe, que se recarga sola después de cada cambio guardado).

import { useEffect, useRef, useState } from 'react';
import { almacen, useDatos, useUi } from '../../data/hooks';
import { buscar } from '../../core/datos';
import { problemaVideo, soltarVideo, subirVideo, urlVideo } from '../../data/videos';
import { embedDe, rutaGracias, rutaPlan } from '../../reserva/gracias/contenido';
import { HUMO_MARCA, Icono, Paso, Seg, Switch } from '../../ui/base';
import { ui } from '../../ui/estadoUi';
import { InputVivo } from '../eventos/comun';
import { ConfirmarBorrarGracias } from './ListaGracias';
import './gracias.css';
import { Button, FieldError, IconButton, InputGroup, Panel } from '../../../../components/standard';

function cerrar() { almacen.flush(); ui.set({ gracias: null }); window.scrollTo({ top: 0 }); }

function editar(id, cambios) { almacen.editar('gracias', id, cambios); almacen.flush(); }

const MSG_SUBIDA = {
    sin_volumen: 'El servidor todavía no tiene dónde guardar videos. Pegá un link de Loom o YouTube mientras tanto.',
    invalido: '',
    unavailable: 'Se cortó la conexión. Volvé a intentarlo: sigue desde donde quedó si no cerrás la página.',
};

// Un video: lo que hay ahora (con su vista previa), subir otro o pegar un link.
function CampoVideo({ g, campo, tit, ayuda }) {
    const v = g[campo];
    const [subida, setSubida] = useState(null);   // {nombre, progreso} mientras sube
    const [error, setError] = useState('');
    const archivo = useRef(null), corte = useRef(null);
    useEffect(() => () => corte.current?.abort(), []);

    const reemplazar = (nuevo) => {
        const viejo = v.archivo;
        editar(g.id, { [campo]: nuevo });
        if (viejo && viejo !== nuevo.archivo) soltarVideo(viejo, g.id);
    };
    const subir = async (file) => {
        const p = problemaVideo(file);
        if (p) { setError(p); return; }
        setError('');
        corte.current = new AbortController();
        setSubida({ nombre: file.name, progreso: 0 });
        try {
            const r = await subirVideo(file, { signal: corte.current.signal, onProgreso: x => setSubida({ nombre: file.name, progreso: x }) });
            reemplazar({ archivo: r.id, nombre: file.name, url: '' });
        } catch (e) {
            if (e.code !== 'cancelado') setError(MSG_SUBIDA[e.code] || e.message || 'No se pudo subir el video.');
        } finally {
            setSubida(null);
            corte.current = null;
        }
    };
    const linkMal = !!v.url && !embedDe(v.url);

    return (
        <Panel as="section" className="gx-video" aura={HUMO_MARCA} soft>
            <h2 className="ev-bloque-tit"><Icono n="video" s={15} />{tit}</h2>
            <p className="t-sm mut">{ayuda}</p>
            <div className="gx-previa">
                {v.archivo ? <video src={urlVideo(v.archivo)} controls preload="metadata" title={tit} />
                    : v.url && !linkMal ? <iframe src={embedDe(v.url)} title={tit} allow="fullscreen" allowFullScreen />
                        : <span className="gx-vacio"><Icono n="video" s={28} />{linkMal ? 'Ese link no se puede mostrar' : 'Sin video'}</span>}
            </div>
            {subida ? (
                <div className="gx-subida" role="status">
                    <div className="gx-subida-txt"><span className="trunc">Subiendo {subida.nombre}</span><b className="num">{Math.round(subida.progreso * 100)}%</b></div>
                    <div className="gx-barra"><i style={{ width: (subida.progreso * 100) + '%' }} /></div>
                    <Button onClick={() => corte.current?.abort()}>Cancelar</Button>
                </div>
            ) : (
                <>
                    {v.archivo && <p className="t-sm gx-nombre"><Icono n="video" s={14} /><span className="trunc">{v.nombre || 'Video subido'}</span></p>}
                    <div className="gx-acc">
                        <Button icon={<Icono n="sube" />} onClick={() => archivo.current?.click()}>
                            {v.archivo ? 'Cambiar video' : 'Subir video'}
                        </Button>
                        <input ref={archivo} type="file" accept="video/mp4,video/webm,video/quicktime" hidden
                            onChange={e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) subir(f); }} />
                        {(v.archivo || v.url) && (
                            <Button icon={<Icono n="basura" />} onClick={() => reemplazar({ archivo: '', nombre: '', url: '' })}>
                                Quitar
                            </Button>
                        )}
                    </div>
                    <InputGroup invalid={linkMal} prefix={<Icono n="link" />}>
                        <InputVivo bare className="gx-link" type="url" inputMode="url" maxLength={500} spellCheck={false}
                            placeholder="O pegá un link de Loom, YouTube, Vimeo o Drive" aria-label={'Link de ' + tit}
                            valor={v.archivo ? '' : v.url}
                            guardar={t => {
                                const u = t.trim();
                                if (!u && v.archivo) return undefined;  // vaciar el link no quita el video subido
                                if (u && !embedDe(u)) return false;
                                reemplazar({ archivo: '', nombre: '', url: u });
                            }} />
                    </InputGroup>
                </>
            )}
            {error && <FieldError><span>{error}</span></FieldError>}
        </Panel>
    );
}

// La página real, en un iframe. `version` cambia con cada cambio: se recarga cuando ya se guardó.
function Vista({ g, pantalla }) {
    const [n, setN] = useState(0);
    const firma = JSON.stringify([g.video, g.plan, g.segundos, g.casos]);
    useEffect(() => {
        const t = setTimeout(() => { almacen.flush(); setN(x => x + 1); }, 1200);
        return () => clearTimeout(t);
    }, [firma]);
    const ruta = pantalla === 'plan' ? rutaPlan(g.id) : rutaGracias(g.id);
    return (
        <aside className="gx-vista">
            <div className="barra">
                <Seg sm label="Pantalla" valor={pantalla} onChange={p => ui.set(s => ({ gracias: { ...s.gracias, pantalla: p } }))}
                    opciones={[{ v: 'gracias', n: 'Gracias', icono: 'video' }, { v: 'plan', n: 'Plan y casos', icono: 'estrella' }]} />
                <a className="btn btn--linea btn--sm" style={{ marginLeft: 'auto' }} href={ruta} target="_blank" rel="noopener noreferrer"><Icono n="expandir" />Abrir</a>
            </div>
            <div className="gx-marco">
                <iframe key={ruta + n} src={ruta + '?previa=' + n} title="Vista previa de la página de gracias" />
            </div>
            <p className="t-sm mut">Así la ve el lead. Los casos de éxito salen de la Academia (los publicados para landings).</p>
        </aside>
    );
}

export default function EditorGracias() {
    const { d } = useDatos();
    const { gracias: abierta } = useUi();
    const [borrar, setBorrar] = useState(false);
    const g = buscar(d, 'gracias', abierta.id);
    useEffect(() => { if (!g) ui.set({ gracias: null }); }, [g]);
    if (!g) return null;
    return (
        <>
            <div className="barra">
                <Button icon={<Icono n="volver" />} data-nav="" onClick={cerrar}>Páginas de gracias</Button>
                <InputVivo className="gx-nom" maxLength={80} aria-label="Nombre de la página" valor={g.nombre}
                    guardar={t => { if (!t.trim()) return false; almacen.editar('gracias', g.id, { nombre: t.trim() }); }} />
                <IconButton label="Eliminar página" icon={<Icono n="basura" s={15} />} size="sm" danger style={{ marginLeft: 'auto' }} title="Eliminar página"
                    aria-expanded={borrar} onClick={() => setBorrar(b => !b)} />
            </div>
            {borrar && <Panel className="caja"><ConfirmarBorrarGracias g={g} d={d} onCancelar={() => setBorrar(false)} /></Panel>}
            <div className="gx-editor">
                <div className="gx-campos">
                    <CampoVideo g={g} campo="video" tit="Video para completar la reserva"
                        ayuda="Lo primero que ve el lead al agendar. «Ver mi plan» aparece después de que le da play." />
                    <Panel as="section" className="caja">
                        <h2 className="ev-bloque-tit"><Icono n="clock" s={15} />«Ver mi plan»</h2>
                        <div className="ffila">
                            <span>Aparece después de</span>
                            <div><Paso label="Segundos de video" valor={g.segundos} min={0} max={60} texto={g.segundos + ' s'}
                                onChange={x => editar(g.id, { segundos: x })} /></div>
                        </div>
                    </Panel>
                    <CampoVideo g={g} campo="plan" tit="Video del plan"
                        ayuda="La segunda pantalla: el protocolo de aprobación. Sin video, muestra solo los casos." />
                    <Panel as="section" className="caja">
                        <h2 className="ev-bloque-tit"><Icono n="estrella" s={15} />Casos de éxito</h2>
                        <div className="ffila">
                            <span>De la Academia</span>
                            <div className="gx-switch">
                                <Switch id="gx-casos" on={g.casos} label="Mostrar los casos de éxito de la Academia" onChange={x => editar(g.id, { casos: x })} />
                                <label htmlFor="gx-casos" className="t-sm">{g.casos ? 'Se muestran debajo del plan' : 'No se muestran'}</label>
                            </div>
                        </div>
                    </Panel>
                </div>
                <Vista g={g} pantalla={abierta.pantalla || 'gracias'} />
            </div>
        </>
    );
}
