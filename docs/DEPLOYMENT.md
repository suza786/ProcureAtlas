# Deployment Guide — ProcureAtlas AI

**Status:** Phase 1 — dev sandbox only. Phase 2 introduces staging (Docker Compose) and Phase 3 introduces production (Kubernetes).
**Last updated:** 2026-09-30

This document covers local development, staging, production deployment, environment variables, backup strategy, runbooks, and health checks.

---

## 1. Environments

| Env | Purpose | Stack | Tenants |
|---|---|---|---|
| Dev | Local development; sandbox | Bun + SQLite + Next.js dev server | Single demo tenant |
| Staging | Pre-prod; integration tests; UAT | Docker Compose (Next.js + PostgreSQL + Redis + MinIO) | Multi-tenant; synthetic data |
| Production | Customer-facing | Kubernetes (EKS/GKE); PostgreSQL managed; Redis managed; S3 | Multi-tenant; real customer data |

---

## 2. Dev Environment

### 2.1 Prerequisites

- Bun 1.3+
- Node 22+ (Next.js 16 requirement)
- SQLite (bundled with Bun)

### 2.2 Setup

```bash
bun install
cp .env.example .env
bun run db:push           # create SQLite schema
bun run scripts/seed.ts   # seed demo data (idempotent)
```

### 2.3 Run

```bash
# Dev server is auto-started by the sandbox; do not run `bun run dev` manually.
bun run lint              # ESLint
```

Open the Preview Panel to view the application. The only externally visible route is `/`.

### 2.4 Dev DB

- SQLite at `file:./dev.db` (configured via `DATABASE_URL` in `.env`).
- Reset: `rm dev.db && bun run db:push && bun run scripts/seed.ts`.

---

## 3. Staging Environment (Phase 2)

### 3.1 Docker Compose stack

`docker-compose.staging.yml`:

```yaml
version: "3.9"
services:
  app:
    build: .
    ports: ["3000:3000"]
    env_file: .env.staging
    depends_on: [postgres, redis, minio]
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: procureatlas
      POSTGRES_USER: atlas
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes: ["pgdata:/var/lib/postgresql/data"]
  redis:
    image: redis:7-alpine
    volumes: ["redisdata:/data"]
  minio:
    image: minio/minio:latest
    command: server /data
    env_file: .env.staging
    volumes: ["miniodata:/data"]
    ports: ["9000:9000"]
volumes: { pgdata: {}, redisdata: {}, miniodata: {} }
```

### 3.2 Bring up staging

```bash
cp .env.example .env.staging  # fill in real values
docker compose -f docker-compose.staging.yml up -d
docker compose -f docker-compose.staging.yml exec app bun run db:migrate
docker compose -f docker-compose.staging.yml exec app bun run scripts/seed.ts --env=staging
```

### 3.3 Tear down

```bash
docker compose -f docker-compose.staging.yml down -v  # -v removes volumes
```

---

## 4. Production Environment (Phase 3)

### 4.1 Target topology

- **Cluster:** Kubernetes (EKS or GKE), multi-AZ.
- **Workloads:**
  - `web` (Next.js) — 3+ replicas, HPA on CPU + request rate.
  - `worker` (async jobs) — 2+ replicas, HPA on queue depth.
  - `connector` (scheduled source pulls) — CronJob per source.
- **Managed services:** PostgreSQL (RDS / Cloud SQL), Redis (ElastiCache / Memorystore), S3 / GCS for object storage.
- **CDN / WAF:** Cloudflare or CloudFront in front of the app.
- **Observability:** OpenTelemetry collector → Grafana Tempo / Loki / Mimir; Sentry for errors.

### 4.2 Helm chart sketch

`helm/procureatlas/Chart.yaml`:

```yaml
apiVersion: v2
name: procureatlas
version: 0.1.0
appVersion: "1.0.0"
dependencies:
  - name: postgresql
    version: 15.x.x
    repository: https://charts.bitnami.com/bitnami
    condition: postgresql.enabled
  - name: redis
    version: 18.x.x
    repository: https://charts.bitnami.com/bitnami
    condition: redis.enabled
```

