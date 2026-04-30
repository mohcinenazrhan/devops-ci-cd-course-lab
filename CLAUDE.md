# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A DevOps CI/CD learning environment running Jenkins, Nexus, and a deployment target via Docker Compose. Contains two apps: a Go word-cloud-generator (from the original course) and a custom Node.js React+Express word-cloud-app.

## Environment Commands

```bash
# Start everything (build containers, apply Jenkins fixes, print URLs)
make dev

# Individual operations
make up                  # Build and start containers
make down                # Stop containers
make clean               # Remove everything (containers, images, volumes)
make logs s=jenkins      # Tail logs for a service
make restart s=nexus     # Restart a service
make ps                  # Show container status
```

## Services

| Service | URL | Credentials |
|---------|-----|-------------|
| Jenkins | http://localhost:8080 | admin / theagileadmin |
| Nexus | http://localhost:8081 | admin / theagileadmin |
| Test Fixture (SSH) | ssh -p 2222 root@localhost | theagileadmin |
| Deployed App | http://localhost:8888 | - |

## Node.js App (word-cloud-app/)

```bash
cd word-cloud-app
npm install              # Install dependencies
npm run lint             # ESLint (zero warnings tolerance)
npm test                 # Vitest - 11 tests (6 backend + 5 frontend)
npm run test:watch       # Vitest watch mode
npm run dev              # Vite dev server (proxies /api to :8888)
npm run build            # Production build → dist/
npm start                # Run Express server on :8888
```

Backend: Express server (`server.js`) with `POST /api/wordcloud`, `GET /api/health`, `GET /api/version`. Serves React dist as static files.

Frontend: React + Vite (`src/`). WordCloud visualization with dynamic sizing.

Tests: Vitest with jsdom. Backend tests in `server.test.js`, React component tests in `src/App.test.jsx`.

Lint: ESLint flat config. `no-unused-vars` ignores React/component imports via `varsIgnorePattern: "^(React|[A-Z])"`.

## Jenkins Jobs

| Job | Type | What It Does |
|-----|------|--------------|
| word-cloud-app-build | Pipeline (from SCM) | Checkout → Install → Lint → Test → Build → Package → Upload → Deploy → Smoke Test |
| word-cloud-app-deploy | Freestyle | Ansible deploys from Nexus to test_fixture (param: `deploy_version`) |
| word-cloud-generator-build | Freestyle | Go app: lint, test, compile ARM64 static binary, upload to Nexus |
| word-cloud-generator-deploy | Freestyle | Ansible deploys Go binary to test_fixture (param: `deploy_version`) |

The Node.js pipeline is defined in `word-cloud-app/Jenkinsfile` (loaded from GitHub via `CpsScmFlowDefinition`). It runs on SCM polling (every 1 min) with path filter `word-cloud-app/.*` -- only changes inside the app trigger a build. The Deploy stage auto-triggers `word-cloud-app-deploy` and the Smoke Test stage verifies `/api/version` matches the expected build number.

**GitHub repo:** https://github.com/mohcinenazrhan/devops-ci-cd-course-lab (monorepo: app + infrastructure)

## Deployment Flow

Jenkins → Ansible → test_fixture container via SSH.

Playbooks in `jenkins_home/ansible/`:
- `node-app.yml` → role `word-cloud-app` (downloads tarball, extracts, runs `node server.js`)
- `app.yml` → role `word-cloud-generator` (downloads binary, runs with `daemonize`)

Nexus credentials are bound to env var `nexus_pwd` in deploy jobs. Deploy version comes from the `deploy_version` build parameter.

## Architecture Decisions

- **Jenkins Dockerfile** (`cd_jenkins/Dockerfile`): Based on `jenkins/jenkins:lts-jdk17`. Installs Go, Node.js, Ansible, sshpass.
- **Entrypoint** (`cd_jenkins/entrypoint.sh`): Fixes macOS Docker volume mount issues — removes SSH config with wrong ownership, sets `ANSIBLE_HOST_KEY_CHECKING=False`, adds git safe.directory.
- **test_fixture** (`test_fixture/Dockerfile`): Ubuntu 20.04 with SSH + Node.js. `DEBIAN_FRONTEND=noninteractive` required to avoid tzdata prompt.
- **Go builds**: Must use `CGO_ENABLED=0 GOOS=linux GOARCH=arm64` for M-series Macs (static binary avoids GLIBC mismatch between Jenkins and test_fixture).
- **Nexus repos**: `word-cloud-generator` (raw hosted) stores artifacts. `cd_class` (raw group) aggregates for consumers.
- **Ansible kill-by-port**: The deploy role uses `fuser -k 8888/tcp` (not `pkill -f 'node server.js'`) because pkill from a remote SSH shell can match its own command line and kill the wrapper instead of the target process.
- **Smoke test verifies version**: The Smoke Test stage checks `/api/version` matches `1.${BUILD_NUMBER}`, not just `/api/health`. A liveness check would pass for the OLD process if a deploy silently failed to replace it.
- **No volume mount for app source**: Don't add back `./word-cloud-app:/var/word-cloud-app:ro` in docker-compose -- the pipeline now uses real `git clone` from GitHub. Local edits go through commit + push.
