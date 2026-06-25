/// <reference types="vite/client" />

interface Window {
  acquireVsCodeApi: () => {
    postMessage: (msg: Record<string, unknown>) => void;
    getState: () => Record<string, unknown> | undefined;
    setState: (state: Record<string, unknown>) => void;
  };
}
