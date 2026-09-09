import Discovery from './components/discovery';
import { Privacy } from './pages/Privacy';
import { ConfirmAuth } from './pages/ConfirmAuth';

export function App() {
  const path = window.location.pathname;
  if (path === '/confidentialite') return <Privacy />;
  if (path === '/auth/confirm') return <ConfirmAuth />;
  return <Discovery />;
}
