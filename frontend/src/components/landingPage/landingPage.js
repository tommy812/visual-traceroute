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
        <button className="landing-button" onClick={onEnter}>
          Open Charts →
        </button>
        <div className="landing-meta">
          v1 • Real-time path aggregation • Protocol & RTT filters • Domain grouping
        </div>
      </div>
      <div className="landing-right">
        <img
          src={process.env.PUBLIC_URL + '/graph.svg'}
          alt="Network graph illustration"
          className="landing-illustration"
          draggable="false"
        />
      </div>
    </div>
  );
};

export default LandingPage;