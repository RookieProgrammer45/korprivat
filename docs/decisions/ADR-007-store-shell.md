# ADR-007: App Store and Google Play shell

## Status
Accepted

## Date
2026-10-27

## Context
DriveLinkUp is a Next.js site at `https://www.drivelinkup.com`. The App Store and Google Play accept a signed app binary, not a website. The live product is the directory. Customers use **Kontakta skolan**. Booking and payment stay off until [ADR-006](ADR-006-directory-first.md).

A rewrite in React Native would fork the product. A static export cannot carry the server, the session, or the API.

## Decision
Ship one Capacitor shell, `mobile/`, that loads `https://www.drivelinkup.com`.

- Bundle id `com.drivelinkup.app` on both stores. It cannot be changed after the first upload.
- The shell is not a second product. It shows the same directory, the same contact button, and the same account deletion on `/profile`.
- No in-app purchase. The app does not sell a digital lesson. Payment stays off with the website.
- Swedish is the primary store language. English is the second.
- Do not describe the app as booking or paying for a lesson, and do not call a school verified.

## Alternatives considered

### React Native rewrite
Rejected. It would duplicate the live site and could drift from the directory release.

### Android Trusted Web Activity only
Rejected for the first submission. It does not produce an iOS binary. The Capacitor shell covers both stores.

### Bundle the site inside the app
Rejected. Next.js on this repo is a server app. The phone must open the canonical host.

## Consequences
- Upload requires Xcode 26 or later and Android target API 36. This repo's current Mac (Xcode 14.2) cannot produce an App Store build.
- Apple may reject a shell that is only the website. The listing and review notes must describe the account and the directory. A rejection is answered with native screens, not by turning booking on.
- The public privacy policy on `/privacy` is the live notice. The form answers in `docs/store/submission.md` have to match that page.
