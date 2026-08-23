import { Component } from 'react'
import { startTimeSync } from './serverTime'
import BiblioAnalytics360 from './BiblioAnalytics360'
import KioscoView from './KioscoView'
import RegistroView from './RegistroView'

startTimeSync();

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', background: '#060d1b', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, fontFamily: 'monospace', gap: 16 }}>
          <div style={{ fontSize: 32 }}>💥</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#e11d48' }}>Error de aplicación</div>
          <pre style={{ background: '#131c2e', borderRadius: 12, padding: 20, fontSize: 12, maxWidth: 600, overflowX: 'auto', color: '#f87171', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {String(this.state.error)}
            {'\n\n'}
            {this.state.error?.stack ?? ''}
          </pre>
          <button onClick={() => window.location.reload()} style={{ padding: '12px 28px', borderRadius: 10, border: 'none', background: '#0d9488', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const path = window.location.pathname;
  if (path === '/kiosco')   return <ErrorBoundary><KioscoView /></ErrorBoundary>;
  if (path === '/registro') return <ErrorBoundary><RegistroView /></ErrorBoundary>;
  return <ErrorBoundary><BiblioAnalytics360 /></ErrorBoundary>;
}

export default App
