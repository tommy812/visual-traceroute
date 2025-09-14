import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          height: '100%', flexDirection: 'column', padding: '20px',
          backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '4px'
        }}>
          <div style={{ fontSize: '24px', marginBottom: '10px' }}>⚠️</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px', color: '#dc3545' }}>
            Something went wrong
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 16px', fontSize: '14px', backgroundColor: '#007bff',
              color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'
            }}
          >
            🔄 Refresh
          </button>
        </div>
      );
    }
    // eslint-disable-next-line react/prop-types
    return this.props.children;
  }
}