`helm/procureatlas/values.yaml` (sketch):

```yaml
web:
  replicaCount: 3
  resources:
    requests: { cpu: 250m, memory: 512Mi }
    limits: { cpu: 1000m, memory: 1Gi }
  hpa:
    minReplicas: 3
    maxReplicas: 20
    cpuUtilization: 70
worker:
  replicaCount: 2
  resources:
    requests: { cpu: 500m, memory: 1Gi }
    limits: { cpu: 2000m, memory: 2Gi }
postgresql:
  enabled: false  # use managed RDS
  external:
    host: db.example.com
    port: 5432
redis:
  enabled: false  # use managed ElastiCache
  external:
    host: cache.example.com
    port: 6379
s3:
  bucket: procureatlas-prod-docs
  region: us-east-1
ingress:
  enabled: true
  className: nginx
  host: app.procureatlas.ai
  tls: true
```

### 4.3 Deploy

```bash
helm upgrade --install procureatlas ./helm/procureatlas \
  -f helm/procureatlas/values.prod.yaml \
  --namespace procureatlas --create-namespace
```

---

## 5. Environment Variables

### 5.1 `.env.example` template

```bash
# Database
DATABASE_URL="file:./dev.db"                  # SQLite dev
# DATABASE_URL="postgresql://atlas:pass@localhost:5432/procureatlas"  # Postgres

# Auth (Phase 2)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET=""                            # generate: openssl rand -base64 32
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
ENTRA_CLIENT_ID=""
ENTRA_CLIENT_SECRET=""

# Object storage (Phase 2)
S3_ENDPOINT=""
S3_REGION="us-east-1"
S3_BUCKET="procureatlas-docs"
S3_ACCESS_KEY_ID=""
S3_SECRET_ACCESS_KEY=""

# Redis (Phase 2)
REDIS_URL="redis://localhost:6379"

# LLM (Phase 2)
ZAI_API_KEY=""                                # z-ai-web-dev-sdk
LLM_TOKEN_BUDGET_DAILY_PER_TENANT="1000000"

# Observability
SENTRY_DSN=""
OTEL_EXPORTER_OTLP_ENDPOINT=""

# Feature flags
NEXT_PUBLIC_DEMO_MODE="true"
NEXT_PUBLIC_ENABLE_FILE_UPLOAD="false"
NEXT_PUBLIC_ENABLE_LLM="false"
NEXT_PUBLIC_ENABLE_AUTH="false"
```

### 5.2 Production secret management

- Secrets never in env files committed to git.
- AWS Secrets Manager / GCP Secret Manager / HashiCorp Vault.
- Kubernetes: External Secrets Operator syncs secrets from Secrets Manager → K8s Secrets.
- Secret rotation: quarterly (see runbook §7.1).

---

## 6. Backup Strategy

| Component | Strategy | Retention | RPO |
|---|---|---|---|
| PostgreSQL | Daily snapshot + continuous WAL archiving | 35 days | ≤ 15 min |
| Object storage (S3) | Versioning + cross-region replication | Indefinite (versioned) | Near-zero |
| Redis | Not backed up (cache only, rebuildable) | n/a | n/a |
| Configuration (Helm values) | Git (no secrets) | Indefinite | n/a |
| Audit log | Daily snapshot + off-site replication | 7 years | ≤ 24 h |

Backups are encrypted with a separate KMS key. Quarterly restore test (see runbook §7.2).

---

## 7. Runbooks

### 7.1 Rotate a secret

