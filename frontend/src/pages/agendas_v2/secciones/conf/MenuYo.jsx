// Botón de perfil arriba a la derecha y su menú: Hours, Mi perfil y el simulador de roles.

import { useEffect, useRef } from 'react';
import { Avatar, Icono } from '../../ui/base';
import { ui } from '../../ui/estadoUi';
import { useDatos, useUi } from '../../data/hooks';
import { buscar, colorRol, esCloser, horasSemana, nombreRol, ord } from '../../core/datos';
import { nombreSim, rolSim, yoPersona } from '../../core/permisos';
import { fmt, iniciales } from '../../core/util';
import { irA } from '../../ui/navegacion';
import { iniciarSim, salirSim } from './simulacion';

function FotoPerfil({ perfil, nom }) {
    return <span className="yo-av">{perfil.foto ? <img src={perfil.foto} alt="" /> : iniciales(nom || '?')}</span>;
}

function BotonYo({ abierto, onClick, btnRef }) {
    const { d, perfil } = useDatos();
    const { sim } = useUi();
    const nom = (perfil.nombre + ' ' + perfil.apellido).trim();
    let cuerpo;
    if (sim) {
        const sp = sim.tipo === 'persona' && buscar(d, 'personas', sim.id), sr = rolSim(d, sim);
        cuerpo = (
            <>
                <span className="yo-av yo-av--sim" style={{ '--c': colorRol(sr) }}>
                    {sp ? (sp.foto ? <img src={sp.foto} alt="" /> : iniciales(sp.nombre)) : <Icono n={sr.icono || 'users'} s={18} />}
                    <i className="yo-sim-badge"><Icono n="mascara" s={11} /></i>
                </span>
                <span className="yo-txt"><b>{nombreSim(d, sim)}</b><span>{sp ? sr.nombre + ' · ' : ''}Simulación</span></span>
            </>
        );
    } else {
        cuerpo = (
            <>
                <FotoPerfil perfil={perfil} nom={nom} />
                <span className="yo-txt"><b>{nom || 'Tu perfil'}</b><span>{nombreRol(d, perfil.funcion) || 'Configurar'}</span></span>
            </>
        );
    }
    return (
        <button ref={btnRef} type="button" className={'yo' + (sim ? ' yo--sim' : '')} id="yo" data-nav="" aria-haspopup="menu" aria-expanded={abierto}
            aria-label="Tu perfil y simulador" onClick={onClick}>
            {cuerpo}
        </button>
    );
}

function MenuPrincipal() {
    const { d, perfil } = useDatos();
    const { sim } = useUi();
    const nom = (perfil.nombre + ' ' + perfil.apellido).trim() || 'Tu perfil';
    const yo = yoPersona(d, sim, perfil);
    const abrirPerfil = () => ui.set({ menu: null, conf: { tab: 'perfil' }, crear: false });
    return (
        <>
            <div className="ym-cab">
                <FotoPerfil perfil={perfil} nom={nom} />
                <div><b>{nom}</b><span>{sim ? 'Simulando ' + nombreSim(d, sim) : nombreRol(d, perfil.funcion) || 'Sin función'}</span></div>
            </div>
            {yo && esCloser(d, yo) ? (
                <button type="button" className="ym-op" role="menuitem" onClick={() => { ui.set({ menu: null }); irA('horas'); }}>
                    <Icono n="clock" /><span>Hours<em>{horasSemana(yo) ? fmt(horasSemana(yo), 1) + ' h/sem' : 'Sin cargar'}</em></span>
                </button>
            ) : !sim && !yo ? (
                <button type="button" className="ym-op" role="menuitem" onClick={abrirPerfil}>
                    <Icono n="clock" /><span>Mi horario<em>Vinculá tu persona de Team</em></span>
                </button>
            ) : null}
            <button type="button" className="ym-op" role="menuitem" onClick={abrirPerfil}><Icono n="ajustes" /><span>Mi perfil</span></button>
            <i className="ym-sep" />
            <button type="button" className="ym-op" role="menuitem" aria-haspopup="menu" onClick={() => ui.set({ menu: 'rol' })}>
                <Icono n="users" /><span>Simular un rol</span><Icono n="chevron-right" s={15} />
            </button>
            <button type="button" className="ym-op" role="menuitem" aria-haspopup="menu" onClick={() => ui.set({ menu: 'persona' })}>
                <Icono n="user" /><span>Simular a una persona</span><Icono n="chevron-right" s={15} />
            </button>
            {sim && (
                <>
                    <i className="ym-sep" />
                    <button type="button" className="ym-op" role="menuitem" onClick={salirSim}><Icono n="rotar" /><span>Volver a mi sesión</span></button>
                </>
            )}
        </>
    );
}

