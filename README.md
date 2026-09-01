# n8n-nodes-dokifly

Dokifly converts HTML, public URLs, and saved Handlebars templates into pixel-perfect PDFs (Playwright + Chromium). This package is a community node so n8n workflows can generate PDFs, create templates, list hosted files, and run Growth-plan batch jobs through the Dokifly API.

## Install

**n8n Cloud / verified community nodes:** after this package is verified, install **Dokifly** from the nodes panel. Until then, Cloud users cannot install it from the panel.

**Self-hosted:** install the npm package `n8n-nodes-dokifly` as a community node, restart n8n, then add **Dokifly** from the nodes panel.

See the [n8n community nodes docs](https://docs.n8n.io/integrations/community-nodes/) for instance-specific install steps.

## Credentials

1. Create an API key in the [Dokifly dashboard](https://dokifly.io/dashboard/keys). Keys are shown once and start with `dk_`.
2. In n8n, create a **Dokifly API** credential and paste the key.
3. Leave **Base URL** as `https://api.dokifly.io` unless you are pointing at a local API.

Full API reference: [https://dokifly.io/docs](https://dokifly.io/docs)

## Operations

| Resource | Operation | API |
| --- | --- | --- |
| PDF | Generate | `POST /v1/pdf/generate` |
| PDF | Get Usage | `GET /v1/pdf/usage` |
| Template | Create | `POST /v1/templates` |
| File | Get Many | `GET /v1/pdf/files` |
| File | Delete | `DELETE /v1/pdf/files/:fileId` |
| Batch | Create | `POST /v1/pdf/batch` |
| Batch | Get | `GET /v1/pdf/batch/:jobId` |
| Batch | Get Many | `GET /v1/pdf/batch` |

This node is an action node only. There is no Dokifly Trigger. `webhookUrl` is an optional per-request callback on Generate and Batch Create (Pro/Growth).

## Example workflows

**HTML to PDF binary to email attachment.** Set Resource to PDF and Operation to Generate. Source HTML, Output Binary Data. Pass the `data` binary property into an email node as an attachment.

**Template plus JSON from the previous node to a download URL.** Create or pick a template, set Generate Source to Template, map Data from the previous item, and set Output to Download URL. The item includes `url` and `expiresAt`.

**Create template, then generate.** Use Template → Create with name and HTML. Then Generate with Source Template, select the new template from the list, and send Handlebars Data. Saved template sample data is not applied at generate time; the caller must send Data.

**Batch create with wait.** On a Growth key, Resource Batch → Create. Provide an Items JSON array (max 50). Leave Wait for Completion on. The node polls until the job is `completed` or `partial`, then each item URL is available on the job JSON. Use Get a batch job later if you turn Wait off.

## Output modes and plans

| Output | Who | Notes |
| --- | --- | --- |
| Binary Data | All plans | Default for Generate. File is attached on the item. |
| Download URL | All plans | 7-day CDN link. |
| Permanent URL | Pro / Growth | Hosted file with `fileId`. The API returns `403 plan_required` on lower plans. |
| Batch | Growth | The API returns `403 plan_required` otherwise. |
| Webhook URL | Pro / Growth | Optional HTTPS callback on Generate and Batch. |

The node does not block operations in the UI. Plan limits come from the API (`message` plus [pricing](https://dokifly.io/pricing)).

Prefer **Binary Data** in n8n so the next node can attach the file directly. Use a **Download URL** when the PDF may exceed about 6 MB (API Gateway cap on binary responses).

## Publish (maintainers)

Verified n8n nodes must be published from GitHub Actions with npm provenance (required from 1 May 2026). This repo includes `.github/workflows/publish.yml`.

One-time npm setup: npm Trusted Publisher → GitHub Actions → owner `chamathapium`, repo `n8n-nodes-dokifly`, workflow filename `publish.yml`. Then run `npm run release` locally to bump, tag, and push. Do not `npm publish` from a laptop.

## Testing

Use `npm run dev` and open `http://localhost:5678`.

1. Credential test succeeds against `GET /v1/pdf/usage` with a real `dk_` key.
2. PDF Generate from HTML, output Binary — next node sees a binary PDF.
3. PDF Generate from HTML, output Download URL — JSON with `url` and `expiresAt`.
4. PDF Generate Source Template: the Resource Locator lists saved templates.
5. Template Create with name and HTML.
6. File Get Many (may be empty; that is success).
7. Batch Create with Wait on a Growth key, or confirm `403 plan_required` on Free with a readable message.
8. Invalid API key → credential/auth message, not a stack trace.

## Links

- [Dokifly](https://dokifly.io)
- [Dokifly docs](https://dokifly.io/docs)
- [GitHub repository](https://github.com/chamathapium/n8n-nodes-dokifly)

## License

MIT
