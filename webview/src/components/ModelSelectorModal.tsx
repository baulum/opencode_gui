import React, { useState, useCallback, useEffect } from 'react';
import { useStore } from '../store';
import { useVSCodeAPI } from '../hooks/useVSCodeAPI';
import { ModelInfo } from '../types';

interface Props {
  onClose: () => void;
}

export default function ModelSelectorModal({ onClose }: Props) {
  const { models, currentSessionId, sessions } = useStore();
  const { postMessage } = useVSCodeAPI();
  const currentSession = sessions.find((s) => s.id === currentSessionId);
  const [selectedModel, setSelectedModel] = useState(
    currentSession?.model || ''
  );

  const handleSelect = useCallback(
    (modelId: string) => {
      setSelectedModel(modelId);
      postMessage('select_model', { modelId });
      onClose();
    },
    [postMessage, onClose]
  );

  const handleUseCLI = useCallback(() => {
    setSelectedModel('');
    postMessage('select_model', { modelId: '' });
    onClose();
  }, [postMessage, onClose]);

  useEffect(() => {
    postMessage('fetch_models');
  }, [postMessage]);

  const grouped = models.reduce<Record<string, ModelInfo[]>>(
    (acc, m) => {
      const provider = m.provider || 'other';
      if (!acc[provider]) acc[provider] = [];
      acc[provider].push(m);
      return acc;
    },
    {}
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel model-selector" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Select Model</h3>
          <button className="icon-button" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          <button
            className={`model-option ${!selectedModel ? 'selected' : ''}`}
            onClick={handleUseCLI}
          >
            <div className="model-option-info">
              <span className="model-name">OpenCode CLI</span>
              <span className="model-provider">local</span>
            </div>
            <span className="model-desc">Use local OpenCode CLI agent</span>
          </button>

          {Object.entries(grouped).map(([provider, providerModels]) => (
            <div key={provider} className="model-group">
              <div className="model-group-label">{provider}</div>
              {providerModels.map((m) => (
                <button
                  key={m.id}
                  className={`model-option ${selectedModel === m.id ? 'selected' : ''}`}
                  onClick={() => handleSelect(m.id)}
                >
                  <div className="model-option-info">
                    <span className="model-name">{m.name}</span>
                    <span className="model-provider">{m.id}</span>
                  </div>
                  {m.description && (
                    <span className="model-desc">{m.description}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>

        {!models.length && (
          <div className="modal-footer model-selector-footer">
            <div className="prompt-info">
              No Zen API key configured. Set one in VS Code settings (<code>opencode-gui.zenApiKey</code>) to access cloud models.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
