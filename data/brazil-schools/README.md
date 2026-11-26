# Brazilian driving schools

Each row is a driving school named on a public DETRAN CFC list (Rio de Janeiro
or Santa Catarina). A row is stored only when a candidate for the school's own
website answers and that page contains the school name. Directory sites and
social profiles are not stored as the school website.

OpenStreetMap in Sudeste and those official lists did not yield 250 schools
with an own website. Search engines rate-limited this collector, so the file
contains every school that could be confirmed this way.

A car school is category B. No lesson price is stored. Nothing here is a
verified permit, and DriveLinkUp does not book the lesson.

Rebuild with `python3 scripts/americas-schools/collect.py`.
