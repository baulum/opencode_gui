import hljs from "highlight.js";
import MarkdownIt from "markdown-it";

type AppMessage =
  | { type: "state"; payload: any }
  | { type: "append"; payload: any }
  | { type: "sessionStarted"; payload: any }
  | { type: "sessionFinished"; payload: any }
  | { type: "error"; payload: any }
  | { type: "selectedFiles"; payload: any }
  | { type: "workspaceContext"; payload: any }
  | { type: "models"; payload: any }
  | { type: "stopped"; payload: any }
  | { type: "focusInput"; payload: any };

type OutgoingMessage =
  | { type: "ready" }
  | { type: "send"; payload: any }
  | { type: "stop" }
  | { type: "newChat" }
  | { type: "switchChat"; payload: any }
  | { type: "updateSystemPrompt"; payload: any }
  | { type: "requestFiles" }
  | { type: "requestWorkspaceContext" }
  | { type: "deleteChat"; payload: any }
  | { type: "renameChat"; payload: any }
  | { type: "focusInput" }
  | { type: "requestState" }
  | { type: "saveMemory"; payload: any }
  | { type: "applyPatch"; payload: any }
  | { type: "selectModel"; payload: any }
  | { type: "requestModels" }
  | { type: "connectZen" };

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
  command?: string;
  isStreaming?: boolean;
}

interface ChatSession {
  id: string;
  name: string;
  model: string;
  systemPrompt: string;
  createdAt: number;
  updatedAt: number;
  opencodeSessionId?: string;
  messages: ChatMessage[];
}

interface ModelOption {
  id: string;
  name: string;
  provider: "zen" | "opencode";
  endpoint: string;
  displayName: string;
}

interface RendererState {
  sessions: ChatSession[];
  activeSessionId?: string;
  systemPrompt: string;
  memoryNotes: string;
  defaultModel: string;
  busy: boolean;
  models: ModelOption[];
  workspaceRoot?: string;
  workspaceContext?: {
    activeFile?: { name: string; path: string; content: string } | null;
    selectedText?: string;
    openFiles?: { name: string; path: string; content: string }[];
  };
}

interface SlashCommandResult {
  command: string;
  prompt: string;
}

const vscodeApi = (window as any).acquireVsCodeApi();

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight(code, lang) {
    const copyData = encodeURIComponent(code);
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<div class="code-wrap"><div class="code-toolbar"><button class="tiny-button copy-code" data-code="${copyData}">Copy</button></div><pre class="code-block"><code>${hljs.highlight(code, { language: lang }).value}</code></pre></div>`;
      } catch {
        return `<div class="code-wrap"><div class="code-toolbar"><button class="tiny-button copy-code" data-code="${copyData}">Copy</button></div><pre class="code-block"><code>${escapeHtml(code)}</code></pre></div>`;
      }
    }
    return `<div class="code-wrap"><div class="code-toolbar"><button class="tiny-button copy-code" data-code="${copyData}">Copy</button></div><pre class="code-block"><code>${escapeHtml(code)}</code></pre></div>`;
  },
});

const state: RendererState = {
  sessions: [],
  activeSessionId: undefined,
  systemPrompt: "",
  memoryNotes: "",
  defaultModel: "opencode/gpt-5.5",
  busy: false,
  models: [],
};

const els = {
  sessionList: document.getElementById("sessionList") as HTMLDivElement,
  messages: document.getElementById("messages") as HTMLDivElement,
  composer: document.getElementById("composer") as HTMLTextAreaElement,
  sendBtn: document.getElementById("sendBtn") as HTMLButtonElement,
  stopBtn: document.getElementById("stopBtn") as HTMLButtonElement,
  newChatBtn: document.getElementById("newChatBtn") as HTMLButtonElement,
  addFilesBtn: document.getElementById("addFilesBtn") as HTMLButtonElement,
  modelSelect: document.getElementById("modelSelect") as HTMLSelectElement,
  systemPrompt: document.getElementById("systemPrompt") as HTMLTextAreaElement,
  memoryNotes: document.getElementById("memoryNotes") as HTMLTextAreaElement,
  filesPreview: document.getElementById("filesPreview") as HTMLDivElement,
  status: document.getElementById("status") as HTMLSpanElement,
  activeFileLabel: document.getElementById("activeFileLabel") as HTMLSpanElement,
  activeSessionLabel: document.getElementById("activeSessionLabel") as HTMLSpanElement,
  selectionLabel: document.getElementById("selectionLabel") as HTMLSpanElement,
  openFilesLabel: document.getElementById("openFilesLabel") as HTMLSpanElement,
};

let attachedFiles: Array<{ name: string; path: string; content: string }> = [];

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderMarkdown(content: string): string {
  return md.render(content);
}

function send(message: OutgoingMessage): void {
  vscodeApi.postMessage(message);
}

function getActiveSession(): ChatSession | undefined {
  return state.sessions.find((session) => session.id === state.activeSessionId);
}

function ensureActiveSession(): ChatSession {
  const existing = getActiveSession();
  if (existing) {
    return existing;
  }
  const session = createSession("New chat");
  state.sessions.unshift(session);
  state.activeSessionId = session.id;
  return session;
}

function createSession(name: string): ChatSession {
  return {
    id: `session_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    name,
    model: "opencode/gpt-5.5",
    systemPrompt: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  };
}

