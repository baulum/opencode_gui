# OpenCode GUI

VS Code sidebar chat UI for OpenCode with:

- persistent workspace chats
- streaming OpenCode responses
- system prompt storage per workspace
- slash commands
- file context attachment
- active file and selection awareness
- stop generation support

## Install

1. Run `npm install`
2. Build the extension with `npm run build`
3. Open the folder in VS Code
4. Press `F5` to launch the Extension Development Host

## Usage

- Open the `OpenCode` activity bar icon
- Start a new chat
- Add files with `+`
- Edit the system prompt
- Use slash commands like `/fix`, `/refactor`, `/test`
- Press `Enter` to send, `Shift+Enter` for a newline

## Debugging

- Check `View -> Output -> OpenCode GUI`
- If OpenCode is missing, verify `opencode --help` works in your terminal
- If streaming fails, run the CLI directly:
  - `opencode run --format json --pure "Say hello"`
- If the webview is blank, rebuild `npm run build:webview`

## Notes

- This extension uses the local `opencode` CLI.
- Workspace data is stored in VS Code workspace state.
