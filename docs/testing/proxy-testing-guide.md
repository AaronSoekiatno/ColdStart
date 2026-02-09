# End-to-End Testing Guide: Secure Provisioning Proxy

This document outlines how to verify the entire secure provisioning flow, from obtaining credentials to successfully using the AI proxy.

## 1. Architecture Overview

-   **Provision API** (`/api/topcandidates/provision`): Issues credentials. now returns a **Proxy URL** instead of a raw Google API Key.
-   **Proxy API** (`/api/proxy/gemini/...`): Intercepts AI requests, validates the User's JWT, injects the server-side API Key, and forwards to Google.
-   **Client (Seed Repo)**: Uses the Proxy URL and JWT to consume AI services.

## 2. Prequisites

Ensure the Hermes development server is running:
```bash
npm run dev
```

## 3. Step-by-Step Testing

### Phase A: Test Provisioning Credential Delivery
**Goal**: Verify the Provision API issues the correct Proxy URL and hides the raw key.

We have a dedicated script for this: `scripts/test-provision-key.ts`.

1.  **Run the Test Script**:
    ```bash
    npx tsx scripts/test-provision-key.ts
    ```
2.  **Expected Output**:
    ```
    ✅ All provisioning tests passed!
    ```
    *Internally, this checks that `GOOGLE_API_KEY` is "managed-by-proxy" and `GEMINI_BASE_URL` is set.*

### Phase B: Test Proxy Connectivity & Auth
**Goal**: Verify that a client using the issued JWT can successfully talk to Google via the Proxy.

We created a simulation script: `scripts/test-proxy-connection.ts`.

1.  **Run the Test Script**:
    ```bash
    npx tsx scripts/test-proxy-connection.ts
    ```
2.  **Expected Output**:
    ```
    ✅ JWT Generated.
    ✅ Proxy Connection Successful!
    ✅ Found Generation Model: models/gemini-2.5-flash
    ✅ Generation Successful!
    Response: "Working!"
    ```

### Phase C: Manual Verification (Curl)
**Goal**: Manually trace the HTTP request to ensure headers are correct.

1.  **Generate a generic JWT** (optional, reuse one if you have it, or rely on the script above to print one).
    *   *Tip: `scripts/test-proxy-connection.ts` prints "JWT Generated" - you can modify it to log the token if you need to copy it.*

2.  **Send a Request**:
    Replace `<YOUR_JWT>` with the token.
    ```bash
    curl -X POST http://localhost:3000/api/proxy/gemini/v1beta/models/gemini-2.5-flash:generateContent \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer <YOUR_JWT>" \
      -d '{
        "contents": [{
          "parts": [{"text": "Hello proxy"}]
        }]
      }'
    ```

3.  **Success Criteria**:
    -   Host receives request at `/api/proxy/...`
    -   Response is a valid JSON from Google.

## 4. Integration with Seed Repo (The Real "End-to-End")

To test this with the **actual assessment repository**:

1.  **Modify the Assessment Code**:
    Ensure the AI client uses `process.env.GEMINI_BASE_URL` as the base path.
2.  **Run setup**: 
    Run the command that triggers provisioning (e.g. `npm run mission:start` in the seed repo).
3.  **Check `.env.local`**:
    Verify it contains:
    ```env
    GEMINI_BASE_URL=http://localhost:3000/api/proxy/gemini
    GOOGLE_API_KEY=managed-by-proxy
    SUPABASE_PRIVATE_KEY=... (This is the JWT)
    ```
4.  **Run the Mission**:
    Execute the assessment. It should succeed without any "invalid API key" errors.

## 5. Troubleshooting

| Error | Cause | Fix |
| :--- | :--- | :--- |
| **401 Unauthorized** | Missing or Invalid JWT | Ensure requests send `Authorization: Bearer <SUPABASE_PRIVATE_KEY>`. Check `verifyCandidateJWT` logic. |
| **404 Not Found** | Wrong Model / URL | Check that the client is appending the correct path (e.g. `/v1beta/models/...`) to the Base URL. |
| **503 Service Unavailable** | Exhausted Keys | The server-side Google API keys are over quota. Add more keys to `lib/api-key-pool.ts`. |
