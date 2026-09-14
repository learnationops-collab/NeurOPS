import AreaCard from './AreaCard';
import NewAreaCard from './NewAreaCard';

const AreaGrid = ({ roadmaps, onEnter, onDelete, onCreate }) => (
    <section>
        <h1 style={{ marginBottom: 20 }}>Estructura del contenido</h1>
        <div className="area-grid">
            {roadmaps.map((roadmap) => (
                <AreaCard key={roadmap.id} roadmap={roadmap} onEnter={onEnter} onDelete={onDelete} />
            ))}
            <NewAreaCard onCreate={onCreate} />
        </div>
    </section>
);

export default AreaGrid;
