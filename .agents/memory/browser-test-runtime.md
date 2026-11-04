---
name: Browser test runtime
description: System-browser and long-suite execution constraints on Replit/Nix.
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

## Long full-suite runs

Run long browser suites in a background shell with a generous completion
check-in rather than a foreground shell with a short execution cap.

**Why:** A passing browser run was terminated by the shell tool's time limit
before the full suite completed. Tool timeout is not evidence of a test failure.

**How to apply:** Keep the established worker settings, let the background
task report completion, and inspect its final exit status and summary. Do not
change app code or raise browser concurrency merely to avoid a tool timeout.
