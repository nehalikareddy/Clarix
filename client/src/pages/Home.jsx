import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
const tickerItems = [
  { legal: 'Force Majeure', plain: 'Not your fault' },
  { legal: 'Indemnification', plain: 'You pay if it goes wrong' },
  { legal: 'Notwithstanding', plain: 'Despite what was said above' },
  { legal: 'Heretofore', plain: 'Before this point' },
  { legal: 'In perpetuity', plain: 'Forever' },
  { legal: 'Liquidated damages', plain: 'A fixed penalty fee' },
  { legal: 'Whereas', plain: 'Given that' },
  { legal: 'Pursuant to', plain: 'As required by' },
  { legal: 'Ab initio', plain: 'From the beginning' },
  { legal: 'Estoppel', plain: 'You can\'t go back on your word' },
];

function Home() {
  const { user } = useAuth();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="home-container">
      <div className="hero-section">

        {/* Background decorative symbol */}
        <div className="hero-bg-symbol">C</div>

        <div className="hero-content">
          <p className="hero-eyebrow">Legal Intelligence, Simplified</p>
          <h1 className="hero-title">
            Understand Any<br />
            Legal Document<br />
            <span className="hero-title-accent">in Seconds.</span>
          </h1>
          <p className="hero-subtitle">
            Clarix reads complex contracts, flags risky clauses, and translates legal jargon into plain English — so you can sign with confidence.
          </p>

          <div className="hero-buttons">
            <Link to="/register" className="btn btn-primary btn-lg">Get Started Free</Link>
            <Link to="/login" className="btn btn-outline btn-lg">Log In</Link>
          </div>

          <div className="hero-features-row">
            <div className="hero-feature">
              <span className="feature-dot"></span>Upload any PDF
            </div>
            <div className="hero-feature">
              <span className="feature-dot"></span>Flag risky clauses
            </div>
            <div className="hero-feature">
              <span className="feature-dot"></span>Ask AI questions
            </div>
          </div>
        </div>
      </div>

      {/* Scrolling ticker */}
      <div className="ticker-strip">
        <div className="ticker-label">CLARIX DECODES</div>
        <div className="ticker-track">
          <div className="ticker-inner">
            {[...tickerItems, ...tickerItems].map((item, i) => (
              <div key={i} className="ticker-item">
                <span className="ticker-legal">"{item.legal}"</span>
                <span className="ticker-arrow">→</span>
                <span className="ticker-plain">{item.plain}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
