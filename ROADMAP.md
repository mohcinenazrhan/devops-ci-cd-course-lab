# Roadmap - Future Steps

What we've done and what's next on the CD/CI learning journey.

---

## Done

- [x] Docker Compose stack: Jenkins + Nexus + test_fixture
- [x] Jenkins setup: ARM64 fixes, plugin upgrades, SSH/git fixes
- [x] Nexus repos: `word-cloud-generator` (hosted) + `cd_class` (group)
- [x] Go pipeline: build → upload → deploy → app live on :8888
- [x] Node.js app: React + Express + ESLint + Vitest (11 tests)
- [x] Node.js pipeline (Freestyle): build → package → upload → deploy
- [x] Pipeline as Code: `Jenkinsfile` with 7 visible stages
- [x] Git repository on `main` with course history

---

## Phase 1: Pipeline Improvements

### 1.1 Auto-trigger deploy from build
Currently you manually trigger build → deploy. Make the build job auto-trigger deploy on success.

**Steps:**
- Add `build job: 'word-cloud-app-deploy'` to the Jenkinsfile post-success block
- Pass `deploy_version: "1.${BUILD_NUMBER}"` as parameter
- See real "continuous delivery" -- one click goes from code to deployed

### 1.2 Add a "Smoke Test" stage
After deploy, hit the running app to verify it works.

**Steps:**
- Add stage that calls `curl http://test_fixture:8888/api/health`
- Fail the pipeline if response isn't `{"status":"ok"}`
- This catches deploys that succeed in Ansible but fail at runtime

### 1.3 Parallel stages
Run lint and tests in parallel (they don't depend on each other).

**Steps:**
- Use `parallel { ... }` block in Jenkinsfile
- Cuts pipeline time, demonstrates DAG capability

---

## Phase 2: Quality Gates

### 2.1 Code coverage
Add coverage reporting and fail builds below threshold.

**Steps:**
- Vitest: `npx vitest run --coverage`
- Add coverage stage; fail if < 70%
- Publish HTML report as Jenkins artifact

### 2.2 UI / E2E testing
The course includes Robot Framework setup (`robot-tests/`).

**Steps:**
- Activate venv: `cd robot-tests && source venv/bin/activate`
- Update tests to target new Node.js app
- Add `Robot Tests` stage to pipeline (after deploy + smoke test)

### 2.3 Security scanning
Catch known vulnerabilities in dependencies.

**Steps:**
- Add stage running `npm audit --production` (fail on high+)
- Optionally: Trivy or Snyk container scanning
- Course chapter on `gauntlt` for security-as-code

---

## Phase 3: Real CD/CI Patterns

### 3.1 Blue/green deployment
Deploy without downtime. Currently deploy kills the running app, then starts new one.

**Steps:**
- Run two instances on different ports (8888, 8889)
- Use a reverse proxy (nginx) to route traffic
- Switch routing only after health check passes
- Old instance stays as rollback target

### 3.2 Rollback support
Make rollback a one-click operation.

**Steps:**
- Keep last 3 versions on test_fixture
- Add Jenkins job: "rollback" that re-runs deploy with previous version
- Useful pattern: deploy by tag, not by build number

### 3.3 Multi-environment promotion
Add a "staging" target before "production".

**Steps:**
- Add a second test_fixture (test_fixture_prod)
- Pipeline: build → deploy to staging → smoke test → manual approval → deploy to prod
- Use Jenkins `input` step for the manual gate

---

## Phase 4: Real Source Control

### 4.1 Push the app to GitHub
Currently the app is mounted from local. Make it pull from a real remote.

**Steps:**
- Create GitHub repo `word-cloud-app`
- Push from `Course Environments/word-cloud-app/`
- Update Jenkinsfile to use Git SCM checkout
- Remove the volume mount from docker-compose

### 4.2 Webhook-triggered builds
Build triggers automatically on git push.

**Steps:**
- Configure GitHub webhook → Jenkins (need ngrok or public IP)
- Or: Switch to polling SCM (already configured in word-cloud-generator-build)
- See builds happen "for free" when you commit

### 4.3 Pull request validation
Run lint + tests on PR before allowing merge.

**Steps:**
- GitHub Actions or Jenkins multibranch pipeline
- Branch protection rules: require passing checks
- This is the first thing teams set up in the real world

---

## Phase 5: Observability

### 5.1 Centralized logging
Right now logs only exist in Jenkins / on the deploy box.

**Steps:**
- Add a log shipper (Vector, Promtail) to test_fixture
- Send to Loki or ELK stack
- See app logs alongside deployment events

### 5.2 Metrics & dashboards
Track build times, success rates, MTTR.

**Steps:**
- Jenkins metrics plugin → Prometheus
- Grafana dashboards: build duration trends, deploy frequency
- The four DORA metrics tracking begins here

### 5.3 Notifications
Get told when things break.

**Steps:**
- Add Slack/Discord/email step on pipeline failure
- Page only on prod deploy failures
- Alert on coverage regression

---

## Phase 6: Advanced

### 6.1 Containerized deployment
Instead of `node server.js` on a VM-like target, deploy as a container.

**Steps:**
- Add `Dockerfile` to word-cloud-app
- Pipeline pushes image to Nexus (or Docker Hub / GitHub Container Registry)
- Deploy = `docker pull && docker run` on test_fixture
- Massive simplification of the Ansible role

### 6.2 Kubernetes deployment
The natural endpoint of the container path.

**Steps:**
- Run a local Kubernetes (Rancher Desktop has it built in)
- Deploy with `kubectl apply` or Helm chart
- Pipeline applies manifests from a `k8s/` directory
- Now you're doing GitOps if manifests are in git

### 6.3 Shared pipeline libraries
DRY up Jenkinsfiles across multiple repos.

**Steps:**
- Create a Groovy shared library in a separate repo
- Replace boilerplate stages with library calls
- This is how big orgs run hundreds of pipelines without copy-paste

---

## Recommended Order

If starting fresh tomorrow, the highest-value path is:

1. **1.1 Auto-trigger deploy** (5 min, huge "wow" moment)
2. **1.2 Smoke test stage** (10 min, feels professional)
3. **6.1 Containerize app** (1 hour, simplifies everything)
4. **4.1 Push to GitHub** + **4.2 Webhooks** (real-world setup)
5. **2.2 Robot Framework tests** (uses what's already in the course)
6. **3.3 Multi-env promotion with manual approval** (the CD prize)

Skip Phases 5 and 6.2-6.3 unless you specifically want to learn observability or Kubernetes.
