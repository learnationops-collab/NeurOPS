// Componentes estándar de la UI. Catálogo y reglas de uso: .agents/skills/ui-builder/SKILL.md
export { Button, IconButton, LinkButton } from './Button';
export { PageHeader, HeaderActions } from './PageHeader';
export { Card, Aura, BRAND_AURA } from './Card';
export { EmptyState, ConfirmDelete, Chip, Status } from './Feedback';
export { Segmented, Select, Switch, Stepper, Modal, ModalHeader, Avatar, initials } from './Controls';
export { Accordion } from './Accordion';
export { Input, InputGroup, FieldError, TextArea } from './Fields';
export { Panel, Grid, Kpi } from './Layout';
export { Bars } from './Charts';
export { default as CifraConCuenta } from './CifraConCuenta';
export { VerRegistros, useVerRegistros, useModoRegistros, MODOS_REGISTROS } from './VerRegistros';
export { Calendar, CalendarEvent, calendarY } from './Calendar';
export { toast, closeToast, Toaster, Tooltip } from './Notify';
export { subirACapa } from './capa';
export {
    Skeleton, SkeletonBlock, SkeletonCircle, SkeletonText, SkeletonKpi, SkeletonRow, SkeletonPanel, SkeletonChart, Reveal,
    skeletonDelay, useEntryWindow,
} from './Skeleton';
