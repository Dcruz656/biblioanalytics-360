import BiblioAnalytics360 from './BiblioAnalytics360'
import KioscoView from './KioscoView'

function App() {
  const isKiosk = window.location.pathname === '/kiosco';
  return isKiosk ? <KioscoView /> : <BiblioAnalytics360 />;
}

export default App
