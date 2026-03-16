import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import pixelService from '../../services/pixelService';

/**
 * PixelTracker Component
 * Este componente no renderiza nada, pero escucha los cambios de ruta
 * para disparar automáticamente el evento PageView del Pixel de Meta.
 */
const PixelTracker = () => {
  const location = useLocation();

  useEffect(() => {
    // Dispara PageView cada vez que la URL (pathname o search) cambia
    pixelService.pageView();
  }, [location.pathname, location.search]);

  return null;
};

export default PixelTracker;
