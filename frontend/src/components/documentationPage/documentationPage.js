import React from 'react';
import './documentationPage.css';

const DocumentationPage = ({ onBack, onEnter }) => {
  return (
    <div className="docs-root">
      <div className="docs-header">
        <h1>📘 User Guide</h1>
        <div className="docs-actions">
          <button onClick={onBack}>← Home Page</button>
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
            <a href="https://github.com/tommy812/" target="_blank" rel="noreferrer noopener"> GitHub</a>. (Public Repo Avalilable Soon).
          </p>
          <ul>
            <li><a href="#getting-started">Getting started</a></li>
            <li><a href="#interface">Interface overview</a></li>
            <li><a href="#sidebar">Sidebar and selection</a></li>
            <li><a href="#graph">Graph interactions</a></li>
            <li><a href="#filters">Filters and time range</a></li>
            <li><a href="#aggregation">Path aggregation</a></li>
            <li><a href="#hierarchy">Network hierarchy</a></li>
            <li><a href="#highlighting">Path highlighting</a></li>
            <li><a href="#panels">Details panels</a></li>
            <li><a href="#export">Export and import</a></li>
            <li><a href="#optimization">Graph optimization</a></li>
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
            <li><strong>Path Types</strong>: filter by path characteristics:
              <ul>
                <li><strong>Most/Least Used</strong>: paths with highest/lowest frequency</li>
                <li><strong>Fastest/Slowest</strong>: paths with lowest/highest average RTT</li>
                <li><strong>Fewest/Most Hops</strong>: paths with shortest/longest hop count</li>
              </ul>
            </li>
            <li><strong>Timeout Handling</strong>: 
              <ul>
                <li><strong>Hide Successful Paths</strong>: show only paths that didn't reach destination</li>
                <li><strong>Only Successful Paths</strong>: show only paths that reached destination</li>
              </ul>
            </li>
            <li><strong>RTT Range</strong>: constrain hops by round-trip time thresholds (min/max in milliseconds).</li>
            <li><strong>Usage %</strong>: require a minimum frequency for alternative paths.</li>
            <li><strong>Time range</strong>: choose absolute dates or presets to scope the data.</li>
          </ul>
        </section>

        <section id="aggregation">
          <h2>Path aggregation</h2>
          <p>Advanced path aggregation helps reduce visual clutter and identify common network patterns:</p>
          <ul>
            <li><strong>Show All Paths</strong>: displays every individual path separately with unique colors (default mode)</li>
            <li><strong>Shared IPs</strong>: groups paths that share common intermediate hops, showing usage counts for each shared node</li>
            <li><strong>Aggregation Scope</strong>: 
              <ul>
                <li><strong>Per-destination</strong>: aggregate paths within each destination separately</li>
                <li><strong>Cross-destination</strong>: aggregate paths across all selected destinations</li>
              </ul>
            </li>
            <li><strong>Smart Disabling</strong>: "Show All Paths" is automatically disabled for large selections to maintain performance</li>
          </ul>
        </section>

        <section id="hierarchy">
          <h2>Network hierarchy</h2>
          <p>Group network nodes by different levels of network hierarchy to understand routing at various scales:</p>
          <ul>
            <li><strong>Individual IPs</strong>: show every IP address separately (default)</li>
            <li><strong>ASN</strong>: group IPs by Autonomous System Number</li>
            <li><strong>Prefix (/64)</strong>: group IPs by /64 subnet prefixes</li>
            <li><strong>ISP-POP (/48)</strong>: group IPs by /48 prefixes (ISP Point of Presence level)</li>
            <li><strong>ISP (/32)</strong>: group IPs by /32 prefixes (ISP level)</li>
            <li><strong>Prefix Grouping</strong>: when enabled, allows expanding/collapsing grouped prefixes</li>
            <li><strong>Interactive Expansion</strong>: click on grouped nodes to expand and see individual IPs</li>
          </ul>
        </section>

        <section id="highlighting">
          <h2>Path highlighting</h2>
          <p>Interactive path highlighting helps trace specific routes through the network:</p>
          <ul>
            <li><strong>Click to Highlight</strong>: click any node or edge to highlight all paths that use it</li>
            <li><strong>Color Coding</strong>: each highlighted path gets a unique color for easy identification</li>
            <li><strong>Path Information Panel</strong>: shows detailed information about highlighted paths including:
              <ul>
                <li>Destination addresses</li>
                <li>Path types (primary/alternative)</li>
                <li>Protocols used</li>
                <li>Node and edge counts</li>
              </ul>
            </li>
            <li><strong>Clear Highlights</strong>: use the "Clear All Highlights" button to reset highlighting</li>
            <li><strong>Visual Indicators</strong>: solid lines for primary paths, dashed lines for alternative paths</li>
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
          <h2>Export and import</h2>
          <ul>
            <li><strong>Graph Export</strong>: download the current graph visualization:
              <ul>
                <li><strong>PNG</strong>: high-quality raster image for presentations</li>
                <li><strong>SVG</strong>: scalable vector format for editing</li>
                <li><strong>JSON</strong>: complete graph data for analysis or sharing</li>
              </ul>
            </li>
            <li><strong>Graph Import</strong>: load previously exported graph data:
              <ul>
                <li>Import JSON files to restore saved graph states</li>
                <li>Share graph visualizations with others</li>
                <li>Analyze historical network states</li>
              </ul>
            </li>
            <li><strong>Fullscreen Mode</strong>: toggle fullscreen for focused analysis and better screenshots</li>
            <li><strong>Responsive Controls</strong>: all export/import controls adapt to screen size</li>
          </ul>
        </section>

        <section id="optimization">
          <h2>Graph optimization</h2>
          <p>Advanced algorithms automatically optimize graph layout and path ordering for better visualization:</p>
          <ul>
            <li><strong>Layout Optimization</strong>: intelligent algorithms minimize edge crossings and improve readability</li>
            <li><strong>Path Sorting</strong>: multiple sorting strategies available:
              <ul>
                <li><strong>Hop Count</strong>: sort paths by number of hops</li>
                <li><strong>Multi-criteria</strong>: combine hop count, success rate, and RTT</li>
                <li><strong>Topology-aware</strong>: consider network structure for optimal ordering</li>
                <li><strong>Centrality-based</strong>: prioritize paths through important network nodes</li>
              </ul>
            </li>
            <li><strong>Performance Optimization</strong>: 
              <ul>
                <li>Automatic strategy selection based on data size and complexity</li>
                <li>Memoization and caching for faster re-renders</li>
                <li>Virtual rendering for large datasets</li>
              </ul>
            </li>
            <li><strong>Protocol Filtering Detection</strong>: automatically detects when network protocols are filtered at network edges</li>
            <li><strong>Smart Disabling</strong>: certain features are automatically disabled for large selections to maintain performance</li>
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
            <li><strong>Selection Management</strong>: limit the number of concurrently selected IPs to speed up renders</li>
            <li><strong>Time Range Filtering</strong>: use time range to reduce dataset size when investigating a specific window</li>
            <li><strong>Aggregation Strategies</strong>: 
              <ul>
                <li>Use "Shared IPs" aggregation for large selections to reduce visual complexity</li>
                <li>Enable network hierarchy grouping to simplify large graphs</li>
                <li>Note that "Show All Paths" is automatically disabled for large selections</li>
              </ul>
            </li>
            <li><strong>Optimization Features</strong>:
              <ul>
                <li>Automatic layout optimization minimizes edge crossings</li>
                <li>Smart path sorting improves visual clarity</li>
                <li>Memoization and caching speed up re-renders</li>
                <li>Virtual rendering handles large datasets efficiently</li>
              </ul>
            </li>
            <li><strong>Mobile Optimization</strong>: responsive controls automatically adapt to screen size for better mobile performance</li>
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
            <li><strong>Why is "Show All Paths" disabled?</strong> This feature is automatically disabled for large selections (many destinations or long time ranges) to maintain performance. Use "Shared IPs" aggregation instead.</li>
            <li><strong>What's the difference between aggregation modes?</strong> 
              <ul>
                <li><strong>Show All Paths</strong>: displays every individual path with unique colors</li>
                <li><strong>Shared IPs</strong>: groups paths that share common intermediate hops, showing usage counts</li>
              </ul>
            </li>
            <li><strong>How does network hierarchy work?</strong> You can group IPs by different network levels (ASN, subnet, ISP-POP, ISP) to understand routing at various scales. Click grouped nodes to expand and see individual IPs.</li>
            <li><strong>Can I save and share my graph visualizations?</strong> Yes! Use the JSON export feature to save graph data, then import it later or share with others.</li>
            <li><strong>What's protocol filtering detection?</strong> The system automatically detects when network protocols are filtered at network edges by analyzing traceroute behavior patterns.</li>
          </ul>
        </section>

        <section id="open-source">
          <h2>Open source</h2>
          <p>
            Built by the community, for the community. Star the repo, open issues, or submit PRs:
            <a href="https://github.com/tommy812/react-graph-vis.git" target="_blank" rel="noreferrer noopener">https://github.com/tommy812/</a> (Public Repo Avalilable Soon).
          </p>
        </section>
      </div>
    </div>
  );
};

export default DocumentationPage;