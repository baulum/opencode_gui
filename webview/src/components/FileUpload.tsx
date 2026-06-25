import React, { useState, useCallback } from 'react';
import { useVSCodeAPI } from '../hooks/useVSCodeAPI';

interface Props {
  onFilesSelected: (files: { path: string; content: string }[]) => void;
  onClose: () => void;
}

interface FileEntry {
  path: string;
  content: string;
  loading: boolean;
}

export default function FileUpload({ onFilesSelected, onClose }: Props) {
  const { postMessage } = useVSCodeAPI();
  const [files, setFiles] = useState<FileEntry[]>([]);

  const handleAddFile = useCallback(() => {
    postMessage('pick_file', {});
  }, [postMessage]);

  const removeFile = useCallback((path: string) => {
    setFiles((prev) => prev.filter((f) => f.path !== path));
  }, []);

  const confirmFiles = useCallback(() => {
    const ready = files.filter((f) => !f.loading);
    onFilesSelected(ready.map((f) => ({ path: f.path, content: f.content })));
  }, [files, onFilesSelected]);

  return (
    <div className="file-upload-overlay" onClick={onClose}>
      <div className="file-upload-panel" onClick={(e) => e.stopPropagation()}>
        <div className="file-upload-header">
          <h3>Attach Files</h3>
          <button className="icon-button" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="file-upload-body">
          {files.map((f) => (
            <div key={f.path} className="file-upload-item">
              <span className="file-path">{f.path}</span>
              {f.loading ? (
                <span className="file-loading">Loading...</span>
              ) : (
                <button
                  className="file-remove-btn"
                  onClick={() => removeFile(f.path)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          ))}

          <button className="add-file-btn" onClick={handleAddFile}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add file
          </button>
        </div>

        {files.length > 0 && (
          <div className="file-upload-footer">
            <button className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={confirmFiles}>
              Attach {files.length} file{files.length > 1 ? 's' : ''}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
