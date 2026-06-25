import React, { useEffect, useRef, useState } from 'react';
import { useStore } from './store';
import { useVSCodeAPI } from './hooks/useVSCodeAPI';
import ChatView from './components/ChatView';
import SessionList from './components/SessionList';
import SystemPromptEditor from './components/SystemPromptEditor';
import ModelSelectorModal from './components/ModelSelectorModal';

export default function App() {
  const { postMessage } = useVSCodeAPI();
  const { sessions, currentSessionId, messages, processing } = useStore();
  const [showSessionList, setShowSessionList] = useState(false);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);

  useEffect(() => {
    postMessage('fetch_models');
    postMessage('get_slash_commands');
  }, [postMessage]);

  const currentSession = sessions.find((s) => s.id === currentSessionId);

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-left">
          <button
            className="icon-button"
            onClick={() => setShowSessionList(!showSessionList)}
            title="Sessions"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="header-title">
            {currentSession?.name || 'OpenCode'}
          </span>
        </div>
        <div className="header-right">
          <button
            className={`model-badge ${currentSession?.model ? 'active' : ''}`}
            onClick={() => setShowModelSelector(true)}
            title="Select model"
          >
            {currentSession?.model ? currentSession.model.split('/').pop() : 'CLI'}
          </button>
          <button
            className="icon-button"
            onClick={() => setShowSystemPrompt(!showSystemPrompt)}
            title="System Prompt"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </button>
          <button
            className="icon-button"
            onClick={() => postMessage('new_session')}
            title="New session"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </header>

      <div className="app-body">
        {showSessionList && (
          <SessionList
            onClose={() => setShowSessionList(false)}
          />
        )}
        <ChatView />
      </div>

      {processing && (
        <div className="progress-bar" />
      )}

      {showSystemPrompt && (
        <SystemPromptEditor
          onClose={() => setShowSystemPrompt(false)}
        />
      )}

      {showModelSelector && (
        <ModelSelectorModal
          onClose={() => setShowModelSelector(false)}
        />
      )}
    </div>
  );
}
