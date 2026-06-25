import React from 'react';
import { Message } from '../types';
import MarkdownRenderer from './MarkdownRenderer';

interface Props {
  message: Message;
}

export default function MessageComponent({ message }: Props) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isSystem = message.role === 'system';
  const isError = message.status === 'error';

  return (
    <div
      className={`message ${isUser ? 'message-user' : ''} ${isAssistant ? 'message-assistant' : ''} ${isSystem ? 'message-system' : ''} ${isError ? 'message-error' : ''} message-enter`}
    >
      {!isUser && !isSystem && (
        <div className="message-avatar">
          {isAssistant ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" />
              <polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" />
              <line x1="4" y1="4" x2="9" y2="9" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
        </div>
      )}

      <div className={`message-content ${isUser ? 'message-content-user' : ''}`}>
        {message.files && message.files.length > 0 && (
          <div className="message-files">
            {message.files.map((f, i) => (
              <span key={i} className="file-chip">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                {f.path.split('/').pop()}
              </span>
            ))}
          </div>
        )}

        {isUser ? (
          <div className="user-bubble">{message.content}</div>
        ) : (
          <div className="assistant-content">
            {message.status === 'streaming' && !message.content ? (
              <span className="cursor-blink">|</span>
            ) : (
              <MarkdownRenderer content={message.content} />
            )}
          </div>
        )}

        {message.model && isAssistant && message.status === 'complete' && (
          <div className="message-meta">{message.model}</div>
        )}

        {isError && message.error && (
          <div className="error-detail">{message.error}</div>
        )}
      </div>
    </div>
  );
}