function renderSessions(): void {
  const list = state.sessions
    .map((session) => {
      const active = session.id === state.activeSessionId ? "active" : "";
      const preview = session.messages.find((message) => message.role !== "system")?.content?.slice(0, 60) ?? "Empty chat";
      return `
        <button class="session-item ${active}" data-session-id="${session.id}">
          <div class="session-title">${escapeHtml(session.name)}</div>
          <div class="session-preview">${escapeHtml(preview)}</div>
        </button>
      `;
    })
    .join("");
  els.sessionList.innerHTML = list || `<div class="empty-state">No chats yet. Start one from the button above.</div>`;

  els.sessionList.querySelectorAll("[data-session-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const sessionId = (button as HTMLElement).dataset.sessionId!;
      send({ type: "switchChat", payload: { sessionId } });
    });
  });
}

function renderModels(): void {
  const models = state.models ?? [];
  els.modelSelect.innerHTML = models
    .map((model) => `<option value="${escapeHtml(model.id)}">${escapeHtml(model.displayName)}</option>`)
    .join("");
  if (state.defaultModel) {
    els.modelSelect.value = state.defaultModel;
  }
}

function renderMessages(): void {
  const session = getActiveSession();
  if (!session) {
    els.messages.innerHTML = `<div class="welcome"><h2>OpenCode Chat</h2><p>Start a chat to talk to OpenCode with files, slash commands, and system instructions.</p></div>`;
    return;
  }

  els.messages.innerHTML = session.messages
    .map((message) => {
      const classes = ["message", message.role];
      if (message.isStreaming) {
        classes.push("streaming");
      }

      const meta =
        message.role === "assistant"
          ? `<div class="message-actions">
              <button class="tiny-button copy-button" data-copy="${message.id}">Copy</button>
            </div>`
          : "";

      return `
        <article class="${classes.join(" ")}" data-message-id="${message.id}">
          <div class="message-head">
            <span class="message-role">${message.role}</span>
            ${message.command ? `<span class="message-command">/${escapeHtml(message.command)}</span>` : ""}
          </div>
          <div class="message-body ${message.role === "assistant" ? "markdown" : ""}">
            ${message.role === "assistant" ? renderMarkdown(message.content) : `<pre>${escapeHtml(message.content)}</pre>`}
          </div>
          ${meta}
        </article>
      `;
    })
    .join("");

  els.messages.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = (button as HTMLElement).dataset.copy!;
      const msg = session.messages.find((item) => item.id === id);
      if (msg) {
        await navigator.clipboard.writeText(msg.content);
      }
    });
  });

  els.messages.querySelectorAll("[data-code]").forEach((button) => {
    button.addEventListener("click", async () => {
      const encoded = (button as HTMLElement).dataset.code ?? "";
      await navigator.clipboard.writeText(decodeURIComponent(encoded));
    });
  });

  els.messages.scrollTop = els.messages.scrollHeight;
}

