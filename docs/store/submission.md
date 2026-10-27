# Store submission

The phone app is the shell in `mobile/`. It opens `https://www.drivelinkup.com`. Listing text below is what you paste into App Store Connect and Play Console. Build steps are in `mobile/README.md`.

## Before you pay for the accounts

These block a review even after the binary uploads.

1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/) and create a [Google Play Console](https://play.google.com/console) account. Apple asks for a legal seller name. A company needs a D-U-N-S number. The privacy page does not name a company or an organisation number yet.
2. Build on a Mac with Xcode 26 or later. App Store Connect has required that SDK since 28 April 2026. Google Play requires target API 36 for a new app. The Mac that holds this repo has Xcode 14.2 and cannot upload.
3. The public privacy page is the live notice (no draft banner). Both stores open `https://www.drivelinkup.com/privacy`. If processing changes, update that page and the store forms in the same release.
4. Take the screenshots yourself on a phone, signed in and signed out. The catalogue must show **Kontakta skolan**, not a booking button.

## App identity

| Field | Value |
| --- | --- |
| Name | DriveLinkUp |
| Bundle id | `com.drivelinkup.app` |
| Primary language | Swedish |
| Category | Education |
| Price | Free |
| Website | https://www.drivelinkup.com |
| Privacy | https://www.drivelinkup.com/privacy |
| Support | https://www.drivelinkup.com/contact |
| Support email | support@drivelinkup.com |
| Age | 16 and older. Not a children's app. |

Apple's questionnaire has no "16+" bucket. Answer it from the real content. Expect 12+ or 17+. On Google Play, set the target age to 16 and do not opt into the Families program.

## Swedish listing

Subtitle: Jämför trafikskolor

Description:

DriveLinkUp är en katalog för trafikskolor i Sverige. Jämför skolor för bil, lastbil och buss, se priser som skolan själv har publicerat och hör av dig med Kontakta skolan.

DriveLinkUp bokar inte lektionen och tar inte betalt i appen. Tid och betalning ordnar du med skolan.

Kontot är kostnadsfritt. Du kan radera det under Profil.

Keywords: trafikskola,körkort,körskola,lastbil,buss,YKB,övningskörning

## English listing

Subtitle: Compare driving schools

Description:

DriveLinkUp is a directory of driving schools in Sweden. Compare schools for cars, trucks and buses, see prices the school has published, and reach them with Contact the school.

DriveLinkUp does not book the lesson and does not take payment in the app. You arrange the time and the payment with the school.

The account is free. You can delete it from Profile.

## Review notes

Paste this into both stores:

```
DriveLinkUp is a directory of driving schools in Sweden. Sign-in is optional for browsing the public home page. The catalogue asks for an account. The customer action is Contact the school (email or the school's website). The app does not create a booking and does not take payment. Account deletion is on Profile, at the bottom of the signed-in page. Test account: provide a learner login in this field before you submit.
```

Create the test learner yourself and put the email and password only in the review form, not in the repo.

## Data you declare

Match the live privacy page. Today the app collects:

- Account: name, email, password, role. Used to run the account. The user can delete it.
- Claimed date of birth at learner signup, used only as a 16+ check.
- Profile photo: optional, chosen by the user.
- Location: only if the user asks for schools near them. Not collected in the background.
- Support messages: whatever the user sends on the contact form.
- Optional teaching-licence file if a school staff member uploads one.
- Assistant questions the user types (sent to OpenAI to reply).
- Cookie choice. Google AdSense loads only after marketing consent.
- Google reviews stored on a listing, labelled as Google. Not verified by DriveLinkUp.
- Published prices and listing text taken from the school's website.

Do not declare payments, card data, or ID-document scans. Customer checkout is off, and identity verification is not the live signup path. If either is turned on later, update the privacy page and both store forms in the same release.

Do not say the app sells data. A separate analytics tool is not loaded today. AdSense stays off until the user accepts marketing cookies.

## Screenshot sizes

iPhone only for the first version, so you do not owe iPad shots.

- iPhone 6.9-inch: 1320 × 2868, or the size App Store Connect asks for on the day you upload.
- At least three shots: home, a school card with **Kontakta skolan**, and the signed-in profile with **Delete account** visible.
- Google Play: phone screenshots plus a 1024 × 500 feature graphic.
- Icon: 1024 × 1024 PNG, no transparency, no rounded mask. Start from `src/app/icon.svg`.

## What a rejection means

Apple's minimum-functionality rule rejects apps that are only a website in a web view. If that happens, add native screens around the same site. Do not turn booking or payment on to get through review.
