import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100dvh',
          padding: '2rem',
          fontFamily: 'monospace',
          color: '#e8edf8',
          background: '#0a0f1e',
          gap: '1rem',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '2rem' }}>Something went wrong</div>
          <pre style={{
            fontSize: '0.75rem',
            color: '#f87171',
            background: 'rgba(239,68,68,0.1)',
            padding: '1rem',
            borderRadius: '0.5rem',
            maxWidth: '40rem',
            overflow: 'auto',
            textAlign: 'left',
            whiteSpace: 'pre-wrap',
          }}>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '0.75rem 2rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: '#2563eb',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
