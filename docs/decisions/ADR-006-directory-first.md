# ADR-006: Directory-first release

## Status
Accepted

## Date
2026-10-27

## Context
The owner approved a directory and comparison release. The point is to show demand for finding driving schools — car, truck and bus, and later taxi — before taking bookings. Request-to-book and instant booking stay in the product, switched off. Specs 00–09 still describe a booking marketplace; this decision is the current release scope where it conflicts with turning on new reservations.

## Decision
- Public surfaces are a directory: schools, prices the school publishes, reviews already stored, and a way to contact the school.
- Heavy-vehicle training (C, D, YKB) is shown only when the school's own website says so. It is not inferred from car training. Motorcycle and taxi are not inferred from car training either. Taxi is not a live filter until a school record actually offers it.
- A school is not hidden only because a price or a review is missing. Missing prices use a price-request contact. Missing reviews are shown as none.
- Keep the booking API. Do not delete `POST /api/bookings`, offering requests, checkout, accept, cancel, refund, dispute, receipt, the booking contracts, or the connector certification path. The later phase needs them.
- That phase starts only when both are true: the directory has shown demand, and driving schools use booking systems this API can connect to. As of this decision, neither is true. Do not set the switch, and do not build a connector, to get ahead of either condition.
- Until then the customer action is the school's contact button. `POST /api/bookings`, new offering requests, and customer checkout do not run unless `BOOKING_CREATION_ENABLED=true`. That variable is unset in production.
- The live site has no customer booking to support. Checked 2026-10-27 on production: one cancelled category-B test from 2 October, plus receipt rows whose bookings are gone. Leave those rows. They are not a reason to show booking or payment. Cancel, refund, dispute, and receipt stay in the API for the later phase and for that test row. They are not the switch.
- DriveLinkUp does not claim official approval, complete coverage, or that a lesson can be booked on the site.

## Consequences
- Homepage and school pages must not promise that DriveLinkUp books the lesson.
- Removing the booking API because the directory does not call it would throw away the phase this release is measuring demand for.
