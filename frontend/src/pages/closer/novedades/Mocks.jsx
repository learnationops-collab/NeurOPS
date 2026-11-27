import React, { useEffect, useState } from 'react';
import {
    CalendarCheck, PhoneCall, MessageCircle, Flame, Zap, CalendarClock, CalendarX, UserX, CheckCircle2,
    Sun, Sunset, Moon, Inbox, Dumbbell, RefreshCw, MousePointer2, ArrowRight,
} from 'lucide-react';
import Bandera from '../../../components/ficha/tabs/confirmacion/Bandera';

// Las escenas chiquitas de cada novedad (clases `nv-m-*` en novedades.css). Todas se animan solas y
// en bucle, así se siguen viendo mientras se lee la tarjeta. Los datos son de ejemplo.

const PERSONAS = [
    { n: 'M', c: '#FF3FA4' },
    { n: 'J', c: '#22D3EE' },
    { n: 'D', c: '#A78BFF' },
];

// Cuenta de 0 a `n` en `ms` (arranca después de `demora`).
export const useCuenta = (n, ms = 900, demora = 0) => {
    const [v, setV] = useState(0);
    useEffect(() => {
        let raf;
        let t0;
        const paso = (t) => {
            if (t0 === undefined) t0 = t;
            const p = Math.min(1, Math.max(0, (t - t0 - demora) / ms));
            setV(Math.round(n * (1 - (1 - p) ** 3)));
            if (p < 1) raf = requestAnimationFrame(paso);
        };
        raf = requestAnimationFrame(paso);
        return () => cancelAnimationFrame(raf);
    }, [n, ms, demora]);
    return v;
};

const Riel = () => {
    const xp = useCuenta(120, 1100, 900);
    const filas = [
        { Icono: CalendarCheck, lbl: 'Confirmar', n: 3, c: '#FF3FA4' },
        { Icono: PhoneCall, lbl: 'Reportar', n: 2, c: '#22D3EE' },
        { Icono: MessageCircle, lbl: 'Seguir', n: 5, c: '#A78BFF' },
    ];
    return (
        <div className="nv-m nv-m-riel">
            <div className="nv-m-riel__prog">
                <span><em>Confirmación</em><b>7/11</b></span>
                <i><b /></i>
            </div>
            {filas.map((f, k) => (
                <div key={f.lbl} className="nv-m-riel__fila" style={{ '--k': k, '--c': f.c }}>
                    <f.Icono aria-hidden="true" /><em>{f.lbl}</em><b>{f.n}</b>
                </div>
            ))}
            <div className="nv-m-riel__chips">
                <span className="is-racha"><Flame aria-hidden="true" />4 días</span>
                <span className="is-xp"><Zap aria-hidden="true" />{xp} XP</span>
            </div>
        </div>
    );
};

// Los días del calendario: 1 → 3 → 7 columnas, con la tecla que lo hace.
const Dias = () => (
    <div className="nv-m nv-m-dias">
        <div className="nv-m-dias__cal">
            {Array.from({ length: 7 }, (_, i) => (
                <span key={i} className={i === 0 ? 'is-1' : i < 3 ? 'is-3' : 'is-7'}>
                    <em>{['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'][i]}</em>
                    <i style={{ '--y': `${18 + ((i * 37) % 50)}%`, '--c': PERSONAS[i % 3].c }} />
                    {i % 2 === 0 && <i style={{ '--y': `${58 + ((i * 13) % 20)}%`, '--c': PERSONAS[(i + 1) % 3].c }} />}
                </span>
            ))}
        </div>
        <div className="nv-m-dias__teclas" aria-hidden="true">
            <kbd className="is-1">1</kbd><kbd className="is-3">3</kbd><kbd className="is-7">7</kbd><kbd className="is-t">T</kbd>
        </div>
    </div>
);

const ETIQUETAS = [
    { t: 'Closing', c: '#A78BFF' },
    { t: 'Marlon', c: '#22D3EE', punto: true },
    { t: 'Decide sola', c: '#2FBF8F' },
    { t: 'Invierte', c: '#D9A441' },
    { t: '$2.000+', c: '#4E8BD8' },
    { t: 'A', c: '#FF3FA4' },
];

const Llamada = () => (
    <div className="nv-m nv-m-llamada">
        <div className="nv-m-llamada__filtro" aria-hidden="true">
            <span>Triage</span><span>Closing</span><i />
        </div>
        <div className="nv-m-llamada__ev">
            <div className="nv-m-llamada__cab"><b>10:30</b><span>Laura Gómez</span><em><i />Por confirmar</em></div>
            <div className="nv-m-llamada__chips">
                {ETIQUETAS.map((e, k) => (
                    <span key={e.t} style={{ '--c': e.c, '--k': k }}>{e.punto && <i />}{e.t}</span>
                ))}
            </div>
        </div>
    </div>
);

const Tarjeta = () => (
    <div className="nv-m nv-m-tarjeta">
        <div className="nv-m-tarjeta__card">
            <span className="nv-m-tarjeta__av">LG<b>A</b></span>
            <div className="nv-m-tarjeta__datos">
                <b>Laura Gómez</b>
                <span className="nv-m-tarjeta__fila">Invierte · Decide · Instagram</span>
                <span className="nv-m-tarjeta__tel">+52 55 1234 5678</span>
                <span className="nv-m-tarjeta__pais">ENARM · <Bandera c="MX" /> México</span>
            </div>
        </div>
    </div>
);