function renderState(): void {
  renderSessions();
  renderMessages();
  els.systemPrompt.value = state.systemPrompt ?? "";
  els.memoryNotes.value = state.memoryNotes ?? "";
  els.sendBtn.disabled = state.busy;
  els.stopBtn.disabled = !state.busy;
  els.status.textContent = state.busy ? "Generating…" : "Ready";
  const ctx = state.workspaceContext;
  els.activeFileLabel.textContent = ctx?.activeFile ? ctx.activeFile.name : "None";
  const activeSession = getActiveSession();
  els.activeSessionLabel.textContent = activeSession ? `${activeSession.name} · ${activeSession.model}` : "None";
  els.selectionLabel.textContent = ctx?.selectedText ? `${ctx.selectedText.slice(0, 42)}${ctx.selectedText.length > 42 ? "…" : ""}` : "None";
  els.openFilesLabel.textContent = ctx?.openFiles?.length ? String(ctx.openFiles.length) : "0";
  renderModels();
  renderAttachedFiles();
}

function renderAttachedFiles(): void {
  els.filesPreview.innerHTML = attachedFiles.length
    ? attachedFiles
        .map(
          (file, index) => `
            <div class="file-chip">
              <div class="file-chip-name">${escapeHtml(file.name)}</div>
              <div class="file-chip-path">${escapeHtml(file.path)}</div>
              <button class="tiny-button" data-remove-file="${index}">Remove</button>
            </div>
          `
        )
        .join("")
    : `<div class="empty-state">No attached files</div>`;

  els.filesPreview.querySelectorAll("[data-remove-file]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number((button as HTMLElement).dataset.removeFile);
      attachedFiles.splice(index, 1);
      renderAttachedFiles();
    });
  });
}

function parseSlashCommand(input: string): SlashCommandResult | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) {
    return null;
  }

  const [commandToken = "", ...rest] = trimmed.slice(1).split(/\s+/);
  const remainder = rest.join(" ");
  const command = commandToken.toLowerCase();

  const templates: Record<string, (rest: string) => string> = {
    explain: (body) => `Explain the following code or concept clearly and briefly:\n${body}`.trim(),
    fix: (body) => `Please analyze and fix the issue below. Provide the corrected version and explain the issue.\n${body}`.trim(),
    refactor: (body) => `Refactor the following code for clarity, maintainability, and correctness.\n${body}`.trim(),
    test: (body) => `Write or update tests for the following code or behavior.\n${body}`.trim(),
    optimize: (body) => `Optimize the following code for performance and explain the tradeoffs.\n${body}`.trim(),
    commit: (body) => `Create a concise git commit message and summarize the changes for this work.\n${body}`.trim(),
  };

  const template = templates[command];
  if (!template) {
    return null;
  }

  return {
    command,
    prompt: template(remainder),
  };
}

function createUserMessage(text: string): ChatMessage {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    role: "user",
    content: text,
    createdAt: Date.now(),
  };
}

function createAssistantMessage(command?: string): ChatMessage {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    role: "assistant",
    content: "",
    createdAt: Date.now(),
    command,
    isStreaming: true,
  };
}

function syncStateFromPayload(payload: RendererState): void {
  state.sessions = payload.sessions ?? [];
  state.activeSessionId = payload.activeSessionId;
  state.systemPrompt = payload.systemPrompt ?? "";
  state.memoryNotes = payload.memoryNotes ?? "";
  state.defaultModel = payload.defaultModel ?? "opencode/gpt-5.5";
  state.busy = payload.busy ?? false;
  state.models = payload.models ?? [];
  state.workspaceRoot = payload.workspaceRoot;
  state.workspaceContext = payload.workspaceContext;
  renderState();
}

function updateDraftFromContext(): void {
  const ctx = state.workspaceContext;
  const parts: string[] = [];
  if (ctx?.activeFile) {
    parts.push(`Active file: ${ctx.activeFile.path}`);
  }
  if (ctx?.selectedText) {
    parts.push(`Selected text: ${ctx.selectedText}`);
  }
  if (ctx?.openFiles?.length) {
    parts.push(`Open files: ${ctx.openFiles.map((file) => file.path).join(", ")}`);
  }
  if (parts.length > 0) {
    const current = els.composer.value.trim();
    if (!current) {
      els.composer.value = parts.join("\n");
    }
  }
}

