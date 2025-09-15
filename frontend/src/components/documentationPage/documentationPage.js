import React from 'react';
import './documentationPage.css';

const DocumentationPage = ({ onBack, onEnter }) => {
  return (
    <div className="docs-root">
      <div className="docs-header">
        <h1>📘 User Guide</h1>
        <div className="docs-actions">
          <button onClick={onBack}>← Back</button>
          <button onClick={onEnter}>Open Charts →</button>
        </div>
      </div>

      <div className="docs-content">
        <nav aria-label="Table of contents">
          <h2>Overview</h2>
          <p>
            This application visualizes network paths from traceroute data to help you explore
            routing behavior, latency, and peering relationships over time. Use the sidebar to
            pick destinations, apply filters, and the interactive graph to inspect paths and hops.
          </p>
          <p>
            This is an <strong>open-source</strong> project. Contribute or report issues on
            <a href="https://github.com/tommy812/react-graph-vis.git" target="_blank" rel="noreferrer noopener"> GitHub</a>.
          </p>
          <ul>
            <li><a href="#getting-started">Getting started</a></li>
            <li><a href="#interface">Interface overview</a></li>
            <li><a href="#sidebar">Sidebar and selection</a></li>
            <li><a href="#graph">Graph interactions</a></li>
            <li><a href="#filters">Filters and time range</a></li>
            <li><a href="#panels">Details panels</a></li>
            <li><a href="#export">Export and fullscreen</a></li>
            <li><a href="#data-model">Data model</a></li>
            <li><a href="#performance">Performance tips</a></li>
            <li><a href="#troubleshooting">Troubleshooting</a></li>
            <li><a href="#faq">FAQ</a></li>
          </ul>
        </nav>

        <section id="getting-started">
          <h2>Getting started</h2>
          <ul>
            <li>Click <strong>Open Charts</strong> to enter the graph view.</li>
            <li>In the left sidebar, expand a domain to reveal destination IPs.</li>
            <li>Select one or more IPs to build the network graph.</li>
            <li>Adjust the time range to focus on a specific period of traceroutes.</li>
          </ul>
        </section>

        <section id="interface">
          <h2>Interface overview</h2>
          <ul>
            <li><strong>Sidebar</strong>: choose domains/IPs, set filters, manage time range.</li>
            <li><strong>Graph canvas</strong>: interactive nodes and edges representing hops and links.</li>
            <li><strong>Controls</strong>: zoom, fit to screen, layout and visibility options.</li>
            <li><strong>Drawers/Panels</strong>: detailed information about hops, full paths, and peering data.</li>
          </ul>
        </section>

        <section id="sidebar">
          <h2>Sidebar and selection</h2>
          <ul>
            <li><strong>Domain checkbox</strong> selects or deselects all IPs under that domain.</li>
            <li>After selecting a domain, you can uncheck individual IPs for a partial selection.</li>
            <li>Use quick access or saved presets (if enabled) to rapidly switch contexts.</li>
          </ul>
        </section>

        <section id="graph">
          <h2>Graph interactions</h2>
          <ul>
            <li>Hover nodes/edges to see tooltips with latency, ASNs, and hop metadata.</li>
            <li>Click a hop to open the details drawer. Use the path highlight to follow flows.</li>
            <li>Primary vs alternative paths are color-coded with usage percentages when available.</li>
            <li>Use the on-canvas controls to zoom, center, and toggle layout options.</li>
          </ul>
        </section>

        <section id="filters">
          <h2>Filters and time range</h2>
          <ul>
            <li><strong>Protocol</strong>: filter by ICMP/TCP/UDP (as supported by the dataset).</li>
            <li><strong>RTT</strong>: constrain hops by round-trip time thresholds.</li>
            <li><strong>Path type</strong>: include primary and/or alternative routes.</li>
            <li><strong>Usage %</strong>: require a minimum frequency for alternative paths.</li>
            <li><strong>Time range</strong>: choose absolute dates or presets to scope the data.</li>
          </ul>
        </section>

        <section id="panels">
          <h2>Details panels</h2>
          <ul>
            <li><strong>Hop Drawer</strong>: IP, ASN, RTT stats, geolocation, and related paths.</li>
            <li><strong>Full Traceroute</strong>: end-to-end hops for a run with timings and status.</li>
            <li><strong>PeeringDB</strong>: facility and peering information when available.</li>
          </ul>
        </section>

        <section id="export">
          <h2>Export and fullscreen</h2>
          <ul>
            <li>Use export to download the current graph as PNG/SVG (as supported).</li>
            <li>Toggle fullscreen for focused analysis and better screenshots.</li>
          </ul>
        </section>

        <section id="data-model">
          <h2>Data model</h2>
          <ul>
            <li>Domains → Destinations (IPs) → Trace runs → Hops.</li>
            <li>Each hop can include RTTs, ASN, geolocation, and loss indicators.</li>
            <li>Paths are grouped into primary and alternative with usage percentages.</li>
          </ul>
        </section>

        <section id="performance">
          <h2>Performance tips</h2>
          <ul>
            <li>Limit the number of concurrently selected IPs to speed up renders.</li>
            <li>Use time range to reduce dataset size when investigating a specific window.</li>
            <li>Underlying UI uses memoization and virtual lists; graph rebuild scopes to selection.</li>
          </ul>
        </section>

        <section id="troubleshooting">
          <h2>Troubleshooting</h2>
          <ul>
            <li><strong>No data appears</strong>: ensure at least one destination IP is selected and time range includes runs.</li>
            <li><strong>High latency spikes</strong>: verify protocol filter and compare across time ranges.</li>
            <li><strong>Missing ASN/Geo</strong>: data may be incomplete; check PeeringDB panel for context.</li>
          </ul>
        </section>

        <section id="faq">
          <h2>FAQ</h2>
          <ul>
            <li><strong>What is a primary path?</strong> The most frequently observed route for a destination.</li>
            <li><strong>What are alternative paths?</strong> Less common routes with associated usage percentages.</li>
            <li><strong>Can I compare two destinations?</strong> Yes. Select multiple IPs; the graph merges paths and highlights shared hops.</li>
          </ul>
        </section>

        <section id="open-source">
          <h2>Open source</h2>
          <p>
            Built by the community, for the community. Star the repo, open issues, or submit PRs:
            <a href="https://github.com/your-org/your-repo" target="_blank" rel="noreferrer noopener"> github.com/your-org/your-repo</a>.
          </p>
        </section>
      </div>
    </div>
  );
};

export default DocumentationPage;