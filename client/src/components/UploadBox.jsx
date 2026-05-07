import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

function UploadBox({ onUpload }) {
  const onDrop = useCallback(acceptedFiles => {
    if (acceptedFiles.length > 0) {
      onUpload(acceptedFiles[0]);
    }
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024 // 10MB
  });

  const isFileTooLarge = fileRejections.length > 0 && fileRejections[0].errors[0].code === "file-too-large";

  return (
    <div {...getRootProps()} className={`upload-box ${isDragActive ? 'active' : ''} ${isFileTooLarge ? 'error' : ''}`}>
      <input {...getInputProps()} />
      <div className="upload-content">
        <div className="upload-icon">{isFileTooLarge ? '⚠️' : '📄'}</div>
        {isDragActive ? (
          <p>Drop the PDF here ...</p>
        ) : isFileTooLarge ? (
          <p style={{ color: 'var(--danger)' }}>File is too large (Max 10MB)</p>
        ) : (
          <p>Drag & drop a legal document PDF here, or click to select</p>
        )}
        <small style={{ display: 'block', marginTop: '10px', color: 'var(--text-muted)' }}>Max file size: 10MB</small>
      </div>
    </div>
  );
}

export default UploadBox;
