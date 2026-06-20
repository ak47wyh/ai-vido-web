import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', padding: '2rem', textAlign: 'center',
          background: 'var(--bg-base, #0a0a0f)', color: 'var(--text-primary, #e5e5e5)'
        }}>
          <AlertTriangle size={48} style={{ color: '#f87171', marginBottom: '1.5rem' }} />
          <h2 style={{ marginBottom: '0.75rem', fontSize: '1.25rem' }}>Something went wrong</h2>
          <p style={{ color: 'var(--text-muted, #9ca3af)', marginBottom: '1.5rem', maxWidth: '480px', lineHeight: 1.6 }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            onClick={this.handleReload}
          >
            <RefreshCw size={16} /> Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