function SubmenuSim({ rol }) {
    const { d } = useDatos();
    const { sim } = useUi();
    const xs = rol ? ord(d, 'roles') : ord(d, 'personas');
    return (
        <>
            <div className="ym-sub">
                <button type="button" className="ibtn ibtn--xs" aria-label="Volver" onClick={() => ui.set({ menu: 'main' })}><Icono n="volver" /></button>
                <b>{rol ? 'Simular un rol' : 'Simular a una persona'}</b>
            </div>
            {xs.length ? xs.map(x => {
                const on = !!(sim && sim.id === x.id);
                return (
                    <button key={x.id} type="button" className={'ym-op' + (on ? ' ym-op--on' : '')} role="menuitemradio" aria-checked={on}
                        onClick={() => iniciarSim({ tipo: rol ? 'rol' : 'persona', id: x.id })}>
                        {rol ? <span className="rol-ico" style={{ '--c': colorRol(x) }}><Icono n={x.icono} s={15} /></span> : <Avatar p={x} clase="avatar--sm" />}
                        <span>{x.nombre}{!rol && <em>{nombreRol(d, x.rol) || ''}</em>}</span>
                        {on && <Icono n="check" s={15} />}
                    </button>
                );
            }) : <p className="t-sm mut" style={{ padding: '8px 10px' }}>Nada para simular.</p>}
        </>
    );
}

export default function MenuYo() {
    const { menu } = useUi();
    const caja = useRef(null), btn = useRef(null), pop = useRef(null);

    // Clic afuera o Escape cierran el menú.
    useEffect(() => {
        if (!menu) return;
        const fuera = (e) => { if (document.contains(e.target) && !caja.current?.contains(e.target)) ui.set({ menu: null }); };
        const tecla = (e) => {
            if (e.key !== 'Escape' || e.defaultPrevented) return;
            e.preventDefault();
            ui.set({ menu: null });
            btn.current?.focus();
        };
        document.addEventListener('click', fuera);
        document.addEventListener('keydown', tecla);
        return () => { document.removeEventListener('click', fuera); document.removeEventListener('keydown', tecla); };
    }, [menu]);

    // Al entrar a un submenú, el foco va a la primera opción.
    useEffect(() => {
        if (menu === 'rol' || menu === 'persona') pop.current?.querySelector('.ym-op')?.focus();
    }, [menu]);

    // Flechas arriba/abajo para moverse entre opciones.
    const flechas = (e) => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        const ops = [...pop.current.querySelectorAll('button')];
        if (!ops.length) return;
        e.preventDefault();
        const i = ops.indexOf(document.activeElement);
        ops[(i + (e.key === 'ArrowDown' ? 1 : -1) + ops.length) % ops.length].focus();
    };

    return (
        <div className="yo-caja" ref={caja}>
            <BotonYo btnRef={btn} abierto={!!menu} onClick={() => ui.set({ menu: menu ? null : 'main' })} />
            {menu && (
                <div className="yo-menu" id="yo-menu" role="menu" aria-label="Perfil y simulador" ref={pop} onKeyDown={flechas}>
                    {menu === 'main' ? <MenuPrincipal /> : <SubmenuSim rol={menu === 'rol'} />}
                </div>
            )}
        </div>
    );
}