const Confirmacion = () => (
    <div className="nv-m nv-m-confirmacion">
        <div className="nv-m-confirmacion__tarjetas">
            {[
                { Icono: CalendarClock, t: 'Reprogramar' },
                { Icono: CalendarX, t: 'Canceló' },
                { Icono: UserX, t: 'No show', nuevo: true },
            ].map((x, k) => (
                <span key={x.t} style={{ '--k': k }} className={x.nuevo ? 'is-nuevo' : ''}>
                    <x.Icono aria-hidden="true" />{x.t}{x.nuevo && <em>Nuevo</em>}
                </span>
            ))}
        </div>
        <div className="nv-m-confirmacion__cta"><CheckCircle2 aria-hidden="true" />Listo · 100% confirmado<i /></div>
    </div>
);

// Personas con su color → días con horarios → horas (una superpuesta, una elegida) → el resumen con banderas.
const Reprogramar = () => {
    const dias = [0, 1, 0, 2, 3, 0, 1, 2, 0, 3, 1, 0, 2, 0];
    const horas = [
        { h: '09:00', c: [0] }, { h: '09:30', c: [1] }, { h: '10:00', c: [0, 2] }, { h: '10:30', c: [1], sel: true },
        { h: '15:00', c: [2] }, { h: '15:30', c: [0, 1] }, { h: '19:00', c: [1] }, { h: '19:30', c: [2] },
    ];
    return (
        <div className="nv-m nv-m-reprog">
            <div className="nv-m-reprog__personas">
                {PERSONAS.map((p, k) => (
                    <span key={p.n} style={{ '--c': p.c, '--k': k }} className={k === 1 ? 'is-toque' : ''}>{p.n}</span>
                ))}
                <MousePointer2 className="nv-m-reprog__puntero" aria-hidden="true" />
            </div>
            <div className="nv-m-reprog__mes">
                {dias.map((d, k) => (
                    <span key={k} style={{ '--k': k }} className={d ? 'is-libre' : ''}>
                        {d > 0 && Array.from({ length: d }, (_, j) => <i key={j} style={{ background: PERSONAS[(k + j) % 3].c }} />)}
                    </span>
                ))}
            </div>
            <div className="nv-m-reprog__horas">
                {horas.map((x, k) => (
                    <span key={x.h} style={{ '--k': k }} className={`${x.sel ? 'is-sel' : ''}${x.c.length > 1 ? ' is-doble' : ''}`}>
                        {k === 0 && <Sun aria-hidden="true" />}{k === 4 && <Sunset aria-hidden="true" />}{k === 6 && <Moon aria-hidden="true" />}
                        {x.h}
                        <em>{x.c.map(i => <i key={i} style={{ background: PERSONAS[i].c }} />)}</em>
                    </span>
                ))}
            </div>
            <div className="nv-m-reprog__resumen">
                <Bandera c="CO" /><b>10:30</b><ArrowRight aria-hidden="true" />
                <i style={{ background: PERSONAS[1].c }} />Julián · 09:30 <Bandera c="MX" />
            </div>
        </div>
    );
};

const Horario = () => {
    const cupos = useCuenta(23, 1200, 2200);
    return (
        <div className="nv-m nv-m-horario">
            <div className="nv-m-horario__cal">
                {['Lu', 'Ma', 'Mi', 'Ju', 'Vi'].map((d, k) => (
                    <span key={d} style={{ '--k': k }}>
                        <em>{d}</em>
                        <i className={k === 0 ? 'is-fijo' : k <= 3 ? 'is-arrastre' : ''} style={{ '--k': k }} />
                    </span>
                ))}
                <MousePointer2 className="nv-m-horario__puntero" aria-hidden="true" />
            </div>
            <div className="nv-m-horario__cupos"><b>{cupos}</b><em>cupos libres · 7 días</em></div>
        </div>
    );
};

const Extras = () => (
    <div className="nv-m nv-m-extras">
        {[
            { Icono: Inbox, t: '«Esperan respuesta» muestra primero el último mensaje', c: '#22D3EE' },
            { Icono: Dumbbell, t: 'Un «Training» tuyo en Google Calendar ocupa tu agenda', c: '#A78BFF' },
            { Icono: RefreshCw, t: 'Si Work se actualiza, reintenta solo: sin errores', c: '#2FBF8F' },
        ].map((x, k) => (
            <span key={x.t} style={{ '--c': x.c, '--k': k }}><x.Icono aria-hidden="true" />{x.t}</span>
        ))}
    </div>
);

const MOCKS = {
    riel: Riel, dias: Dias, llamada: Llamada, tarjeta: Tarjeta, confirmacion: Confirmacion,
    reprogramar: Reprogramar, horario: Horario, extras: Extras,
};

const Mock = ({ tipo }) => {
    const Componente = MOCKS[tipo];
    return Componente ? <Componente /> : null;
};

export default Mock;
