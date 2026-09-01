import { lazy, Suspense } from 'react'
import { startTimeSync } from './serverTime'

startTimeSync();

const BiblioAnalytics360 = lazy(() => import('./BiblioAnalytics360'));
const KioscoView = lazy(() => import('./KioscoView'));
const RegistroView = lazy(() => import('./RegistroView'));
const CubiQRView = lazy(() => import('./CubiQRView'));

function Loader() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#0f172a' }}>
      <div style={{ width:40, height:40, border:'3px solid rgba(255,255,255,0.1)', borderTop:'3px solid #0d9488', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
    </div>
  );
}

function App() {
  const path = window.location.pathname;
  if (path === '/kiosco')
    return <Suspense fallback={<Loader />}><KioscoView /></Suspense>;
  if (path === '/registro')
    return <Suspense fallback={<Loader />}><RegistroView /></Suspense>;
  if (path === '/cubiculo' || path === '/cubiculo/') { window.location.replace('/kiosco'); return null; }
  if (path.startsWith('/cubiculo/')) {
    const cubiId = decodeURIComponent(path.slice('/cubiculo/'.length));
    return <Suspense fallback={<Loader />}><CubiQRView cubiId={cubiId} /></Suspense>;
  }
  return <Suspense fallback={<Loader />}><BiblioAnalytics360 /></Suspense>;
}

export default App
