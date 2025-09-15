import React from 'react';
import './landingPage.css';

const LandingPage = ({ onEnter, onShowDocs }) => {
  return (
    <div className="landing-root">
        <button
        type="button"
        className="landing-docs-btn"
        onClick={onShowDocs}
        title="View documentation"
        >
        📘 Documentation
      </button>
      <div className="landing-left">
        <h1 className="landing-title">Network Traceroute Visualization</h1>
        <p className="landing-subtitle">
          Explore end-to-end network paths, latency, alternative routes, and hop level details with interactive visual analytics.
        </p>
        <div className="landing-actions">
          <button className="landing-button" onClick={onEnter}>
            Open Charts →
          </button>
          <a
            href="https://github.com/tommy812/react-graph-vis"
            target="_blank"
            rel="noreferrer noopener"
            className="landing-gh-pill"
            title="Open on Git Hub"
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path fill="#fff" d="M12 .5C5.73.5.98 5.24.98 11.52c0 4.86 3.15 8.98 7.51 10.44.55.1.75-.24.75-.53 0-.26-.01-1.13-.02-2.05-3.06.67-3.71-1.3-3.71-1.3-.5-1.27-1.22-1.61-1.22-1.61-.99-.68.07-.67.07-.67 1.1.08 1.68 1.13 1.68 1.13.97 1.66 2.54 1.18 3.16.9.1-.7.38-1.18.69-1.45-2.44-.28-5.01-1.22-5.01-5.43 0-1.2.43-2.18 1.13-2.95-.11-.28-.49-1.42.11-2.96 0 0 .92-.29 3.02 1.13.87-.24 1.81-.36 2.74-.36.93 0 1.87.12 2.74.36 2.1-1.42 3.02-1.13 3.02-1.13.6 1.54.22 2.68.11 2.96.7.77 1.13 1.75 1.13 2.95 0 4.22-2.58 5.15-5.03 5.43.39.34.74 1.01.74 2.05 0 1.48-.01 2.67-.01 3.03 0 .29.2.64.75.53 4.36-1.46 7.51-5.58 7.51-10.44C23.02 5.24 18.27.5 12 .5Z"/>
            </svg>
            <span>Open on Git Hub</span>
          </a>
        </div>
        <div className="landing-meta">
          v1 • Real-time path aggregation • Protocol & RTT filters • Domain grouping
        </div>
      </div>
      <div className="landing-right">
        <img
          src={process.env.PUBLIC_URL + '/graph.png'}
          alt="Network graph illustration"
          className="landing-illustration"
          draggable="false"
        />
      </div>
    </div>
  );
};

export default LandingPage;