import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import RiskBadge from '../components/RiskBadge';
import ChatBox from '../components/ChatBox';
import Loader from '../components/Loader';
import SimplifiedAnalysis from '../components/SimplifiedAnalysis';

function DocumentView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('document'); // for mobile tabs

  useEffect(() => {
    fetchDocument();
  }, [id]);

  const fetchDocument = async () => {
    try {
      const res = await api.get(`/api/docs/${id}`);
      setDoc(res.data);
    } catch (err) {
      console.error(err);
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="container"><Loader /></div>;
  if (!doc) return <div className="container">Document not found</div>;

  return (
    <div className="document-view-container">

      {/* Mobile Tab Bar */}
      <div className="mobile-tabs">
        <button className={`mobile-tab ${activeTab === 'analysis' ? 'active' : ''}`} onClick={() => setActiveTab('analysis')}>
          ⚠️ Risks
        </button>
        <button className={`mobile-tab ${activeTab === 'document' ? 'active' : ''}`} onClick={() => setActiveTab('document')}>
          📄 Document
        </button>
        <button className={`mobile-tab ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>
          💬 Ask
        </button>
      </div>

      {/* LEFT — Risks only */}
      <div className={`doc-panel doc-panel-left ${activeTab !== 'analysis' ? 'mobile-hidden' : ''}`}>
        <div className="doc-panel-header">
          <h3>Risk Analysis</h3>
          <span className="risk-score-badge">{doc.riskScore}/10</span>
        </div>
        <div className="doc-panel-body">
          <div className="risks-list">
            {[...doc.riskClauses]
              .sort((a, b) => {
                const order = { high: 0, medium: 1, low: 2 };
                return order[a.severity] - order[b.severity];
              })
              .map((risk, idx) => (
                <div key={idx} className="risk-item">
                <div className="risk-header">
                  <span>{risk.clause}</span>
                  <RiskBadge severity={risk.severity} />
                </div>
                <p>{risk.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MIDDLE — Summary + Simplified */}
      <div className={`doc-panel doc-panel-middle ${activeTab !== 'document' ? 'mobile-hidden' : ''}`}>
        <div className="doc-panel-header">
          <h3>{doc.fileName}</h3>
          <span className="doc-panel-label">Document</span>
        </div>
        <div className="doc-panel-body">
          <SimplifiedAnalysis summary={doc.summary} sections={doc.simplified} />
        </div>
      </div>

      {/* RIGHT — Chatbox */}
      <div className={`doc-panel doc-panel-right ${activeTab !== 'chat' ? 'mobile-hidden' : ''}`}>
        <div className="doc-panel-header">
          <h3>Ask Questions</h3>
          <span className="doc-panel-label">Powered by AI</span>
        </div>
        <div className="doc-panel-body doc-panel-chat">
          <ChatBox docId={doc._id} initialHistory={doc.chatHistory} />
        </div>
      </div>
      
      {/* Disclaimer Ticker */}
      <div className="disclaimer-ticker">
        <div className="disclaimer-label">IMPORTANT</div>
        <div className="disclaimer-track">
          <div className="disclaimer-inner">
            <span className="disclaimer-text">⚠️ AI-generated analysis only. Not legal advice. Consult a qualified lawyer before making any legal or business decisions based on this analysis.</span>
            <span className="disclaimer-text">⚠️ AI-generated analysis only. Not legal advice. Consult a qualified lawyer before making any legal or business decisions based on this analysis.</span>
            <span className="disclaimer-text">⚠️ AI-generated analysis only. Not legal advice. Consult a qualified lawyer before making any legal or business decisions based on this analysis.</span>
          </div>
        </div>
      </div>

    </div>
  );
}

export default DocumentView;
