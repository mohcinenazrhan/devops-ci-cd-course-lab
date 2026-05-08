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

### 3.1 Blue/Green Deployment
Deploy without downtime. Currently the deploy kills the running app, then starts the new one --
that's a brief gap where users hit nothing. Blue/Green eliminates that gap.

**Concept:** Two identical instances ("blue" and "green") run side by side. A router (nginx)
sends traffic to whichever is "active". Deploys go to the inactive one; routing flips only
after the new version passes health checks. The old version stays running as instant rollback.

**Steps:**
- Add nginx container in front of the app, listening on :8888
- App runs two instances: blue on :9001, green on :9002 (internal ports)
- nginx upstream points to one of them at a time, controlled by a small config file
- Ansible role:
  1. Detect which color is currently active (read nginx config or marker file)
  2. Deploy new version to the INACTIVE color
  3. Smoke test the inactive color directly (`curl :9001/api/version`)
  4. Switch nginx upstream to point at the newly deployed color
  5. nginx reload (zero downtime, in-flight requests finish on old)
  6. Old color stays running for X minutes as rollback target
- Rollback = swap nginx upstream back, no redeploy

**Real-world parallel:** This is how AWS ELB target group swaps, Kubernetes service selectors,
and `kubectl rollout` work under the hood.

### 3.2 Rollback support
Make rollback a one-click operation.

**Steps:**
- Keep last 3 versions on test_fixture
- Add Jenkins job: "rollback" that re-runs deploy with previous version
- Useful pattern: deploy by tag, not by build number
- Note: 3.1 (Blue/Green) provides a much faster rollback path than this -- use both together.

### 3.3 Multi-environment promotion
Add a "staging" target before "production".

**Steps:**
- Add a second test_fixture (test_fixture_prod)
- Pipeline: build → deploy to staging → smoke test → manual approval → deploy to prod
- Use Jenkins `input` step for the manual gate

### 3.4 Canary Deployment
A more nuanced version of blue/green: route a SMALL percentage of traffic (1%, then 10%,
then 50%) to the new version while monitoring error rates. Bad versions affect few users
before being rolled back automatically.

**Steps:**
- Build on the nginx setup from 3.1
- Use nginx `split_clients` or weighted upstreams to send % of traffic to new version
- Pipeline ramps the percentage automatically: 1% → wait → 10% → wait → 50% → wait → 100%
- Each ramp step checks error rate via `/api/health` or a metrics endpoint
- If error rate exceeds threshold at any step, auto-route 100% back to old version
- Demonstrate by intentionally introducing a buggy build and watching the canary catch it

**Real-world parallel:** This is how Spotify, Netflix, and Google all deploy. "Auto-rollback
on canary failure" is the gold standard for production CD.

### 3.5 Containerize the App (was Phase 6.1)
Replace `node server.js` on a VM with `docker pull && docker run` of an image we built and pushed.

**Steps:**
- Add `Dockerfile` to word-cloud-app
- Pipeline pushes image to Nexus Docker registry (or Docker Hub / GHCR)
- Deploy = `docker pull && docker run` on test_fixture
- Massive simplification of the Ansible role (no node install, no kill-by-port, no GLIBC issues)

**Why move it here:** Containerization pairs naturally with Blue/Green (just run two containers
on different ports) and with Canary (nginx routes between containers). Doing it before 3.1 makes
those phases simpler.

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

### 6.1 Containerized deployment (moved to Phase 3.5)
See Phase 3.5 above. Containerization pairs better with Blue/Green and Canary, so it's been
moved earlier in the sequence.

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

## Phase 7: Feature Flags (Decouple Deploy from Release)

The most underrated CD/CI skill. Blue/Green and Canary control **which version users get**.
Feature flags control **which features are active inside that version**. Together they
transform how teams ship: you can deploy code to production with new features OFF, then
turn them on (or off) instantly without redeploying.

**Why this matters more than people realize:**
- **Trunk-based development:** Merge unfinished features behind off-flags. No long-lived branches.
- **Decoupled release:** Deploy Tuesday, release feature Thursday. Marketing controls release timing, not engineering.
- **Kill switch:** A misbehaving feature can be disabled in seconds without a redeploy.
- **A/B testing:** Show feature to 50% of users, measure impact, decide.
- **Targeted rollout:** Beta users → internal employees → 1% prod → 100% prod.

### 7.1 Environment variable flags (simplest start)
Add a feature flag controlled by an env var.

**Steps:**
- Add a "v2 word cloud algorithm" code path in `server.js` behind `FEATURE_NEW_ALGO`
- Default: off. App reads `process.env.FEATURE_NEW_ALGO === 'true'` to decide which path to run
- Both code paths ship in every deploy; only the flag determines which runs
- Demonstrate: deploy with flag OFF, verify old behavior. Set env var to `true`, restart, verify new behavior.

**Real-world parallel:** This is the simplest form. Many teams start here before adopting a real flag service.

### 7.2 Config file flags (multi-flag management)
Move flags out of env vars into a JSON/YAML config file the app reads.

**Steps:**
- Create `flags.json` on test_fixture: `{ "newAlgo": false, "betaUI": false }`
- App reads it on startup (or watches for changes)
- Ansible role copies the file during deploy; flags can be edited per-environment without redeploying
- Add a Jenkins job: "toggle flag" that just rewrites flags.json and restarts the app

### 7.3 Real flag service (production-grade)
Adopt a feature flag service for runtime evaluation, percentage rollouts, and targeting.

**Options:**
- **Self-hosted:** GrowthBook, Unleash, FlagSmith (all open source, easy local Docker setup)
- **Hosted:** LaunchDarkly, Statsig, Split.io (free tiers exist)

**Steps:**
- Add the flag service container to docker-compose
- Replace `flags.json` lookup with SDK calls: `if (flagsService.isEnabled('newAlgo', user))`
- Demonstrate percentage rollout: turn on for 1% of users by user ID hash
- Demonstrate kill switch: flip a flag while traffic is hitting the app, watch it propagate

### 7.4 Feature flags + canary deployment together
This is the holy grail. Combine the patterns:
- Deploy v2 of code via canary (1% traffic)
- v2 includes new feature behind flag, default OFF
- Flag enabled for the same 1% of users
- Monitor → ramp BOTH up together → full rollout
- If anything breaks, you have TWO independent kill switches: route traffic away (canary) OR turn off the flag (feature)

### 7.5 Feature flag hygiene
The dirty secret of feature flags: cleanup. Old flags accumulate and become technical debt.

**Practices:**
- Tag every flag with creation date and owner
- Quarterly review: any flag at 100% rollout for >30 days should be removed (delete the off path)
- Pipeline check: flag tools that detect dead flags in code
- Document the "remove me by" date for each flag

---

## Recommended Order (Updated)

If starting fresh, the highest-value path is now:

1. **1.1 Auto-trigger deploy** + **1.2 Smoke test** ✅ DONE
2. **2.2 Robot Framework tests** -- close the testing loop with real browser tests
3. **3.5 Containerize the app** -- simplify deploys and prepare for next steps
4. **3.1 Blue/Green deployment** -- zero-downtime deploys (easy once containerized)
5. **7.1 Feature flags (env var)** -- decouple deploy from release
6. **3.4 Canary deployment** -- gradual rollout with auto-rollback
7. **7.4 Combined feature flags + canary** -- production-grade deploy strategy
8. **3.3 Multi-env promotion** -- staging → manual approval → prod (the "CD prize")

Skip Phases 5 (observability), 6.2 (k8s), 6.3 (shared libs) unless you specifically want
to deepen those areas. The path above gives you the full deploy lifecycle most teams use.
