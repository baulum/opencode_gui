import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import { StreamChunk, FileAttachment } from '../types';

export type ChunkCallback = (chunk: StreamChunk) => void;
export type DoneCallback = () => void;
export type ErrorCallback = (error: string) => void;

export class OpenCodeCLIBridge {
  private process: ChildProcess | null = null;
  private outputStream: vscode.OutputChannel;
  private opencodePath: string;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputStream = outputChannel;
    this.opencodePath = this.resolveOpenCodePath();
  }

  private resolveOpenCodePath(): string {
    const config = vscode.workspace.getConfiguration('opencode-gui');
    const customPath = config.get<string>('cliPath');
    return customPath || 'opencode';
  }

  private buildArgs(
    systemPrompt: string,
    files: FileAttachment[]
  ): string[] {
    const args: string[] = [];

    if (systemPrompt) {
      args.push('--system-prompt', systemPrompt);
    }

    for (const file of files) {
      args.push('--file', file.path);
    }

    args.push('--stream');
    return args;
  }

  async sendMessage(
    message: string,
    systemPrompt: string,
    files: FileAttachment[],
    onChunk: ChunkCallback,
    onDone: DoneCallback,
    onError: ErrorCallback
  ): Promise<void> {
    return new Promise((resolve) => {
      try {
        const args = this.buildArgs(systemPrompt, files);
        this.process = spawn(this.opencodePath, args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env },
        });

        let buffer = '';

        this.process.stdout?.on('data', (data: Buffer) => {
          const text = data.toString();
          buffer += text;

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
              try {
                const parsed = JSON.parse(trimmed);
                onChunk(parsed as StreamChunk);
              } catch {
                onChunk({ type: 'text', content: trimmed });
              }
            } else {
              onChunk({ type: 'text', content: trimmed });
            }
          }
        });

        this.process.stdout?.on('end', () => {
          if (buffer.trim()) {
            onChunk({ type: 'text', content: buffer.trim() });
          }
          onDone();
          resolve();
        });

        this.process.stderr?.on('data', (data: Buffer) => {
          const text = data.toString().trim();
          if (text) {
            this.outputStream.appendLine(`[opencode stderr] ${text}`);
          }
        });

        this.process.on('error', (err) => {
          const msg = `Failed to start opencode: ${err.message}`;
          this.outputStream.appendLine(msg);
          onError(msg);
          resolve();
        });

        this.process.on('close', (code) => {
          if (code !== null && code !== 0) {
            this.outputStream.appendLine(
              `[opencode] exited with code ${code}`
            );
          }
          if (!this.process?.killed) {
            onDone();
            resolve();
          }
        });

        if (this.process.stdin) {
          this.process.stdin.write(message + '\n');
          this.process.stdin.end();
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        onError(msg);
        resolve();
      }
    });
  }

  cancel(): void {
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }

  dispose(): void {
    this.cancel();
  }
}
