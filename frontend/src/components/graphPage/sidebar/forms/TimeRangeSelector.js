import React from 'react';
import { toLocalInputValue, fromLocalInputValue } from '../../../../utils/dateUtils';
import { QUICK_ACCESS_OPTIONS } from '../../../../constants/quickAccessOptions';

const TimeRangeSelector = ({ dateRange, currentPeriod, onQuickAccess }) => (
  <div style={{ padding: '15px', backgroundColor: '#fff', borderBottom: '1px solid #dee2e6' }}>
    <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#333' }}>
      📅 Time Range
    </h3>
    <div style={{ marginBottom: '10px' }}>
      <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '6px' }}>
        Quick Access:
      </label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {QUICK_ACCESS_OPTIONS.map(({ id, label }) => {
          const active = currentPeriod === id;
          return (
            <button
              key={id}
              onClick={() => onQuickAccess(id)}
              style={{
                padding: '6px 10px',
                border: `1px solid ${active ? '#28a745' : '#007bff'}`,
                backgroundColor: active ? '#28a745' : '#007bff',
                color: 'white',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: active ? 'bold' : '500'
              }}
            >
              {label} {active && '(Active)'}
            </button>
          );
        })}
      </div>
    </div>
    <div>
      <label style={{ fontSize: '12px', fontWeight: '500', color: '#666', display: 'block', marginBottom: '6px' }}>
        Custom Range:
      </label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div>
          <label style={{ fontSize: '11px', color: '#666' }}>Start:</label>
          <input
            type="datetime-local"
            value={toLocalInputValue(dateRange.start)}
            onChange={e => onQuickAccess('custom', { start: fromLocalInputValue(e.target.value) })}
            style={{
              width: '100%',
              padding: '4px 6px',
              border: '1px solid #ccc',
              borderRadius: '3px',
              fontSize: '11px',
              display: 'block',
              marginTop: '2px',
              boxSizing: 'border-box'
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: '11px', color: '#666' }}>End:</label>
          <input
            type="datetime-local"
            value={toLocalInputValue(dateRange.end)}
            onChange={e => onQuickAccess('custom', { end: fromLocalInputValue(e.target.value) })}
            style={{
              width: '100%',
              padding: '4px 6px',
              border: '1px solid #ccc',
              borderRadius: '3px',
              fontSize: '11px',
              display: 'block',
              marginTop: '2px',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>
    </div>
  </div>
);

export default TimeRangeSelector;