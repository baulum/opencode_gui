import React from 'react';
import { Message } from '../types';
import MessageComponent from './Message';
import TypingIndicator from './TypingIndicator';

interface Props {
  messages: Message[];
}

export default function MessageList({ messages }: Props) {
  return (
    <div className="message-list">
      {messages.map((message, idx) => (
        <div
          key={message.id}
          className="message-wrapper"
          style={{ animationDelay: `${idx * 30}ms` }}
        >
          <MessageComponent message={message} />
        </div>
      ))}
      {messages.length > 0 &&
        messages[messages.length - 1].status === 'streaming' && (
          <TypingIndicator />
        )}
    </div>
  );
}
