# Self-hosted Supabase in Jakarta

Production runs the official Supabase Docker Compose stack on a VM in the Jakarta region
(PLAN.md D-01, D-02). This folder holds only our overrides; the upstream compose file is
pinned by version in the deployment repo.

## Required settings (verified in the upstream compose file, 2026-09-25)

| Purpose | Setting |
| --- | --- |
| Access token hook (tenant_id, app_role claims) | `GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_ENABLED=true`, `GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_URI=pg-functions://postgres/public/custom_access_token_hook` |
| TOTP MFA | `GOTRUE_MFA_TOTP_ENROLL_ENABLED=true`, `GOTRUE_MFA_TOTP_VERIFY_ENABLED=true` |
| ES256 signing keys + JWKS | run `sh utils/add-new-auth-keys.sh --update-env` (writes `JWT_KEYS`, `JWT_JWKS`); uncomment `GOTRUE_JWT_KEYS` |
| No self sign-up | `DISABLE_SIGNUP=true` |
| Storage in-region S3 | `STORAGE_BACKEND=s3`, `GLOBAL_S3_BUCKET`, `REGION=ap-southeast-3` (AWS: omit endpoint/path-style) |

## Hardening checklist
- TLS terminates at our in-region reverse proxy; the default gateway is plain HTTP.
- Never expose the gateway admin port 9901.
- Studio reachable only over VPN/bastion.
- The `sb_secret` key lives only on the bastion (break-glass, logged). No app container gets it.
- Backups: PITR is not provided self-hosted. WAL archiving to in-region object storage plus a
  monthly restore drill is a Phase 0 exit criterion (tooling to be confirmed, PLAN.md §3.2).
