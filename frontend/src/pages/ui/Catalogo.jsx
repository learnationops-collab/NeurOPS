// Catálogo de los componentes estándar (/ui): cada componente con sus variantes, en el tema y el
// contexto que se elijan. Es la referencia para construir (skill ui-builder) y para revisar que una
// mejora a un componente se vea bien en todos lados antes de que llegue a las pantallas.
// Agregar un componente al catálogo = sumar una entrada a SECCIONES.

import { useEffect, useState } from 'react';
import { Bell, Copy, Pencil, Play, Plus, Settings, Trash2, X } from 'lucide-react';
import '../agendas_v2/thalamus.css';
import '../comercial/comercial.css';
import './catalogo.css';
import {
    BRAND_AURA, Button, Card, Chip, ConfirmDelete, EmptyState, IconButton, LinkButton, PageHeader,
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

function Demo({ titulo, children }) {
    return (
        <div className="cat-demo">
            <span className="cat-demo-t">{titulo}</span>
            <div className="cat-demo-c">{children}</div>
        </div>
    );
}

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
        props: 'color · icon — subtle',
        demo: () => (
            <Demo titulo="Estados y versión suave">
                <Chip color="var(--ui-brand)">Publicado</Chip>
                <Chip color="var(--ln-success, #2FBF8F)">Activo</Chip>
                <Chip color="var(--ln-warning, #D9A441)">Sin funnel</Chip>
                <Chip color="var(--ln-info, #4E8BD8)" icon={<Bell />}>Solo lectura</Chip>
                <Chip subtle>30 min</Chip>
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
        nombre: 'ConfirmDelete',
        para: '«¿Eliminar X?» con Cancelar y Eliminar. Lo que se borra y su consecuencia, en una frase.',
        props: 'name · article · detail · onCancel · onConfirm · confirmLabel · icon · extraActions',
        demo: () => (
            <ConfirmDelete name="Diagnóstico Workshop" detail="El link deja de funcionar." icon={<Trash2 />}
                autoFocusCancel={false} onCancel={nada} onConfirm={nada} />
        ),
    },
    {
        nombre: 'PageHeader',
        para: 'Cabecera de la página. Las secciones mandan sus acciones con <HeaderActions>.',
        props: 'title · logo · badges · actions',
        demo: () => (
            <PageHeader title="Eventos" badges={<Chip color="var(--ln-info, #4E8BD8)">Solo lectura</Chip>}
                actions={<div className="cat-fila"><Button icon={<Play />}>Probar</Button><Button variant="primary" icon={<Plus />}>Nuevo evento</Button></div>} />
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
