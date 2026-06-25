import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SlashCommandInfo } from '../types';

interface Props {
  commands: SlashCommandInfo[];
  onSelect: (command: string, description: string) => void;
  onClose: () => void;
}

export default function SlashSuggestions({ commands, onSelect, onClose }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedIndex(0);
  }, [commands]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % commands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + commands.length) % commands.length);
      } else if (e.key === 'Enter' && commands[selectedIndex]) {
        e.preventDefault();
        onSelect(commands[selectedIndex].command, commands[selectedIndex].description);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commands, selectedIndex, onSelect, onClose]);

  return (
    <div className="slash-suggestions" ref={listRef}>
      {commands.map((cmd, idx) => (
        <button
          key={cmd.command}
          className={`slash-item ${idx === selectedIndex ? 'selected' : ''}`}
          onClick={() => onSelect(cmd.command, cmd.description)}
          onMouseEnter={() => setSelectedIndex(idx)}
        >
          <span className="slash-command">/{cmd.command}</span>
          <span className="slash-desc">{cmd.description}</span>
        </button>
      ))}
    </div>
  );
}
