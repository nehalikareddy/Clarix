import { Link } from 'react-router-dom';

function DocumentCard({ doc, onDelete }) {
  return (
    <div className="document-card">
      <div className="doc-card-header">
        <h3 title={doc.fileName}>{doc.fileName}</h3>
        <button className="btn-icon" onClick={() => onDelete(doc._id)}>🗑️</button>
      </div>
      <p className="doc-summary">{doc.summary}</p>
      <div className="doc-footer">
        <span className="risk-badge">Risk: {doc.riskScore}/10</span>
        <Link to={`/doc/${doc._id}`} className="btn btn-primary btn-sm">View Analysis</Link>
      </div>
    </div>
  );
}

export default DocumentCard;
