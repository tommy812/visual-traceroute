import React from 'react';
import { QUICK_ACCESS_OPTIONS } from '../../constants/quickAccessOptions';

const QuickAccessButtons = ({ onQuickAccess, currentPeriod }) => {
  return (
    <div style={{ marginBottom: '15px' }}>
      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
        Quick Access:
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {QUICK_ACCESS_OPTIONS.map((option) => (
          <button
            key={option.id}
            onClick={() => onQuickAccess(option.id)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              backgroundColor: currentPeriod === option.id ? '#007bff' : '#f8f9fa',
              color: currentPeriod === option.id ? 'white' : '#495057',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            title={option.description}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickAccessButtons; 