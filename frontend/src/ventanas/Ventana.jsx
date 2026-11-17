// Una ventana flotante, como las «Ventanas v2» de la Academia (`modal/sheet.blade.php`): se arrastra por la
// cabecera; soltada a menos de SNAP px del borde de arriba pasa a pantalla completa y del de abajo se
// minimiza al dock (con una guía mientras se arrastra). Doble clic en la cabecera maximiza; arrastrar una
// maximizada la restaura. Escape la minimiza. En un teléfono es una hoja de abajo, sin arrastre.
// No tapa la pantalla: se sigue trabajando debajo (no es un modal).

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Minimize2, Minus, X } from 'lucide-react';
import { IconButton } from '../components/standard';
import { cerrarVentana, enfocarVentana, maximizarVentana, minimizarVentana, moverVentana } from './ventanasStore';

const SNAP = 24;
const ARRIBA = 16;          // lo más arriba que queda una ventana suelta
const MOVIL = '(max-width: 640px)';

const useMovil = () => {
    const [movil, setMovil] = useState(() => window.matchMedia(MOVIL).matches);
    useEffect(() => {
        const m = window.matchMedia(MOVIL);
        const cambio = () => setMovil(m.matches);
        m.addEventListener('change', cambio);
        return () => m.removeEventListener('change', cambio);
    }, []);
    return movil;
};

const ancho = (h) => Math.min(h.ancho || 720, window.innerWidth - 32);
const posInicial = (h) => ({ x: Math.max(16, (window.innerWidth - ancho(h)) / 2), y: 72 });
const acotar = (pos, h) => ({
    x: Math.min(Math.max(pos.x, 16 - ancho(h) + 120), window.innerWidth - 120),
    y: Math.min(Math.max(pos.y, ARRIBA), window.innerHeight - 80),
});

export default function Ventana({ item, h, children }) {
    const movil = useMovil();
    const [arrastre, setArrastre] = useState(null);   // {x, y} mientras se arrastra
    const [guia, setGuia] = useState(null);           // 'max' | 'min' | null
    const inicio = useRef(null);
    const minimizada = item.estado === 'minimizada';
    const max = (item.max || movil) && !arrastre;
    const pos = arrastre || item.pos || posInicial(h);

    const empezar = (e) => {
        if (movil || e.button > 0 || e.target.closest('button')) return;
        e.preventDefault();
        const desde = item.max ? { x: e.clientX - ancho(h) / 2, y: ARRIBA } : pos;
        inicio.current = { px: e.clientX, py: e.clientY, ...desde };
        const mover = (ev) => {
            const s = inicio.current;
            setArrastre({ x: s.x + ev.clientX - s.px, y: s.y + ev.clientY - s.py });
            setGuia(ev.clientY < SNAP ? 'max' : ev.clientY > window.innerHeight - SNAP ? 'min' : null);
        };
        const soltar = (ev) => {
            document.removeEventListener('pointermove', mover);
            document.removeEventListener('pointerup', soltar);
            const s = inicio.current;
            inicio.current = null;
            setArrastre(null);
            setGuia(null);
            if (ev.clientY < SNAP) maximizarVentana(item.key, true);
            else if (ev.clientY > window.innerHeight - SNAP) minimizarVentana(item.key);
            else if (s) moverVentana(item.key, acotar({ x: s.x + ev.clientX - s.px, y: s.y + ev.clientY - s.py }, h));
        };
        document.addEventListener('pointermove', mover);
        document.addEventListener('pointerup', soltar);
    };

    const teclas = (e) => {
        if (e.key === 'Escape' && !e.defaultPrevented) {
            e.stopPropagation();
            minimizarVentana(item.key);
        }
    };

    const clases = ['vt', max && 'vt--max', movil && 'vt--hoja', arrastre && 'vt--arrastre'].filter(Boolean).join(' ');
    const estilo = max ? { zIndex: 1000 + item.z } : { zIndex: 1000 + item.z, left: pos.x, top: pos.y, width: ancho(h) };
    return createPortal(
        <>
            {guia && (
                <div className={`vt-guia vt-guia--${guia}`} aria-hidden="true">
                    {guia === 'max' ? 'Soltá para pantalla completa' : 'Soltá para minimizar al dock'}
                </div>
            )}
            <section className={clases} style={estilo} hidden={minimizada} role="dialog" aria-label={h.label}
                onPointerDown={() => enfocarVentana(item.key)} onKeyDown={teclas}>
                <header className="vt-cab" onPointerDown={empezar} onDoubleClick={() => !movil && maximizarVentana(item.key, !item.max)}>
                    <h.Icono size={16} aria-hidden="true" />
                    <b className="vt-titulo">{h.label}</b>
                    <span className="vt-controles">
                        <IconButton size="sm" label="Minimizar al dock" icon={<Minus size={15} />} onClick={() => minimizarVentana(item.key)} />
                        {!movil && (
                            <IconButton size="sm" label={item.max ? 'Restaurar' : 'Pantalla completa'}
                                icon={item.max ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                                onClick={() => maximizarVentana(item.key, !item.max)} />
                        )}
                        <IconButton size="sm" label="Cerrar" icon={<X size={15} />} onClick={() => cerrarVentana(item.key)} />
                    </span>
                </header>
                <div className="vt-cuerpo">{children}</div>
            </section>
        </>,
        document.body,
    );
}
