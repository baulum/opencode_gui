import React, { useState, useCallback, useEffect } from 'react';
import { useStore } from '../store';
import { useVSCodeAPI } from '../hooks/useVSCodeAPI';

interface Props {
  onClose: () => void;
}

export default function SystemPromptEditor({ onClose }: Props) {
  const { currentSessionId, sessions } = useStore();
  const { postMessage } = useVSCodeAPI();
  const currentSession = sessions.find((s) => s.id === currentSessionId);
  const [prompt, setPrompt] = useState(currentSession?.systemPrompt || '');

  useEffect(() => {
    if (currentSession) {
      setPrompt(currentSession.systemPrompt);
    }
  }, [currentSession]);

  const handleSave = useCallback(() => {
    postMessage('update_system_prompt', { prompt });
    onClose();
  }, [prompt, postMessage, onClose]);

  const handleReset = useCallback(() => {
    const defaultPrompt =
      'You are a senior software engineer. Help the user write clean, maintainable, production-ready code.';
    setPrompt(defaultPrompt);
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>System Prompt</h3>
          <button className="icon-button" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <textarea
            className="system-prompt-textarea"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter system prompt..."
            rows={10}
            autoFocus
          />
          <div className="prompt-info">
            This prompt is persisted for the current session and sent with every request.
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={handleReset}>
            Reset to default
          </button>
          <div className="modal-footer-right">
            <button className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSave}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
