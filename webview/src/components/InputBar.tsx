import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useStore } from '../store';
import { useVSCodeAPI } from '../hooks/useVSCodeAPI';
import SlashSuggestions from './SlashSuggestions';
import FileUpload from './FileUpload';

export default function InputBar() {
  const { processing, slashCommands } = useStore();
  const { postMessage } = useVSCodeAPI();
  const [text, setText] = useState('');
  const [showSlash, setShowSlash] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [showFileUpload, setShowFileUpload] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const filteredCommands = slashCommands.filter((c) =>
    c.command.startsWith(slashFilter)
  );

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setText(val);
      const slashMatch = val.match(/^\/(\w*)$/);
      if (slashMatch) {
        setShowSlash(true);
        setSlashFilter(slashMatch[1]);
      } else {
        setShowSlash(false);
      }
    },
    []
  );

  const handleSlashSelect = useCallback(
    (command: string, description: string) => {
      setText(`/${command} `);
      setShowSlash(false);
      if (textRef.current) {
        textRef.current.focus();
      }
    },
    []
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [text]
  );

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || processing) return;
    setText('');
    setShowSlash(false);
    postMessage('send_message', { text: trimmed });
  }, [text, processing, postMessage]);

  const handleCancel = useCallback(() => {
    postMessage('cancel');
  }, [postMessage]);

  const handleFilesSelected = useCallback(
    (files: { path: string; content: string }[]) => {
      setShowFileUpload(false);
      const fileContext = files
        .map((f) => `File: ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
        .join('\n\n');
      setText((prev) => (prev ? `${prev}\n\n${fileContext}` : fileContext));
    },
    []
  );

  useEffect(() => {
    if (textRef.current) {
      textRef.current.style.height = 'auto';
      textRef.current.style.height =
        Math.min(textRef.current.scrollHeight, 200) + 'px';
    }
  }, [text]);

  return (
    <div className="input-bar-container">
      {showSlash && filteredCommands.length > 0 && (
        <SlashSuggestions
          commands={filteredCommands}
          onSelect={handleSlashSelect}
          onClose={() => setShowSlash(false)}
        />
      )}

      {showFileUpload && (
        <FileUpload
          onFilesSelected={handleFilesSelected}
          onClose={() => setShowFileUpload(false)}
        />
      )}

      <div className="input-bar">
        <button
          className="input-action-btn"
          onClick={() => setShowFileUpload(true)}
          title="Attach files"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        <textarea
          ref={textRef}
          className="input-textarea"
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={processing ? 'Waiting for response...' : 'Ask OpenCode... (type / for commands)'}
          rows={1}
          disabled={processing}
        />

        {processing ? (
          <button className="input-action-btn stop-btn" onClick={handleCancel} title="Stop">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        ) : (
          <button
            className="input-action-btn send-btn"
            onClick={handleSend}
            disabled={!text.trim()}
            title="Send"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
