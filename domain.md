# Resend Domain Verification — hollowscan.com

Use this file as a copy-paste checklist when adding DNS records to verify **hollowscan.com** on Resend.

---

## Quick notes
- **DNS manager:** Add records where your DNS is hosted (Vercel, Namecheap, GoDaddy, Cloudflare).  
- **Paste exactly:** No extra quotes or line breaks in TXT values.  
- **Wait:** DNS changes can take minutes to 24 hours to propagate.

---

## Records to add

### DKIM (required)
- **Type:** TXT  
- **Host / Name:** `resend._domainkey`  
- **Value:** `PASTE_DKIM_KEY_HERE`  
  - Replace `PASTE_DKIM_KEY_HERE` with the full DKIM value Resend shows (long string starting with `p=`).

### SPF (required)
- **Type:** TXT  
- **Host / Name:** `send`  
- **Value:** `v=spf1 include:amazonses.com ~all`

### MX (required for inbound/feedback)
- **Type:** MX  
- **Host / Name:** `send`  
- **Mail server / Value:** `feedback-smtp.eu-west-1.amazonses.com`  
- **Priority:** `10`

### DMARC (optional but recommended)
- **Type:** TXT  
- **Host / Name:** `_dmarc`  
- **Value:** `v=DMARC1; p=none;`

---

## Step-by-step (beginner-friendly)

1. **Log in** to the account that manages DNS for `hollowscan.com` (Vercel or your registrar).  
2. **Open DNS settings** for the domain (look for "DNS", "DNS Records", or "Manage DNS").  
3. **Add a new record** for each item in the "Records to add" section:
   - Choose the correct **Type** (TXT or MX).
   - Paste the **Host / Name** exactly.
   - Paste the **Value** exactly (for DKIM paste the full key Resend gave you).
   - For MX, set **Priority** to `10`.
4. **Save** each record.  
5. **Wait** for propagation (minutes to 24 hours).  
6. **Verify**:
   - Return to the Resend domain page and click **Verify** (or the button Resend shows).
   - If verification fails, re-check Host/Name and Value for typos.

---

## Quick checks (optional)
- Use an online DNS checker (e.g., DNSChecker) and search:
  - `TXT` for `resend._domainkey.hollowscan.com`
  - `TXT` for `send.hollowscan.com`
  - `MX` for `send.hollowscan.com`
- If you have a terminal and `dig`:
  - `dig TXT resend._domainkey.hollowscan.com`
  - `dig TXT send.hollowscan.com`
  - `dig MX send.hollowscan.com`

---

## Troubleshooting tips
- **No extra quotes** around TXT values.  
- **Cloudflare users:** set these records to DNS-only (proxy off).  
- **Multiple SPF records:** keep only one SPF TXT at the same host; merge includes if needed.  
- **Still failing after 24 hours:** copy the exact record values into a DNS checker; if they don’t appear, contact your DNS provider support.

---

## Final checklist
- [ ] DKIM TXT added (`resend._domainkey`)  
- [ ] SPF TXT added (`send`)  
- [ ] MX added (`send`, priority 10)  
- [ ] DMARC TXT added (optional)  
- [ ] Waited for propagation  
- [ ] Clicked Verify on Resend

---
