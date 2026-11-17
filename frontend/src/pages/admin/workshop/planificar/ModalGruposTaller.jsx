import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, Check, Flame, Loader2, Plus, Snowflake } from 'lucide-react';
import toast from 'react-hot-toast';
import {
    Button, FieldError, Input, Segmented, Skeleton, SkeletonBlock,
} from '../../../../components/standard';
import ModalPlan from './ModalPlan';
import FilaGrupo from './FilaGrupo';
import { useGruposTaller } from './useGruposTaller';
import {
    aCuerpo, activosSinGrupo, aFormulario, codigoDe, enlaceDePrueba, filaVacia, loQueFalta, nombreSugerido,
    opcionesDeConjunto, OTRO, TIPOS,
} from './grupos';
import { formatearInicio } from '../agendaTaller';

const ICONO_TIPO = { frio: Snowflake, caliente: Flame };
// Los íconos van acá y no en `grupos.js`, que es solo cuentas.
const OPCIONES_TIPO = Object.entries(TIPOS).map(([value, t]) => {
    const Icono = ICONO_TIPO[value];
    return { value, label: t.texto, icon: <Icono aria-hidden="true" />, props: { 'data-tip': t.ayuda } };
});

/**
 * «Grupos» de un taller: su tipo (frío o caliente), el grupo general y un grupo de WhatsApp por conjunto
 * de anuncios. La landing manda cada visita al grupo del conjunto que la trajo (ADR-W146). Se guarda
 * todo junto: cancelar no deja nada a medias.
 */
