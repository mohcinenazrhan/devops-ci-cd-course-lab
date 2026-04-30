# DevOps Foundations: CD/CI - Course Notes

## Environment Setup

### Services

| Service | URL | Credentials |
|---------|-----|-------------|
| Jenkins | http://localhost:8080 | `admin` / `theagileadmin` |
| Nexus | http://localhost:8081 | `admin` / `theagileadmin` |
| Test Fixture (SSH) | `ssh -p 2222 root@localhost` | password: `theagileadmin` |

### Changes Made to Original Course Files

- **cd_jenkins/Dockerfile**: Updated from `jenkins/jenkins:lts-jdk11` (deprecated) to `jenkins/jenkins:lts-jdk17`
- **docker-compose.yml**: Removed deprecated `version` key, replaced `links` with `depends_on`, remapped SSH port from `22` to `2222` (avoids macOS conflict)
- **nexus-data**: Reset to fresh (old data was incompatible with latest Nexus image, backup in `nexus-data.bak`)

### Commands

```bash
# Start everything
docker-compose up --build -d

# Check status
docker-compose ps

# View logs
docker-compose logs jenkins
docker-compose logs nexus

# Stop everything
docker-compose down

# Full cleanup (images, volumes, everything)
docker-compose down -v --rmi all
```

---

## Nexus Repository Manager

### Initial Setup

- Choose "Disable anonymous access" -- forces proper credential management, closer to real-world practice
- Update admin password to `theagileadmin` via: user icon (top-right) > Change password

### Repositories

Two repositories are needed for the course pipeline:

**1. `word-cloud-generator` (raw hosted)**
- Type: raw (hosted)
- Purpose: Where Jenkins uploads the compiled Go binary after a successful build
- Deployment policy: Allow redeploy
- "Raw" = plain binary (not Maven JAR or npm package)
- "Hosted" = stored locally (not proxied from a remote source)

**2. `cd_class` (raw group)**
- Type: raw (group)
- Members: `word-cloud-generator`
- Purpose: Single pull URL that aggregates multiple hosted repos

### Why Two Repos Instead of One?

For this course, one repo would technically work. The group repo teaches a pattern used at scale:

- **Push side (Jenkins)** writes to a specific hosted repo
- **Pull side (Deploy/Ansible)** reads from the group URL without knowing where artifacts are stored
- Like DNS -- consumers hit one URL, Nexus routes to the right repo internally
- If you add more apps later, deploy scripts don't change -- just add new hosted repos to the group

```
cd_class (group - single pull URL)
├── word-cloud-generator (hosted)
├── api-gateway (hosted)        # future apps
└── auth-service (hosted)       # just add to group
```

---

## CD/CI Pipeline Flow

```
Code (GitHub) → Jenkins (build + test) → Artifact (Nexus) → Deploy (Ansible → test_fixture)
```

---

## Jenkins Plugin Issues (Resolved)

The pre-configured `jenkins_home` shipped with very old plugins incompatible with current Jenkins LTS.
All plugins were bulk-updated using `jenkins-plugin-cli` inside the container:

```bash
docker exec courseenvironments-jenkins-1 jenkins-plugin-cli --latest true --plugins \
  credentials ssh-credentials plain-credentials credentials-binding \
  mina-sshd-api-core sshd cloudbees-folder git git-client git-server \
  github github-branch-source workflow-cps-global-lib pipeline-input-step \
  pipeline-graph-analysis pipeline-rest-api pipeline-stage-view \
  pipeline-model-extensions pipeline-model-definition workflow-job \
  workflow-step-api workflow-multibranch workflow-cps pipeline-build-step \
  pipeline-groovy-lib ssh-agent ssh-slaves nexus-artifact-uploader \
  ansible matrix-auth ldap email-ext script-security trilead-api
```

Then restart Jenkins: `docker-compose restart jenkins`

**Root cause:** The Credentials Plugin v2.5 had cyclic dependencies with SSH/SSHD plugins, which cascaded into 15+ plugins failing to load (Git, Pipeline, Ansible, Nexus uploader, etc.).

