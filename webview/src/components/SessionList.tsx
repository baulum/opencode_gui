import React, { useState, useCallback } from 'react';
import { useStore } from '../store';
import { useVSCodeAPI } from '../hooks/useVSCodeAPI';

interface Props {
  onClose: () => void;
}

export default function SessionList({ onClose }: Props) {
  const { sessions, currentSessionId } = useStore();
  const { postMessage } = useVSCodeAPI();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const handleSelect = useCallback(
    (id: string) => {
      postMessage('select_session', { sessionId: id });
      onClose();
    },
    [postMessage, onClose]
  );

  const handleDelete = useCallback(
    (id: string) => {
      postMessage('delete_session', { sessionId: id });
    },
    [postMessage]
  );

  const handleNew = useCallback(() => {
    postMessage('new_session');
    onClose();
  }, [postMessage, onClose]);

  const startRename = useCallback((id: string, name: string) => {
    setRenamingId(id);
    setRenameValue(name);
  }, []);

  const confirmRename = useCallback(() => {
    if (renamingId && renameValue.trim()) {
      postMessage('rename_session', {
        sessionId: renamingId,
        name: renameValue.trim(),
      });
    }
    setRenamingId(null);
  }, [renamingId, renameValue, postMessage]);

  return (
    <div className="session-list-panel" onClick={(e) => e.stopPropagation()}>
      <div className="session-list-header">
        <h3>Sessions</h3>
        <button className="icon-button" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="session-list-body">
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`session-item ${s.id === currentSessionId ? 'active' : ''}`}
            onClick={() => handleSelect(s.id)}
          >
            {renamingId === s.id ? (
              <input
                className="session-rename-input"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={confirmRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmRename();
                  if (e.key === 'Escape') setRenamingId(null);
                }}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <span className="session-name">{s.name}</span>
                <div className="session-actions">
                  <button
                    className="session-action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      startRename(s.id, s.name);
                    }}
                    title="Rename"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    className="session-action-btn danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(s.id);
                    }}
                    title="Delete"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="session-list-footer">
        <button className="btn btn-primary btn-full" onClick={handleNew}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Session
        </button>
      </div>
    </div>
  );
}
