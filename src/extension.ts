import * as fs from "node:fs/promises";
import { spawn } from "node:child_process";
import * as path from "node:path";
import * as vscode from "vscode";
import {
  AttachedFile,
  ChatSession,
  ContextSnapshot,
  ExtensionToWebviewMessage,
  ModelOption,
  RendererState,
  SendRequest,
  WebviewToExtensionMessage,
} from "./types";
import { OpenCodeBridge } from "./opencodeBridge";
import { getSlashCommand, parseSlashCommand } from "./slashCommands";
import { WorkspaceSessionStore } from "./sessionStore";
import { ZenModelService } from "./zenModels";

class ChatController implements vscode.WebviewViewProvider {
  public static readonly viewType = "opencodeGui.chatView";
  private view?: vscode.WebviewView;
  private readonly store: WorkspaceSessionStore;
  private readonly bridge: OpenCodeBridge;
  private readonly zen: ZenModelService;
  private models: ModelOption[] = [];
  private state = {
    busy: false,
    workspaceContext: undefined as ContextSnapshot["workspaceContext"] | undefined,
  };

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly output: vscode.OutputChannel
  ) {
    this.store = new WorkspaceSessionStore(context);
    this.bridge = new OpenCodeBridge(output);
    this.zen = new ZenModelService(context);
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void | Thenable<void> {
    this.view = webviewView;
    const webview = webviewView.webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "media"),
        vscode.Uri.joinPath(this.context.extensionUri, "dist"),
      ],
    };
    webview.html = this.getHtml(webview);

    webview.onDidReceiveMessage((message: WebviewToExtensionMessage) => {
      void this.handleMessage(message);
    });

    void this.pushState();
    void this.refreshWorkspaceContext();
    void this.refreshModels();
  }

  async show(): Promise<void> {
    if (this.view) {
      this.view.show?.(true);
      return;
    }

    const commands = await vscode.commands.getCommands(true);
    if (commands.includes("workbench.view.extension.opencodeGuiContainer")) {
      await vscode.commands.executeCommand("workbench.view.extension.opencodeGuiContainer");
      return;
    }

    await vscode.commands.executeCommand("workbench.action.focusSideBar");
  }

  private async refreshModels(force = false): Promise<void> {
    try {
      this.models = await this.zen.listModels(force);
    } catch (error) {
      this.output.appendLine(`[OpenCode GUI] Zen model fetch failed: ${(error as Error).message}`);
      this.models = [
        {
          id: "opencode/gpt-5.5",
          name: "gpt-5.5",
          provider: "opencode",
          endpoint: "https://opencode.ai/zen/v1/responses",
          displayName: "GPT 5.5",
        },
      ];
    }
    this.postToWebview({ type: "models", payload: { models: this.models } });
    await this.pushState();
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "media", "webview.js")
    );
    const styleUri = webview.cspSource;
    const nonce = String(Date.now());
    return /* html */ `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource};" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>OpenCode GUI</title>
        <style>
          :root {
            color-scheme: dark;
            --bg: #0b1020;
            --panel: #11192f;
            --panel-2: #16213c;
            --border: rgba(148, 163, 184, 0.18);
            --text: #e5eefc;
            --muted: #94a3b8;
            --accent: #38bdf8;
            --accent-2: #7c3aed;
            --good: #10b981;
            --warning: #f59e0b;
            --danger: #ef4444;
            --shadow: 0 16px 44px rgba(0, 0, 0, 0.28);
          }
          body {
            margin: 0;
            background:
              radial-gradient(circle at top left, rgba(56, 189, 248, 0.16), transparent 28%),
              radial-gradient(circle at bottom right, rgba(124, 58, 237, 0.14), transparent 30%),
              var(--bg);
            color: var(--text);
            font-family: "Inter", system-ui, sans-serif;
          }
          .app {
            height: 100vh;
            display: grid;
            grid-template-rows: auto 1fr auto;
          }
          .topbar, .composer, .sidebar-card {
            backdrop-filter: blur(10px);
          }
          .topbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 12px;
            border-bottom: 1px solid var(--border);
            background: rgba(17, 25, 47, 0.88);
          }
          .brand {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .brand strong {
            font-size: 13px;
            letter-spacing: 0.04em;
            text-transform: uppercase;
          }
          .brand span, .hint {
            color: var(--muted);
            font-size: 12px;
          }
          .toolbar {
            display: flex;
            gap: 8px;
            align-items: center;
            flex-wrap: wrap;
          }
          .layout {
            display: grid;
            grid-template-columns: 220px 1fr;
            min-height: 0;
          }
          .sidebar {
            border-right: 1px solid var(--border);
            background: rgba(9, 14, 28, 0.55);
            display: flex;
            flex-direction: column;
            min-height: 0;
          }
          .sidebar-scroll {
            padding: 10px;
            overflow: auto;
            display: grid;
            gap: 10px;
          }
          .main {
            display: grid;
            grid-template-rows: 1fr auto;
            min-width: 0;
            min-height: 0;
          }
          .messages {
            overflow: auto;
            padding: 16px;
            display: grid;
            gap: 12px;
          }
          .composer {
            border-top: 1px solid var(--border);
            background: rgba(17, 25, 47, 0.92);
            padding: 12px;
            display: grid;
            gap: 10px;
          }
          .composer-row {
            display: flex;
            gap: 10px;
            align-items: end;
          }
          textarea, input {
            width: 100%;
            box-sizing: border-box;
            border: 1px solid var(--border);
            background: rgba(5, 10, 19, 0.68);
            color: var(--text);
            border-radius: 14px;
            padding: 10px 12px;
            font: inherit;
            outline: none;
          }
          textarea:focus, input:focus {
            border-color: rgba(56, 189, 248, 0.56);
            box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.16);
          }
          #composer {
            min-height: 72px;
            resize: vertical;
          }
          .button, .tiny-button, .session-item {
            border: 1px solid var(--border);
            background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03));
            color: var(--text);
            border-radius: 12px;
            cursor: pointer;
          }
          .button {
            padding: 10px 14px;
            font-weight: 600;
          }
          .button.primary {
            border-color: rgba(56, 189, 248, 0.5);
            background: linear-gradient(180deg, rgba(56,189,248,0.24), rgba(56,189,248,0.12));
          }
          .button.danger {
            border-color: rgba(239, 68, 68, 0.46);
          }
          .tiny-button {
            padding: 4px 8px;
            font-size: 12px;
          }
          .session-item {
            text-align: left;
            width: 100%;
            padding: 10px 12px;
            display: grid;
            gap: 4px;
          }
          .session-item.active {
            border-color: rgba(56, 189, 248, 0.5);
            background: rgba(56, 189, 248, 0.1);
          }
          .session-title {
            font-size: 13px;
            font-weight: 600;
          }
          .session-preview {
            font-size: 12px;
            color: var(--muted);
            line-height: 1.3;
          }
          .message {
            border: 1px solid var(--border);
            background: rgba(17, 25, 47, 0.68);
            border-radius: 18px;
            padding: 14px;
            box-shadow: var(--shadow);
          }
          .message.user {
            background: rgba(22, 33, 60, 0.84);
          }
          .message.assistant {
            background: rgba(10, 16, 32, 0.92);
          }
          .message.system {
            background: rgba(56, 189, 248, 0.08);
          }
          .message-head {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 8px;
            color: var(--muted);
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }
          .message-body {
            font-size: 14px;
            line-height: 1.5;
          }
          .message-body pre {
            white-space: pre-wrap;
            word-break: break-word;
            margin: 0;
          }
          .markdown h1, .markdown h2, .markdown h3 {
            margin-top: 0.8em;
          }
          .markdown p, .markdown ul, .markdown ol, .markdown pre {
            margin: 0.7em 0;
          }
          .code-block {
            padding: 12px;
            overflow: auto;
            border-radius: 12px;
            background: rgba(2, 6, 23, 0.9);
            border: 1px solid rgba(148, 163, 184, 0.18);
          }
          .code-wrap {
            margin: 10px 0;
          }
          .code-toolbar {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 6px;
          }
          .code-block code {
            font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
            font-size: 12px;
          }
          .panel-title {
            padding: 10px 12px 0;
            font-size: 12px;
            color: var(--muted);
            text-transform: uppercase;
            letter-spacing: 0.1em;
          }
          .sidebar-card {
            margin: 0 10px 10px;
            border: 1px solid var(--border);
            border-radius: 16px;
            background: rgba(17, 25, 47, 0.66);
            padding: 10px;
            display: grid;
            gap: 8px;
          }
          .kv {
            display: grid;
            gap: 4px;
          }
          .kv label {
            color: var(--muted);
            font-size: 12px;
          }
          .header-select {
            min-width: 220px;
          }
          .muted-box {
            border: 1px dashed rgba(148, 163, 184, 0.22);
            border-radius: 12px;
            padding: 10px;
            color: var(--muted);
            font-size: 12px;
            line-height: 1.4;
          }
          .files {
            display: grid;
            gap: 8px;
          }
          .file-chip {
            border: 1px solid var(--border);
            background: rgba(5, 10, 19, 0.58);
            border-radius: 12px;
            padding: 8px;
            display: grid;
            gap: 6px;
          }
          .file-chip-name {
            font-size: 13px;
            font-weight: 600;
          }
          .file-chip-path {
            font-size: 11px;
            color: var(--muted);
            word-break: break-all;
          }
          .welcome {
            margin: auto;
            max-width: 460px;
            text-align: center;
            color: var(--muted);
          }
          .welcome h2 {
            color: var(--text);
            margin-bottom: 10px;
          }
          .empty-state {
            color: var(--muted);
            font-size: 12px;
            padding: 10px;
          }
          .message-actions {
            margin-top: 10px;
            display: flex;
            justify-content: flex-end;
          }
          .status-line {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            padding-top: 2px;
            color: var(--muted);
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="app">
          <div class="topbar">
            <div class="brand">
              <strong>OpenCode GUI</strong>
              <span>Claude Code style chat for OpenCode</span>
            </div>
            <div class="toolbar">
              <select id="modelSelect" class="header-select"></select>
              <button id="focusButton" class="button">Focus</button>
              <button id="newChatBtn" class="button primary">New Chat</button>
            </div>
          </div>
          <div class="layout">
            <aside class="sidebar">
              <div class="panel-title">Sessions</div>
              <div class="sidebar-scroll">
                <div id="sessionList"></div>
                <div class="sidebar-card">
                  <div class="kv">
                    <label>Workspace file</label>
                    <span id="activeFileLabel">None</span>
                  </div>
                  <div class="kv">
                    <label>Current session</label>
                    <span id="activeSessionLabel">None</span>
                  </div>
                  <div class="kv">
                    <label>Selection</label>
                    <span id="selectionLabel">None</span>
                  </div>
                  <div class="kv">
                    <label>Open files</label>
                    <span id="openFilesLabel">0</span>
                  </div>
                  <div class="kv">
                    <label for="systemPrompt">System Prompt / Instructions</label>
                    <textarea id="systemPrompt" rows="7" placeholder="You are a senior software engineer..."></textarea>
                  </div>
                  <div class="kv">
                    <label for="memoryNotes">Memory Notes</label>
                    <textarea id="memoryNotes" rows="5" placeholder="Workspace notes, conventions, reminders..."></textarea>
                  </div>
                </div>
                <div class="sidebar-card">
                  <div class="kv">
                    <label>Attached files</label>
                    <div id="filesPreview" class="files"></div>
                  </div>
                  <button id="addFilesBtn" class="button">+ Add Files</button>
                </div>
              </div>
            </aside>
            <main class="main">
              <div id="messages" class="messages"></div>
              <div class="composer">
                <div class="status-line">
                  <span id="status">Ready</span>
                  <button id="stopBtn" class="button danger">Stop</button>
                </div>
                <textarea id="composer" placeholder="Ask OpenCode... use /fix, /refactor, /test, /explain"></textarea>
                <div class="composer-row">
                  <div class="hint">Enter to send, Shift+Enter for newline</div>
                  <button id="sendBtn" class="button primary">Send</button>
                </div>
              </div>
            </main>
          </div>
        </div>
        <script nonce="${nonce}" src="${scriptUri}"></script>
      </body>
      </html>`;
  }

  private postToWebview(message: ExtensionToWebviewMessage): void {
    this.view?.webview.postMessage(message);
  }

  private getState(): RendererState {
    const persisted = this.store.load();
    return {
      sessions: persisted.sessions,
      activeSessionId: persisted.activeSessionId,
      systemPrompt: persisted.systemPrompt,
      memoryNotes: persisted.memoryNotes,
      defaultModel: persisted.defaultModel,
      busy: this.state.busy,
      models: this.models,
      workspaceRoot: this.workspaceRoot(),
      workspaceContext: this.state.workspaceContext,
    };
  }

  private workspaceRoot(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  private async pushState(): Promise<void> {
    this.postToWebview({
      type: "state",
      payload: this.getState(),
    });
  }

  private async handleMessage(message: WebviewToExtensionMessage): Promise<void> {
    switch (message.type) {
      case "ready":
      case "requestState":
        await this.pushState();
        return;
      case "requestModels":
        await this.refreshModels(true);
        return;
      case "newChat":
        await this.createNewChat();
        return;
      case "switchChat":
        await this.switchChat(String((message.payload as { sessionId: string }).sessionId));
        return;
      case "selectModel":
        await this.selectModel(String((message.payload as { model: string }).model));
        return;
      case "updateSystemPrompt":
        await this.store.updateSystemPrompt(String((message.payload as { systemPrompt: string }).systemPrompt ?? ""));
        await this.updateActiveSessionSystemPrompt(String((message.payload as { systemPrompt: string }).systemPrompt ?? ""));
        await this.pushState();
        return;
      case "saveMemory":
        await this.store.updateMemoryNotes(String((message.payload as { memoryNotes: string }).memoryNotes ?? ""));
        await this.pushState();
        return;
      case "requestFiles":
        await this.pickFiles();
        return;
      case "requestWorkspaceContext":
        await this.refreshWorkspaceContext();
        return;
      case "send":
        await this.sendMessage(message.payload as { sessionId?: string; message: string; command?: string; attachedFiles?: AttachedFile[] });
        return;
      case "stop":
        this.bridge.stop();
        this.state.busy = false;
        this.postToWebview({ type: "stopped" });
        await this.pushState();
        return;
      case "deleteChat":
        await this.deleteChat(String((message.payload as { sessionId: string }).sessionId));
        return;
      case "renameChat":
        await this.renameChat(message.payload as { sessionId: string; title: string });
        return;
      case "focusInput":
        this.postToWebview({ type: "focusInput" });
        return;
      case "applyPatch":
        await this.applyPatch(message.payload as { patch: string });
        return;
      case "connectZen":
        await this.connectZen();
        return;
    }
  }

  private async createNewChat(): Promise<void> {
    await this.createSession(false);
  }

  private async createSession(fork: boolean): Promise<ChatSession> {
    const state = this.store.load();
    const model = state.defaultModel || (await this.zen.ensureDefaultModel());
    const source = this.getActiveSession();
    const session: ChatSession = {
      id: `session_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      name: fork && source ? `Fork of ${source.name}` : "New chat",
      model,
      systemPrompt: state.systemPrompt,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: fork && source ? source.messages.map((message) => ({ ...message, id: `${message.id}_fork_${Date.now()}` })) : [],
    };
    const sessions = [session, ...state.sessions];
    await this.store.save({ ...state, sessions, activeSessionId: session.id });
    await this.pushState();
    return session;
  }

  private getActiveSession(): ChatSession | undefined {
    const state = this.store.load();
    return state.sessions.find((item) => item.id === state.activeSessionId) ?? state.sessions[0];
  }

  private async updateActiveSessionSystemPrompt(systemPrompt: string): Promise<void> {
    const session = this.getActiveSession();
    if (!session) {
      return;
    }
    session.systemPrompt = systemPrompt;
    session.updatedAt = Date.now();
    await this.store.updateSession(session);
  }

  private async selectModel(model: string): Promise<void> {
    const active = this.getActiveSession();
    if (!active) {
      await this.createNewChat();
    }
    const session = this.getActiveSession();
    if (!session) {
      return;
    }
    session.model = model;
    session.updatedAt = Date.now();
    await this.store.updateSession(session);
    await this.store.updateDefaultModel(model);
    await this.pushState();
  }

  private async openModelPicker(): Promise<void> {
    if (this.models.length === 0) {
      await this.refreshModels(true);
    }
    const picked = await vscode.window.showQuickPick(
      this.models.map((model) => ({
        label: model.displayName,
        description: model.id,
        detail: model.endpoint,
      })),
      {
        placeHolder: "Select a model for the active session",
      }
    );
    if (!picked) {
      return;
    }
    await this.selectModel(picked.description);
  }

  private async openThemePicker(): Promise<void> {
    await vscode.commands.executeCommand("workbench.action.selectTheme");
  }

  async showAgents(): Promise<void> {
    const child = spawn("opencode", ["agent", "list"], { env: process.env });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      output += String(chunk);
    });

    await new Promise<void>((resolve, reject) => {
      child.on("error", reject);
      child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(output || `opencode agent list exited ${code}`))));
    });

    const lines = output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    await vscode.window.showQuickPick(
      lines.map((line) => ({ label: line })),
      { placeHolder: "OpenCode agents" }
    );
  }

  private async exportSession(sessionId: string): Promise<void> {
    const state = this.store.load();
    const session = state.sessions.find((item) => item.id === sessionId);
    if (!session) {
      return;
    }
    const uri = await vscode.window.showSaveDialog({
      saveLabel: "Export OpenCode session",
      filters: { JSON: ["json"] },
      defaultUri: vscode.Uri.file(`${session.name.replaceAll(/\s+/g, "-").toLowerCase()}.json`),
    });
    if (!uri) {
      return;
    }
    await fs.writeFile(uri.fsPath, JSON.stringify(session, null, 2), "utf8");
  }

  private async copySession(sessionId: string): Promise<void> {
    const state = this.store.load();
    const session = state.sessions.find((item) => item.id === sessionId);
    if (!session) {
      return;
    }
    const text = session.messages.map((message) => `[${message.role}] ${message.content}`).join("\n\n");
    await vscode.env.clipboard.writeText(text);
  }

  private async compactSession(sessionId: string): Promise<void> {
    const state = this.store.load();
    const session = state.sessions.find((item) => item.id === sessionId);
    if (!session) {
      return;
    }
    const summaryRequest: SendRequest = {
      sessionId: session.opencodeSessionId,
      message: "Summarize this conversation into compact memory notes and key action items.",
      systemPrompt: session.systemPrompt,
      memoryNotes: state.memoryNotes,
      model: session.model,
      files: [],
      workspaceRoot: this.workspaceRoot(),
    };
    const result = await this.bridge.run(summaryRequest, () => undefined);
    session.messages = [
      {
        id: `msg_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        role: "system",
        content: `Compact summary:\n${result.finalText}`,
        createdAt: Date.now(),
      },
    ];
    session.updatedAt = Date.now();
    await this.store.updateSession(session);
    await this.pushState();
  }

  async openSessionPicker(): Promise<void> {
    const state = this.store.load();
    const picked = await vscode.window.showQuickPick(
      state.sessions.map((session) => ({
        label: session.name,
        description: session.model,
        detail: `${session.messages.length} messages`,
        sessionId: session.id,
      })),
      { placeHolder: "Switch workspace session" }
    );
    if (!picked) {
      return;
    }
    await this.switchChat(picked.sessionId);
  }

  async connectZen(): Promise<void> {
    const apiKey = await vscode.window.showInputBox({
      prompt: "Paste your OpenCode Zen API key",
      ignoreFocusOut: true,
      password: true,
    });
    if (!apiKey) {
      return;
    }
    await this.context.secrets.store("opencodeGui.zenApiKey", apiKey.trim());
    await this.refreshModels(true);
    await vscode.window.showInformationMessage("OpenCode Zen key stored.");
  }

  private async switchChat(sessionId: string): Promise<void> {
    await this.store.setActiveSession(sessionId);
    await this.pushState();
  }

  private async deleteChat(sessionId: string): Promise<void> {
    await this.store.deleteSession(sessionId);
    await this.pushState();
  }

  private async renameChat(payload: { sessionId: string; title: string }): Promise<void> {
    const state = this.store.load();
    const session = state.sessions.find((item) => item.id === payload.sessionId);
    if (session) {
      session.name = payload.title.trim() || session.name;
      session.updatedAt = Date.now();
      await this.store.updateSession(session);
    }
    await this.pushState();
  }

  private async pickFiles(): Promise<void> {
    const picked = await vscode.window.showOpenDialog({
      canSelectMany: true,
      canSelectFiles: true,
      canSelectFolders: false,
      openLabel: "Attach files",
      defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri,
    });
    if (!picked?.length) {
      return;
    }

    const files = await Promise.all(
      picked.map(async (uri) => this.readFileAsContext(uri))
    );

    this.postToWebview({
      type: "selectedFiles",
      payload: { files },
    });
  }

  private async refreshWorkspaceContext(): Promise<void> {
    this.state.workspaceContext = await this.collectWorkspaceContext();
    this.postToWebview({
      type: "workspaceContext",
      payload: this.state.workspaceContext,
    });
    await this.pushState();
  }

  private async collectWorkspaceContext(): Promise<ContextSnapshot["workspaceContext"]> {
    const config = vscode.workspace.getConfiguration("opencodeGui");
    const autoAttachActiveFile = config.get<boolean>("autoAttachActiveFile", true);
    const autoAttachSelection = config.get<boolean>("autoAttachSelection", true);
    const autoAttachOpenFiles = config.get<boolean>("autoAttachOpenFiles", false);

    const activeEditor = vscode.window.activeTextEditor;
    const activeFile = autoAttachActiveFile && activeEditor ? await this.readEditorAsContext(activeEditor) : null;
    const selectedText = autoAttachSelection && activeEditor?.selection && !activeEditor.selection.isEmpty
      ? activeEditor.document.getText(activeEditor.selection)
      : undefined;

    const openFiles: AttachedFile[] = [];
    if (autoAttachOpenFiles) {
      for (const editor of vscode.window.visibleTextEditors) {
        if (editor.document.uri.scheme !== "file") {
          continue;
        }
        openFiles.push(await this.readEditorAsContext(editor));
      }
    }

    return {
      activeFile,
      selectedText,
      openFiles: openFiles.length > 0 ? openFiles : undefined,
    };
  }

  private async readEditorAsContext(editor: vscode.TextEditor): Promise<AttachedFile> {
    const document = editor.document;
    return {
      name: path.basename(document.uri.fsPath),
      path: document.uri.fsPath,
      content: document.getText(),
    };
  }

  private async readFileAsContext(uri: vscode.Uri): Promise<AttachedFile> {
    const content = await fs.readFile(uri.fsPath, "utf8");
    return {
      name: path.basename(uri.fsPath),
      path: uri.fsPath,
      content,
    };
  }

  private async sendMessage(payload: { sessionId?: string; message: string; command?: string; attachedFiles?: AttachedFile[] }): Promise<void> {
    const state = this.store.load();
    let session = state.sessions.find((item) => item.id === state.activeSessionId) ?? state.sessions[0];
    if (!session) {
      session = await this.createSession(false);
    }
    if (!session) {
      throw new Error("Unable to create or restore a chat session.");
    }

    const workspaceContext = await this.collectWorkspaceContext();
    this.state.workspaceContext = workspaceContext;

    const attachedFiles = payload.attachedFiles ?? [];
    const parsed = parseSlashCommand(payload.message);
    const definition = parsed ? getSlashCommand(parsed.command) : undefined;
    if (parsed && definition?.kind === "action" && definition.action) {
      await definition.action(
        {
          input: payload.message,
          session,
          workspaceSessions: state.sessions,
          stopGeneration: () => this.bridge.stop(),
          createSession: async (fork?: boolean) => this.createSession(Boolean(fork)),
          renameSession: async (sessionId: string, name: string) => {
            const current = this.store.load().sessions.find((item) => item.id === sessionId);
            if (!current) {
              return;
            }
            current.name = name;
            current.updatedAt = Date.now();
            await this.store.updateSession(current);
          },
          setActiveSession: async (sessionId: string) => this.switchChat(sessionId),
          exportSession: async (sessionId: string) => this.exportSession(sessionId),
          copySession: async (sessionId: string) => this.copySession(sessionId),
          openModelPicker: async () => this.openModelPicker(),
          openThemePicker: async () => this.openThemePicker(),
          openSessionPicker: async () => this.openSessionPicker(),
          compactSession: async (sessionId: string) => this.compactSession(sessionId),
        },
        parsed.body
      );
      await this.pushState();
      return;
    }

    const transformedMessage = parsed && definition?.buildPrompt ? definition.buildPrompt(parsed.body, session) : payload.message;
    const request: SendRequest = {
      sessionId: payload.sessionId ?? session.opencodeSessionId,
      message: transformedMessage,
      command: parsed?.command ?? payload.command,
      systemPrompt: session.systemPrompt || state.systemPrompt,
      memoryNotes: state.memoryNotes,
      model: session.model || state.defaultModel,
      files: attachedFiles,
      workspaceRoot: this.workspaceRoot(),
      activeFile: workspaceContext?.activeFile ?? null,
      selectedText: workspaceContext?.selectedText,
      openFiles: workspaceContext?.openFiles,
    };

    const sessionMessage = session;
    sessionMessage.messages.push({
      id: `msg_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      role: "user",
      content: transformedMessage,
      createdAt: Date.now(),
      command: parsed?.command ?? payload.command,
    });
    const assistantMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      role: "assistant" as const,
      content: "",
      createdAt: Date.now(),
      command: parsed?.command ?? payload.command,
      isStreaming: true,
    };
    sessionMessage.messages.push(assistantMessage);
    sessionMessage.updatedAt = Date.now();
    if (!sessionMessage.name || sessionMessage.name === "New chat") {
      sessionMessage.name = transformedMessage.slice(0, 40) || "Chat";
    }
    await this.store.updateSession(sessionMessage);
    await this.pushState();

    this.state.busy = true;
    this.postToWebview({
      type: "sessionStarted",
      payload: { sessionId: sessionMessage.id, opencodeSessionId: sessionMessage.opencodeSessionId },
    });
    await this.pushState();

    try {
      const result = await this.bridge.run(request, (progress) => {
        if (progress.text) {
          assistantMessage.content += progress.text;
          this.postToWebview({
            type: "append",
            payload: {
              sessionId: sessionMessage.id,
              text: progress.text,
              command: payload.command,
              isFinal: false,
            },
          });
        }
        if (progress.sessionID) {
          sessionMessage.opencodeSessionId = progress.sessionID;
        }
      });

      assistantMessage.isStreaming = false;
      assistantMessage.content = result.finalText || assistantMessage.content;
      sessionMessage.opencodeSessionId = result.sessionID ?? sessionMessage.opencodeSessionId;
      sessionMessage.updatedAt = Date.now();
      await this.store.updateSession(sessionMessage);
      this.state.busy = false;
      this.postToWebview({
        type: "sessionFinished",
        payload: {
          sessionId: sessionMessage.id,
          opencodeSessionId: sessionMessage.opencodeSessionId,
        },
      });
      await this.pushState();
    } catch (error) {
      assistantMessage.isStreaming = false;
      assistantMessage.content += `\n\n[OpenCode error] ${(error as Error).message}`;
      sessionMessage.updatedAt = Date.now();
      await this.store.updateSession(sessionMessage);
      this.state.busy = false;
      this.postToWebview({
        type: "error",
        payload: { message: (error as Error).message },
      });
      await this.pushState();
    }
  }

  private async applyPatch(payload: { patch: string }): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage("Open a file before applying a patch.");
      return;
    }
    const document = editor.document;
    const preview = await vscode.workspace.openTextDocument({
      content: payload.patch,
      language: document.languageId,
    });
    await vscode.commands.executeCommand(
      "vscode.diff",
      document.uri,
      preview.uri,
      "OpenCode Patch Preview"
    );
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("OpenCode GUI");
  const controller = new ChatController(context, output);

  context.subscriptions.push(
    output,
    vscode.window.registerWebviewViewProvider(ChatController.viewType, controller),
    vscode.commands.registerCommand("opencodeGui.showChat", async () => {
      await controller.show();
    }),
    vscode.commands.registerCommand("opencodeGui.showAgents", async () => {
      await controller["showAgents"]();
    }),
    vscode.commands.registerCommand("opencodeGui.connectZen", async () => {
      await controller["connectZen"]();
    }),
    vscode.commands.registerCommand("opencodeGui.newChat", async () => {
      await controller.show();
    }),
    vscode.commands.registerCommand("opencodeGui.focusInput", async () => {
      await controller.show();
    })
  );
}

export function deactivate(): void {}
