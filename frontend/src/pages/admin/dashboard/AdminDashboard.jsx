import { useState, useEffect } from 'react';
import api from '../../../services/api';
import { Plus, Settings2, X, Maximize2, Hash, Check, Users, TrendingUp, DollarSign, Trash2, BarChart3, Bell } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { useAuth } from '../../../contexts/AuthContext';
import StatTile from './components/StatTile';
import ChartTile from './components/ChartTile';
import { AnimatePresence, motion } from 'framer-motion';
import HotkeysTable from '../../../components/dashboard/HotkeysTable';
import NotificationWidget from '../../../components/dashboard/NotificationWidget';

const AdminDashboard = () => {
  const { user } = useAuth();
  const [config, setConfig] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [draggedId, setDraggedId] = useState(null);
  const [ghost, setGhost] = useState(null); // { x, y, w, h, valid }
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newWidget, setNewWidget] = useState({ metric: 'agendas', type: 'stat' });
  const COLS = 5;
  const ROW_HEIGHT = 110;
  const GAP = 24;

  const [activeSection, setActiveSection] = useState(0);
  const [notifications, setNotifications] = useState([]);


  useEffect(() => {
    const handleSectionChange = (e) => {
      setActiveSection(e.detail.index);
    };
    window.addEventListener('request-section-change', handleSectionChange);
    return () => window.removeEventListener('request-section-change', handleSectionChange);
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/admin/notifications');
      setNotifications(res.data || []);
    } catch (error) {
      console.error("Error fetching notifications", error);
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      await api.post(`/admin/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (error) {
      console.error("Error marking as read", error);
    }
  };

  // Centralized state for all filters with persistence
  const [filters, setFilters] = useState({
    period: 'this_month',
    closer_ids: [],
    program_ids: [],
    start_date: '',
    end_date: ''
  });

  // Load persistence for filters and hidden widgets when user is available
  useEffect(() => {
    if (user?.id) {
      const savedFilters = localStorage.getItem(`dashboard_filters_${user.id}`);
      if (savedFilters) {
        try { setFilters(JSON.parse(savedFilters)); } catch (e) { }
      }
    }
  }, [user?.id]);

  // Save filters persistence
  useEffect(() => {
    if (user?.id) {
      localStorage.setItem(`dashboard_filters_${user.id}`, JSON.stringify(filters));
    }
  }, [filters, user?.id]);

  // Save layout persistence
  useEffect(() => {
    if (user?.id && config.length > 0) {
      localStorage.setItem(`dashboard_layout_${user.id}`, JSON.stringify(config));
    }
  }, [config, user?.id]);


  useEffect(() => {
    if (user?.id) {
      fetchConfig();
    }
  }, [user?.id]);

  const fetchConfig = async () => {
    try {
      let data = [];
      const savedLayout = localStorage.getItem(`dashboard_layout_${user?.id}`);
      if (savedLayout) {
        data = JSON.parse(savedLayout);
      } else {
        const res = await api.get('/analytics/config');
        data = res.data || [];
      }

      if (!data || !Array.isArray(data)) data = [];

      // Ensure all items have coordinates and follow gravity
      const packed = packLayout(data);
      setConfig(packed);
      setError(null);
    } catch (err) {
      console.error("Error loading dashboard config", err);
      setError("No se pudo conectar con el servidor. Verifica tu conexión.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetLayout = () => {
    if (window.confirm("¿Seguro que quieres reiniciar el tablero? Se perderá tu personalización.")) {
      localStorage.removeItem(`dashboard_layout_${user?.id}`);
      window.location.reload();
    }
  };

  const packLayout = (items) => {
    let packed = [];
    let map = []; // [y][x] grid occupancy

    // Sort items to maintain some order during initial pack
    const sorted = [...items].sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0));

    sorted.forEach(item => {
      const w = Math.min(COLS, item.w || 1);
      const h = 2; // Fixed height of 2 units for stat tiles

      let placed = false;
      let y = 0;
      while (!placed && y < 100) {
        for (let x = 0; x <= COLS - w; x++) {
          if (!checkOverlap(map, x, y, w, item.h || 2)) {
            packed.push({ ...item, x, y, w, h: item.h || 2 });
            fillMap(map, x, y, w, item.h || 2);
            placed = true;
            break;
          }
        }
        if (!placed) y++;
      }
    });

    return packed;
  };

  const checkOverlap = (map, x, y, w, h) => {
    for (let dy = 0; dy < h; dy++) {
      if (!map[y + dy]) continue;
      for (let dx = 0; dx < w; dx++) {
        if (map[y + dy][x + dx]) return true;
      }
    }
    return false;
  };

  const fillMap = (map, x, y, w, h) => {
    for (let dy = 0; dy < h; dy++) {
      if (!map[y + dy]) map[y + dy] = [];
      for (let dx = 0; dx < w; dx++) {
        map[y + dy][x + dx] = true;
      }
    }
  };

  const handleApplyFilters = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handlePeriodChange = (newPeriod) => {
    setFilters(prev => ({ ...prev, period: newPeriod }));
    // Note: isFilterOpen logic is preserved even if modal is not yet implemented
    if (newPeriod === 'custom') {
      setIsFilterOpen(true);
    }
  };

  const deleteWidget = (widgetId) => {
    if (window.confirm("¿Estás seguro de que deseas eliminar este widget?")) {
      setConfig(prev => prev.filter(w => w.id !== widgetId));
    }
  };

  const compactLayout = (items, excludeId = null) => {
    let sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
    let moved = true;
    while (moved) {
      moved = false;
      for (let item of sorted) {
        if (item.id === excludeId) continue;

        // Try moving UP first
        while (item.y > 0 && !anyOverlap(item.x, item.y - 1, item.w, item.h, sorted.filter(i => i.id !== item.id))) {
          item.y--;
          moved = true;
        }
        // Then try moving LEFT
        while (item.x > 0 && !anyOverlap(item.x - 1, item.y, item.w, item.h, sorted.filter(i => i.id !== item.id))) {
          item.x--;
          moved = true;
        }
      }
    }
    return sorted;
  };

  const cleanupFloating = (items) => {
    if (items.length <= 1) return items;

    let connected = new Set();
    let queue = [items[0].id];
    connected.add(items[0].id);

    while (queue.length > 0) {
      let currentId = queue.shift();
      let c = items.find(i => i.id === currentId);

      for (let other of items) {
        if (connected.has(other.id)) continue;

        const xOverlap = (c.x < other.x + other.w) && (c.x + c.w > other.x);
        const yOverlap = (c.y < other.y + other.h) && (c.y + c.h > other.y);
        const touches = ((c.x === other.x + other.w || c.x + c.w === other.x) && yOverlap) ||
          ((c.y === other.y + other.h || c.y + c.h === other.y) && xOverlap);

        if (touches) {
          connected.add(other.id);
          queue.push(other.id);
        }
      }
    }

    let floating = items.filter(i => !connected.has(i.id));
    if (floating.length === 0) return items;

    let newItems = [...items];
    floating.forEach(f => {
      let found = false;
      let distance = 1;
      while (!found && distance < 20) {
        for (let cid of connected) {
          let c = items.find(i => i.id === cid);
          const spots = [
            { x: c.x - f.w, y: c.y }, // Left
            { x: c.x + c.w, y: c.y }, // Right
            { x: c.x, y: c.y - f.h }, // Up
            { x: c.x, y: c.y + f.h }  // Down
          ];
          for (let s of spots) {
            if (s.x >= 0 && s.x + f.w <= COLS && s.y >= 0) {
              if (!anyOverlap(s.x, s.y, f.w, f.h, items.filter(i => i.id !== f.id))) {
                const idx = newItems.findIndex(i => i.id === f.id);
                newItems[idx] = { ...f, x: s.x, y: s.y };
                connected.add(f.id);
                found = true;
                break;
              }
            }
          }
          if (found) break;
        }
        distance++;
      }
    });

    return newItems;
  };

  const anyOverlap = (x, y, w, h, others) => {
    return others.some(o => x < o.x + o.w && x + w > o.x && y < o.y + o.h && y + h > o.y);
  };

  const handleDragStart = (id) => {
    setDraggedId(id);
  };

  const handleDrag = (event, info, id) => {
    const gridContainer = document.querySelector('[data-grid-container]');
    if (!gridContainer) return;

    const rect = gridContainer.getBoundingClientRect();
    const cellWidth = rect.width / COLS;
    const rowFullHeight = ROW_HEIGHT + GAP;

    let x = Math.floor((info.point.x - rect.left) / cellWidth);
    let y = Math.floor((info.point.y - rect.top) / rowFullHeight);

    const item = config.find(i => i.id === id);
    if (!item) return;

    x = Math.max(0, Math.min(COLS - item.w, x));
    y = Math.max(0, y);

    const isValid = !anyOverlap(x, y, item.w, item.h, config.filter(i => i.id !== id));
    setGhost({ x, y, w: item.w, h: item.h, valid: isValid });

    if (isValid && (x !== item.x || y !== item.y)) {
      setConfig(prev => {
        let newConfig = prev.map(i => i.id === id ? { ...i, x, y } : i);
        return compactLayout(newConfig, id);
      });
    }
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setGhost(null);
    setConfig(prev => {
      const compacted = compactLayout(prev);
      return cleanupFloating(compacted);
    });
  };

  const updateWidgetSize = (id, type) => {
    const PRESETS = [
      { w: 1, h: 1 },
      { w: 2, h: 1 },
      { w: 2, h: 2 },
      { w: 1, h: 2 }
    ];

    setConfig(prev => {
      const newConfig = prev.map(w => {
        if (w.id === id) {
          const currentIdx = PRESETS.findIndex(p => p.w === w.w && p.h === (w.h || 2));
          const nextIdx = (currentIdx + 1) % PRESETS.length;
          const preset = PRESETS[nextIdx];

          let newX = w.x;
          if (newX + preset.w > COLS) {
            newX = Math.max(0, COLS - preset.w);
          }

          return { ...w, w: preset.w, h: preset.h, x: newX };
        }
        return w;
      });
      let result = compactLayout(newConfig, id);
      return cleanupFloating(result);
    });
  };

  const toggleWidgetType = (id) => {
    setConfig(prev => {
      return prev.map(w => {
        if (w.id === id) {
          const newType = w.type === 'stat' ? 'grafico' : 'stat';
          return { ...w, type: newType };
        }
        return w;
      });
    });
  };

  const addWidget = () => {
    const id = `w-${Date.now()}`;
    const widget = {
      id,
      ...newWidget,
      w: newWidget.type === 'stat' ? 1 : 2,
      h: 2,
      x: 0,
      y: 0
    };
    setConfig(prev => {
      let next = [...prev, widget];
      next = packLayout(next);
      return compactLayout(next);
    });
    setIsCreateOpen(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-primary font-bold uppercase tracking-widest text-sm">Cargando Tablero...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-12 text-center">
        <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-3xl inline-block">
          <p className="text-red-400 font-bold text-lg">{error}</p>
          <Button onClick={fetchConfig} variant="outline" className="mt-4">Reintentar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden relative bg-main">
      <motion.div
        className="absolute top-0 left-0 w-full h-[200%]"
        animate={{ y: `-${activeSection * 50}%` }}
        transition={{ type: 'spring', damping: 25, stiffness: 120 }}
      >
        {/* SECTION 0: HOME (Hotkeys & Notifications) */}
        <div className="absolute top-0 left-0 w-full h-[50%] p-8 sm:p-12 overflow-y-auto">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight text-white drop-shadow-lg">
                Centro de Mando
              </h1>
              <p className="text-muted font-medium text-lg italic bg-clip-text text-transparent bg-gradient-to-r from-muted to-muted/50">
                "Accesos rápidos y notificaciones."
              </p>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-[1600px] mx-auto">
            {/* LEFT COLUMN: HOTKEYS */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-primary/20 rounded-xl text-primary">
                  <Hash size={24} />
                </div>
                <h2 className="text-xl font-bold text-white">Atajos de Teclado</h2>
              </div>
              <div className="glass-panel p-6 rounded-[32px] border border-white/5 bg-[#1a1c23]/80">
                <HotkeysTable />
              </div>
            </div>

            {/* RIGHT COLUMN: NOTIFICATIONS */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-500/20 rounded-xl text-amber-500">
                  <Bell size={24} />
                </div>
                <h2 className="text-xl font-bold text-white">Notificaciones</h2>
              </div>
              <NotificationWidget notifications={notifications} onMarkAsRead={handleMarkAsRead} />
            </div>
          </div>
        </div>

        {/* SECTION 1: DAILY SUMMARY (Old Dashboard) */}
        <div className="absolute top-[50%] left-0 w-full h-[50%] p-8 sm:p-12 overflow-y-auto">
          <div className="max-w-[1600px] mx-auto space-y-12">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
              <div className="space-y-2">
                <h1 className="text-4xl font-bold tracking-tight text-white drop-shadow-lg">
                  Resumen Diario
                </h1>
                <p className="text-muted font-medium text-lg italic bg-clip-text text-transparent bg-gradient-to-r from-muted to-muted/50">
                  "Métricas y visualización de datos."
                </p>
              </div>

              <div className="flex items-center gap-4">
                <Button
                  onClick={() => setIsEditMode(!isEditMode)}
                  className={`glass-panel p-3 rounded-2xl border transition-all duration-300 flex items-center justify-center group ${isEditMode
                    ? 'bg-primary text-white border-primary shadow-brand-glow scale-105'
                    : 'bg-surface/50 backdrop-blur-md border-base/50 text-white hover:bg-white/5'
                    }`}
                  title={isEditMode ? '💾 Guardar Cambios' : '⚙️ Personalizar Tablero'}
                >
                  {isEditMode ? <Check size={20} className="animate-pulse" /> : <Settings2 size={20} className="group-hover:rotate-45 transition-transform" />}
                </Button>

                {isEditMode && (
                  <Button
                    onClick={() => setIsCreateOpen(true)}
                    className="glass-panel px-6 py-2.5 bg-emerald-500 text-white rounded-2xl border border-emerald-400/50 shadow-emerald-500/20 shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                  >
                    <Plus size={18} />
                    <span className="text-xs font-black uppercase tracking-[0.15em]">Crear</span>
                  </Button>
                )}

              </div>
            </header>

            {/* Flexible Widget Grid */}
            <div
              data-grid-container
              className="grid grid-cols-2 lg:grid-cols-5 gap-6 relative min-h-[800px]"
              style={{ gridAutoRows: `${ROW_HEIGHT}px` }}
            >
              <AnimatePresence mode="popLayout">
                {config.map((widget) => (
                  <motion.div
                    key={widget.id}
                    data-widget-id={widget.id}
                    layout
                    style={{
                      gridColumnStart: (widget.x || 0) + 1,
                      gridColumnEnd: `span ${widget.w || 1}`,
                      gridRowStart: (widget.y || 0) + 1,
                      gridRowEnd: `span ${widget.h || 2}`,
                    }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      zIndex: draggedId === widget.id ? 100 : 1,
                      scale: draggedId === widget.id ? 1.02 : 1,
                      pointerEvents: draggedId === widget.id ? 'none' : 'auto'
                    }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 40,
                      scale: { duration: 0.2 }
                    }}
                    className="relative h-full"
                    drag={isEditMode}
                    dragSnapToOrigin={true}
                    onDragStart={() => handleDragStart(widget.id)}
                    onDragEnd={handleDragEnd}
                    onDrag={(e, info) => handleDrag(e, info, widget.id)}
                  >
                    <div className={`h-full flex flex-col relative group transition-all duration-300 ${isEditMode ? 'cursor-grab ring-2 ring-dashed ring-primary/30 rounded-[32px] overflow-hidden' : ''
                      }`}>

                      <div className={`flex-1 min-h-0 w-full h-full transition-opacity ${isEditMode ? 'pointer-events-none opacity-60' : ''}`}>
                        {widget.type === 'stat' ? (
                          <StatTile metric={widget.metric} filters={filters} size={`${widget.w}x${widget.h}`} />
                        ) : widget.type === 'grafico' ? (
                          <ChartTile metric={widget.metric} filters={filters} size={`${widget.w}x${widget.h}`} />
                        ) : (
                          <div className="bg-rose-500/10 p-4 rounded-xl text-xs text-rose-400">Widget desconocido</div>
                        )}
                      </div>

                      {/* Resize Controls (Match Style) */}
                      {isEditMode && (
                        <div className="absolute top-4 right-4 flex flex-col gap-2 z-[60]">
                          <button
                            onClick={(e) => { e.stopPropagation(); updateWidgetSize(widget.id); }}
                            className="bg-primary text-white p-2.5 rounded-xl shadow-lg hover:scale-110 active:scale-95 transition-all pointer-events-auto border border-white/20"
                            title="Siguiente Tamaño"
                          >
                            <Maximize2 size={16} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteWidget(widget.id); }}
                            className="p-2.5 bg-rose-500 text-white rounded-xl shadow-lg hover:scale-110 active:scale-95 transition-all outline-none"
                            title="Eliminar Widget"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {config.length === 0 && !loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
                  <div className="max-w-md space-y-6 glass-panel p-10 rounded-[32px] border border-base/50">
                    <div className="p-4 bg-primary/10 rounded-full w-16 h-16 mx-auto flex items-center justify-center border border-primary/20">
                      <Settings2 className="text-primary animate-spin-slow" size={32} />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-white">El tablero está vacío</h3>
                      <p className="text-muted text-sm tracking-wide">
                        Tu configuración actual no contiene elementos visibles o hubo un error al cargar.
                      </p>
                    </div>
                    <div className="flex flex-col gap-3 pt-4">
                      <Button onClick={() => setIsEditMode(true)} className="bg-primary text-white font-black uppercase tracking-widest text-[10px] py-4 rounded-2xl shadow-brand-glow">
                        🎨 Comenzar a Personalizar
                      </Button>
                      <button onClick={handleResetLayout} className="text-muted hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors py-2">
                        🔄 Reiniciar Configuración
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Ghost Feedback (Match Style) */}
              {ghost && isEditMode && (
                <div
                  className={`border-2 border-dashed rounded-[32px] absolute z-10 transition-colors duration-200 pointer-events-none flex items-center justify-center ${ghost.valid ? 'border-primary/40 bg-primary/5' : 'border-rose-500/40 bg-rose-500/5'
                    }`}
                  style={{
                    gridColumnStart: ghost.x + 1,
                    gridColumnEnd: `span ${ghost.w}`,
                    gridRowStart: ghost.y + 1,
                    gridRowEnd: `span ${ghost.h}`,
                  }}
                >
                  {!ghost.valid && (
                    <div className="bg-black/60 backdrop-blur-md text-rose-400 text-[10px] font-black uppercase px-3 py-1.5 rounded-lg tracking-widest shadow-xl">
                      Sin Espacio
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminDashboard;
