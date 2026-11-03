---
name: Browser test runtime
description: Why browser automation should prefer Replit's working system browser.
---

Prefer the available system Chromium wrapper for browser tests in this Replit
environment rather than assuming a downloaded stock Playwright browser will run.

**Why:** A stock browser download succeeded but failed before launch because its
expected Linux shared-library paths were unavailable in the Nix environment.
The existing system wrapper launched successfully without changing app code or
installing more system packages.

**How to apply:** When browser automation fails before opening a page, check for
an existing system browser before downloading another browser or changing the
application. Keep any executable override confined to test configuration.
