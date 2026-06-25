import * as vscode from "vscode";
import { ChatSession, SlashCommandResult } from "./types";

export interface SlashCommandContext {
  input: string;
  session: ChatSession;
  workspaceSessions: ChatSession[];
  stopGeneration: () => void;
  createSession: (fork?: boolean) => Promise<ChatSession>;
  renameSession: (sessionId: string, name: string) => Promise<void>;
  setActiveSession: (sessionId: string) => Promise<void>;
  exportSession: (sessionId: string) => Promise<void>;
  copySession: (sessionId: string) => Promise<void>;
  openModelPicker: () => Promise<void>;
  openThemePicker: () => Promise<void>;
  openSessionPicker: () => Promise<void>;
  compactSession: (sessionId: string) => Promise<void>;
}

export type SlashCommandHandlerResult =
  | { kind: "prompt"; prompt: string; command: string }
  | { kind: "action"; handled: true }
  | { kind: "unknown" };

type PromptBuilder = (body: string, session: ChatSession) => string;
type ActionHandler = (ctx: SlashCommandContext, body: string) => Promise<void>;

interface SlashCommandDefinition {
  name: string;
  category: string;
  description: string;
  kind: "prompt" | "action";
  buildPrompt?: PromptBuilder;
  action?: ActionHandler;
}

function promptify(prefix: string, body: string): string {
  return `${prefix}${body ? `\n${body}` : ""}`.trim();
}

