// People: sumar personas, foto, nombre, rol, nivel (Top 1–3), horario y orden.
// Con la API, las personas salen de los closers reales de la app: se suman desde esa lista y
// quedan unidas a su cuenta por el email (es lo que usa el servidor para saber a qué closer va una agenda).
// Un closer sin Google Calendar conectado en NeurOPS no recibe agendas: se marca en su tarjeta.

import { useCallback, useState } from 'react';
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
import ElegirCloser, { useUsuariosReales } from './ElegirCloser';
import { useAuth } from '../../../../contexts/AuthContext';
import { SIMULAN_CLOSERS, simularParaConfigurar } from '../conf/TabEquipo';

// El Top es solo una etiqueta del equipo: no cambia el reparto (eso lo decide cada estrategia).
function Nivel({ p, onChange }) {
    return (
        <div className="top-sel" role="radiogroup" aria-label={'Top de ' + p.nombre} title="Top (solo para el equipo; no cambia el reparto)">
            {[1, 2, 3].map(n => (
                <button key={n} type="button" role="radio" aria-checked={p.nivel === n} aria-label={'Top ' + n} style={{ '--m': METAL[n - 1] }}
                    onClick={() => onChange(n)}>
                    <Icono n="estrellaLlena" s={12} />{n}
                </button>
            ))}
        </div>
    );
}

// Con la API: los closers de la app que todavía no están en Team, con lo que les falta para recibir
// agendas (ElegirCloser). Los listos van primero.
function SumarDeLaApp({ disponibles, cargando, vacio, onSumar, bloqueado }) {
    const opciones = disponibles.map(u => ({ id: String(u.id), nombre: u.nombre, calendar: !!u.calendar, whatsapp: !!u.whatsapp, horarios: false }));
    const listos = disponibles.filter(u => u.calendar && u.whatsapp);
    return (
        <section className={'compo caja' + (vacio ? ' compo--solo' : '')}>
            <Humo clase="humo--hero" cols={HUMO_PERSONA} />
            <div className="compo-txt">
                <span className="compo-icono"><Icono n="plus" s={19} /></span>
                <div style={{ display: 'grid', gap: 4 }}><h2 className="t-h3">{vacio ? 'Sumá a tu equipo' : 'Sumar persona'}</h2></div>
            </div>
            <div className="compo-accion">
                {cargando ? <p className="t-sm mut">Cargando la lista de closers…</p>
                    : !opciones.length ? <p className="t-sm mut">Todos los closers activos de la app ya están en Team.</p>
                        : <ElegirCloser opciones={opciones} texto="Elegí un closer de la app" label="Closer de la app" disabled={bloqueado}
                            onElegir={id => onSumar(disponibles.filter(u => String(u.id) === id))} />}
                {listos.length > 1 && (
                    <div className="compo-sug">
                        <button type="button" className="sug" disabled={bloqueado} onClick={() => onSumar(listos)}>
                            <Icono n="users" />Sumar los {listos.length} con Calendar y WhatsApp
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}

const conEmail = (ps) => new Set(ps.map(p => (p.email || '').toLowerCase()).filter(Boolean));

function rolDeUsuario(d, u) {
    if (u.rol !== 'setter') return rolCloser(d);
    const r = ord(d, 'roles').find(x => /setter/i.test(x.nombre));
    return r ? r.id : 'setter';
}

function Persona({ p, ordenable, borrando, setBorrando, sinCuenta, sinCalendar, sinWhatsapp, simularId }) {
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
                        {closer && sinCalendar && <span className="pc-vos" title="No recibe agendas hasta que conecte su Google Calendar en NeurOPS (su menú › Configuración)">Sin Calendar</span>}
                        {closer && sinWhatsapp && <span className="pc-vos" title="No recibe agendas hasta que confirme su WhatsApp en NeurOPS (su menú › Configuración)">Sin WhatsApp</span>}
                        {closer && (sinCalendar || sinWhatsapp) && simularId && (
                            <button type="button" className="pc-link" title={'Entrar como ' + p.nombre + ' a su Configuración'} onClick={() => simularParaConfigurar(simularId)}>
                                <Icono n="mascara" s={12} />Simular para configurar
                            </button>
                        )}
                        {closer
                            ? <><SemanaMini p={p} /><span className="num">{hs ? fmt(hs, 1) + ' h/sem' : 'Sin horario'}</span></>
                            : <span>No toma llamadas</span>}
                    </span>
                </div>
                <div className="pc-ctrl">
                    <Sx sm label="Rol" valor={p.rol} opciones={opcionesRol(d, p.rol)} onChange={v => cambiar({ rol: v })} />
                    {closer ? (
                        <>
                            <Nivel p={p} onChange={v => cambiar({ nivel: v })} />
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
                        <p className="t-sm">¿Eliminar a <b>{p.nombre}</b>? Sale de todas las estrategias.</p>
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
    const { user } = useAuth();
    const rolReal = user?.is_impersonating ? user?.original_user_role : user?.role;
    const simula = SIMULAN_CLOSERS.includes(rolReal);

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

    // Con la API solo se suman usuarios reales, desde el desplegable; en modo local, cualquier nombre.
    const crear = (v) => {
        const n = String(v || '').replace(/\s+/g, ' ').trim();
        if (!n) return 'Escribí un nombre.';
        almacen.crear('personas', {
            nombre: n, rol: rolCloser(d), nivel: Math.min(3, closers(d).length + 1), color: colorLibre(d, 'personas'),
            tz: TZ_DEF, horario: horarioLaV(), orden: maxOrden(d, 'personas') + 1,
        });
        toast(n + ' sumado');
        return '';
    };

    const compo = reales ? (
        <SumarDeLaApp disponibles={disponibles} cargando={usuarios === null} vacio={!ps.length} onSumar={sumarUsuarios} bloqueado={!!sim && !sumar} />
    ) : (
        <Compo vacio={!ps.length} tit="Sumar persona" soloTit="Sumá a tu equipo" ph="Nombre, ej. Giancarlo" onCrear={crear}
            nav={!!sim && sumar} bloqueado={!!sim && !sumar} />
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
                            sinCalendar={reales && cuentas.has((p.email || '').toLowerCase()) && !cuentas.get((p.email || '').toLowerCase()).calendar}
                            sinWhatsapp={reales && cuentas.has((p.email || '').toLowerCase()) && !cuentas.get((p.email || '').toLowerCase()).whatsapp}
                            simularId={simula && cuentas.has((p.email || '').toLowerCase()) && cuentas.get((p.email || '').toLowerCase()).id !== (user && user.id)
                                ? cuentas.get((p.email || '').toLowerCase()).id : null} />
                    ))}
                </div>
            </div>
        </>
    );
}

function porIdsOrden(ps, lista) { return lista.map(id => ps.find(p => p.id === id)).filter(Boolean); }
