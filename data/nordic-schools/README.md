# Nordic driving schools

Directory entries for driving schools outside Sweden. A row is included only when a public page links to the school's own website. Email, phone and a lesson price are stored only when that website shows them.

Nothing in this file is a verified permit. The directory shows these schools as not verified, with contact as the only action. Prices keep their own currency (NOK, DKK, ISK). They are not SEK and they are not a booking amount.

| Country | Source | What is listed |
| --- | --- | --- |
| Norway | Norges Trafikkskoleforbund public member finder | Schools whose card publishes a website |
| Denmark | Foreningen af Frie Kørelærere (ffk.nu), Fyn | Member schools with a website on that page |
| Iceland | Ísland.is list of operating theory schools | Schools with a website on that list |
| Finland | Suomen Autokoululiitto publishes names and street addresses only | Not listed. No school website is on that page, and a website is not guessed |

Refresh with `python3 scripts/nordic-schools/collect.py`. The script reads `/tmp/ntsf-schools.json` (the public finder response) and fetches each homepage. Do not edit `schools.json` by hand.
