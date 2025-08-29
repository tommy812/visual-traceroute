import React from 'react';

const SidebarFooter = ({ onOpenSettings, onGoLanding }) => {
  return (
    <div style={{
      borderTop: '1px solid #d0d7de',
      padding: '10px 12px',
      background: '#f8f9fa',
      display: 'flex',
      gap: '8px',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: '12px'
    }}>
        <button
        onClick={typeof onGoLanding === 'function' ? onGoLanding : undefined}
        style={{
          flex: 1,
          background: '#1976d2',
          color: '#fff',
          border: '1px solid #1565c0',
          padding: '6px 8px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 600
        }}
        title="Return to landing page"
      >
        ⬅ Close Chart
      </button>
      <button
        onClick={onOpenSettings}
        style={{
          flex: 1,
          background: '#ffffff',
          border: '1px solid #b0bec5',
          padding: '6px 8px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 600
        }}
      >
        ⚙️ Settings
      </button>
      
    </div>
  );
};

export default SidebarFooter;