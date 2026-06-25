import * as vscode from 'vscode';
import { SlashCommand } from '../types';

export interface SlashCommandContext {
  sendToWebview: (type: string, payload?: Record<string, unknown>) => void;
  newSession: (model?: string) => void;
  renameSession: (id: string, name: string) => void;
  deleteSession: (id: string) => void;
  getCurrentSessionId: () => string | null;
  getAllSessionNames: () => { id: string; name: string }[];
  selectModel: () => void;
  toggleThinking: () => void;
  toggleCompact: () => void;
}

const COMMANDS: Array<{
  command: string;
  description: string;
  handler: (ctx: SlashCommandContext, args: string) => void;
}> = [
  {
    command: 'new',
    description: 'Start a new session',
    handler: (ctx) => ctx.newSession(),
  },
  {
    command: 'sessions',
    description: 'List all sessions',
    handler: (ctx) => {
      const sessions = ctx.getAllSessionNames();
      const list = sessions
        .map((s) => `- **${s.name}** (\`${s.id}\`)`)
        .join('\n');
      ctx.sendToWebview('system_message', {
        content: `## Sessions\n\n${list || '*No sessions*'}`,
      });
    },
  },
  {
    command: 'agents',
    description: 'List available agents',
    handler: (ctx) => {
      ctx.sendToWebview('system_message', {
        content:
          '## Agents\n\n- `opencode` - Default coding agent\n- More coming soon...',
      });
    },
  },
  {
    command: 'fork',
    description: 'Fork current session',
    handler: (ctx) => {
      const id = ctx.getCurrentSessionId();
      if (id) ctx.newSession();
    },
  },
  {
    command: 'rename',
    description: 'Rename current session (usage: /rename <name>)',
    handler: (ctx, args) => {
      const id = ctx.getCurrentSessionId();
      if (id && args.trim()) {
        ctx.renameSession(id, args.trim());
        ctx.sendToWebview('system_message', {
          content: `Session renamed to **${args.trim()}**`,
        });
      }
    },
  },
  {
    command: 'models',
    description: 'Open model selector',
    handler: (ctx) => ctx.selectModel(),
  },
  {
    command: 'thinking',
    description: 'Toggle thinking mode',
    handler: (ctx) => ctx.toggleThinking(),
  },
  {
    command: 'compact',
    description: 'Toggle compact mode',
    handler: (ctx) => ctx.toggleCompact(),
  },
  {
    command: 'clear',
    description: 'Clear current session messages',
    handler: (ctx) => {
      ctx.sendToWebview('system_message', {
        content: 'Session cleared.',
      });
    },
  },
  {
    command: 'help',
    description: 'Show available commands',
    handler: (ctx) => {
      const list = COMMANDS.map(
        (c) => `- \`/${c.command}\` — ${c.description}`
      ).join('\n');
      ctx.sendToWebview('system_message', {
        content: `## Slash Commands\n\n${list}`,
      });
    },
  },
];

export function getSlashCommands() {
  return COMMANDS.map((c) => ({
    command: c.command,
    description: c.description,
  }));
}

export function getSlashCommandNames(): string[] {
  return COMMANDS.map((c) => c.command);
}

export function executeSlashCommand(
  ctx: SlashCommandContext,
  input: string
): boolean {
  const match = input.match(/^\/(\w+)\s*(.*)/);
  if (!match) return false;

  const [, cmd, args] = match;
  const command = COMMANDS.find((c) => c.command === cmd);
  if (!command) return false;

  command.handler(ctx, args.trim());
  return true;
}
