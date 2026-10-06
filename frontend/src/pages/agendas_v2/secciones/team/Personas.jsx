// People: sumar personas, foto, nombre, rol, nivel (Top 1–3), horario y orden.
// Con la API, las personas salen de los closers reales de la app: se suman desde esa lista y
// quedan unidas a su cuenta por el email (es lo que usa el servidor para saber a qué closer va una agenda).
// Un closer sin Google Calendar conectado en NeurOPS no recibe agendas: se marca en su tarjeta.

import { useCallback, useEffect, useState } from 'react';
import { TZ_DEF } from '../../core/catalogos';
import { closers, colorLibre, colorVar, esCloser, horasSemana, maxOrden, ord, rolCloser } from '../../core/datos';
import { fmt, iniciales } from '../../core/util';
import { almacen, useDatos, usePermisos } from '../../data/hooks';
import { Humo, Icono, Sx, leerFoto } from '../../ui/base';
import { toast } from '../../ui/toast';
import { useOrdenable } from '../../ui/useOrdenable';
import { horarioLaV } from './cobertura';
import { CampoNombre, Compo, HUMO_PERSONA, METAL, SemanaMini, opcionesRol } from './comun';
import { abrirHorario } from './Horario';

const OPS_NIVEL = [1, 2, 3].map(n => ({ v: n, n: 'Top ' + n, icono: 'estrellaLlena', color: METAL[n - 1] }));

// Closers reales de la app (los setters no van en Team: tienen su link en los funnels de setting).
// null mientras carga; [] en modo local (sin backend).
function useUsuariosReales() {
    const [usuarios, setUsuarios] = useState(null);
    useEffect(() => {
        let vivo = true;
        Promise.resolve(almacen.adaptador.usuarios ? almacen.adaptador.usuarios() : [])
            .then(u => { if (vivo) setUsuarios(u); }, () => { if (vivo) { setUsuarios([]); toast('No se pudo traer la lista de closers.', 'error'); } });
        return () => { vivo = false; };
    }, []);
    return usuarios;
}

const conEmail = (ps) => new Set(ps.map(p => (p.email || '').toLowerCase()).filter(Boolean));

function rolDeUsuario(d, u) {
    if (u.rol !== 'setter') return rolCloser(d);
    const r = ord(d, 'roles').find(x => /setter/i.test(x.nombre));
    return r ? r.id : 'setter';
}

function Persona({ p, ordenable, borrando, setBorrando, sinCuenta, sinCalendar }) {
    const { d } = useDatos();
    const { yo } = usePermisos();
    const hs = horasSemana(p), closer = esCloser(d, p);
    const cambiar = (campos) => almacen.editar('personas', p.id, campos, true);

    const foto = async (e) => {
        const f = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!f) return;
        try { cambiar({ foto: await leerFoto(f) }); } catch (er) { toast(er.message, 'error'); }
    };
    const borrar = () => {
        const st = almacen.getState().d;
        st.grupos.forEach(g => { if (g.miembros.includes(p.id)) almacen.editar('grupos', g.id, { miembros: g.miembros.filter(x => x !== p.id) }); });
        almacen.flush();
        almacen.borrar('personas', p.id);
        setBorrando(null);
        toast(p.nombre + ' eliminado');
    };

    return (
        <article data-item={p.id} className={'tarjeta persona caja' + ordenable.claseItem(p.id)} style={{ '--c': colorVar(p.color) }}>
            <Humo clase="humo--tarjeta humo--suave" cols={HUMO_PERSONA} />
            <div className="persona-cab">
                <button type="button" className="grip" {...ordenable.grip(p.id, 'Mover ' + p.nombre)}><Icono n="grip" /></button>
                <label className="avatar avatar--l foto" style={{ '--c': colorVar(p.color) }} title="Cambiar foto">
                    {p.foto ? <img src={p.foto} alt="" /> : iniciales(p.nombre)}
                    <input type="file" accept="image/*" aria-label={'Foto de ' + p.nombre} onChange={foto} />
                </label>
                <div className="pc-id">
                    <label className="sr" htmlFor={'pn-' + p.id}>Nombre</label>
                    <CampoNombre className="persona-nom" id={'pn-' + p.id} maxLength={60} valor={p.nombre} onGuardar={v => almacen.editar('personas', p.id, { nombre: v })} />
                    <span className="pc-sub">
                        {yo && yo.id === p.id && <span className="pc-vos">Vos</span>}
                        {sinCuenta && <span className="pc-vos" title="Su email no coincide con ningún closer activo de la app">Sin usuario</span>}
                        {closer && sinCalendar && <span className="pc-vos" title="No recibe agendas hasta que conecte su Google Calendar en NeurOPS (Configuración › Agendas)">Sin Calendar</span>}
                        {closer
                            ? <><SemanaMini p={p} /><span className="num">{hs ? fmt(hs, 1) + ' h/sem' : 'Sin horario'}</span></>
                            : <span>No toma llamadas</span>}
                    </span>
                </div>
                <div className="pc-ctrl">
                    <Sx sm label="Rol" valor={p.rol} opciones={opcionesRol(d, p.rol)} onChange={v => cambiar({ rol: v })} />
                    {closer ? (
                        <>
                            <Sx sm label="Nivel" valor={p.nivel} opciones={OPS_NIVEL} onChange={v => cambiar({ nivel: v })} />
                            <button type="button" className="horas-btn" data-nav="" aria-haspopup="dialog" onClick={e => abrirHorario(p, e.currentTarget)}>
                                <Icono n="clock" />Horario<Icono n="edit" s={14} />
                            </button>
                        </>
                    ) : <><span /><span /></>}
                </div>
                <button type="button" className="ibtn ibtn--sm ibtn--peligro" aria-label={'Eliminar ' + p.nombre} onClick={() => setBorrando(p.id)}><Icono n="basura" s={15} /></button>
            </div>
            {borrando && (
                <div style={{ padding: '0 10px 10px' }}>
                    <div className="ed-pie--borrar" role="alertdialog" aria-label={'Eliminar a ' + p.nombre}>
                        <p className="t-sm">¿Eliminar a <b>{p.nombre}</b>? Sale de todas las prioridades.</p>
                        <div className="der">
                            <button type="button" className="btn btn--linea btn--sm" autoFocus onClick={() => setBorrando(null)}>Cancelar</button>
                            <button type="button" className="btn btn--borrar btn--sm" onClick={borrar}><Icono n="basura" />Eliminar</button>
                        </div>
                    </div>
                </div>
            )}
        </article>
    );
}

