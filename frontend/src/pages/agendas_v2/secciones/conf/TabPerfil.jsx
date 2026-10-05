// Configuración › Perfil: foto, nombre, función, tu disponibilidad (tu persona de Team) y apariencia.

import { useState } from 'react';
import { Icono, Sx, leerFoto } from '../../ui/base';
import { ui } from '../../ui/estadoUi';
import { toast } from '../../ui/toast';
import { almacen, useDatos, useUi } from '../../data/hooks';
import { detectarPais } from '../../core/catalogos';
import { buscar, colorLibre, maxOrden, ord, rolCloser } from '../../core/datos';
import { iniciales } from '../../core/util';
import { InputVivo, useDiferido } from './campos';
import { HorarioEditor } from '../team/Horario';

const TEMAS = [['oscuro', 'Oscuro', 'luna'], ['claro', 'Claro', 'sol'], ['sistema', 'Sistema', 'sistema']];

function sumarmeATeam(d, perfil) {
    const nombre = (perfil.nombre + ' ' + perfil.apellido).trim() || 'Yo', horario = {};
    for (let i = 0; i < 7; i++) horario[i] = i >= 1 && i <= 5 ? [['09:00', '18:00']] : [];
    const id = almacen.crear('personas', {
        nombre, rol: rolCloser(d), nivel: 1, color: colorLibre(d, 'personas'), tz: detectarPais().tz, horario, foto: perfil.foto,
        orden: maxOrden(d, 'personas') + 1,
    });
    almacen.guardarPerfil({ persona: id });
    toast('Te sumamos a Team');
}

function Disponibilidad({ d, perfil }) {
    const yo = buscar(d, 'personas', perfil.persona);
    return (
        <>
            <p className="t-eyebrow">Tu disponibilidad</p>
            <div className="disp">
                <div className="horario-barra">
                    <Sx id="pf-persona" label="Sos en Team" valor={yo ? yo.id : ''} onChange={v => almacen.guardarPerfil({ persona: v })}
                        opciones={[{ v: '', n: '¿Quién sos en Team?' }, ...ord(d, 'personas').map(x => ({ v: x.id, n: x.nombre }))]} />
                    {!yo && (
                        <button type="button" className="btn btn--linea btn--sm" onClick={() => sumarmeATeam(d, perfil)}><Icono n="plus" />Sumarme a Team</button>
                    )}
                </div>
                {yo && <div style={{ display: 'grid', gap: 12 }}><HorarioEditor p={yo} /></div>}
            </div>
        </>
    );
}

export default function TabPerfil() {
    const { d, perfil } = useDatos();
    const { tema } = useUi();
    // Nombre y apellido se ven al instante en las iniciales; se guardan con una pausa.
    const [borrador, setBorrador] = useState({});
    const guardar = useDiferido((cambios) => { almacen.guardarPerfil(cambios); setBorrador({}); });
    const p = { ...perfil, ...borrador };
    const escribir = (k, v) => { const n = { ...borrador, [k]: v }; setBorrador(n); guardar(n); };

    const subirFoto = (e) => {
        const f = e.target.files && e.target.files[0];
        e.target.value = '';
        e.target.blur();
        leerFoto(f).then(u => { almacen.guardarPerfil({ foto: u }); toast('Foto guardada'); }, err => toast(err.message, 'error'));
    };
    const funcion = (ord(d, 'roles').find(r => p.funcion === r.id || p.funcion === r.nombre) || {}).id || '';

    return (
        <>
            <p className="t-eyebrow">Quién sos</p>
            <div className="perfil">
                <div className="perfil-foto">
                    <label className="avatar-g foto" title="Cambiar foto">
                        <span id="pf-avatar">{p.foto ? <img src={p.foto} alt="" /> : iniciales(p.nombre + ' ' + p.apellido)}</span>
                        <span className="foto-pista">Cambiar foto</span>
                        <input type="file" accept="image/*" id="pf-foto" aria-label="Foto de perfil" onChange={subirFoto} />
                    </label>
                    {p.foto && (
                        <button type="button" className="link-btn" style={{ color: 'var(--text-muted)' }} onClick={() => almacen.guardarPerfil({ foto: '' })}>Quitar foto</button>
                    )}
                </div>
                <div>
                    {[['nombre', 'Nombre'], ['apellido', 'Apellido']].map(([k, n]) => (
                        <div key={k} className="pcampo">
                            <label className="t-eyebrow" htmlFor={'pf-' + k}>{n}</label>
                            <InputVivo className="input" id={'pf-' + k} maxLength={60} valor={p[k]} onCambio={v => escribir(k, v)} />
                        </div>
                    ))}
                    <div className="pcampo">
                        <label className="t-eyebrow" htmlFor="pf-funcion">Función</label>
                        <Sx id="pf-funcion" label="Función" valor={funcion} onChange={v => almacen.guardarPerfil({ funcion: v })}
                            style={{ height: 50, borderRadius: 999, paddingLeft: 22, fontSize: 16 }}
                            opciones={[{ v: '', n: 'Elegí tu función' }, ...ord(d, 'roles').map(r => ({ v: r.id, n: r.nombre }))]} />
                    </div>
                </div>
            </div>
            <Disponibilidad d={d} perfil={perfil} />
            <p className="t-eyebrow">Apariencia</p>
            <div className="apariencia" role="group" aria-label="Apariencia">
                {TEMAS.map(([v, n, ico]) => (
                    <button key={v} type="button" data-nav="" aria-pressed={tema === v} onClick={() => ui.set({ tema: v })}><Icono n={ico} />{n}</button>
                ))}
            </div>
        </>
    );
}
