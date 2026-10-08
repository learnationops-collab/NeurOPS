import { TOP_ABANDONO, agruparPorBloque, masAbandonadas } from '../lib/embudoFormulario';

/**
 * Embudo del formulario: una barra por pregunta (ancho = % de postulaciones que llegaron hasta
 * ahí), agrupadas por bloque. Sirve para ver DÓNDE se queda la gente dentro del formulario.
 *
 * Los datos son `embudo_formulario` de /assistant-applications/stats: por pregunta,
 * `cantidad` (llegaron), `pct_del_total`, `abandonaron_aca` (se quedaron exactamente ahí),
 * `pct_abandono` y `descartadas_aca` (las que cortó el propio formulario por una respuesta
 * excluyente: no se fueron solas).
 */

const Fila = ({ e, puesto }) => {
    const destacada = puesto >= 0;
    const ancho = Math.max(0, Math.min(100, e.pct_del_total));
    const pista = [
        `${e.cantidad} postulaciones llegaron hasta «${e.etapa}» (${e.pct_del_total} %).`,
        `${e.abandonaron_aca} se quedaron justo ahí (${e.pct_abandono} % de las que llegaron).`,
        e.descartadas_aca ? `${e.descartadas_aca} las cortó el formulario por una respuesta excluyente.` : null,
        e.opcional ? 'Pregunta opcional: quien la saltea no cuenta como abandono.' : null,
    ].filter(Boolean).join(' ');

    return (
        // La grilla va en `style` y no con la clase `grid`: dentro de `.dc-shell` (Talent) esa
        // clase es la de las tarjetas del tablero comercial y le pisaba las columnas.
        <div
            className="items-center gap-x-3"
            style={{ display: 'grid', gridTemplateColumns: 'minmax(100px,168px) minmax(0,1fr) 74px' }}
            title={pista}
        >
            <span className="flex min-w-0 items-center gap-1.5">
                {destacada && (
                    <span
                        className="flex h-4 w-4 flex-none items-center justify-center rounded-full bg-[#FF3FA4] text-[10px] font-black leading-none text-white"
                        aria-label={`Puesto ${puesto + 1} en abandono`}
                    >
                        {puesto + 1}
                    </span>
                )}
                <span
                    className="truncate text-[11.5px] font-bold"
                    style={{ color: destacada ? '#fff' : 'rgba(255,255,255,.6)' }}
                >
                    {e.etapa}
                </span>
            </span>
            <span className="h-2.5 w-full overflow-hidden rounded-full bg-white/[.07]">
                <span
                    className="block h-full rounded-full"
                    style={{
                        width: `${ancho}%`,
                        background: destacada
                            ? 'linear-gradient(90deg,#FF3FA4,#FF6AD5)'
                            : 'linear-gradient(90deg,#1323C6,#5B7CFF)',
                    }}
                />
            </span>
            <span className="flex flex-col items-end leading-tight">
                <span className="text-[13px] font-black tabular-nums text-white/85">{e.cantidad}</span>
                {e.abandonaron_aca > 0 ? (
                    <span
                        className="text-[10.5px] font-bold tabular-nums"
                        style={{ color: destacada ? '#FF6AD5' : 'rgba(255,255,255,.45)' }}
                    >
                        −{e.abandonaron_aca} · {Math.round(e.pct_abandono)} %
                    </span>
                ) : (
                    <span className="text-[10.5px] font-bold text-white/25">sin bajas</span>
                )}
            </span>
        </div>
    );
};

const EmbudoFormulario = ({ items }) => {
    if (!items || items.length === 0 || items[0].cantidad === 0) {
        return <span className="text-[13px] text-white/35">Todavía sin datos.</span>;
    }
    const top = masAbandonadas(items);
    const grupos = agruparPorBloque(items);

    return (
        <div className="flex flex-col gap-4">
            <p className="max-w-3xl text-[12.5px] leading-relaxed text-white/45">
                Cada barra es el porcentaje de postulaciones que llegó hasta esa pregunta. A la derecha, cuántas
                llegaron y cuántas se quedaron justo ahí. En magenta, las {TOP_ABANDONO} preguntas donde más gente
                se fue por su cuenta (no cuenta a quienes cortó un requisito excluyente).
            </p>
            <div className="gap-x-10 xl:columns-2">
                {grupos.map((g) => (
                    <div key={g.bloque} className="mb-5 flex break-inside-avoid flex-col gap-2.5">
                        <span className="border-b border-white/[.08] pb-1.5 text-[10px] font-extrabold uppercase tracking-[.18em] text-white/40">
                            {g.bloque}
                        </span>
                        {g.items.map((e) => (
                            <Fila key={e.campo} e={e} puesto={top.indexOf(e.campo)} />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default EmbudoFormulario;