export const slashCommands: SlashCommandDefinition[] = [
  { name: "explain", category: "Code Tools", description: "Explain code or behavior", kind: "prompt", buildPrompt: (body) => promptify("Explain the following code or concept clearly and practically.", body) },
  { name: "fix", category: "Code Tools", description: "Fix a bug or error", kind: "prompt", buildPrompt: (body) => promptify("Please analyze and fix the issue below. Provide the corrected version and explain the issue.", body) },
  { name: "refactor", category: "Code Tools", description: "Refactor code", kind: "prompt", buildPrompt: (body) => promptify("Refactor the following code for clarity, maintainability, and correctness.", body) },
  { name: "test", category: "Code Tools", description: "Write tests", kind: "prompt", buildPrompt: (body) => promptify("Write or update tests for the following code or behavior.", body) },
  { name: "optimize", category: "Code Tools", description: "Optimize code", kind: "prompt", buildPrompt: (body) => promptify("Optimize the following code for performance and explain the tradeoffs.", body) },
  { name: "commit", category: "Output & Sharing", description: "Draft a commit message", kind: "prompt", buildPrompt: (body) => promptify("Create a concise git commit message and summarize the changes for this work.", body) },
  { name: "review", category: "Code Tools", description: "Review code", kind: "prompt", buildPrompt: (body) => promptify("Perform a code review. Find bugs, regressions, edge cases, and missing tests.", body) },
  { name: "diff", category: "Code Tools", description: "Prepare a diff-style answer", kind: "prompt", buildPrompt: (body) => promptify("Provide the answer as a precise diff or patch summary when possible.", body) },
  { name: "editor", category: "Code Tools", description: "Focus active editor context", kind: "action", action: async () => { await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup"); } },
  { name: "undo", category: "Code Tools", description: "Undo last change", kind: "action", action: async () => { await vscode.commands.executeCommand("undo"); } },
  { name: "agents", category: "Session & Agent", description: "Show available agents", kind: "action", action: async () => { await vscode.commands.executeCommand("opencodeGui.showAgents"); } },
  { name: "sessions", category: "Session & Agent", description: "Show session list", kind: "action", action: async (ctx) => { await ctx.openSessionPicker(); } },
  { name: "new", category: "Session & Agent", description: "Create a new session", kind: "action", action: async (ctx) => { const session = await ctx.createSession(false); await ctx.setActiveSession(session.id); } },
  { name: "fork", category: "Session & Agent", description: "Fork current session", kind: "action", action: async (ctx) => { const session = await ctx.createSession(true); await ctx.setActiveSession(session.id); } },
  { name: "rename", category: "Session & Agent", description: "Rename current session", kind: "action", action: async (ctx, body) => { const name = body.trim() || await vscode.window.showInputBox({ prompt: "Rename session" }) || ctx.session.name; await ctx.renameSession(ctx.session.id, name); } },
  { name: "move", category: "Session & Agent", description: "Reorder current session", kind: "action", action: async (ctx) => { await ctx.setActiveSession(ctx.session.id); } },
  { name: "exit", category: "Session & Agent", description: "Stop generation", kind: "action", action: async (ctx) => { ctx.stopGeneration(); } },
  { name: "copy", category: "Output & Sharing", description: "Copy last assistant response", kind: "action", action: async (ctx) => { await ctx.copySession(ctx.session.id); } },
  { name: "export", category: "Output & Sharing", description: "Export session JSON", kind: "action", action: async (ctx) => { await ctx.exportSession(ctx.session.id); } },
  { name: "share", category: "Output & Sharing", description: "Create a shareable transcript summary", kind: "prompt", buildPrompt: (body) => promptify("Prepare a concise summary of this conversation suitable for sharing.", body) },
  { name: "timeline", category: "Output & Sharing", description: "Summarize timeline of work", kind: "prompt", buildPrompt: (body) => promptify("Create a chronological timeline of the work done so far.", body) },
  { name: "timestamps", category: "Output & Sharing", description: "Include timestamps in response", kind: "prompt", buildPrompt: (body) => promptify("Include concise timestamps or step ordering in the response.", body) },
  { name: "models", category: "Model & Provider", description: "Open model picker", kind: "action", action: async (ctx) => { await ctx.openModelPicker(); } },
  { name: "connect", category: "Model & Provider", description: "Set Zen API key", kind: "action", action: async () => { await vscode.commands.executeCommand("opencodeGui.connectZen"); } },
  { name: "variants", category: "Model & Provider", description: "Choose a model variant", kind: "action", action: async (ctx) => { await ctx.openModelPicker(); } },
  { name: "status", category: "System", description: "Show current session status", kind: "prompt", buildPrompt: (body, session) => promptify(`Status check. Current session: ${session.name}. Current model: ${session.model}.`, body) },
  { name: "help", category: "System", description: "Show available commands", kind: "prompt", buildPrompt: (body) => promptify("Explain the available slash commands and how to use them in this chat UI.", body) },
  { name: "themes", category: "System", description: "Open theme picker", kind: "action", action: async (ctx) => { await ctx.openThemePicker(); } },
  { name: "thinking", category: "System", description: "Toggle thinking mode", kind: "prompt", buildPrompt: (body) => promptify("Work in a careful, step-by-step mode and keep reasoning concise.", body) },
  { name: "compact", category: "System", description: "Compact session context", kind: "action", action: async (ctx) => { await ctx.compactSession(ctx.session.id); } },
  { name: "mcps", category: "System", description: "Inspect MCP setup", kind: "prompt", buildPrompt: (body) => promptify("Review available MCP servers and explain how they affect this workspace.", body) },
  { name: "skills", category: "System", description: "Inspect available skills", kind: "prompt", buildPrompt: (body) => promptify("Review the available agent skills and explain which ones are relevant.", body) },
  { name: "init", category: "System", description: "Create a workspace onboarding prompt", kind: "prompt", buildPrompt: (body) => promptify("Initialize this workspace with a concise onboarding checklist and next steps.", body) },
];

export function parseSlashCommand(input: string): { command: string; body: string } | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) {
    return null;
  }

  const [command = "", ...rest] = trimmed.slice(1).split(/\s+/);
  return { command: command.toLowerCase(), body: rest.join(" ") };
}

export function getSlashCommand(command: string): SlashCommandDefinition | undefined {
  return slashCommands.find((entry) => entry.name === command);
}

export function resolveSlashCommand(input: string, session: ChatSession): SlashCommandHandlerResult {
  const parsed = parseSlashCommand(input);
  if (!parsed) {
    return { kind: "unknown" };
  }

  const definition = getSlashCommand(parsed.command);
  if (!definition) {
    return { kind: "unknown" };
  }

  if (definition.kind === "action" && definition.action) {
    return { kind: "action", handled: true };
  }

  if (definition.buildPrompt) {
    return {
      kind: "prompt",
      command: definition.name,
      prompt: definition.buildPrompt(parsed.body, session),
    };
  }

  return { kind: "unknown" };
}
