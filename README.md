# Playwright Storage State Generator for Splunk

[日本語版 README はこちら](README.ja.md)

A tool to generate pre-authenticated browser state (Storage State) for [Playwright MCP](https://github.com/anthropics/anthropic-cookbook/tree/main/misc/model_context_protocol) when accessing Splunk. This allows the MCP server to use a saved session instead of exposing credentials in arguments or logs.

Works on **Windows**, **Linux**, **macOS**, and **WSL2**.

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)

## Installation

Extract the zip to any directory and run `npm install`. Chromium will be downloaded automatically during installation.

```bash
cd playwright-storage-state
npm install
```

> If Chromium is not installed automatically, run `npx playwright install chromium` manually.

## Setup

Create a `.env` file with your Splunk credentials in the `playwright/.auth/` directory (following the [Playwright authentication convention](https://playwright.dev/docs/auth#core-concepts)).

```bash
mkdir -p playwright/.auth
```

Create `playwright/.auth/splunk-myenv.env` with the following content:

```
SPLUNK_URL=https://your-splunk-server:8000
SPLUNK_USER=your-username
SPLUNK_PASS=your-password
```

## Security

- The `.env` file stores passwords in **plain text**. Restrict access permissions accordingly.
- `playwright/.auth/` is excluded from git via `.gitignore`.
- On Linux / macOS / WSL2, restrict file permissions:
  ```bash
  chmod 600 playwright/.auth/splunk-myenv.env
  ```
- The generated Storage State file also contains session credentials.
  - On Linux / macOS / WSL2, the script automatically sets `chmod 600`.
  - On Windows, verify file permissions manually after generation.

## Usage

Run from the project directory:

```bash
node generate-storage-state.js <env-file> <output-path>
```

Example:

```bash
node generate-storage-state.js \
  playwright/.auth/splunk-myenv.env \
  playwright/.auth/splunk-myenv-storage.json
```

- If the output directory does not exist, it will be created automatically.

## Cursor MCP Configuration

Add the Playwright MCP server to `~/.cursor/mcp.json` (Windows: `%USERPROFILE%\.cursor\mcp.json`), specifying the **absolute path** to the generated Storage State file.

```json
"playwright-myenv": {
  "command": "npx",
  "args": [
    "-y", "@playwright/mcp@latest",
    "--browser", "chromium",
    "--headless",
    "--ignore-https-errors",
    "--isolated",
    "--storage-state", "<absolute-path>/playwright-storage-state/playwright/.auth/splunk-myenv-storage.json"
  ]
}
```

Absolute path examples:

| Platform | Example |
|----------|---------|
| Linux / WSL2 | `/home/<USER>/playwright-storage-state/playwright/.auth/splunk-myenv-storage.json` |
| macOS | `/Users/<USER>/playwright-storage-state/playwright/.auth/splunk-myenv-storage.json` |
| Windows | `C:\\Users\\<USER>\\playwright-storage-state\\playwright\\.auth\\splunk-myenv-storage.json` |

> Use an **absolute path** for `--storage-state`. Relative paths and `~` may not be resolved correctly by the MCP server.

## Session Renewal

Splunk sessions expire after a period of time. If the MCP encounters authentication errors or the Splunk login page appears, regenerate the Storage State by running the same command again.

After regeneration, toggle the MCP server OFF/ON in Cursor, or restart Cursor to apply the new session.

## Troubleshooting

### Cannot connect to Splunk server

- Verify that `SPLUNK_URL` is correct and includes the scheme (`https://`).
- Check that the server is running and the port is accessible through any firewalls.
- For self-signed certificates, include `--ignore-https-errors` in the MCP server arguments (already included in the example above).

### Login fails

- Verify `SPLUNK_USER` and `SPLUNK_PASS` are correct.
- The script waits for a redirect to `**/app/**` after login. Timeout may indicate incorrect credentials or multi-factor authentication (MFA). Check the error message output for details.

### Certificate error (ERR_CERT_AUTHORITY_INVALID)

- The script uses `ignoreHTTPSErrors: true`, so certificate errors do not affect Storage State generation.
- For the MCP server, include `--ignore-https-errors` in its arguments.

### Chromium not found

- Run `npx playwright install chromium` to install the browser.

## Project Structure

```
playwright-storage-state/
├── generate-storage-state.js   # Main script
├── package.json                # Dependencies
├── package-lock.json           # Lock file
├── .gitignore                  # Excludes playwright/.auth/ and node_modules/
├── README.md                   # This file (English)
├── README.ja.md                # Japanese README
└── playwright/
    └── .auth/                  # Credential storage (created by user)
        ├── splunk-myenv.env              # Credentials
        └── splunk-myenv-storage.json     # Generated Storage State
```

## License

MIT