**Fix that worked:** Remove ALL old plugins from `jenkins_home/plugins/`, then fresh install with `jenkins-plugin-cli`. Also removed deprecated `workflow-cps-global-lib` from the Docker image via Dockerfile.

**Note:** The Jenkins Go Plugin no longer exists in the registry. Go is installed directly in the container via `apt-get install -y golang-go` (added to Dockerfile).

---

## Build Issues (Resolved)

### 1. Git "not in a git directory"
Stale workspace from previous runs. Fix: delete workspace directory.

### 2. Git "dubious ownership"
Jenkins runs as user `jenkins` but workspace files owned by different UID (from host mount).
Fix: `docker exec courseenvironments-jenkins-1 git config --global --add safe.directory '*'`

### 3. Go not found
Original course used the Jenkins Go Plugin (now removed from registry).
Fix: Install Go directly in container via Dockerfile: `apt-get install -y golang-go`

### 4. sed "preserving permissions" warning
Harmless warning -- `sed -i` can't preserve permissions due to UID mismatch on mounted volumes. Build still succeeds.

### 5. SSH config "Bad owner or permissions" (Deploy job)
macOS Docker volume mounts preserve host UID. SSH refuses config files not owned by the running user.
Jenkins runs as UID 1000, but files on the mount are owned by macOS UID.
Fix: Custom entrypoint.sh removes the bad config and sets `ANSIBLE_SSH_ARGS` with inline SSH options.

### 6. Binary architecture mismatch (x86-64 on ARM)
The app's Makefile hardcodes `GOARCH=amd64`. M3 Pro runs ARM64 containers.
Fix: Modified Jenkins build job to use `CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build`.
`CGO_ENABLED=0` is needed for a static binary (avoids GLIBC version mismatch between
Jenkins container Debian Trixie and test_fixture Ubuntu 20.04).

---

## Full CD Pipeline Flow (Verified Working End-to-End)

```
1. Git Clone     → fetch code from github.com/wickett/word-cloud-generator
2. Lint          → go vet + go fmt
3. Unit Test     → 3 tests pass (TestSimpleSentence, TestLongPunc, TestParseText)
4. Build         → compile static ARM64 Linux binary (CGO_ENABLED=0)
5. Package       → gzip the Linux binary
6. Upload        → push to Nexus (word-cloud-generator repo, version 1.x)
7. Deploy        → Ansible SSHs into test_fixture, downloads from Nexus, runs app
8. App Live      → http://localhost:8888 serves the WordCloud web app
```

Artifact path: `http://nexus:8081/repository/word-cloud-generator/cd_class/word-cloud-generator/<version>/`

---

## Key Concepts

### Nexus Repository Types vs Components/Assets

**Repository types** are organizational/routing concepts in Nexus:

| Nexus Term | In Our Setup | What It Is |
|------------|-------------|------------|
| Hosted Repository | `word-cloud-generator` | Storage location -- where artifacts physically live |
| Group Repository | `cd_class` | Virtual aggregator -- single URL that combines multiple hosted repos |

**Components and Assets** are what's stored inside repositories:

| Term | Example | Meaning |
|------|---------|---------|
| Component | `word-cloud-generator` v1.8 | A versioned piece of software |
| Asset | `word-cloud-generator-1.8.gz` | The actual file(s) that make up that component |

**How they all relate:**

```
cd_class (group)            = warehouse entrance / loading dock (routing layer)
├── word-cloud-generator    = a shelf in the warehouse (hosted repo)
│   └── v1.8               = a labeled box (component)
│       └── .gz file        = the actual item inside (asset)
├── (future-app-1)          = another shelf
└── (future-app-2)          = another shelf
```

The group is not a component or asset -- it's just a routing layer so consumers only need one URL to access everything.

---

## Node.js Pipeline (React + Express)

Replaced the Go app with a custom Node.js stack to learn CI/CD with familiar tools.

### App Structure (`word-cloud-app/`)

