import { createBrowserRouter } from 'react-router';
import Shell from './components/Shell';
import Calculator from './pages/Calculator';
import Journal from './pages/Journal';
import Settings from './pages/Settings';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Shell,
    children: [
      { index: true, Component: Calculator },
      { path: 'journal', Component: Journal },
      { path: 'settings', Component: Settings },
    ],
  },
]);
