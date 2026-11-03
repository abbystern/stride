---
name: Supabase URL diagnostics
description: Avoid false confidence from successful Auth health probes when investigating client request paths.
---

A successful Supabase health/settings request does not prove the SDK's configured project URL is correct when the probe replaces the URL's path.

**Why:** A configured Data API URL ending in `/rest/v1` passed an absolute-path Auth settings probe, while the SDK appended another API path and signup returned HTTP 404, “Invalid path specified in request URL.”

**How to apply:** Check the configured URL's structure without revealing credential values, capture the actual Auth response, and verify the SDK-generated endpoint using an intercepted request before creating real test accounts. Treat missing profile schema as a separate finding rather than assuming it caused an Auth routing error.

Email-confirmation redirects are a separate Supabase configuration concern from the SDK project URL and database migration.

**Why:** The user reported that confirmation initially redirected to localhost and was resolved through Supabase URL Configuration. The user subsequently confirmed the authentication flow worked.

**How to apply:** When a confirmation link returns to the wrong host, check Supabase's Site URL and allowed redirect URLs as well as the app's `emailRedirectTo`; do not change authentication or RLS to work around a redirect problem.