```
word-cloud-app/
├── server.js           Express API (POST /api/wordcloud, GET /api/health)
├── server.test.js      Backend tests (6 tests - parseText logic)
├── src/
│   ├── App.jsx         React app - text input + word cloud display
│   ├── App.test.jsx    Frontend tests (5 tests - render, API calls, errors)
│   ├── WordCloud.jsx   Word cloud visualization component
│   ├── styles.css      Styling
│   ├── main.jsx        React entry point
│   └── test-setup.js   Vitest setup for jsdom
├── Jenkinsfile         Pipeline as Code (7 stages)
├── vite.config.js      Vite + Vitest config
├── eslint.config.js    ESLint flat config
├── index.html          Vite entry HTML
└── package.json        Dependencies and scripts
```

### Pipeline Stages (Jenkinsfile)

The job `word-cloud-app-build` is a **Pipeline** job (not Freestyle), so Jenkins shows each
stage visually at http://localhost:8080/job/word-cloud-app-build/

```
Checkout → Install → Lint → Test → Build → Package → Upload to Nexus
```

Each stage is independent -- if Lint fails, Test/Build/Package never run. You can click
any stage in the Stage View to see its specific logs.

### Freestyle vs Pipeline Jobs

| | Freestyle Job | Pipeline Job |
|---|---|---|
| Config | Click-through Jenkins UI | Code in Jenkinsfile |
| Stages | One big shell script | Separate visible stages |
| Version control | Config lives in Jenkins only | Jenkinsfile lives in git with app code |
| Visualization | Just pass/fail | Stage View with per-stage status + timing |
| Reusability | Copy/paste between jobs | Shared libraries, parameters |

**Pipeline as Code** is the modern approach -- pipeline definition is version-controlled,
code-reviewed, and travels with the application.

### Differences from Go Pipeline

| Step | Go Pipeline | Node.js Pipeline |
|------|-------------|------------------|
| Lint | `go vet` + `go fmt` | `eslint` |
| Test | `go test` | `vitest` (11 tests: 6 backend + 5 frontend) |
| Build | `go build` → single binary | `vite build` → dist/ directory |
| Artifact | `.gz` (gzipped binary, ~5 MB) | `.tar.gz` (dist + server + node_modules, ~914 KB) |
| Runtime | `daemonize ./binary` | `node server.js` |
| Deploy needs | Nothing (static binary) | Node.js installed on target |

### Infrastructure Changes for Node.js

- **Jenkins Dockerfile**: Added `nodejs npm` to apt packages
- **test_fixture Dockerfile**: Added `nodejs npm` + `DEBIAN_FRONTEND=noninteractive` (fixes tzdata prompt)
- **Ansible**: New playbook `node-app.yml` with role `word-cloud-app` (extracts tarball, runs with nohup node)

### Jenkins Jobs

| Job | Type | Purpose |
|-----|------|---------|
| `word-cloud-app-build` | Pipeline (from SCM) | Checkout → Install → Lint → Test → Build → Package → Upload → Deploy → Smoke Test |
| `word-cloud-app-deploy` | Freestyle | Ansible deploys from Nexus to test_fixture |
| `word-cloud-generator-build` | Freestyle | Original Go app build (still works) |
| `word-cloud-generator-deploy` | Freestyle | Original Go app deploy |

---

## Milestone: GitHub-Triggered CI/CD (Real Production Flow)

**Goal achieved:** `git push to main` → Jenkins polls → build → deploy → smoke test → app live, fully automatic.

### Architecture Change

| Before | After |
|--------|-------|
| Pipeline used inline Jenkinsfile in `config.xml` | Pipeline pulls Jenkinsfile from GitHub (`CpsScmFlowDefinition`) |
| Source code came from `./word-cloud-app:/var/word-cloud-app:ro` volume mount | Source code comes from `git clone https://github.com/mohcinenazrhan/devops-ci-cd-course-lab.git` |
| Manual click "Build" + "Deploy" + manually type version | Push to main → 1 min polling → build → auto-deploy → smoke test |
| 7 pipeline stages | 9 stages (added Deploy + Smoke Test) |

### Why SCM Polling Instead of Webhooks

- **Security**: Webhooks (GitHub → Jenkins) require exposing Jenkins to the internet (ngrok/tunnels)
- **Real-world parallel**: Most enterprise/financial Jenkins setups poll because they can't expose Jenkins externally
- **Trade-off**: Up to 1 min delay vs. instant push notification, but 1-min is realistic for many real pipelines

