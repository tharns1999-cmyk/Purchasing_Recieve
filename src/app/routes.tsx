import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PurchasingPage } from '@/features/purchasing/PurchasingPage';
import { SuppliersPage } from '@/features/purchasing/suppliers/SuppliersPage';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Purchasing Module as Main App Entrypoint */}
      <Route path="/" element={<PurchasingPage />} />
      <Route path="/purchasing" element={<PurchasingPage />} />
      <Route path="/purchasing/*" element={<PurchasingPage />} />
      <Route path="/purchasing/suppliers" element={<SuppliersPage />} />

      {/* Catch-all fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
