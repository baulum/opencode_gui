import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import * as vscode from "vscode";
import {
  BridgeProgress,
  BridgeResult,
  SendRequest,
  StreamEvent,
} from "./types";

type ProgressHandler = (progress: BridgeProgress) => void;

function resolveOpencodeCommand(): string {
  const configured = vscode.workspace.getConfiguration("opencodeGui").get<string>("opencodePath");
  const candidates = [
    configured,
    process.env.OPENCODE_PATH,
    "opencode",
    "/opt/homebrew/bin/opencode",
    "/usr/local/bin/opencode",
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (path.isAbsolute(candidate)) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
      continue;
    }
    return candidate;
  }

  return "opencode";
}

function buildPromptPayload(request: SendRequest): string {
  const payload = {
    type: "opencode_gui_request",
    system: {
      type: "system",
      content: request.systemPrompt,
    },
    memory: {
      type: "memory",
      content: request.memoryNotes ?? "",
    },
    context: {
      type: "workspace_context",
      workspaceRoot: request.workspaceRoot,
      activeFile: request.activeFile ?? null,
      selectedText: request.selectedText ?? "",
      openFiles: request.openFiles ?? [],
      memoryNotes: request.memoryNotes ?? "",
    },
    file_context: {
      type: "file_context",
      files: request.files,
    },
    user: {
      type: "message",
      command: request.command,
      content: request.message,
    },
    instructions: [
      "Use the provided system instructions as the highest priority behavior.",
      "Treat attached files and workspace context as authoritative context.",
      "Return clear markdown with code blocks when appropriate.",
    ],
  };

  return [
    "You are receiving a structured request from a VS Code extension.",
    "Use the system instructions and workspace context as authoritative guidance.",
    "Process the following JSON payload and answer the user's coding question.",
    "If code changes are requested, provide concrete changes and explain how to apply them.",
    "",
    "```json",
    JSON.stringify(payload, null, 2),
    "```",
  ].join("\n");
}

function parseJsonLine(line: string): StreamEvent | null {
  try {
    const value = JSON.parse(line) as StreamEvent;
    return value;
  } catch {
    return null;
  }
}

export class OpenCodeBridge {
  private currentProcess: ChildProcessWithoutNullStreams | null = null;
  private currentSessionId: string | undefined;

  constructor(private readonly output: vscode.OutputChannel) {}

  stop(): void {
    if (this.currentProcess && !this.currentProcess.killed) {
      this.currentProcess.kill("SIGTERM");
      setTimeout(() => {
        if (this.currentProcess && !this.currentProcess.killed) {
          this.currentProcess.kill("SIGKILL");
        }
      }, 1500);
    }
    this.currentProcess = null;
  }

  async run(request: SendRequest, onProgress: ProgressHandler): Promise<BridgeResult> {
    const prompt = buildPromptPayload(request);
    const args = [
      "run",
      "--format",
      "json",
      "--pure",
      "--model",
      request.model,
      "--dir",
      request.workspaceRoot ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd(),
      "--prompt",
      prompt,
    ];

    if (request.variant) {
      args.push("--variant", request.variant);
    }

    if (request.sessionId) {
      args.push("--session", request.sessionId, "--continue");
    }

    if (request.files.length > 0) {
      for (const file of request.files) {
        args.push("--file", file.path);
      }
    }

    const child = spawn(resolveOpencodeCommand(), args, {
      cwd: request.workspaceRoot ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd(),
      env: {
        ...process.env,
        FORCE_COLOR: "1",
      },
    });

    this.currentProcess = child;
    this.currentSessionId = request.sessionId;

    let finalText = "";
    let sessionID = request.sessionId;
    let bufferedStderr = "";

    const rl = readline.createInterface({
      input: child.stdout,
      crlfDelay: Infinity,
    });

    const stderrRl = readline.createInterface({
      input: child.stderr,
      crlfDelay: Infinity,
    });

    stderrRl.on("line", (line) => {
      bufferedStderr += `${line}\n`;
      this.output.appendLine(`[opencode] ${line}`);
    });

    rl.on("line", (line) => {
      const event = parseJsonLine(line);
      if (!event) {
        if (line.trim()) {
          onProgress({ text: line });
          finalText += `${line}\n`;
        }
        return;
      }

      if (event.sessionID) {
        sessionID = event.sessionID;
      }
      if (event.part?.sessionID) {
        sessionID = event.part.sessionID;
      }

      if (event.type === "text" && event.part?.text) {
        finalText += event.part.text;
        onProgress({ text: event.part.text, sessionID, raw: event });
        return;
      }

      if (event.type === "step_start" || event.type === "step_finish") {
        onProgress({ sessionID, raw: event });
      }
    });

    return await new Promise<BridgeResult>((resolve, reject) => {
      child.on("error", (error) => {
        this.currentProcess = null;
        reject(error);
      });

      child.on("close", (code) => {
        rl.close();
        stderrRl.close();
        this.currentProcess = null;

        if (code === 0) {
          resolve({
            sessionID,
            finalText: finalText.trim(),
          });
          return;
        }

        const details = bufferedStderr.trim();
        reject(new Error(details || `OpenCode exited with code ${code ?? "unknown"}`));
      });
    });
  }
}
