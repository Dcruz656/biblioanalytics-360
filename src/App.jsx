import { startTimeSync } from './serverTime'
import BiblioAnalytics360 from './BiblioAnalytics360'
import KioscoView from './KioscoView'
import RegistroView from './RegistroView'

// Sincronizar con el servidor al cargar la app (re-sync cada 5 min)
startTimeSync();

function App() {
  const path = window.location.pathname;
  if (path === '/kiosco')   return <KioscoView />;
  if (path === '/registro') return <RegistroView />;
  return <BiblioAnalytics360 />;
}

export default App
