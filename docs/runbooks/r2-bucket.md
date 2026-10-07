# Cloudflare R2

## Buckets

| Logical | Env var | Visibility | Lifecycle |
| --- | --- | --- | --- |
| `originals` | `R2_BUCKET_ORIGINALS` | Private | Pre-sanitization keep: 7 days. After sanitization: indefinite. |
| `derivatives` | `R2_BUCKET_DERIVATIVES` | Public via CDN origin `R2_PUBLIC_DERIVATIVES_URL` | Keep until linked asset is deleted. |
| `documents` | `R2_BUCKET_DOCUMENTS` | Private, served via signed-URL only | Indefinite. |

The documents bucket MUST NOT share a public hostname with derivatives.
Treat its contents as PII — receipts, consent forms, signed contracts.

## Lifecycle rules

- Originals: `prefix: photo/`, `transition: 7d sanitized/`, `expiration: 30d`
  for the raw original. The sanitized sibling is kept.
- Derivatives: no expiration; cleanup is driven by `media.cleanup` worker on
  asset delete.
- Documents: no expiration. Legal hold applies to receipts for 7 years.

## Signed URL failures

- 403 from presigned GET: check `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
  `R2_REGION` (must be `auto`), and that `R2_ENDPOINT` matches the account's
  S3 API endpoint. Rebuild the URL with the server's clock; our signer uses
  system time.
- 403 on a derivative CDN URL: check the public hostname is bound to the
  derivatives bucket in Cloudflare, not accidentally pointed at originals.

## Multipart uploads

- The uploader opens multipart via `POST ?uploads`, uploads parts via signed
  URLs, completes via `POST ?uploadId=...`.
- Orphaned multipart uploads are swept by `media.sweep_orphans` after 24h.
- To inspect orphans manually: `aws s3api list-multipart-uploads --bucket <b>`
  with the R2 credentials.

## Malware scanner

- The scanner is a sidecar reachable at `MALWARE_SCANNER_URL`.
- Health check: `GET $MALWARE_SCANNER_URL/healthz`.
- If the scanner is down, every uploaded asset flips to `pending_scan` and
  stays there. Fix the scanner first; the worker will retry.
- EICAR fixture should always flag `signature: "EICAR-Test-Signature"` in
  staging.