1. Identify the secret to rotate (e.g., `NEXTAUTH_SECRET`, database password, S3 access key, LLM API key).
2. Generate the new secret value: `openssl rand -base64 32`.
3. Update the secret in AWS Secrets Manager / GCP Secret Manager / Vault.
4. Trigger External Secrets Operator sync (automatic, ~1 min) or restart affected pods: `kubectl rollout restart deployment/web deployment/worker -n procureatlas`.
5. Verify pod health: `kubectl get pods -n procureatlas`.
6. Verify application health: hit `/api/health` and `/api/ready`.
7. Invalidate old sessions if rotating `NEXTAUTH_SECRET` (forces re-login for all users — coordinate with customers).
8. Log the rotation in the ops audit log.

### 7.2 Restore database from backup

1. Identify the recovery point (timestamp).
2. In AWS RDS: "Restore to point in time" → new instance.
3. Wait for restore (~30 min for 10 GB).
4. Validate restored instance: connect, run `SELECT count(*) FROM "Tender"`, spot-check a few records.
5. Switch application `DATABASE_URL` to the restored instance (via secret update + pod restart).
6. Verify application health.
7. Retire the old instance after 24 hours of stable operation.
8. Document the restore in the incident log if it was incident-driven.

### 7.3 Scale worker pool

1. Monitor queue depth (Grafana dashboard; alert if > 1000 for 5 min).
2. Increase worker HPA max: `kubectl patch hpa worker -n procureatlas -p '{"spec":{"maxReplicas":20}}'`.
3. Or manually scale: `kubectl scale deployment/worker -n procureatlas --replicas=10`.
4. Verify queue depth drops.
5. Revert after load subsides.

### 7.4 Roll back a deployment

1. Identify the failing deployment: `kubectl rollout status deployment/web -n procureatlas`.
2. Roll back: `kubectl rollout undo deployment/web -n procureatlas`.
3. Verify rollback: `kubectl get pods -n procureatlas`; hit `/api/health`.
4. If database migration is involved, the rollback may require a database restore — coordinate with on-call DBA.
5. Document the rollback in the incident log.

### 7.5 Page on-call (SEV1)

1. SEV1 = data breach, full outage, or data corruption.
2. Page via PagerDuty (or equivalent).
3. Open incident channel in Slack.
4. Assign Incident Commander; communicate status every 30 min.
5. Customer notification within 24 hours (per `SECURITY.md` §20).
6. Postmortem within 7 days; publish to tenants.

---

## 8. Health Checks

### 8.1 Liveness

`GET /api/health/live` → `200 OK` `{ "status": "alive" }`. No DB check. Used by kubelet liveness probe.

### 8.2 Readiness

`GET /api/health/ready` → `200 OK` `{ "status": "ready", "checks": { "db": "ok", "redis": "ok", "storage": "ok" } }`. Returns 503 if any check fails. Used by kubelet readiness probe.

### 8.3 Health (deep)

`GET /api/health` → full status: app version, build SHA, DB latency, Redis latency, S3 reachability, queue depth, LLM provider reachability. Used by ops dashboard.

### 8.4 Probe configuration

```yaml
livenessProbe:
  httpGet: { path: /api/health/live, port: 3000 }
  initialDelaySeconds: 30
  periodSeconds: 10
readinessProbe:
  httpGet: { path: /api/health/ready, port: 3000 }
  initialDelaySeconds: 10
  periodSeconds: 5
```

---

## 9. CI/CD Pipeline (Phase 2+)

```
PR opened
  → lint, typecheck, unit tests, integration tests, SAST, dependency scan
  → build Docker image (tagged by SHA)
  → push to registry
PR merged to main
  → deploy to staging
  → run E2E + DAST + accessibility tests against staging
  → if green: tag release, deploy to production (canary)
  → canary 10% → 50% → 100% over 1 hour with auto-rollback on error rate spike
```

---

## 10. Phase 1 Deviations

- Dev only — no staging or production deployment in Phase 1.
- No CI/CD pipeline — local lint + manual verification only.
- No Docker images built — Bun + SQLite dev server only.
- No Kubernetes manifests or Helm chart — sketches in this document are design artifacts.
- Health checks: `/api/health` skeleton route exists; full liveness/readiness split is Phase 2.
- No backup automation — SQLite file copied manually if needed.
