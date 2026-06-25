import React, { useRef, useEffect, useState } from 'react';
import { useStore } from '../store';
import MessageList from './MessageList';
import InputBar from './InputBar';

export default function ChatView() {
  const { messages, processing } = useStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, autoScroll]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 100);
  };

  return (
    <div className="chat-container">
      {messages.length === 0 ? (
        <div className="welcome-screen">
          <div className="welcome-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 3 21 3 21 8" /><line x1="4" y1="20" x2="21" y2="3" />
              <polyline points="21 16 21 21 16 21" /><line x1="15" y1="15" x2="21" y2="21" />
              <line x1="4" y1="4" x2="9" y2="9" />
            </svg>
          </div>
          <h1 className="welcome-title">OpenCode</h1>
          <p className="welcome-subtitle">AI coding agent inside VS Code</p>
          <div className="welcome-hints">
            <span className="hint">Type <kbd>/help</kbd> for commands</span>
            <span className="hint"><kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> new line</span>
          </div>
        </div>
      ) : (
        <div className="message-scroll" ref={scrollRef} onScroll={handleScroll}>
          <MessageList messages={messages} />
          {!autoScroll && messages.length > 0 && (
            <button className="scroll-down-btn" onClick={() => setAutoScroll(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          )}
        </div>
      )}

      <InputBar />
    </div>
  );
}
