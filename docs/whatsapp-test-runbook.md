# Synthetic WhatsApp Cloud API test

This adapter uses a Meta-provided test business number and fictional insurance data. Opening a public callback, enabling billing, or sending any external test message requires Nagy's explicit approval. Keep the Meta app in development and use the official mobile WhatsApp app for acceptance.

## 1. Prepare the Meta test number

1. In the Meta App Dashboard choose **Create App** and the **Connect with customers through WhatsApp** use case. Select a business portfolio for the test app. In **Customize use case → Connect on WhatsApp → Quickstart**, choose **Start using the API** to reach **API Setup**. Some dashboards show **WhatsApp → API Setup**.
2. In **API Setup**, select the Meta-provided **test number** in **From**. Record the displayed test phone number for the mobile chat, **Phone number ID** for `WHATSAPP_PHONE_NUMBER_ID`, and the associated test **WhatsApp Business Account ID** for `WHATSAPP_WABA_ID`. The listener enforces this configured pair. Confirm the test-number label in Meta because the IDs alone do not distinguish test assets. Leave payment settings untouched.
3. Under **To**, add Nagy's personal WhatsApp number as a test recipient. Complete the dashboard's recipient verification if prompted and approved. Put only that recipient's international digits, including country code with no plus sign or punctuation, in `WHATSAPP_ALLOWED_SENDERS`. A second pre-approved recipient is optional for isolation checks. The personal number belongs in the local configuration only.
4. Choose **Generate access token** in **API Setup** and copy the temporary test token to `WHATSAPP_ACCESS_TOKEN`. Use the Graph version shown in the dashboard's generated request for `WHATSAPP_GRAPH_VERSION`. In **App settings → Basic**, reveal the same app's **App secret** and set `WHATSAPP_APP_SECRET`. Keep these values local. The temporary token can expire during setup. Regenerate it in **API Setup** and restart the listener if needed.

[Meta Cloud API getting started](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started)

## 2. Start the loopback listener

First run the signed synthetic HTTP tests. Both model and Graph transports are stubbed and fixtures use fictional phone numbers, member IDs and credentials.

```powershell
npm test
if (!(Test-Path -LiteralPath '.env.whatsapp')) { Copy-Item .env.example .env.whatsapp }
node -e "const fs = require('node:fs'); const p = '.env.whatsapp'; const env = fs.readFileSync(p, 'utf8'); fs.writeFileSync(p, env.replace(/^WHATSAPP_VERIFY_TOKEN=(?=\r?$)/m, () => 'WHATSAPP_VERIFY_TOKEN=' + require('node:crypto').randomBytes(32).toString('hex')))"
```

The command fills a blank `WHATSAPP_VERIFY_TOKEN` in the ignored file without printing it. Use that same value later in Meta. Fill in the values from step 1 and set `ENABLE_WHATSAPP_TEST=true`. Run from the repository folder with Node.js 22.16 or newer. Existing shell environment variables take precedence over the file, so keep configuration in one place.

- For `WHATSAPP_INTENT_MODE=hub` (default), run the V0.5 Local AI Hub on `127.0.0.1:8000` with `LOCAL_AI_HUB_PROFILE=local-instruct`.
- For `WHATSAPP_INTENT_MODE=ollama-v05`, run Ollama on `127.0.0.1:11434` with the local model named by `OLLAMA_MODEL`. Use the same installed model as the verified demo. Coordinate the GPU window if the Hub is already using it.

```powershell
npm run dev:whatsapp
```

The default listener is `127.0.0.1:3010`. The Web Demo can run separately with its existing commands and provider modes. In another terminal, the following requests should return `404` and `403` respectively. These checks use a deliberately incorrect verify token.

```powershell
curl.exe -i http://127.0.0.1:3010/v1/chat
curl.exe -i 'http://127.0.0.1:3010/webhooks/whatsapp?hub.mode=subscribe&hub.challenge=123&hub.verify_token=wrong'
```

