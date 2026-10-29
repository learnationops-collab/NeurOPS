// Catálogo de los componentes estándar (/ui): cada componente con sus variantes, en el tema y el
// contexto que se elijan. Es la referencia para construir (skill ui-builder) y para revisar que una
// mejora a un componente se vea bien en todos lados antes de que llegue a las pantallas.
// Agregar un componente al catálogo = sumar una entrada a SECCIONES.

import { useEffect, useState } from 'react';
import { Bell, CalendarDays, Copy, Link, Mail, Pencil, Play, Plus, Settings, Trash2, Users, X } from 'lucide-react';
import '../agendas_v2/thalamus.css';
import '../comercial/comercial.css';
import './catalogo.css';
import {
    Avatar, Bars, BRAND_AURA, CifraConCuenta, Button, Calendar, CalendarEvent, calendarY, Card, Chip, Status, ModalHeader, TextArea, toast, Toaster, Tooltip, ConfirmDelete, EmptyState, FieldError, Grid, IconButton, Input, InputGroup, Kpi, LinkButton, Modal, PageHeader, Panel, Segmented, Select,
    useVerRegistros, Stepper, Switch, Reveal, Skeleton, SkeletonBlock, SkeletonChart, SkeletonCircle, SkeletonKpi, SkeletonPanel, SkeletonRow, SkeletonText,
} from '../../components/standard';

const TEMAS = [
    { v: 'modern-oscuro', n: 'Modern oscuro' },
    { v: 'modern-claro', n: 'Modern claro' },
    { v: 'classic-oscuro', n: 'Classic oscuro' },
    { v: 'classic-claro', n: 'Classic claro' },
];
const CONTEXTOS = [
    { v: 'thalamus', n: 'Thalamus / Inbox' },
    { v: 'dc-shell', n: 'Dashboard comercial' },
];

const nada = () => {};

