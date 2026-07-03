# Java CRM — Direct MSG91 WhatsApp Integration

This guide shows how to connect **your Java CRM** directly to MSG91 for inbound WhatsApp messages and store them in your own `whatsapp_lead` table — the same data Hub currently receives via webhook, but **without any Hub dependency**.

---

## What Hub does today (for reference only)

Hub does **not** poll MSG91. MSG91 pushes data to Hub when a customer sends a WhatsApp message.

| Hub endpoint | Table | What is stored |
|---|---|---|
| `POST /api/customer` | `customer_api_records` | Phone + minimal JSON `{ "customer_mobile": "919876543210" }` |
| `POST /api/msg91/webhook` | `msg91_inbound_records` | Phone + full MSG91 payload (text, name, direction, etc.) |

Your Java CRM should use the **full webhook approach** (`msg91_inbound_records` style), not the minimal phone-only approach.

```
Customer WhatsApp message
        │
        ▼
     MSG91 cloud
        │
        │  HTTP POST (JSON webhook)
        ▼
  Your Java CRM webhook URL
        │
        ▼
  whatsapp_lead table
```

**No Hub API, no polling Hub, no `EXTERNAL_LEAD_INGEST_API_KEY`.**

---

## Step 1 — MSG91 dashboard setup

1. Log in to [MSG91 Dashboard](https://control.msg91.com).
2. Go to **WhatsApp → Webhook (New) → Create Webhook**.
3. Configure:

| Setting | Value |
|---|---|
| **Name** | `Java CRM Inbound` |
| **Service** | WhatsApp |
| **Event** | **On Inbound Request Received** |
| **Callback URL** | `https://<your-java-crm-domain>/api/msg91/webhook` |
| **Content-Type** | `application/json` |

4. **Optional security header** (recommended):

| Header name | Header value |
|---|---|
| `X-Webhook-Secret` | Same secret string you put in `application.properties` (see Step 5) |

5. Click **Create**.

### Important MSG91 rules

- Respond within **8 seconds** with HTTP **2xx** (`200` or `201`).
- Return **4xx** only for bad requests; MSG91 may **auto-pause** the webhook on repeated 4xx.
- On **5xx**, MSG91 retries up to **5 times**.
- Media URLs in inbound payloads are valid for **30 days** — download and store if you need attachments later.

Official docs: [MSG91 WhatsApp Webhook (New)](https://msg91.com/help/webhook-new/how-to-receive-whatsapp-delivery-reports-via-webhook-new)

---

## Step 2 — `whatsapp_lead` table (MySQL)

Create a table equivalent to Hub's `msg91_inbound_records`, mapped to your CRM naming:

```sql
CREATE TABLE IF NOT EXISTS whatsapp_lead (
  id                BIGINT AUTO_INCREMENT PRIMARY KEY,
  phone_number      VARCHAR(32)  NOT NULL COMMENT 'Normalized digits, usually 91xxxxxxxxxx',
  customer_number   VARCHAR(32)  NULL     COMMENT 'Raw phone from MSG91 payload',
  customer_name     VARCHAR(255) NULL,
  integrated_number VARCHAR(32)  NULL     COMMENT 'Your WhatsApp business number',
  direction         VARCHAR(32)  NULL     COMMENT '0=inbound, 1=outbound',
  event_type        VARCHAR(64)  NULL     COMMENT 'eventName from MSG91',
  message_text      TEXT         NULL,
  content_type      VARCHAR(64)  NULL,
  request_id        VARCHAR(64)  NULL,
  msg_uuid          VARCHAR(128) NULL     COMMENT 'uuid from MSG91 / Meta',
  payload           JSON         NOT NULL COMMENT 'Full raw webhook body',
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_wa_lead_phone (phone_number),
  INDEX idx_wa_lead_created (created_at),
  INDEX idx_wa_lead_request (request_id)
);
```

### Field mapping from MSG91 inbound payload

| MSG91 field | `whatsapp_lead` column |
|---|---|
| `customerNumber` | `customer_number` + normalized `phone_number` |
| `customerName` | `customer_name` |
| `integratedNumber` | `integrated_number` |
| `direction` | `direction` |
| `eventName` | `event_type` |
| `text` | `message_text` |
| `contentType` | `content_type` |
| `requestId` | `request_id` |
| `uuid` | `msg_uuid` |
| entire JSON body | `payload` |

---

## Step 3 — Phone normalization (same logic as Hub)

Hub normalizes Indian numbers to `91` + 10 digits. Use the same rules in Java:

```java
public final class PhoneUtil {

    private PhoneUtil() {}

    public static String normalizePhoneDigits(String raw) {
        if (raw == null || raw.isBlank()) return null;

        String digits = raw.replaceAll("\\D", "");
        while (digits.startsWith("0")) {
            digits = digits.substring(1);
            if (digits.isEmpty()) return null;
        }

        if (digits.length() == 10) {
            char first = digits.charAt(0);
            if (first >= '6' && first <= '9') {
                return "91" + digits;
            }
        }
        return digits.isEmpty() ? null : digits;
    }
}
```

---

## Step 4 — Extract phone from MSG91 payload (same logic as Hub)

MSG91 may send phone in different keys. Check all of these (same order as Hub `extractPhoneFromMsg91Payload`):

```java
public final class Msg91PayloadParser {

    private Msg91PayloadParser() {}

    public record ExtractedPhone(
        String phone,
        String customerNumber,
        String integratedNumber,
        String direction,
        String eventType
    ) {}

    public static ExtractedPhone extract(JsonNode body) {
        if (body == null || !body.isObject()) {
            return new ExtractedPhone(null, null, null, null, null);
        }

        String customerNumber = firstNonEmpty(
            body, "customerNumber", "customer_number", "sender", "from", "mobile", "phone", "wa_id"
        );

        String integratedNumber = firstNonEmpty(
            body, "integratedNumber", "integrated_number", "receiver"
        );

        String direction = firstNonEmpty(body, "direction", "type");
        String eventType = firstNonEmpty(body, "event", "eventName", "eventType", "event_type", "status");

        if (customerNumber == null && body.has("data") && body.get("data").isObject()) {
            JsonNode data = body.get("data");
            customerNumber = firstNonEmpty(data, "customerNumber", "from", "mobile");
        }

        String phone = PhoneUtil.normalizePhoneDigits(customerNumber);
        return new ExtractedPhone(phone, customerNumber, integratedNumber, direction, eventType);
    }

    private static String firstNonEmpty(JsonNode node, String... fields) {
        for (String field : fields) {
            JsonNode v = node.get(field);
            if (v == null || v.isNull()) continue;
            String s = v.isNumber() ? v.asText() : v.asText("").trim();
            if (!s.isEmpty()) return s;
        }
        return null;
    }
}
```

---

## Step 5 — Spring Boot webhook controller

Add to your Java CRM (adjust package names):

### `application.properties` (secret directly here — no `.env`, no env variable)

Pick any long random string. Put the **same value** in MSG91 webhook header `X-Webhook-Secret`.

```properties
# Direct value only — do not use ${MSG91_WEBHOOK_SECRET} or .env
msg91.webhook.secret=hub-wa-inbound-8f3k2m9x7p1q4r6s
```

Example only — replace `hub-wa-inbound-8f3k2m9x7p1q4r6s` with your own secret.

### Entity

```java
@Entity
@Table(name = "whatsapp_lead")
public class WhatsappLead {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "phone_number", nullable = false, length = 32)
    private String phoneNumber;

    @Column(name = "customer_number", length = 32)
    private String customerNumber;

    @Column(name = "customer_name")
    private String customerName;

    @Column(name = "integrated_number", length = 32)
    private String integratedNumber;

    private String direction;
    private String eventType;

    @Column(name = "message_text", columnDefinition = "TEXT")
    private String messageText;

    private String contentType;
    private String requestId;
    private String msgUuid;

    @Column(columnDefinition = "json", nullable = false)
    private String payload;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    // getters / setters
}
```

### Controller

```java
@RestController
@RequestMapping("/api/msg91")
public class Msg91WebhookController {

    private final WhatsappLeadRepository repository;
    private final ObjectMapper objectMapper;

    @Value("${msg91.webhook.secret}")
    private String webhookSecret;

    public Msg91WebhookController(WhatsappLeadRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @PostMapping("/webhook")
    public ResponseEntity<Map<String, Object>> inboundWebhook(
            @RequestHeader(value = "X-Webhook-Secret", required = false) String headerSecret,
            @RequestHeader(value = "X-Msg91-Webhook-Secret", required = false) String msg91HeaderSecret,
            @RequestParam(value = "secret", required = false) String querySecret,
            @RequestBody JsonNode body
    ) throws JsonProcessingException {

        if (webhookSecret != null && !webhookSecret.isBlank()) {
            String provided = headerSecret != null ? headerSecret
                : (msg91HeaderSecret != null ? msg91HeaderSecret : querySecret);
            if (provided == null || !webhookSecret.equals(provided)) {
                return ResponseEntity.status(401).body(Map.of("ok", false, "message", "Invalid webhook secret"));
            }
        }

        Msg91PayloadParser.ExtractedPhone extracted = Msg91PayloadParser.extract(body);
        if (extracted.phone() == null) {
            return ResponseEntity.badRequest().body(Map.of(
                "ok", false,
                "message", "Could not extract phone from payload"
            ));
        }

        WhatsappLead row = new WhatsappLead();
        row.setPhoneNumber(extracted.phone());
        row.setCustomerNumber(extracted.customerNumber());
        row.setIntegratedNumber(extracted.integratedNumber());
        row.setDirection(extracted.direction());
        row.setEventType(extracted.eventType());
        row.setCustomerName(textOrNull(body, "customerName"));
        row.setMessageText(textOrNull(body, "text"));
        row.setContentType(textOrNull(body, "contentType"));
        row.setRequestId(textOrNull(body, "requestId"));
        row.setMsgUuid(textOrNull(body, "uuid"));
        row.setPayload(objectMapper.writeValueAsString(body));

        WhatsappLead saved = repository.save(row);

        return ResponseEntity.status(201).body(Map.of(
            "ok", true,
            "id", saved.getId(),
            "phoneNumber", saved.getPhoneNumber(),
            "message", "Inbound WhatsApp saved",
            "createdAt", saved.getCreatedAt().toString()
        ));
    }

    private static String textOrNull(JsonNode body, String field) {
        JsonNode n = body.get(field);
        if (n == null || n.isNull()) return null;
        String s = n.asText("").trim();
        return s.isEmpty() ? null : s;
    }
}
```

### Repository

```java
public interface WhatsappLeadRepository extends JpaRepository<WhatsappLead, Long> {

    List<WhatsappLead> findByPhoneNumberOrderByCreatedAtDesc(String phoneNumber);

    @Query("""
        SELECT w FROM WhatsappLead w
        WHERE w.phoneNumber = :phone
           OR w.phoneNumber LIKE CONCAT('%', :last10)
           OR w.phoneNumber = CONCAT('91', :last10)
        ORDER BY w.createdAt DESC
        """)
    List<WhatsappLead> findByPhoneFlexible(@Param("phone") String phone, @Param("last10") String last10);
}
```

---

## Step 6 — Sample MSG91 inbound payload

When a customer sends `Hi` on WhatsApp, MSG91 POSTs JSON like:

```json
{
  "companyId": "384905",
  "requestedAt": "2025-08-25T15:25:55+05:30",
  "customerNumber": "917748847990",
  "eventName": "delivered",
  "uuid": "wamid.HBgMOTE3NzQ4ODQ3OTkwFQIAEhgg...",
  "integratedNumber": "917316914325",
  "direction": "0",
  "customerName": "Manas",
  "contentType": "text",
  "text": "Hi",
  "contacts": "[{\"profile\":{\"name\":\"Manas\"},\"wa_id\":\"917748847990\"}]",
  "messages": "[{\"from\":\"917748847990\",\"text\":{\"body\":\"Hi\"},\"type\":\"text\"}]",
  "ts": "2025-08-25T15:25:55+05:30"
}
```

Your webhook saves:

- `phone_number` = `917748847990`
- `message_text` = `Hi`
- `customer_name` = `Manas`
- `payload` = full JSON above

---

## Step 7 — Test before going live

### Local test (curl)

```bash
curl -X POST "http://localhost:8080/api/msg91/webhook" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: hub-wa-inbound-8f3k2m9x7p1q4r6s" \
  -d '{
    "customerNumber": "919876543210",
    "integratedNumber": "917316914325",
    "direction": "0",
    "eventName": "delivered",
    "customerName": "Test User",
    "contentType": "text",
    "text": "Hello from test",
    "uuid": "test-uuid-001"
  }'
```

Expected response:

```json
{
  "ok": true,
  "id": 1,
  "phoneNumber": "919876543210",
  "message": "Inbound WhatsApp saved",
  "createdAt": "2026-06-20T10:00:00"
}
```

### Production checklist

- [ ] Java CRM URL is **HTTPS** (MSG91 requires a public callback URL).
- [ ] Firewall / security group allows inbound POST from the internet.
- [ ] Same `msg91.webhook.secret` value is in `application.properties` and MSG91 header `X-Webhook-Secret`.
- [ ] Database `whatsapp_lead` table exists.
- [ ] Send a real WhatsApp message to your business number and confirm a row is inserted.
- [ ] Check MSG91 **Webhook Logs** if nothing arrives.

---

## Step 8 — Create CRM lead from `whatsapp_lead` (optional)

After the webhook saves the row, you can auto-create a CRM lead in the same request or via a scheduled job:

```java
// After repository.save(row):
if (!leadService.existsByPhone(row.getPhoneNumber())) {
    leadService.createFromWhatsapp(
        row.getPhoneNumber(),
        row.getCustomerName(),
        row.getMessageText(),
        row.getId()
    );
}
```

Suggested dedup rule: one open lead per `phone_number` in the last 24 hours (adjust to your sales process).

---

## What you do NOT need

| Do not use | Why |
|---|---|
| `https://api.hubinterior.com/api/customer` | That is Hub's storage, not yours |
| `GET /api/customer/phones/recent` | Hub polling API for external projects |
| `EXTERNAL_LEAD_INGEST_API_KEY` | Hub-only auth |
| MSG91 Authkey for inbound | Authkey is for **sending** messages via MSG91 API; inbound uses **webhook only** |

---

## Sending WhatsApp from Java CRM (outbound — separate)

Inbound webhook above only **receives** messages. To **send** templates/messages from Java CRM, use MSG91 REST API with your Authkey:

```
POST https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/
Header: authkey: <YOUR_MSG91_AUTHKEY>
Header: Content-Type: application/json
```

That is optional and independent of the inbound `whatsapp_lead` flow.

---

## Quick comparison

| | Hub (current) | Your Java CRM (target) |
|---|---|---|
| MSG91 webhook URL | `https://api.hubinterior.com/api/msg91/webhook` | `https://<your-crm>/api/msg91/webhook` |
| Storage table | `msg91_inbound_records` | `whatsapp_lead` |
| Hub dependency | Yes | **No** |
| Data source | MSG91 direct push | MSG91 direct push |
| Phone normalization | `normalizePhoneDigits()` in Node | Same logic in Java `PhoneUtil` |

---

## Support

- MSG91 webhook docs: https://msg91.com/help/webhook-new/how-to-receive-whatsapp-delivery-reports-via-webhook-new
- Hub reference implementation (read-only): `backend/routes/msg91InboundApi.ts`