els.newChatBtn.addEventListener("click", () => send({ type: "newChat" }));
els.stopBtn.addEventListener("click", () => send({ type: "stop" }));
els.addFilesBtn.addEventListener("click", () => send({ type: "requestFiles" }));
els.modelSelect.addEventListener("change", () => {
  send({ type: "selectModel", payload: { model: els.modelSelect.value } });
});

els.systemPrompt.addEventListener("input", () => {
  send({ type: "updateSystemPrompt", payload: { systemPrompt: els.systemPrompt.value } });
});

els.memoryNotes.addEventListener("input", () => {
  send({ type: "saveMemory", payload: { memoryNotes: els.memoryNotes.value } });
});

els.composer.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    if (!state.busy) {
      void submitMessage();
    }
  }
});

async function submitMessage(): Promise<void> {
  const raw = els.composer.value.trim();
  if (!raw) {
    return;
  }

  const activeSession = ensureActiveSession();
  const userMessage = createUserMessage(raw);
  activeSession.messages.push(userMessage);

  const assistantMessage = createAssistantMessage();
  activeSession.messages.push(assistantMessage);

  els.composer.value = "";
  renderState();
  send({
    type: "send",
    payload: {
      sessionId: activeSession.opencodeSessionId,
      message: raw,
      attachedFiles,
    },
  });
}

window.addEventListener("message", (event: MessageEvent<AppMessage>) => {
  const message = event.data;
  switch (message.type) {
    case "state":
      syncStateFromPayload(message.payload);
      updateDraftFromContext();
      break;
    case "append": {
      const { sessionId, text, command, isFinal } = message.payload || {};
      const session = state.sessions.find((item) => item.id === sessionId) ?? getActiveSession();
      if (!session) {
        break;
      }
      let assistant = session.messages.find((item) => item.role === "assistant" && item.isStreaming);
      if (!assistant) {
        assistant = createAssistantMessage(command);
        session.messages.push(assistant);
      }
      assistant.content += text ?? "";
      assistant.isStreaming = !isFinal;
      session.updatedAt = Date.now();
      renderState();
      break;
    }
    case "sessionStarted":
      state.busy = true;
      if (message.payload?.sessionId) {
        const session = state.sessions.find((item) => item.id === message.payload.sessionId);
        if (session) {
          session.opencodeSessionId = message.payload.opencodeSessionId ?? session.opencodeSessionId;
        }
      }
      renderState();
      break;
    case "sessionFinished":
      state.busy = false;
      if (message.payload?.sessionId) {
        const session = state.sessions.find((item) => item.id === message.payload.sessionId);
        if (session) {
          session.opencodeSessionId = message.payload.opencodeSessionId ?? session.opencodeSessionId;
          const assistant = [...session.messages].reverse().find((item) => item.role === "assistant");
          if (assistant) {
            assistant.isStreaming = false;
          }
        }
      }
      renderState();
      break;
    case "error":
      state.busy = false;
      renderState();
      break;
    case "selectedFiles":
      attachedFiles = message.payload?.files ?? [];
      renderAttachedFiles();
      break;
    case "workspaceContext":
      state.workspaceContext = message.payload;
      renderState();
      break;
    case "models":
      state.models = message.payload?.models ?? [];
      renderState();
      break;
    case "stopped":
      state.busy = false;
      renderState();
      break;
    case "focusInput":
      els.composer.focus();
      break;
  }
});

els.sessionList.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const button = target.closest("[data-session-id]") as HTMLElement | null;
  if (!button) {
    return;
  }
  send({ type: "switchChat", payload: { sessionId: button.dataset.sessionId } });
});

send({ type: "ready" });
send({ type: "requestState" });
send({ type: "requestModels" });
send({ type: "requestWorkspaceContext" });

document.getElementById("focusButton")?.addEventListener("click", () => send({ type: "focusInput" }));

renderState();

export {};
