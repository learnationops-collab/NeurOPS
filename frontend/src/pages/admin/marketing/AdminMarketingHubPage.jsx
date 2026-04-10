import { useState } from 'react';
import AdManagementPage from '../../public/AdManagementPage';

const AdminMarketingHubPage = () => {
    // Para marketing solo dejamos AdManagementPage por ahora, a menos que luego agreguen más,
    // pero dejamos la estructura para poder poner tabs si es necesario.
    return (
        <div className="relative bg-background min-h-screen">
            <div className="w-full">
                <AdManagementPage />
            </div>
        </div>
    );
};

export default AdminMarketingHubPage;
