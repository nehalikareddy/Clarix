function SimplifiedAnalysis({ summary, sections }) {
  return (
    <div className="simplified-container">
      {/* Summary block */}
      <div className="simplified-section" style={{ marginBottom: '28px' }}>
        <h4 className="simplified-section-title">Executive Summary</h4>
        <p className="simplified-section-content" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
          {summary || "No summary available."}
        </p>
      </div>

      {/* Divider */}
      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', marginBottom: '24px' }} />

      {/* Simplified sections */}
      <div className="simplified-doc">
        {Array.isArray(sections) ? (
          sections.map((item, i) => (
            <div key={i} className="simplified-section">
              <h4 className="simplified-section-title">{item.section}</h4>
              <p className="simplified-section-content">{item.content}</p>
            </div>
          ))
        ) : typeof sections === 'string' ? (
          sections.split('\n').filter(l => l.trim()).map((line, i) => (
            <p key={i} className="simplified-section-content">{line}</p>
          ))
        ) : (
          <p className="simplified-section-content">No simplified analysis available.</p>
        )}
      </div>
    </div>
  );
}

export default SimplifiedAnalysis;