// Una semana corta de ejemplo: los tonos de las tarjetas los pone la pantalla (acá, colores inline).
const DIAS_CAL = [['lun', 19], ['mar', 20], ['mié', 21]];
const EVENTOS_CAL = [
    [0, 9 * 60, 60, 'Llamada', 'Lucía Pérez', 'var(--ln-info, #4E8BD8)'],
    [1, 10 * 60, 45, 'Libre', null, 'var(--ln-success, #2FBF8F)'],
    [2, 9 * 60 + 30, 90, 'Ocupado', 'Reunión de equipo', 'var(--fc-violeta, #7D63E6)'],
];
function DemoCalendario() {
    const desde = 8, hasta = 13, alto = 44;
    return (
        <Calendar startHour={desde} endHour={hasta} hourHeight={alto} zoneLabel="GMT-4" minWidth={420} nowMinutes={10 * 60 + 20}
            days={DIAS_CAL.map(([w, n], i) => ({ key: w, weekday: w, number: n, today: i === 1, caption: i === 1 ? 'hoy' : '' }))}
            renderColumn={(_, i) => EVENTOS_CAL.filter(e => e[0] === i).map(([, m, dur, t, l, c]) => (
                <CalendarEvent key={m} top={calendarY(m, desde, alto)} height={dur / 60 * alto} title={t} line={l}
                    time={Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0')} style={{ background: c, color: '#fff' }} />
            ))} />
    );
}

// Los controles del catálogo funcionan de verdad: cada uno guarda su estado.
function DemoControles() {
    const [vista, setVista] = useState('semana');
    const [evento, setEvento] = useState('');
    const [on, setOn] = useState(true);
    const [n, setN] = useState(3);
    return (
        <>
            <Demo titulo="Segmented con cuenta y vertical (colas de una bandeja)">
                <Segmented size="sm" label="Estado" value={vista === 'semana' ? 'a' : 'b'} onChange={v => setVista(v === 'a' ? 'semana' : 'equipo')}
                    options={[{ value: 'a', label: 'Activos', count: 4 }, { value: 'b', label: 'Pausados', count: 1 }]} />
                <Segmented orientation="vertical" label="Colas" value={vista === 'semana' ? 'a' : 'b'} onChange={v => setVista(v === 'a' ? 'semana' : 'equipo')}
                    style={{ width: 220 }} options={[{ value: 'a', label: 'Esperan respuesta', count: 13 }, { value: 'b', label: 'Todas', count: 100 }]} />
            </Demo>
            <Demo titulo="Segmented (md y sm)">
                <Segmented label="Vista" value={vista} onChange={setVista}
                    options={[{ value: 'semana', label: 'Semana', icon: <CalendarDays /> }, { value: 'equipo', label: 'Equipo', icon: <Users /> }]} />
                <Segmented size="sm" label="Período" value={vista === 'semana' ? '7' : '30'} onChange={v => setVista(v === '7' ? 'semana' : 'equipo')}
                    options={[{ value: '7', label: '7 días' }, { value: '30', label: '30 días' }]} />
            </Demo>
            <Demo titulo="Select (md y sm), con ícono y opción vacía">
                <Select label="Evento" value={evento} onChange={setEvento} options={[
                    { value: '', label: 'Todos los eventos' },
                    { value: 'diag', label: 'Diagnóstico', icon: <CalendarDays size={15} />, iconColor: 'var(--ln-info, #4E8BD8)' },
                    { value: 'ws', label: 'Workshop' },
                ]} />
                <Select size="sm" label="Closer" value="ana" onChange={nada} options={[{ value: 'ana', label: 'Ana Pérez' }, { value: 'leo', label: 'Leo Díaz' }]} />
            </Demo>
            <Demo titulo="Switch y Stepper">
                <Switch checked={on} onChange={setOn} label="Obligatoria" />
                <Switch checked={on} />
                <Stepper value={n} min={1} max={6} onChange={setN} display={n * 15 + ' min'} label="Duración" />
            </Demo>
        </>
    );
}

function DemoModal() {
    const [abierto, setAbierto] = useState(false);
    return (
        <Demo titulo="Se abre sobre la página">
            <Button onClick={() => setAbierto(true)}>Abrir modal</Button>
            {abierto && (
                <Modal onClose={() => setAbierto(false)} labelledBy="cat-modal-t">
                    <div style={{ display: 'grid', gap: 16 }}>
                        <ModalHeader title="Nuevo evento" subtitle="Escape o un clic en el fondo la cierran." titleId="cat-modal-t" onClose={() => setAbierto(false)} />
                        <div className="cat-fila"><Button onClick={() => setAbierto(false)}>Cancelar</Button><Button variant="primary">Crear</Button></div>
                    </div>
                </Modal>
            )}
        </Demo>
    );
}

// «Recargar» vuelve a mostrar el esqueleto un momento: cada bloque entra cuando llega su dato.
function DemoEsqueleto() {
    const [listos, setListos] = useState(2);
    const recargar = () => {
        setListos(0);
        [1, 2].forEach((n) => setTimeout(() => setListos(n), n * 900));
    };
    return (
        <>
            <Demo titulo="Piezas">
                <SkeletonCircle />
                <SkeletonText lines={3} width={220} lastWidth={140} lineHeight={20} style={{ width: 220 }} />
                <SkeletonBlock width={120} height={34} />
            </Demo>
            <Demo titulo="KPIs, filas y gráfico">
                <Skeleton label="Cargando el ejemplo…" style={{ display: 'grid', gap: 16, width: '100%' }}>
                    <Grid variant="kpis">{[0, 1, 2, 3].map((i) => <SkeletonKpi key={i} step={i} />)}</Grid>
                    <Grid variant="charts">
                        <SkeletonPanel rows={4} step={4} />
                        <SkeletonChart height={140} step={6} />
                    </Grid>
                    <SkeletonRow avatar cells={['50%', '80%', '40%', '30%']} step={8} />
                </Skeleton>
            </Demo>
            <Demo titulo="Reveal: cada bloque con su dato">
                <Button onClick={recargar}>Recargar</Button>
                <Grid variant="kpis" style={{ width: '100%' }}>
                    {['Leads', 'Agendas'].map((label, i) => (
                        <Reveal key={label} ready={listos > i} skeleton={<Skeleton label={`Cargando ${label}…`}><SkeletonKpi /></Skeleton>}>
                            <Kpi label={label} value={i ? '96' : '1.240'}><small>últimos 30 días</small></Kpi>
                        </Reveal>
                    ))}
                </Grid>
            </Demo>
        </>
    );
}

function Demo({ titulo, children }) {
    return (
        <div className="cat-demo">
            <span className="cat-demo-t">{titulo}</span>
            <div className="cat-demo-c">{children}</div>
        </div>
    );
}

// Un KPI que abre sus registros: la pantalla arma el contenido, el componente pone el marco.
const DemoRegistros = () => {
    const registros = useVerRegistros();
    const abrir = () => registros.abrir({
        titulo: 'Agendas', subtitulo: '128 en el período · una fila por persona',
        contenido: (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
                {['Lucía Pérez', 'Mateo Ruiz', 'Ana Gómez', 'Pablo Díaz'].map((n) => <li key={n}>{n}</li>)}
            </ul>
        ),
    });
    return (
        <>
            <Kpi label="Agendas" value="128" onSelect={abrir}><small>tocá para ver las que la suman</small></Kpi>
            {registros.panel}
        </>
    );
};

const SECCIONES = [
    {
        nombre: 'Button',
        para: 'Toda acción con texto. Una sola primary por zona.',
        props: 'variant: secondary · primary · ghost · danger · dangerSolid — size: sm · md — icon',
        demo: () => (
            <>
                <Demo titulo="Variantes (sm)">
                    <Button variant="primary" icon={<Plus />}>Crear</Button>
                    <Button icon={<Pencil />}>Editar</Button>
                    <Button variant="ghost">Ghost</Button>
                    <Button variant="danger" icon={<Trash2 />}>Eliminar evento</Button>
                    <Button variant="dangerSolid" icon={<Trash2 />}>Eliminar</Button>
                </Demo>
                <Demo titulo="Tamaño md y deshabilitado">
                    <Button variant="primary" size="md">Guardar</Button>
                    <Button size="md">Cancelar</Button>
                    <Button variant="primary" disabled>Deshabilitado</Button>
                </Demo>
            </>
        ),
    },
    {
        nombre: 'IconButton',
        para: 'Acción de solo ícono. El label es obligatorio: es lo que lee un lector de pantalla.',
        props: 'icon · label — size: md · sm · xs — danger — pressed',
        demo: () => (
            <Demo titulo="Tamaños, peligro y presionado">
                <IconButton icon={<Settings />} label="Ajustes" />
                <IconButton icon={<Copy />} label="Copiar" size="sm" />
                <IconButton icon={<X />} label="Cerrar" size="xs" />
                <IconButton icon={<Trash2 />} label="Borrar" size="sm" danger />
                <IconButton icon={<Bell />} label="Silenciar" size="sm" pressed />
            </Demo>
        ),
    },
    {
        nombre: 'LinkButton',
        para: 'Acción con aspecto de link, dentro de un texto o debajo de una lista.',
        props: 'icon — subtle',
        demo: () => (
            <Demo titulo="Normal y sutil">
                <LinkButton icon={<Plus />}>Opción</LinkButton>
                <LinkButton subtle>Usar la propuesta</LinkButton>
            </Demo>
        ),
    },
    {
        nombre: 'Chip',
        para: 'Etiqueta de estado o categoría. El color lo decide la pantalla.',
        props: 'color · icon — subtle · square — as="button" (filtro)',
        demo: () => (
            <Demo titulo="Estados y versión suave">
                <Chip color="var(--ui-brand)">Publicado</Chip>
                <Chip color="var(--ln-success, #2FBF8F)">Activo</Chip>
                <Chip color="var(--ln-warning, #D9A441)">Sin funnel</Chip>
                <Chip color="var(--ln-info, #4E8BD8)" icon={<Bell />}>Solo lectura</Chip>
                <Chip subtle>30 min</Chip>
                <Chip color="var(--ln-danger, #E85C4A)" square icon={<X />} title="Filtra" />
                <Chip as="button" subtle color="var(--ui-brand)" aria-pressed="true" icon={<Plus />}>Filtro</Chip>
            </Demo>
        ),
    },
    {
        nombre: 'Status',
        para: 'Estado con un punto de color, más liviano que un Chip: el estado de algo en su tarjeta o en la barra de la cabecera.',
        props: 'color',
        demo: () => (
            <Demo titulo="Estados">
                <Status color="var(--ln-success, #2FBF8F)">Activo</Status>
                <Status color="var(--ln-warning, #D9A441)">Sin publicar</Status>
                <Status>Borrador</Status>
            </Demo>
        ),
    },
    {
        nombre: 'Card',
        para: 'Tarjeta. No sabe qué muestra: el contenido y los colores del aura los pone la pantalla.',
        props: 'as · aura (hasta 4 colores) · soft',
        demo: () => (
            <div className="cat-grilla">
                <Card className="cat-card"><b>Lisa</b><span className="cat-mut">Sin aura</span></Card>
                <Card className="cat-card" aura={BRAND_AURA}><b>Con aura</b><span className="cat-mut">Colores de marca</span></Card>
                <Card className="cat-card" aura={['var(--ln-success, #2FBF8F)', 'var(--ui-brand-2)', 'var(--ln-success, #2FBF8F)', 'var(--ui-navy)']} soft>
                    <b>Aura suave</b><span className="cat-mut">El color lo pasa la pantalla</span>
                </Card>
            </div>
        ),
    },
    {
        nombre: 'Calendar · CalendarEvent',
        para: 'Calendario de horas (semana o día). La pantalla decide qué va en cada columna; el calendario lo ubica.',
        props: 'Calendar: days[{key,weekday,number,today,caption,extra}] · startHour · endHour · hourHeight · zoneLabel · nowMinutes · renderColumn · columnProps — CalendarEvent: top · height · title · line · time · icon · marker — calendarY(minutos)',
        demo: () => <DemoCalendario />,
    },
    {
        nombre: 'Panel',
        para: 'Bloque de una pantalla (una sección de configuración, una columna). Más liviano que Card.',
        props: 'as · size: md · sm · aura · soft',
        demo: () => (
            <Grid variant="cards">
                <Panel><b>Panel</b><p className="cat-mut">Bloque de configuración</p></Panel>
                <Panel size="sm" aura={BRAND_AURA} soft><b>Chico con aura</b><p className="cat-mut">Revisión, avisos</p></Panel>
            </Grid>
        ),
    },
    {
        nombre: 'Grid',
        para: 'Cómo se acomodan varios elementos. Las columnas se ajustan solas al ancho disponible.',
        props: 'variant: list · cards · charts · kpis · column — as',
        demo: () => (
            <Grid variant="kpis">
                <Kpi label="Agendas" value="128" aura={BRAND_AURA}><small>vs 112 el mes anterior</small></Kpi>
                <Kpi label="Asistencia" value="74%"><small>de las confirmadas</small></Kpi>
                <Kpi label="Ventas" value="23" />
                <Kpi label="Tasa de cierre" value="18%" />
            </Grid>
        ),
    },
    {
        nombre: 'Kpi',
        para: 'Número grande con su rótulo y un detalle debajo. Los de arriba están en un Grid kpis.',
        props: 'label · value · aura · onSelect (la tarjeta abre sus registros) · selectLabel — children: el detalle (con <small> para lo secundario)',
        demo: () => <Kpi label="Leads" value="1.240" aura={BRAND_AURA}><small>últimos 30 días</small></Kpi>,
    },
    {
        nombre: 'VerRegistros',
        para: 'La lista que compone una cifra, en un panel lateral o en una ventana central (la persona alterna y se recuerda). Un Kpi con onSelect lo abre; la pantalla pasa el contenido.',
        props: 'useVerRegistros() → { abrir({ titulo, subtitulo, contenido, acciones }), panel, cerrar } — VerRegistros: titulo · subtitulo · modo: lateral · central · onModo · onClose',
        demo: () => <DemoRegistros />,
    },
    {
        nombre: 'CifraConCuenta',
        para: 'Un porcentaje, un ROAS o un costo que se ve SOLO; al pasar el mouse dice su cuenta («163 de 2.448 leads») y cada parte abre la lista que la suma.',
        props: 'cuenta { a, b } con { t, m, titulo } · metrica · titulo · onVer(metrica, titulo) · lado: izq · der — children: la cifra',
        demo: () => (
            <p style={{ fontSize: 28, fontWeight: 900 }}>
                <CifraConCuenta onVer={nada} cuenta={{ a: { t: '163', m: 'agendas', titulo: 'Agendas' }, b: { t: '2.448 leads', m: 'leads', titulo: 'Leads' } }}>6,7%</CifraConCuenta>
            </p>
        ),
    },
    {
        nombre: 'Bars',
        para: 'Barras sin ejes: el embudo por paso de una tarjeta (columnas) o un embudo con rótulos (filas). La pantalla elige el color de cada barra.',
        props: 'items[{key,value,label,display,detail,color,tip}] · variant: columns · rows · scale: linear · sqrt · label · onSelect',
        demo: () => (
            <Grid variant="cards">
                <Card soft><Bars label="Embudo por paso" style={{ '--ui-bars-h': '48px' }} onSelect={nada} items={[742, 624, 527, 327, 181, 134, 98].map((v, i) => ({
                    key: String(i), value: v, label: `Paso ${i + 1}`, color: i === 3 ? 'var(--ln-brand, #FF3FA4)' : i < 3 ? 'var(--ln-success, #2FBF8F)' : 'var(--ln-info, #4E8BD8)',
                }))} /></Card>
                <Card soft><Bars variant="rows" scale="sqrt" label="Embudo del taller" items={[['Leads', 600], ['Asistieron', 180], ['Agendaron', 24], ['Ventas', 3]].map(([l, v], i, a) => ({
                    key: l, label: l, value: v, display: String(v), detail: i ? `${Math.round((v / a[i - 1][1]) * 100)} %` : '',
                }))} /></Card>
            </Grid>
        ),
    },
    {
        nombre: 'EmptyState',
        para: 'Vacío, cargando o sin permiso.',
        props: 'icon · title · aura · action — children: el texto',
        demo: () => (
            <div className="cat-grilla">
                <EmptyState>Todavía no hay eventos.</EmptyState>
                <EmptyState title="Sin eventos todavía" action={<Button>Ir a Eventos</Button>}>Creá un evento para ver estadísticas.</EmptyState>
            </div>
        ),
    },
    {
        nombre: 'Skeleton · Reveal',
        para: 'Mientras carga, cada bloque muestra la forma de SU dato con un brillo que la recorre; Reveal lo cambia por el dato al llegar.',
        props: 'Skeleton: label · as — SkeletonBlock: width · height · radius · step — SkeletonText: lines · width · lastWidth · height · lineHeight — SkeletonCircle: size — SkeletonKpi: className · valueHeight · detail — SkeletonRow: cells · columns · avatar · height — SkeletonPanel: className · title · rows · rowHeight — SkeletonChart: variant (bars · area) · height · bars — Reveal: ready · skeleton · as · delay',
        demo: () => <DemoEsqueleto />,
    },
    {
        nombre: 'ConfirmDelete',
        para: '«¿Eliminar X?» con Cancelar y Eliminar. Lo que se borra y su consecuencia, en una frase.',
        props: 'name · article · detail · onCancel · onConfirm · confirmLabel · icon · extraActions',
        demo: () => (
            <ConfirmDelete name="Diagnóstico Workshop" detail="El link deja de funcionar." icon={<Trash2 />}
                autoFocusCancel={false} onCancel={nada} onConfirm={nada} />
        ),
    },
    {
        nombre: 'Segmented · Select · Switch · Stepper',
        para: 'Controles de formulario y filtros. Las opciones las arma la pantalla; el control solo las muestra.',
        props: 'Segmented: value · options[{value,label,icon,count,props}] · onChange · size · orientation: horizontal · vertical · itemProps · prefix · radio — Select: value · options[{value,label,icon,iconColor}] · size — Switch: checked · onChange · label — Stepper: value · min · max · display',
        demo: () => <DemoControles />,
    },
    {
        nombre: 'Input · InputGroup · FieldError',
        para: 'Campos de texto. InputGroup suma un ícono o texto fijo adelante y, como formulario, un botón pegado.',
        props: 'Input: variant (number · date) · invalid · as="textarea" — InputGroup: prefix · invalid · as="form" — FieldError: role · icon',
        demo: () => (
            <>
                <Demo titulo="Input">
                    <Input placeholder="Nombre del evento" aria-label="Nombre" style={{ maxWidth: 260 }} />
                    <Input variant="number" type="number" defaultValue={30} aria-label="Minutos" />
                    <Input variant="date" type="date" aria-label="Desde" />
                    <Input invalid defaultValue="sin arroba" aria-label="Email" style={{ maxWidth: 200 }} />
                </Demo>
                <Demo titulo="InputGroup">
                    <InputGroup prefix={<><Link />/agenda/</>} style={{ flex: '1 1 260px' }}><input aria-label="Link" defaultValue="workshop" /></InputGroup>
                    <InputGroup as="form" prefix={<Mail />} style={{ flex: '1 1 320px' }} onSubmit={e => e.preventDefault()}>
                        <input aria-label="Email" placeholder="Tu email" />
                        <Button variant="primary" type="submit">Guardar</Button>
                    </InputGroup>
                </Demo>
                <Demo titulo="FieldError">
                    <FieldError>Ese link ya existe.</FieldError>
                </Demo>
            </>
        ),
    },
    {
        nombre: 'Modal · ModalHeader',
        para: 'Ventana sobre la página. Cierra con Escape o clic en el fondo, bloquea el scroll y enfoca el primer campo.',
        props: 'Modal: onClose · className · labelledBy · id — ModalHeader: title · subtitle · icon · titleId · size: md · lg · actions · children (fila de abajo) · flush · onClose · closeProps',
        demo: () => <DemoModal />,
    },
    {
        nombre: 'TextArea · Toaster · Tooltip',
        para: 'Texto largo que crece solo; avisos cortos abajo (toast) y la ayuda al pasar el mouse por cualquier elemento con data-tip.',
        props: 'TextArea: value · bare · invalid — toast(texto, tone: success · error, action: {label, onClick}) — <Toaster /> y <Tooltip /> una vez por app',
        demo: () => (
            <>
                <Demo titulo="TextArea">
                    <TextArea aria-label="Pregunta" defaultValue="¿Qué te gustaría lograr en los próximos 6 meses?" style={{ maxWidth: 420 }} />
                </Demo>
                <Demo titulo="toast y data-tip">
                    <Button onClick={() => toast('Evento creado', 'success', { label: 'Deshacer', onClick: nada })}>Mostrar aviso</Button>
                    <Button variant="danger" onClick={() => toast('No se pudo guardar', 'error')}>Aviso de error</Button>
                    <Chip color="var(--ln-info, #4E8BD8)" data-tip="Solo lectura|Lo que se configura lo cambia la dirección comercial.">Pasá el mouse</Chip>
                </Demo>
            </>
        ),
    },
    {
        nombre: 'Avatar',
        para: 'Foto o iniciales sobre el color de la persona.',
        props: 'name · photo · color — size: md · lg · sm · xs',
        demo: () => (
            <Demo titulo="Tamaños">
                <Avatar name="Ana Pérez" color="var(--fc-azul, #317DE9)" size="lg" />
                <Avatar name="Leo Díaz" color="var(--fc-violeta, #7D63E6)" />
                <Avatar name="Sol Ríos" color="var(--fc-verde, #3B9555)" size="sm" />
                <Avatar name="Tomás Gil" color="var(--fc-ambar, #C06F0A)" size="xs" />
            </Demo>
        ),
    },
    {
        nombre: 'PageHeader',
        para: 'Cabecera de la página. Las secciones mandan sus acciones con <HeaderActions>.',
        props: 'title · logo · badges · actions · size: md · sm (barra baja, para herramientas de trabajo como el Inbox)',
        demo: () => (
            <>
                <PageHeader title="Eventos" badges={<Chip color="var(--ln-info, #4E8BD8)">Solo lectura</Chip>}
                    actions={<div className="cat-fila"><Button icon={<Play />}>Probar</Button><Button variant="primary" icon={<Plus />}>Nuevo evento</Button></div>} />
                <PageHeader size="sm" title="Conversaciones" badges={<Status color="var(--ln-success, #2FBF8F)">Motor encendido</Status>}
                    actions={<div className="cat-fila"><Button variant="primary" icon={<Plus />}>Crear flujo</Button></div>} />
            </>
        ),
    },
];

export default function Catalogo() {
    const [tema, setTema] = useState('modern-oscuro');
    const [contexto, setContexto] = useState('thalamus');
    const [nombreTema, modo] = tema.split('-');
    useEffect(() => { document.title = 'Componentes estándar · Learnation'; }, []);

    return (
        <div className="cat">
            <header className="cat-cab">
                <div>
                    <h1>Componentes estándar</h1>
                    <p>Base: Thalamus. Código en <code>frontend/src/components/standard</code>; reglas de uso en la skill <code>ui-builder</code>.</p>
                </div>
                <div className="cat-ctl">
                    <Selector label="Tema" valor={tema} opciones={TEMAS} onChange={setTema} />
                    <Selector label="Contexto" valor={contexto} opciones={CONTEXTOS} onChange={setContexto} />
                </div>
            </header>
            <div className={'cat-marco ' + contexto} data-tema={nombreTema} data-tema-modo={modo} data-theme={modo === 'claro' ? 'light' : 'dark'}>
                {SECCIONES.map(s => (
                    <section key={s.nombre} className="cat-sec" id={s.nombre}>
                        <div className="cat-sec-cab">
                            <h2>{s.nombre}</h2>
                            <p>{s.para}</p>
                            <code>{s.props}</code>
                        </div>
                        {s.demo()}
                    </section>
                ))}
                <Toaster />
                <Tooltip />
            </div>
        </div>
    );
}

function Selector({ label, valor, opciones, onChange }) {
    return (
        <div className="cat-sel" role="group" aria-label={label}>
            <span>{label}</span>
            {opciones.map(o => (
                <button key={o.v} type="button" aria-pressed={valor === o.v} onClick={() => onChange(o.v)}>{o.n}</button>
            ))}
        </div>
    );
}
