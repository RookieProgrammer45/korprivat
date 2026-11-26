# European driving schools

Each row is a car driving school whose own website is published on OpenStreetMap, or, for France, in the Sécurité routière labelled-school file. Directory sites and social profiles are not stored as the school website.

Lesson prices are empty until `scripts/regional-schools/extract.ts` reads the school's own pages with OpenAI. A listed price is the price on that website. Nothing here is a verified permit, and DriveLinkUp does not book the lesson.

Countries with no school website on that public list are not included. Cyprus and Malta had no driving school with both a website and a city. Finland stays in the Nordic file and is still unlisted for the same reason.

Border tiles overlap, so a city is kept in the country where that city is more common. Zagreb, Sisak, and Nedelišće are filed under Croatia. A school named as a taxi school is left out. A car school is stored as category B only. French truck and bus categories come from the same Sécurité routière file. For the other countries, a truck or bus category is stored only when the OpenStreetMap `license_classes` tag on that school lists it. The city is the address city on the same point. No heavy lesson price is stored. A car listing is not marked as heavy.
