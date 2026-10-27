# ADR-006: Directory-first release

## Status
Accepted

## Date
2026-10-27

## Context
The owner approved a directory and comparison release. The point is to show demand for finding driving schools — car, truck and bus, and later taxi — before taking bookings. Request-to-book and instant booking are deferred. Specs 00–09 still describe a booking marketplace; this decision is the current release scope where it conflicts with building or turning on new reservations.

## Decision
- Public surfaces are a directory: schools, prices the school publishes, reviews already stored, and a way to contact the school.
- Heavy-vehicle training (C, D, YKB) is shown only when the school's own website says so. It is not inferred from car training. Motorcycle and taxi are not inferred from car training either. Taxi is not a live filter until a school record actually offers it.
- A school is not hidden only because a price or a review is missing. Missing prices use a price-request contact. Missing reviews are shown as none.
- `POST /api/bookings` and new offering requests do not create reservations unless `BOOKING_CREATION_ENABLED=true`. That variable is unset in production.
- Existing booking rows keep their support paths: pay an existing booking, cancel, refund, dispute, receipt, and admin resolution.
- DriveLinkUp does not claim official approval, complete coverage, or that a lesson can be booked on the site.

## Consequences
- Homepage and school pages must not promise that DriveLinkUp books the lesson.
- Re-enabling booking is a later decision, not a gap in this release.
