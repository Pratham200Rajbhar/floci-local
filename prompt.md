# Prompt: Build a Production-Grade Floci Management Dashboard

Build a clean, minimal, production-quality web dashboard to fully manage a local Floci instance (an open-source AWS emulator running at http://localhost:4566) without needing the AWS CLI. Prioritize clarity, correctness, and maintainability over visual flair — no unnecessary animations, no dense sidebars, no dashboard clutter. Treat this as a real internal tool that will be maintained long-term, not a prototype: proper error handling, typed end-to-end, tested, and deployable.

## Tech stack
- Framework: Next.js 15 (App Router), TypeScript throughout, strict mode enabled
- Styling: Tailwind CSS, neutral gray/blue palette only, no gradients or heavy shadows
- Server logic: Next.js Route Handlers (`app/api/**/route.ts`) as the backend layer — no separate Express server
- AWS SDK for JavaScript v3, one centralized client factory per service, configured via environment variables (`FLOCI_ENDPOINT`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`) so swapping to real AWS later is a pure config change, zero code change
- Data fetching/caching: TanStack Query (React Query) on the client for all reads, with automatic polling/invalidation after writes
- Forms and validation: React Hook Form + Zod, with the same Zod schemas reused server-side to validate request bodies before calling AWS SDK
- State: no global state library needed — React Query cache is the source of truth
- Testing: Vitest + React Testing Library for components, and integration tests for each API route using a mocked AWS SDK client (`aws-sdk-client-mock`)
- Linting/formatting: ESLint (Next.js config) + Prettier, enforced via a pre-commit hook (Husky + lint-staged)

## Production requirements (non-negotiable)
- Full TypeScript typing for every API request/response — no `any`
- Centralized error handling: a single `handleAwsError` utility that maps AWS SDK exceptions to consistent JSON error shapes (`{ error: { code, message } }`) returned with correct HTTP status codes, used by every route handler
- Environment validation at startup using Zod — the app should fail fast with a clear message if `FLOCI_ENDPOINT` or credentials are missing, rather than failing deep inside a request
- Loading, empty, and error states designed for every list/table, not just happy path
- Optimistic UI updates for fast actions (e.g., queue creation) with rollback on failure
- Rate-limit-aware retry logic in the AWS SDK client config (exponential backoff) since some Floci services simulate throttling
- Structured logging on the server side (pino or similar) instead of console.log, with request IDs for tracing
- A `Dockerfile` and `docker-compose.override.yml` so the dashboard itself can run as a container alongside the existing Floci compose stack, on the same `floci_default` network, reachable at `http://floci:4566` internally
- `.env.example` file documenting every required environment variable
- CI-ready: a GitHub Actions workflow file that runs lint, typecheck, and tests on every push

## Core requirement
No raw AWS CLI usage anywhere. Every action a user would normally run via `aws s3 ...`, `aws rds ...`, `aws ec2 ...`, etc. must be a clickable UI action backed by a typed API route.

## Pages / sections to build (App Router structure)

1. **`/` Dashboard**
   - Health check card polling `GET /api/health` (which itself calls Floci's `_floci/health`) every 5s via React Query, showing UP/DOWN status and Floci version
   - Summary counts: S3 buckets, RDS instances, EC2 instances, ElastiCache clusters, Lambda functions, SQS queues
   - "Reset all data" button with a confirmation dialog (Radix UI AlertDialog) that wipes local state

2. **`/s3`**
   - List buckets, create bucket, delete bucket (confirm required)
   - Bucket detail view (`/s3/[bucket]`): list objects, drag-and-drop upload with progress, download, delete, copy-able S3 URI
   - Server-side pagination for buckets with many objects (use `ListObjectsV2` continuation tokens, don't load everything at once)

3. **`/rds`**
   - List DB instances with status (creating/available/deleting), engine, endpoint, port
   - Create instance form: identifier, engine (postgres/mysql/mariadb), instance class, master username/password (masked input), storage size — Zod-validated
   - Delete instance action
   - "Copy connection string" button generating a ready-to-use psql/mysql string from the returned endpoint

4. **`/ec2`**
   - List instances: ID, state, instance type, mapped SSH port
   - Launch instance form: AMI ID, instance type, count
   - Start / Stop / Terminate actions per instance, each with optimistic status updates
   - Show the exact `ssh -p <port> user@localhost` command per running instance

5. **`/elasticache`**
   - List replication groups/clusters with status and endpoint:port
   - Create cluster form: ID, description, node type
   - Delete cluster action
   - Show ready-to-use `redis-cli -h localhost -p <port>` command

6. **`/lambda`**
   - List functions with runtime and last modified
   - Create function: name, runtime dropdown, zip upload, handler name
   - Invoke function with a JSON payload editor (Monaco or CodeMirror) and formatted response viewer
   - Delete function

7. **`/messaging`** (SQS + SNS combined, tabbed)
   - List queues/topics, create/delete each
   - Send test message to a queue, poll and display received messages
   - Publish test message to a topic

8. **`/ses`**
   - Verify an email identity
   - Send a test email (from/to/subject/body) via a validated form
   - List captured/sent emails from Floci's inspection endpoint, rendered inline (HTML sanitized before render)

## UX requirements
- Single persistent left nav, no nested menus
- Every destructive action requires an inline confirm step (Radix AlertDialog), not a full-page redirect
- Plain-text error messages surfaced from `handleAwsError`, never swallowed or replaced with generic "Something went wrong"
- One light theme only, no theming system, no dark mode toggle
- Responsive down to laptop width only; no mobile requirement

## Deliverable
A production-ready Next.js app with:
- `npm run dev` for local development
- `npm run build && npm run start` for a production build, verified to actually run correctly (not just build without errors)
- `npm run test` running the full Vitest suite
- `npm run lint` and `npm run typecheck` passing cleanly
- A README covering environment setup, how to point at real AWS later (just changing `FLOCI_ENDPOINT` and credentials in `.env`), and how to run via Docker alongside the existing Floci compose stack
