// Botón de perfil arriba a la derecha y su menú: Hours, Mi perfil y «Simular a un closer».
//
// «Simular a un closer» es la simulación OFICIAL de NeurOPS (POST /auth/impersonate, la misma del menú
// de sesión del dashboard comercial): entra como ese closer a SU pantalla real y se vuelve con «Volver a
// mi sesión». Thalamus ya no tiene un simulador propio de roles.

import { useEffect, useRef, useState } from 'react';
import api from '../../../../services/api';
import { simularA } from '../../../../utils/impersonation';
import { Icono } from '../../ui/base';
import { ui } from '../../ui/estadoUi';
import { useDatos, useUi } from '../../data/hooks';
import { esCloser, horasSemana, nombreRol } from '../../core/datos';
import { yoPersona } from '../../core/permisos';
import { fmt, iniciales } from '../../core/util';
import { irA } from '../../ui/navegacion';
import { toast } from '../../ui/toast';

function FotoPerfil({ perfil, nom }) {
    return <span className="yo-av">{perfil.foto ? <img src={perfil.foto} alt="" /> : iniciales(nom || '?')}</span>;
}

function BotonYo({ abierto, onClick, btnRef }) {
    const { d, perfil } = useDatos();
    const nom = (perfil.nombre + ' ' + perfil.apellido).trim();
    return (
        <button ref={btnRef} type="button" className="yo" id="yo" data-nav="" aria-haspopup="menu" aria-expanded={abierto}
            aria-label="Tu perfil" onClick={onClick}>
            <FotoPerfil perfil={perfil} nom={nom} />
            <span className="yo-txt"><b>{nom || 'Tu perfil'}</b><span>{nombreRol(d, perfil.funcion) || 'Configurar'}</span></span>
        </button>
    );
}

function MenuPrincipal() {
    const { d, perfil } = useDatos();
    const nom = (perfil.nombre + ' ' + perfil.apellido).trim() || 'Tu perfil';
    const yo = yoPersona(d, null, perfil);
    const abrirPerfil = () => ui.set({ menu: null, conf: { tab: 'perfil' }, crear: false });
    return (
        <>
            <div className="ym-cab">
                <FotoPerfil perfil={perfil} nom={nom} />
                <div><b>{nom}</b><span>{nombreRol(d, perfil.funcion) || 'Sin función'}</span></div>
            </div>
            {yo && esCloser(d, yo) ? (
                <button type="button" className="ym-op" role="menuitem" onClick={() => { ui.set({ menu: null }); irA('horas'); }}>
                    <Icono n="clock" /><span>Hours<em>{horasSemana(yo) ? fmt(horasSemana(yo), 1) + ' h/sem' : 'Sin cargar'}</em></span>
                </button>
            ) : !yo ? (
                <button type="button" className="ym-op" role="menuitem" onClick={abrirPerfil}>
                    <Icono n="clock" /><span>Mi horario<em>Vinculá tu persona de Team</em></span>
                </button>
            ) : null}
            <button type="button" className="ym-op" role="menuitem" onClick={abrirPerfil}><Icono n="ajustes" /><span>Mi perfil</span></button>
            <i className="ym-sep" />
            <button type="button" className="ym-op" role="menuitem" aria-haspopup="menu" onClick={() => ui.set({ menu: 'closers' })}>
                <Icono n="mascara" /><span>Simular a un closer<em>Entrás a su NeurOPS</em></span><Icono n="chevron-right" s={15} />
            </button>
        </>
    );
}

// Los closers que el backend deja simular (GET /auth/impersonate/closers), igual que el dashboard comercial.
function SubmenuCloseres() {
    const [closers, setCloseres] = useState(null);
    useEffect(() => {
        let vivo = true;
        api.get('/auth/impersonate/closers')
            .then(r => { if (vivo) setCloseres(r.data?.closers || []); })
            .catch(() => { if (vivo) setCloseres([]); });
        return () => { vivo = false; };
    }, []);
    const simular = async (c) => {
        toast('Entrando como ' + c.username + '…');
        try { await simularA(c.id); } catch (e) {
            toast(e?.response?.status === 403 ? 'No podés simular a ' + c.username : 'No se pudo simular a ' + c.username, 'error');
        }
    };
    return (
        <>
            <div className="ym-sub">
                <button type="button" className="ibtn ibtn--xs" aria-label="Volver" onClick={() => ui.set({ menu: 'main' })}><Icono n="volver" /></button>
                <b>Simular a un closer</b>
            </div>
            {closers === null ? <p className="t-sm mut" style={{ padding: '8px 10px' }}>Cargando…</p>
                : closers.length ? closers.map(c => (
                    <button key={c.id} type="button" className="ym-op" role="menuitem" onClick={() => simular(c)}>
                        <span className="yo-av yo-av--sm">{iniciales(c.username)}</span><span>{c.username}</span>
                    </button>
                )) : <p className="t-sm mut" style={{ padding: '8px 10px' }}>No hay closers activos.</p>}
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
        if (menu === 'closers') pop.current?.querySelector('.ym-op, .ibtn')?.focus();
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
                <div className="yo-menu" id="yo-menu" role="menu" aria-label="Tu perfil" ref={pop} onKeyDown={flechas}>
                    {menu === 'closers' ? <SubmenuCloseres /> : <MenuPrincipal />}
                </div>
            )}
        </div>
    );
}