const ModalGruposTaller = ({ taller, onCerrar, onGuardado }) => {
    const { datos, error, guardar } = useGruposTaller(taller.id);
    const reducir = useReducedMotion();
    const [form, setForm] = useState(null);
    const [guardando, setGuardando] = useState(false);
    const [falla, setFalla] = useState(null);
    if (datos && !form) setForm(aFormulario(datos));

    const conjuntos = datos?.conjuntos || [];
    const cambiar = (parte) => { setFalla(null); setForm((f) => ({ ...f, ...parte })); };
    const cambiarFila = (clave, parte) => cambiar({
        filas: form.filas.map((f) => (f.clave === clave ? { ...f, ...parte } : f)),
    });

    const elegirConjunto = (fila, valor) => {
        if (valor === OTRO) return cambiarFila(fila.clave, { conjunto_id: '', manual: true });
        const conjunto = conjuntos.find((c) => c.id === valor);
        return cambiarFila(fila.clave, {
            conjunto_id: valor, manual: false,
            nombre: fila.nombre.trim() || !conjunto ? fila.nombre : nombreSugerido(conjunto, taller.date),
        });
    };

    // Un grupo nuevo arranca con el primer conjunto activo que todavía no tiene: solo falta pegar el enlace.
    const agregar = () => {
        const [libre] = activosSinGrupo(conjuntos, form.filas);
        const fila = filaVacia();
        cambiar({
            filas: [...form.filas, libre
                ? { ...fila, conjunto_id: libre.id, nombre: nombreSugerido(libre, taller.date) }
                : fila],
        });
    };

    const copiar = async (fila) => {
        const enlace = enlaceDePrueba(fila, conjuntos, datos.landing);
        try {
            await navigator.clipboard.writeText(enlace);
            toast.success('Enlace de prueba copiado');
        } catch {
            toast.error('No se pudo copiar el enlace');
        }
    };

    const enviar = async () => {
        if (!form || guardando) return;
        const falta = loQueFalta(form);
        if (falta) { setFalla(falta); return; }
        setGuardando(true);
        const problema = await guardar(aCuerpo(form));
        setGuardando(false);
        if (problema) { setFalla(problema); return; }
        toast.success('Grupos guardados');
        onGuardado?.();
        onCerrar();
    };

    const sinGrupo = form ? activosSinGrupo(conjuntos, form.filas) : [];
    const cuando = taller.inicio_at ? formatearInicio(taller.inicio_at) : taller.date.split('-').reverse().join('/');

    return (
        <ModalPlan titulo="Grupos de WhatsApp" eyebrow={cuando} className="wp-modal--ancho" cerrable={!guardando}
            onCerrar={onCerrar} onSubmit={enviar}
            pie={(
                <>
                    <Button onClick={onCerrar} disabled={guardando}>Cancelar</Button>
                    <Button variant="primary" type="submit" disabled={!form || guardando}
                        icon={guardando ? <Loader2 className="ws-gira" aria-hidden="true" /> : <Check aria-hidden="true" />}>
                        Guardar
                    </Button>
                </>
            )}>
            {error && <FieldError>{error}</FieldError>}
            {!form && !error && (
                <Skeleton label="Cargando los grupos del taller…" className="wp-grupos">
                    <SkeletonBlock height={36} width={220} />
                    <SkeletonBlock height={40} step={1} />
                    <SkeletonBlock height={40} step={2} />
                </Skeleton>
            )}
            {form && (
                <div className="wp-grupos">
                    <div className="wp-campo-linea">
                        <span className="t-rotulo">Tipo de taller</span>
                        {/* Tocar el elegido lo saca: el taller vuelve a «sin tipo». */}
                        <Segmented size="sm" label="Tipo de taller" value={form.tipo} options={OPCIONES_TIPO}
                            onChange={(v) => cambiar({ tipo: form.tipo === v ? '' : v })} />
                    </div>
                    <label className="wp-campo-linea">
                        <span className="t-rotulo">Grupo general</span>
                        <Input type="url" placeholder="https://chat.whatsapp.com/..." value={form.general}
                            data-tip="Adonde van las visitas que no llegan de un anuncio"
                            onChange={(e) => cambiar({ general: e.target.value })} />
                    </label>

                    {form.filas.length > 0 ? (
                        <>
                            <div className="wp-grupos-rotulos" aria-hidden="true">
                                <span className="t-rotulo">Conjunto de anuncios</span>
                                <span className="t-rotulo">Nombre del grupo</span>
                                <span className="t-rotulo">Enlace</span>
                            </div>
                            <ul className="wp-grupos-lista" aria-label="Grupos por conjunto de anuncios">
                                {form.filas.map((fila, i) => (
                                    <motion.li key={fila.clave} className="wp-grupo"
                                        initial={reducir ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.18 }}>
                                        <FilaGrupo fila={fila} numero={i + 1}
                                            opciones={opcionesDeConjunto(conjuntos, form.filas, fila)}
                                            enlace={enlaceDePrueba(fila, conjuntos, datos.landing)}
                                            onCambio={(parte) => cambiarFila(fila.clave, parte)}
                                            onConjunto={(v) => elegirConjunto(fila, v)}
                                            onCopiar={() => copiar(fila)}
                                            onQuitar={() => cambiar({ filas: form.filas.filter((f) => f.clave !== fila.clave) })} />
                                    </motion.li>
                                ))}
                            </ul>
                        </>
                    ) : (
                        <p className="t-sm mut">Sin grupos por conjunto: todas las visitas van al grupo general.</p>
                    )}

                    <Button className="wp-grupos-mas" icon={<Plus aria-hidden="true" />} onClick={agregar}>Agregar grupo</Button>

                    {sinGrupo.length > 0 && (
                        <p className="wp-aviso" role="status">
                            <AlertTriangle aria-hidden="true" />
                            <span>
                                {sinGrupo.length === 1 ? 'Un conjunto activo de Workshop no tiene' : `${sinGrupo.length} conjuntos activos de Workshop no tienen`}
                                {' '}grupo: {sinGrupo.map((c) => codigoDe(c.nombre) || c.nombre || c.id).join(', ')}. Sus visitas van al grupo general.
                            </span>
                        </p>
                    )}
                    {falla && <FieldError>{falla}</FieldError>}
                </div>
            )}
        </ModalPlan>
    );
};

export default ModalGruposTaller;