### Path Filter (Monorepo Pattern)

The repo contains both app code AND infrastructure (Jenkins configs, Ansible, docs). The build job uses
`PathRestriction` extension with `<includedRegions>word-cloud-app/.*</includedRegions>` so:
- Editing `word-cloud-app/**` triggers a build
- Editing `NOTES.md`, `docker-compose.yml`, infra configs does NOT trigger a build

This is the typical monorepo CI pattern: many apps in one repo, each with its own pipeline filter.

### Auto-Deploy Chain

In the Jenkinsfile, after `Upload to Nexus`:

```groovy
stage('Deploy') {
    steps {
        build job: 'word-cloud-app-deploy',
              parameters: [string(name: 'deploy_version', value: "1.${BUILD_NUMBER}")],
              wait: true
    }
}
```

- `wait: true` means the build job waits for deploy to finish, and inherits its success/failure
- If deploy fails, build is marked failed (correct cascade)
- The version param uses `BUILD_NUMBER` so each build gets its own version (1.1, 1.2, 1.3, ...)

### Lessons Learned (Real-World Bugs Found)

These are real bugs that surfaced during the first end-to-end test runs. Reproducing them is part of the learning:

#### 1. Tests block deploys (CI working as intended)
- Build #4 changed the title from `"Word Cloud Generator"` to `"Word Cloud Generator v2 - Auto-deployed"`
- The unit test asserted exact text: `screen.getByText("Word Cloud Generator")`
- Test failed → build failed → deploy did NOT run → app stayed on old version
- **Fix:** Use regex matcher `screen.getByText(/Word Cloud Generator/)` for forward-compatible tests
- **Lesson:** Tests catch real regressions. Exact-match assertions are brittle.

#### 2. False-positive smoke test
- Original smoke test checked only `curl /api/health | grep '"status":"ok"'`
- Build #5 deployed a new version, but the OLD process was still running on port 8888
- Old process happily returned `{"status":"ok"}` → smoke test passed → build marked success
- But the deployed code was NOT live (old PID still serving)
- **Fix:** Smoke test now checks `/api/version` matches the expected `1.${BUILD_NUMBER}`
- **Lesson:** "Health check" is meaningless if it doesn't verify the new version is actually serving. Always check identity, not just liveness.

#### 3. Ansible kill matched its own SSH command
- `pkill -f 'node server.js'` killed the SSH wrapper shell (which had that string in argv) instead of the actual node process
- Result: `pkill` exited with `rc=-15` (killed itself), then `nohup node ...` failed with `EADDRINUSE`
- **Fix:** Replaced with `fuser -k 8888/tcp` (kill by listening port) + wait for port to free
- **Lesson:** Process pattern matching from a remote shell is fragile. Killing by port is reliable.

### Build Number Hygiene

Failed builds (`1.4`, `1.5`) and false-positive builds remain in Nexus forever. Real-world:
- Don't trust version numbers without smoke test verification
- Consider tagging only "verified" builds in artifact storage
- Cleanup policies in Nexus help (we have `numToKeep>5</numToKeep>` on Jenkins side)

### Files Touched in This Milestone

- `word-cloud-app/Jenkinsfile` -- replaced volume copy with `checkout scm`, added Deploy + Smoke Test stages
- `jenkins_home/jobs/word-cloud-app-build/config.xml` -- switched to `CpsScmFlowDefinition` + SCM block + 1-min polling + path filter
- `jenkins_home/ansible/roles/word-cloud-app/tasks/main.yml` -- kill by port, install psmisc, wait for port free
- `docker-compose.yml` -- removed `word-cloud-app` volume mount

### Verification Pattern That Works

To test the pipeline end-to-end:
1. Edit something in `word-cloud-app/`
2. `git commit && git push origin main`
3. Within ~60s, watch http://localhost:8080/job/word-cloud-app-build/ -- new build appears
4. Watch all 9 stages go green
5. `curl http://localhost:8888/api/version` should show new build number

To test the path filter:
1. Edit `NOTES.md` only
2. `git push`
3. Wait 90s -- no build should trigger (`scm-polling.log` shows "No changes")

---

(to be continued as we progress through the course)
