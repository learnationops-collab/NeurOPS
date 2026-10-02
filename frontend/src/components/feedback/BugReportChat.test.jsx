import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import toast from 'react-hot-toast';

vi.mock('../../services/api', () => ({ default: { post: vi.fn() } }));
vi.mock('html2canvas', () => ({ default: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({ user: { username: 'Elias', role: 'closer' } }),
}));

import BugReportChat from './BugReportChat';

// jsdom no decodifica imágenes ni dibuja en un canvas: se simula lo justo para que la captura
// pase por `blobToCompressedDataUrl` como en el navegador.
class ImagenFalsa {
    width = 2800;
    height = 1400;
    set src(_) { queueMicrotask(() => this.onload?.()); }
}

const archivos = (...lista) => ({ types: ['Files'], files: lista, dropEffect: 'none' });
const png = () => new File(['png'], 'captura.png', { type: 'image/png' });

const abrir = () => render(
    <BugReportChat isOpen onClose={vi.fn()} onMinimize={vi.fn()} technicalContext={null} />,
);

// Hasta el paso de adjuntos, que es donde se ven las capturas agregadas.
const llegarAAdjuntos = async (user) => {
    await user.click(screen.getByRole('button', { name: /Encontré un problema/ }));
    await user.type(screen.getByPlaceholderText('Describe el problema...'), 'No suma el total');
    await user.click(screen.getByRole('button', { name: /Continuar/ }));
    await user.type(screen.getByPlaceholderText('Escribe qué estabas haciendo...'), 'Editaba el plan');
    await user.click(screen.getByRole('button', { name: /Continuar/ }));
};

describe('BugReportChat: arrastrar una imagen', () => {
    beforeEach(() => {
        vi.stubGlobal('Image', ImagenFalsa);
        URL.createObjectURL = vi.fn(() => 'blob:falsa');
        URL.revokeObjectURL = vi.fn();
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() });
        vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,QUJD');
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        delete URL.createObjectURL;
        delete URL.revokeObjectURL;
    });

    it('mientras se arrastra un archivo el chat muestra dónde soltarlo', async () => {
        abrir();
        expect(screen.queryByText('Soltá la imagen acá')).toBeNull();
        fireEvent.dragEnter(document.body, { dataTransfer: archivos() });
        expect(screen.getByText('Soltá la imagen acá')).toBeInTheDocument();
        fireEvent.dragLeave(document.body, { dataTransfer: archivos() });
        await waitFor(() => expect(screen.queryByText('Soltá la imagen acá')).toBeNull());
    });

    it('soltar una imagen la agrega como captura y el navegador no la abre', async () => {
        const user = userEvent.setup();
        abrir();
        await llegarAAdjuntos(user);
        expect(screen.getByRole('button', { name: /Pegar \(Ctrl\+V\) o arrastrar captura/ })).toBeInTheDocument();

        fireEvent.dragEnter(document.body, { dataTransfer: archivos(png()) });
        // `false` es que se llamó a preventDefault: sin eso el navegador abre la imagen y saca de
        // la app con el reporte a medio llenar.
        expect(fireEvent.drop(document.body, { dataTransfer: archivos(png(), png()) })).toBe(false);

        expect(await screen.findByAltText('Captura 2')).toBeInTheDocument();
        expect(screen.getByAltText('Captura 1')).toBeInTheDocument();
        expect(toast.success).toHaveBeenCalledWith('2 capturas agregadas');
    });

    it('lo que no es imagen no se agrega y se dice por qué', async () => {
        const user = userEvent.setup();
        abrir();
        await llegarAAdjuntos(user);
        const pdf = new File(['pdf'], 'factura.pdf', { type: 'application/pdf' });
        fireEvent.drop(document.body, { dataTransfer: archivos(pdf) });
        expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/Solo se pueden agregar imágenes/));
        expect(screen.queryByAltText('Captura 1')).toBeNull();
    });

    it('arrastrar texto de la página no se toca', () => {
        abrir();
        const texto = { types: ['text/plain'], files: [] };
        expect(fireEvent.dragEnter(document.body, { dataTransfer: texto })).toBe(true);
        expect(fireEvent.drop(document.body, { dataTransfer: texto })).toBe(true);
        expect(screen.queryByText('Soltá la imagen acá')).toBeNull();
    });
});