[Local V0.5 Hub and Ollama setup](../README.md#run-the-v05-conversational-experiment)

## 3. Restrict the HTTPS tunnel

After explicit approval, use a named Cloudflare Tunnel with an existing Cloudflare-managed domain and a dedicated test hostname. Use that hostname and the listener port consistently below. Keep the tunnel credentials and config in your local Cloudflare directory. Leave Web Demo, member-auth, Local AI Hub and Ollama ports outside the tunnel. Disable request, inspector and debug logging that would record webhook queries, headers or payloads.

```powershell
cloudflared tunnel login
cloudflared tunnel create tpa-whatsapp-test
```

Save this as `$env:USERPROFILE\.cloudflared\tpa-whatsapp-test.yml`, with the returned tunnel UUID, the absolute credentials JSON path and your test hostname.

```yaml
tunnel: <TUNNEL-UUID>
credentials-file: 'C:\Users\YOUR_USER\.cloudflared\<TUNNEL-UUID>.json'
ingress:
  - hostname: whatsapp-test.example.com
    path: ^/webhooks/whatsapp$
    service: http://127.0.0.1:3010
  - service: http_status:404
```

```powershell
$whatsappTunnelConfig = Join-Path $env:USERPROFILE '.cloudflared\tpa-whatsapp-test.yml'
cloudflared tunnel --config $whatsappTunnelConfig ingress validate
cloudflared tunnel --config $whatsappTunnelConfig ingress rule https://whatsapp-test.example.com/webhooks/whatsapp
cloudflared tunnel --config $whatsappTunnelConfig ingress rule https://whatsapp-test.example.com/v1/chat
cloudflared tunnel route dns tpa-whatsapp-test whatsapp-test.example.com
cloudflared tunnel --config $whatsappTunnelConfig run tpa-whatsapp-test
```

The first URL should match the webhook rule. The second should match the catch-all. The callback is authenticated by the application through Meta's signature and verification token. Meta must be able to reach it over HTTPS without an interactive sign-in.

If there is no existing domain, the approved short acceptance session can instead use `cloudflared tunnel --url http://127.0.0.1:3010`. Use the generated `trycloudflare.com` hostname. The restriction in this variant is enforced by the dedicated origin, which rejects all other paths. The hostname changes on restart. Use only the restricted listener's port. Cloudflare documents configuration-file compatibility in its Quick Tunnels guide.

Before entering the callback in Meta, use `curl.exe -i` against the public hostname to check that `/demo`, `/v1/chat`, `/v1/member-auth/challenges`, `/v1/inference` and `/api/chat` each return `404`. A POST to `/webhooks/whatsapp` without a signature should return `401`. A GET with invalid verification parameters should return `403`.

[Cloudflare tunnel setup](https://developers.cloudflare.com/tunnel/do-more-with-tunnels/local-management/create-local-tunnel/) · [Ingress rules](https://developers.cloudflare.com/tunnel/advanced/local-management/configuration-file/) · [Quick Tunnels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/)

## 4. Register the Meta callback

1. In the WhatsApp use case open **Configuration**. In the webhook section choose **Edit** and use `https://<TEST_HOST>/webhooks/whatsapp` as **Callback URL**. Paste the local `WHATSAPP_VERIFY_TOKEN` into **Verify token**, then choose **Verify and save**. Meta sends the GET challenge.
2. In the `whatsapp_business_account` webhook fields, subscribe to `messages`. Confirm the app is subscribed to the same test WABA. If needed, use the PowerShell 7 commands below with separate authorization scoped to the test WABA and `whatsapp_business_management` permission.
3. After approval for an external test message, open the test number in the personal WhatsApp app and send `help`. If Meta requires a starter thread for its test assets, use **API Setup → Send message** with the `hello_world` template to Nagy's approved **To** number, then reply `help` from the phone. The adapter sends text replies in response to inbound messages inside Meta's customer service window.

```powershell
$subscriptionUrl = 'https://graph.facebook.com/<VERSION>/<TEST_WABA_ID>/subscribed_apps'
$testWabaToken = Read-Host 'Temporary token authorized for the test WABA' -AsSecureString
Invoke-RestMethod -Uri $subscriptionUrl -Method Get -Authentication Bearer -Token $testWabaToken
# Run only if the test app is absent from the response.
Invoke-RestMethod -Uri $subscriptionUrl -Method Post -Authentication Bearer -Token $testWabaToken
Invoke-RestMethod -Uri $subscriptionUrl -Method Get -Authentication Bearer -Token $testWabaToken
Remove-Variable testWabaToken
```

[Meta webhook verification](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/) · [WhatsApp messages webhook](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages) · [WABA app subscription](https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-account/subscribed-apps-api) · [Meta text replies](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/text-messages)

## 5. Mobile acceptance

Wait for each reply before sending the next message. Record pass/fail and elapsed time, omitting phone numbers, IDs, codes and raw payloads from shared evidence. The following fixture identifiers and codes are public synthetic values.

| Send from personal WhatsApp | Expected |
| --- | --- |
| `هل الرنين المغناطيسي مغطى؟` before login | Instructions to start verification. No benefit information. |
| `login M-DEMO-001` | Instructions to enter the synthetic code. |
| `verify 000001`, then `verify 135790` | Generic failure, then verification confirmation. |
| `هل الرنين المغناطيسي مغطى؟` | Gold fixture MRI coverage with prior approval, 20% co-pay and 5,000 EGP remaining. |
| `وطب نسبة التحمل كام؟` within two minutes | Gold's 20% co-pay with the approval condition. |
| `login M-DEMO-002`, then a coverage question before `verify 246801` | Old Gold session revoked at switch. Pending verification gives no coverage. |
| `verify 246801`, then ask about MRI | Silver's MRI exclusion. |
| `logout`, then ask about MRI | Logout confirmed. The next question requires fresh verification. |
| `login M-DEMO-003`, `verify 357912`, then ask about MRI | VIP fixture from a different tenant. Coverage with prior approval, 0% co-pay and 12,000 EGP remaining. |
| Wait ten minutes after verification, then ask about MRI | A new login is required. An unused challenge expires in up to two minutes. |

For an optional two-phone check, add and allowlist a second approved test recipient. Verify different fixtures on each phone and check that each retains its own benefit result and active topic. The same fixture has one active WhatsApp session. Reverification from another configured sender replaces it.

Stop the tunnel and listener when acceptance ends. For a named tunnel, remove or disable the temporary test route through its owning Cloudflare account when it is no longer needed. Keep the Meta subscription scoped to the test WABA.

## Behavior and troubleshooting

- Sessions, queues and deduplication are process-local. Restart clears them. Signed messages older than ten minutes are ignored. Deliveries with an older message timestamp than the sender's last processed turn are ignored. Messages sharing a timestamp are processed in arrival order. If a code shares the login timestamp or a question shares the verification timestamp, the adapter asks you to resend it because the intended challenge or account scope is ambiguous.
- The listener queues up to eight jobs per sender including the active job. Under temporary saturation it replies `503` so Meta can retry; already accepted IDs stay deduplicated. The bounded ID cache holds up to 2,048 recent IDs. Tests use one listener instance.
- The OTP is a published fixture code supplied from this runbook. The adapter does not deliver the code. Existing per-member resend and attempt limits apply. Wait at least 30 seconds to restart the same identifier after requesting a challenge, and up to five minutes after exhausting the attempt window.
- Submit only fictional coverage questions without identifiers, verification data or numerals. Help, login, verify and logout are handled before model inference. The input filter blocks known sensitive labels, digits and common spelled-out digit forms. Follow the synthetic-only rule for free text. Coverage and session scope come from the existing authorized synthetic backend.
- A local model outage returns a generic retry message. `GRAPH_SEND_FAILED` means the Graph request timed out, was rejected, or did not return an accepted message ID. It does not include Meta diagnostics or recipient data. Acknowledged deliveries are not automatically resent after an ambiguous Graph outcome; send a fresh question after checking the token and test asset configuration. Graph acceptance and delivery to a phone are separate, and status callbacks do not send replies.
- The phone allowlist requires Meta to include `messages[].from`. If a WhatsApp username causes Meta to send only a business-scoped ID, use the approved starter test message to the phone number, then reply again from the same test chat. Meta includes phone numbers after a recent interaction with that business number. [Meta business-scoped user IDs](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-scoped-user-ids/)
