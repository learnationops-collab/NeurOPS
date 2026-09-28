import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DesplegableAgrupado from './DesplegableAgrupado';

const GRUPOS = [
    { titulo: 'Respuesta', tono: 'info', opciones: [
        { clave: 'pendiente', label: 'Pendiente' },
        { clave: 'no_contesta', label: 'No contesta' },
    ] },
    { titulo: 'Otros', tono: 'idle', opciones: [] },
];

/** Envoltorio con estado: el componente es controlado y sin esto nada cambia al tocar. */
const Vivo = ({ multiple = false, inicial = multiple ? [] : null, ...resto }) => {
    const [valor, setValor] = useState(inicial);
    return <DesplegableAgrupado grupos={GRUPOS} valor={valor} multiple={multiple}
        onChange={setValor} {...resto} />;
};

const abrir = async (usuario) => {
    await usuario.click(screen.getByRole('button', { expanded: false }));
    return screen.getByRole('listbox');
};

describe('DesplegableAgrupado', () => {
    it('elige una opción, la muestra con su grupo y se cierra', async () => {
        const usuario = userEvent.setup();
        render(<Vivo placeholder="Elegí cómo viene" />);
        const lista = await abrir(usuario);
        await usuario.click(within(lista).getByRole('option', { name: /Pendiente/ }));
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        const disparador = screen.getByRole('button');
        expect(disparador).toHaveTextContent('Pendiente');
        expect(disparador).toHaveTextContent('Respuesta');
    });

    it('con selección múltiple acumula, deselecciona y no se cierra sola', async () => {
        const usuario = userEvent.setup();
        render(<Vivo multiple placeholder="Elegí los dolores" />);
        const lista = await abrir(usuario);
        expect(lista).toHaveAttribute('aria-multiselectable', 'true');

        await usuario.click(within(lista).getByRole('option', { name: /Pendiente/ }));
        await usuario.click(within(lista).getByRole('option', { name: /No contesta/ }));
        expect(screen.getByRole('listbox')).toBeInTheDocument();
        expect(within(lista).getByRole('option', { name: /Pendiente/ })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByText('2 elegidos')).toBeInTheDocument();

        // Volver a tocar una elegida la saca: el mismo control sirve para los dos sentidos.
        await usuario.click(within(lista).getByRole('option', { name: /Pendiente/ }));
        expect(within(lista).getByRole('option', { name: /Pendiente/ })).toHaveAttribute('aria-selected', 'false');
        expect(screen.getByText('1 elegido')).toBeInTheDocument();
    });

    it('con selección múltiple avisa UNA vez, al cerrar', async () => {
        // Avisar en cada clic disparaba un guardado por opción, y como cada guardado recarga la
        // ficha, el segundo clic salía calculado sobre el estado viejo: elegir dos dolores
        // guardaba uno solo. Se vio en pantalla, no en un test, porque el envoltorio `Vivo`
        // refleja el cambio de inmediato y el servidor real no.
        const usuario = userEvent.setup();
        const onChange = vi.fn();
        render(<DesplegableAgrupado grupos={GRUPOS} valor={[]} multiple onChange={onChange}
            placeholder="Elegí los dolores" />);
        const lista = await abrir(usuario);

        await usuario.click(within(lista).getByRole('option', { name: /Pendiente/ }));
        await usuario.click(within(lista).getByRole('option', { name: /No contesta/ }));
        expect(onChange).not.toHaveBeenCalled();

        await usuario.click(screen.getByRole('button', { name: 'Listo' }));

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(['pendiente', 'no_contesta']);
    });

    it('con selección múltiple no avisa si al final quedó lo mismo', async () => {
        const usuario = userEvent.setup();
        const onChange = vi.fn();
        render(<DesplegableAgrupado grupos={GRUPOS} valor={['pendiente']} multiple
            onChange={onChange} placeholder="Elegí los dolores" />);
        const lista = await abrir(usuario);

        await usuario.click(within(lista).getByRole('option', { name: /No contesta/ }));
        await usuario.click(within(lista).getByRole('option', { name: /No contesta/ }));
        await usuario.click(screen.getByRole('button', { name: 'Listo' }));

        expect(onChange).not.toHaveBeenCalled();
    });

    it('crea una opción nueva con Enter, la deja elegida y avisa a onAgregar', async () => {
        const usuario = userEvent.setup();
        const onAgregar = vi.fn();
        render(<Vivo onAgregar={onAgregar} />);
        const lista = await abrir(usuario);

        // Hay un `+ Agregar` por grupo: el del grupo "Otros" es el segundo.
        const agregar = within(lista).getAllByRole('button', { name: /Agregar/ });
        await usuario.click(agregar[1]);
        await usuario.type(screen.getByLabelText('Nueva opción en Otros'), 'Se fue de viaje{Enter}');

        expect(onAgregar).toHaveBeenCalledWith(
            expect.objectContaining({ grupo: 'Otros', indice: 1, label: 'Se fue de viaje' }),
        );
        const nueva = screen.getByRole('option', { name: /Se fue de viaje/ });
        expect(nueva).toHaveAttribute('aria-selected', 'true');
    });

    it('Escape cancela la opción nueva sin crearla', async () => {
        const usuario = userEvent.setup();
        const onAgregar = vi.fn();
        render(<Vivo onAgregar={onAgregar} />);
        const lista = await abrir(usuario);
        await usuario.click(within(lista).getAllByRole('button', { name: /Agregar/ })[1]);
        await usuario.type(screen.getByLabelText('Nueva opción en Otros'), 'A medias{Escape}');

        expect(onAgregar).not.toHaveBeenCalled();
        expect(screen.queryByRole('option', { name: /A medias/ })).not.toBeInTheDocument();
        // Escape cancela el campo, no cierra el desplegable entero.
        expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('no ofrece «Agregar» si nadie sabe persistir la opción nueva', async () => {
        const usuario = userEvent.setup();
        render(<Vivo />);
        const lista = await abrir(usuario);
        expect(within(lista).queryByRole('button', { name: /Agregar/ })).not.toBeInTheDocument();
    });
});