export default function Personas() {
    const { d } = useDatos();
    const { sim, puede } = usePermisos();
    const [borrando, setBorrando] = useState(null);
    const ps = ord(d, 'personas');
    const ids = ps.map(p => p.id);
    const reordenar = useCallback((nuevos) => {
        nuevos.forEach((id, i) => almacen.editar('personas', id, { orden: i + 1 }));
        almacen.flush();
    }, []);
    const { contenedor: ordenCont, ...orden } = useOrdenable(ids, reordenar);
    const sumar = puede('team.sumar');
    const usuarios = useUsuariosReales();
    const reales = almacen.adaptador.tipo === 'api';
    const enTeam = conEmail(ps);
    const disponibles = (usuarios || []).filter(u => u.email && !enTeam.has(u.email.toLowerCase()));
    const cuentas = new Map((usuarios || []).map(u => [(u.email || '').toLowerCase(), u]));

    const sumarUsuarios = (us) => {
        let st = almacen.getState().d, orden0 = maxOrden(st, 'personas');
        us.forEach((u, i) => {
            const rol = rolDeUsuario(st, u), closer = u.rol !== 'setter';
            almacen.crear('personas', {
                nombre: u.nombre, email: u.email, rol, nivel: Math.min(3, closers(st).length + 1), color: colorLibre(st, 'personas'),
                tz: u.tz || TZ_DEF, horario: closer ? horarioLaV() : {}, orden: orden0 + i + 1,
            });
            st = almacen.getState().d;
        });
        toast(us.length === 1 ? us[0].nombre + ' sumado' : us.length + ' personas sumadas');
    };

    // Con la API solo se suman usuarios reales (por nombre o desde la lista); en modo local, cualquier nombre.
    const crear = (v) => {
        const n = String(v || '').replace(/\s+/g, ' ').trim();
        if (!n) return 'Escribí un nombre.';
        if (reales) {
            const u = disponibles.find(x => x.nombre.toLowerCase() === n.toLowerCase());
            if (!u) return usuarios === null ? 'Cargando la lista de closers…' : 'No hay un closer o setter activo con ese nombre que no esté ya en Team.';
            sumarUsuarios([u]);
            return '';
        }
        almacen.crear('personas', {
            nombre: n, rol: rolCloser(d), nivel: Math.min(3, closers(d).length + 1), color: colorLibre(d, 'personas'),
            tz: TZ_DEF, horario: horarioLaV(), orden: maxOrden(d, 'personas') + 1,
        });
        toast(n + ' sumado');
        return '';
    };

    const sug = reales && disponibles.length > 0 && (
        <div className="compo-sug">
            <span className="t-rotulo">De la app</span>
            {disponibles.map(u => (
                <button key={u.id} type="button" className="sug" title={u.email} onClick={() => sumarUsuarios([u])}>
                    <Icono n="plus" />{u.nombre}{u.rol === 'setter' ? ' · setter' : !u.calendar ? ' · sin Calendar' : ''}
                </button>
            ))}
            {disponibles.length > 1 && <button type="button" className="sug" onClick={() => sumarUsuarios(disponibles)}><Icono n="users" />Sumar todos</button>}
        </div>
    );

    const compo = (
        <Compo vacio={!ps.length} tit="Sumar persona" soloTit="Sumá a tu equipo" ph={reales ? 'Nombre del closer en la app' : 'Nombre, ej. Giancarlo'} onCrear={crear}
            sug={sug} nav={!!sim && sumar} bloqueado={!!sim && !sumar} />
    );
    if (!ps.length) return compo;
    return (
        <>
            {compo}
            <div className="columna" style={{ width: '100%' }}>
                <div className="lista" ref={ordenCont}>
                    {porIdsOrden(ps, orden.lista).map(p => (
                        <Persona key={p.id} p={p} ordenable={orden} borrando={borrando === p.id} setBorrando={setBorrando}
                            sinCuenta={reales && usuarios !== null && !cuentas.has((p.email || '').toLowerCase())}
                            sinCalendar={reales && cuentas.has((p.email || '').toLowerCase()) && !cuentas.get((p.email || '').toLowerCase()).calendar} />
                    ))}
                </div>
            </div>
        </>
    );
}

function porIdsOrden(ps, lista) { return lista.map(id => ps.find(p => p.id === id)).filter(Boolean); }
