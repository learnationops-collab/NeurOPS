// Fondos de la entrada (el login y el Portal), como la referencia de Learnation Holding. Se elige en
// Configuración › Apariencia (temas/TabApariencia.jsx) y queda guardado en este navegador; el login lo
// usa aunque todavía no se sepa quién entra:
//   light       «Simple»: gradientes y una grilla tenue, se pinta una vez (por defecto, el más liviano).
//   humo        humo en WebGL que sigue al mouse, con viñeta.
//   particulas  brasas que suben lento sobre el fondo light.
//   aurora      manchas de color que flotan (el fondo de antes).
// Con «reducir movimiento» del sistema, o si el equipo no da (menos de 20 cuadros por segundo), vuelve a light.

import { useEffect, useRef, useState } from 'react';

export const FONDOS = [
    ['light', 'Simple', 'Quieto, el más liviano'],
    ['humo', 'Humo', 'Sigue al mouse'],
    ['particulas', 'Partículas', 'Brasas que suben'],
    ['aurora', 'Aurora', 'Manchas de color'],
];
const CLAVE = 'ln-fondo-entrada';
const reducido = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function leer() {
    try { const v = localStorage.getItem(CLAVE); return FONDOS.some(f => f[0] === v) ? v : 'light'; } catch { return 'light'; }
}

/**
 * [fondo, cambiar, elegido]: el fondo que se pinta (con «reducir movimiento» del sistema, siempre el
 * simple) y el elegido en este navegador, que es el que muestra Apariencia.
 */
export function useFondo() {
    const [elegido, setElegido] = useState(leer);
    const cambiar = (v) => { setElegido(v); try { localStorage.setItem(CLAVE, v); } catch { /* sin storage */ } };
    return [reducido() ? 'light' : elegido, cambiar, elegido];
}

export const movimientoReducido = reducido;

// --- Humo: shader con ruido fractal deformado, a media resolución -------------------------------
const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
const FS = `precision highp float;
uniform vec2 r; uniform float t; uniform vec2 m;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float a = .5, s = 0.; for(int i = 0; i < 5; i++){ s += a * n(p); p = p*2.03 + vec2(1.7, 9.2); a *= .5; } return s; }
void main(){
  vec2 uv = gl_FragCoord.xy / r; float asp = r.x / r.y;
  vec2 p = (uv - .5) * vec2(asp, 1.); vec2 mm = (m - .5) * vec2(asp, 1.);
  float tm = t * .045;
  vec2 d = p - mm; float md = exp(-dot(d, d) * 7.); vec2 sw = vec2(-d.y, d.x) * md * 1.1;
  vec2 q = vec2(fbm(p*1.5 + tm), fbm(p*1.5 + vec2(5.2, 1.3) - tm)) + sw;
  vec2 w = vec2(fbm(p*1.3 + 3.2*q + vec2(1.7, 9.2) + tm*1.6), fbm(p*1.3 + 3.2*q + vec2(8.3, 2.8) - tm*1.3));
  float f = fbm(p*1.15 + 3.4*w);
  vec3 navy = vec3(.020, .024, .082), indigo = vec3(.150, .130, .560), violet = vec3(.380, .210, .760), magenta = vec3(.900, .200, .560), blue = vec3(.080, .420, .860);
  float pinkZone = exp(-pow(length((uv - vec2(.17, .28)) * vec2(1.0, 1.25)), 2.) * 4.2);
  float blueZone = exp(-pow(length((uv - vec2(.80, .55)) * vec2(1.1, 1.0)), 2.) * 5.0);
  float topDark = smoothstep(.45, 1., uv.y) * smoothstep(.55, 1., uv.x);
  float midViolet = exp(-pow(length((uv - vec2(.47, .65)) * vec2(1.0, 1.3)), 2.) * 4.5);
  vec3 c = mix(navy, indigo, smoothstep(.15, .75, f));
  c = mix(c, violet, midViolet * smoothstep(.25, .8, f) * .9);
  c = mix(c, magenta, pinkZone * smoothstep(.2, .85, f + w.x*.35) * 1.05);
  c = mix(c, blue, blueZone * smoothstep(.25, .9, f + w.y*.3) * .95);
  c = mix(c, navy, topDark * .8);
  float wisp = pow(smoothstep(.42, .72, f), 3.) * (.3 + .7*smoothstep(.3,.9,w.x));
  c += wisp * (magenta*.22*pinkZone + blue*.22*blueZone + violet*.12);
  c += (magenta*.5 + violet*.4) * md * .13;
  c += (h(gl_FragCoord.xy + t) - .5) * .028;
  c *= 1. - .35 * pow(length(uv - .5) * 1.25, 2.);
  gl_FragColor = vec4(c, 1.);
}`;

