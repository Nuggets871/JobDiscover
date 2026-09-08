import Discovery from './components/discovery';
import { Privacy } from './pages/Privacy';

export function App() {
  const path = window.location.pathname;
  if (path === '/confidentialite') return <Privacy />;
  return <Discovery />;
}