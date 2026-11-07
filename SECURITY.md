# Security policy

## Reporting a vulnerability

Report a vulnerability privately through GitHub's private vulnerability reporting: open the repository's **Security** tab and choose **Report a vulnerability** (<https://github.com/visvaya/fm-evaluator/security/advisories/new>). Please do not open a public issue, discussion or pull request for it.

Include:

- the commit or deployed version you tested;
- steps to reproduce, and the browser and its version;
- if the problem needs a crafted export file, a minimal synthetic file, not a real save or a file with personal data;
- what an attacker could achieve.

The project has a single maintainer and promises no response time. Reports are acknowledged in the advisory thread, and a fix is published before the advisory.

## Supported versions

There are no releases yet. Fixes go to the latest commit on `main`.

## Scope

FM Evaluator runs entirely in the browser: imported files are parsed locally and are never uploaded. In scope is the code in this repository, for example markup or script injection through a crafted export, a way around the Content Security Policy, or a way to make the service worker serve something other than the app's own files.

Out of scope: Football Manager itself, bugs in third-party libraries that are not caused by how this project uses them (please report those upstream), and problems that need a modified browser or an attacker who already controls the user's device.
