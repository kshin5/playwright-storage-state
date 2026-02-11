# Playwright Storage State Generator for Splunk

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

[Japanese README](README.ja.md)

A tool to generate pre-authenticated browser state (Storage State) for [Playwright MCP](https://github.com/microsoft/playwright/tree/main/packages/playwright-mcp) when accessing Splunk. This allows the MCP server to use a saved session instead of exposing credentials in arguments or logs.

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ (LTS recommended)

## Installation

```bash
git clone https://github.com/<owner>/playwright-storage-state.git
cd playwright-storage-state
npm install
npx playwright install --with-deps chromium
```

## Setup

Create the `playwright/.auth/` directory if it does not exist, then create a `.env` file there with your Splunk credentials (directory structure inspired by [Playwright's authentication guide](https://playwright.dev/docs/auth#core-concepts)).

Create `playwright/.auth/splunk-myenv.env` with the following content:

```ini
SPLUNK_URL=https://your-splunk-server:8000
SPLUNK_USER=your-username
SPLUNK_PASS=your-password
```

## Security

- The `.env` file stores passwords in **plain text**. Restrict access so only you can read it.
- `playwright/.auth/` is excluded from git via `.gitignore`.
- The generated Storage State file also contains session credentials. The script automatically restricts file permissions after saving (on Windows, verify permissions manually).

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

### Managing multiple Splunk environments

Create separate `.env` and Storage State files for each environment:

```bash
# Development
node generate-storage-state.js \
  playwright/.auth/splunk-dev.env \
  playwright/.auth/splunk-dev-storage.json

# Production
node generate-storage-state.js \
  playwright/.auth/splunk-prod.env \
  playwright/.auth/splunk-prod-storage.json
```

```
playwright/.auth/
├── splunk-dev.env               # Dev credentials
├── splunk-dev-storage.json      # Dev session
├── splunk-prod.env              # Prod credentials
└── splunk-prod-storage.json     # Prod session
```

Register each environment as a separate MCP server to connect to multiple Splunk instances.

## Using with Playwright MCP

Pass the generated Storage State file to the Playwright MCP server using the `--storage-state` option with an **absolute path**:

```
@playwright/mcp ... --storage-state /absolute/path/to/splunk-myenv-storage.json
```

> Use an **absolute path** for `--storage-state`. Relative paths and `~` may not be resolved correctly by the MCP server.

<details>
<summary>Example: Cursor IDE configuration</summary>

First, find the absolute path to your Storage State file:

```bash
# Run from the project directory
cd playwright-storage-state
echo "$(pwd)/playwright/.auth/splunk-myenv-storage.json"
```

Add the following to `~/.cursor/mcp.json` (Windows: `%USERPROFILE%\.cursor\mcp.json`). The entry goes inside the `mcpServers` object. Replace the `--storage-state` value with the path from above:

```json
{
  "mcpServers": {
    "playwright-myenv": {
      "command": "npx",
      "args": [
        "-y", "@playwright/mcp@latest",
        "--browser", "chromium",
        "--headless",
        "--ignore-https-errors",
        "--isolated",
        "--storage-state", "/your/absolute/path/playwright-storage-state/playwright/.auth/splunk-myenv-storage.json"
      ]
    }
  }
}
```

</details>

## Session Renewal

Splunk sessions expire after a period of time. If the MCP encounters authentication errors or the Splunk login page appears, regenerate the Storage State by running the same command again.

The file is overwritten in place, so the MCP server will use the new session automatically.

## Limitations

- This tool targets Splunk’s **default login page** (username/password form). It does not support SSO, SAML, or custom login pages.
- Timeouts are fixed in the script: 30 seconds for the initial page load, 10 seconds for the post-login redirect. On slow networks you may need to adjust these values in the script.

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

### Timeout during login or page load

- The script uses fixed timeouts (30s for page load, 10s for post-login redirect). If you hit timeouts on a slow network, adjust the `timeout` values in the script.

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

Apache License 2.0 - see [LICENSE](LICENSE) for details.
