import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import UploadBox from '../components/UploadBox';
import DocumentCard from '../components/DocumentCard';
import Loader from '../components/Loader';

function Dashboard() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchDocs();
  }, []);

  const fetchDocs = async () => {
    try {
      const res = await api.get('/api/docs');
      setDocs(res.data);
    } catch (err) {
      setError('Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (file) => {
    const formData = new FormData();
    formData.append('pdf', file);

    setUploading(true);
    setError('');
    try {
      const res = await api.post('/api/docs/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      navigate(`/doc/${res.data._id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/docs/${id}`);
      setDocs(docs.filter(d => d._id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="container dashboard-container">
      <div className="dashboard-header">
        <h1>Your Documents</h1>
        <p>Upload a new legal document or review your past uploads.</p>
      </div>

      {error && <div className="error-alert">{error}</div>}

      <div className="upload-section">
        {uploading ? <Loader message="Analyzing document..." /> : <UploadBox onUpload={handleUpload} />}
      </div>

      <div className="documents-grid">
        {loading ? (
          <Loader />
        ) : docs.length === 0 ? (
          <div className="empty-state">No documents uploaded yet.</div>
        ) : (
          docs.map(doc => (
            <DocumentCard key={doc._id} doc={doc} onDelete={handleDelete} />
          ))
        )}
      </div>
    </div>
  );
}

export default Dashboard;
