import React from 'react';
import './documentationPage.css';

const DocumentationPage = ({ onBack, onEnter }) => {
  return (
    <div className="docs-root">
      <div className="docs-header">
        <h1>📘 Documentation</h1>
        <div className="docs-actions">
          <button onClick={onBack}>← Back</button>
          <button onClick={onEnter}>Open Charts →</button>
        </div>
      </div>

      <div className="docs-content">
        <section>
          <h2>Overview</h2>
          <p>This tool visualizes traceroute runs grouped by destination IP (organized under domains).</p>
        </section>
        <section>
          <h2>Data Model</h2>
          <ul>
            <li>Domains → Destinations (IPs) → Trace Runs → Hops</li>
            <li>Primary vs Alternative path types with usage percentages.</li>
          </ul>
        </section>
        <section>
          <h2>Key Interactions</h2>
          <ul>
            <li>Select domains or individual IPs in sidebar.</li>
            <li>Hover / click hops to open detailed drawer.</li>
            <li>Filters: protocol, RTT range, path types, usage %, date range.</li>
          </ul>
        </section>
        <section>
          <h2>Shortcuts</h2>
          <ul>
            <li>Domain checkbox: select/deselect all IPs.</li>
            <li>Uncheck IP after domain selection → domain becomes partial.</li>
          </ul>
        </section>
        <section>
          <h2>Performance Notes</h2>
          <ul>
            <li>Memoized selectors & virtual scrolling for large sets.</li>
            <li>Graph rebuild scoped to selected IP list.</li>
          </ul>
        </section>
      </div>
    </div>
  );
};

export default DocumentationPage;