function humo(cv) {
    const gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) return null;
    const sh = (tipo, src) => { const s = gl.createShader(tipo); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
    const v = sh(gl.VERTEX_SHADER, VS), f = sh(gl.FRAGMENT_SHADER, FS);
    if (!v || !f) return null;
    const pr = gl.createProgram(); gl.attachShader(pr, v); gl.attachShader(pr, f); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uR = gl.getUniformLocation(pr, 'r'), uT = gl.getUniformLocation(pr, 't'), uM = gl.getUniformLocation(pr, 'm');
    const t0 = performance.now();
    return {
        tam() { cv.width = Math.max(2, Math.floor(innerWidth * 0.5)); cv.height = Math.max(2, Math.floor(innerHeight * 0.5)); gl.viewport(0, 0, cv.width, cv.height); },
        pintar(ahora, raton) {
            gl.uniform2f(uR, cv.width, cv.height); gl.uniform1f(uT, (ahora - t0) / 1000 + 6); gl.uniform2f(uM, raton.x, raton.y);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        },
    };
}

// --- Partículas: brasas que suben ---------------------------------------------------------------
function brasas(cv) {
    const ctx = cv.getContext('2d');
    if (!ctx) return null;
    const COLORES = ['255,255,255', '255,150,215', '170,190,255', '255,210,240'];
    let W = 0, H = 0, ps = [], ultimo = performance.now();
    const nueva = (ini) => ({ x: Math.random() * W, y: ini ? Math.random() * H : H + 10, r: 0.5 + Math.random() * 1.8, vy: 0.12 + Math.random() * 0.42,
        vx: (Math.random() - 0.5) * 0.18, a: 0.15 + Math.random() * 0.6, ph: Math.random() * 6.28, sp: 0.4 + Math.random() * 1.2, c: COLORES[(Math.random() * 4) | 0], z: Math.random() });
    return {
        tam() {
            const dpr = Math.min(devicePixelRatio || 1, 1.5);
            W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ps = Array.from({ length: Math.round(Math.min(80, (W * H) / 18000)) }, () => nueva(true));
        },
        pintar(ahora, raton) {
            const dt = Math.min(2.5, (ahora - ultimo) / 16.67); ultimo = ahora;
            ctx.clearRect(0, 0, W, H);
            ps.forEach((p, i) => {
                p.ph += 0.01 * p.sp * dt; p.y -= p.vy * dt * (0.5 + p.z); p.x += (p.vx + Math.sin(p.ph) * 0.22) * dt;
                const dx = p.x - raton.x * W, dy = p.y - (1 - raton.y) * H, d2 = dx * dx + dy * dy;
                if (d2 < 14000) { const k = (1 - d2 / 14000) * 0.9; p.x += dx * 0.02 * k * dt; p.y += dy * 0.02 * k * dt; }
                if (p.y < -12 || p.x < -12 || p.x > W + 12) ps[i] = nueva(false);
                const tw = 0.6 + 0.4 * Math.sin(p.ph * 2.2), g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
                g.addColorStop(0, `rgba(${p.c},${p.a * tw})`); g.addColorStop(1, `rgba(${p.c},0)`);
                ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 5, 0, 6.283); ctx.fill();
            });
        },
    };
}

/** El fondo animado detrás de la entrada. onLento: el equipo no da para este fondo (se vuelve a light). */
export default function FondoEntrada({ fondo, onLento }) {
    const cv = useRef(null);
    const lento = useRef(onLento);
    useEffect(() => { lento.current = onLento; });

    useEffect(() => {
        if ((fondo !== 'humo' && fondo !== 'particulas') || !cv.current || reducido()) return undefined;
        const motor = fondo === 'humo' ? humo(cv.current) : brasas(cv.current);
        if (!motor) { lento.current?.(); return undefined; }
        const raton = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
        const mover = (e) => { raton.tx = e.clientX / innerWidth; raton.ty = 1 - e.clientY / innerHeight; };
        let raf = 0, tam = 0, desde = performance.now() + 1800, cuadros = 0, lentas = 0;
        const cuadro = (ahora) => {
            raf = requestAnimationFrame(cuadro);
            raton.x += (raton.tx - raton.x) * 0.06; raton.y += (raton.ty - raton.y) * 0.06;
            motor.pintar(ahora, raton);
            // Freno: dos ventanas seguidas de 2 s por debajo de 20 cuadros por segundo.
            if (ahora < desde) return;
            cuadros++;
            if (ahora - desde >= 2000) {
                lentas = cuadros * 1000 / (ahora - desde) < 20 ? lentas + 1 : 0;
                desde = ahora; cuadros = 0;
                if (lentas >= 2) { cancelAnimationFrame(raf); lento.current?.(); }
            }
        };
        const redimensionar = () => { clearTimeout(tam); tam = setTimeout(() => motor.tam(), 120); };
        motor.tam();
        raf = requestAnimationFrame(cuadro);
        addEventListener('pointermove', mover);
        addEventListener('resize', redimensionar);
        return () => { cancelAnimationFrame(raf); clearTimeout(tam); removeEventListener('pointermove', mover); removeEventListener('resize', redimensionar); };
    }, [fondo]);

    return (
        <div className={'fe fe--' + fondo} aria-hidden="true">
            {fondo === 'aurora' && <div className="lg-fondo fe-aurora"><i /><i /><i /></div>}
            {(fondo === 'humo' || fondo === 'particulas') && <canvas key={fondo} ref={cv} className="fe-lienzo" />}
            {fondo === 'humo' && <div className="fe-vineta" />}
        </div>
    );
}
