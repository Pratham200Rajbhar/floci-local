# Floci Management Dashboard

A production-grade, typed Next.js web dashboard to manage local and remote [Floci](https://github.com/floci/floci) AWS emulator instances. Supports multi-mode network access configuration from the UI (Local machine, LAN/Wi-Fi, Tailscale VPN, Custom reverse proxy) with automatic connection string generation and zero Docker IP leaks.

---

## 🌐 Configurable Network Access Modes

Navigate to **Network & Access** (`/settings/network`) in the sidebar to configure how developers and client devices connect to your Floci resources:

1. **Local Machine (`local`)**
   - Ideal for single-device local development.
   - Endpoint: `http://localhost:4566`.
   - Generates `localhost` database (`psql`/`mysql`), Redis, SSH, and AWS CLI connection commands.

2. **LAN / Local Wi-Fi (`lan`)**
   - Access Floci across your local subnet or office network (e.g., `192.168.1.50` or `floci.local`).
   - Generates LAN-accessible connection snippets for other devices on the same Wi-Fi.

3. **Tailscale / Private VPN (`tailscale`)**
   - Secure private tailnet connectivity via Tailscale CGNAT IP (`100.x.x.x`) or MagicDNS (`*.ts.net`).
   - Fully isolated: no public exposure, Funnels, or open ports required.

4. **Custom Host / Reverse Proxy (`custom`)**
   - Support for custom private domains, TLS (`https://`), reverse proxies (Nginx, Traefik, Caddy), and VPN gateways.

---

## ⚙️ Environment Configuration

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

### Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `FLOCI_ENDPOINT` | Backend connection to Floci emulator | `http://localhost:4566` |
| `FLOCI_NETWORK_MODE` | Initial network mode (`local`, `lan`, `tailscale`, `custom`) | `local` |
| `FLOCI_PUBLIC_HOST` | Initial public/published hostname | `localhost` |
| `FLOCI_PUBLIC_PROTOCOL` | Initial protocol (`http` or `https`) | `http` |
| `FLOCI_API_PORT` | Core Floci API port | `4566` |
| `FLOCI_CONFIG_LOCKED` | Lock UI settings in read-only mode (`true`/`false`) | `false` |
| `FLOCI_CONFIG_STORAGE_PATH` | Server-side JSON persistence path | `./data/floci-ui-config.json` |
| `FLOCI_RDS_PORT_RANGE_START/END` | RDS database proxy ports | `7001` – `7099` |
| `FLOCI_EC2_SSH_PORT_RANGE_START/END` | EC2 SSH proxy ports | `2200` – `2299` |
| `FLOCI_ELASTICACHE_PORT_RANGE_START/END` | ElastiCache Redis proxy ports | `6379` – `6399` |

---

## 🚀 Deployment Patterns

### Pattern 1: Same-Machine Docker Compose
Run both Floci and the Dashboard on the same host:
```bash
docker compose up -d
```
The dashboard connects internally via `http://floci:4566`, while publishing connection commands according to the network mode selected in `/settings/network`.

### Pattern 2: Remote Floci Host
When running Floci on a dedicated server or Raspberry Pi on your network/Tailnet:
```bash
# Set the backend endpoint
FLOCI_ENDPOINT=http://100.101.187.9:4566
npm run build
npm run start
```

---

## 🧪 Development & Testing

```bash
# Install dependencies
npm install

# Run Vitest unit & integration test suite
npm run test

# Run TypeScript type check
npm run typecheck

# Run Next.js linter
npm run lint

# Build and start production server
npm run build
npm run start
```
