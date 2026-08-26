import { startTimeSync } from './serverTime'
import BiblioAnalytics360 from './BiblioAnalytics360'
import KioscoView from './KioscoView'
import RegistroView from './RegistroView'
import CubiQRView from './CubiQRView'

startTimeSync();

function App() {
  const path = window.location.pathname;
  if (path === '/kiosco')              return <KioscoView />;
  if (path === '/registro')            return <RegistroView />;
  if (path === '/cubiculo' || path === '/cubiculo/') return <CubiQRView />;
  if (path.startsWith('/cubiculo/')) {
    const cubiId = decodeURIComponent(path.slice('/cubiculo/'.length));
    return <CubiQRView cubiId={cubiId} />;
  }
  return <BiblioAnalytics360 />;
}

export default App
