import React from 'react';
import { HashRouter } from 'react-router-dom';
import { AppRoutes } from './routes';

export const App: React.FC = () => {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
};
