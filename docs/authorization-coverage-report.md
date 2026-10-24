# Authorization collection coverage

Generated: 2026-10-24T13:37:56.694Z
Source: neon production branch main br-rough-frost-b7ttlbxj read-only 2026-10-24

This is the go/no-go input from `docs/authorization-collection-plan.md` §6 and §10.
Grant counts are not usable supply. No production flag was changed.

## §6 buckets

- availability_display: 0
- inquiry_collection: 0
- request_to_book: 0
- transactional_booking: 0
- payment_collection: 0
- action-eligible (E0–E3 + approved policy + request-acceptance route): 0
- instant-bookable (action-eligible + E4 + current inventory): 0
- availability-display-authorized: 0
- directory-only today: 1
- directory-only if `SCHOOL_AUTHZ_ENFORCEMENT` is on: 635

## Cohort assignment

- 0-pilot: 0
- 1-professional: 0
- 2-active-core: 0
- 3-long-tail: 0
- excluded-contact: 1
- unclassified: 634

Pilot cell: not selected — pass --pilot-city and --pilot-category

## Proposed cells (first 20)

- Alingsås (no category): 6 (city-only-missing-category)
- Alvesta (no category): 1 (city-only-missing-category)
- Angered (no category): 1 (city-only-missing-category)
- Arboga (no category): 2 (city-only-missing-category)
- Arlandastad (no category): 1 (city-only-missing-category)
- Arlöv (no category): 1 (city-only-missing-category)
- Arvidsjaur (no category): 1 (city-only-missing-category)
- Arvika (no category): 1 (city-only-missing-category)
- Avesta (no category): 1 (city-only-missing-category)
- Bandhagen (no category): 2 (city-only-missing-category)
- Bankeryd (no category): 1 (city-only-missing-category)
- Boden (no category): 3 (city-only-missing-category)
- Bollnäs (no category): 2 (city-only-missing-category)
- Borlänge (no category): 5 (city-only-missing-category)
- Borås (no category): 5 (city-only-missing-category)
- Bromma (no category): 2 (city-only-missing-category)
- Brämhult (no category): 1 (city-only-missing-category)
- Bålsta (no category): 1 (city-only-missing-category)
- Båstad (no category): 1 (city-only-missing-category)
- Danderyd (no category): 3 (city-only-missing-category)

## Hypothetical flip delta

Schools that are bookable via legacy `bookingMode` today and would become directory-only: **634**.

## Per-city density (eligible offerings, not grant counts)

- Alingsås: 6 schools, 0 action-eligible, 6 directory-only on flip
- Alvesta: 1 schools, 0 action-eligible, 1 directory-only on flip
- Angered: 1 schools, 0 action-eligible, 1 directory-only on flip
- Arboga: 2 schools, 0 action-eligible, 2 directory-only on flip
- Arlandastad: 1 schools, 0 action-eligible, 1 directory-only on flip
- Arlöv: 1 schools, 0 action-eligible, 1 directory-only on flip
- Arvidsjaur: 1 schools, 0 action-eligible, 1 directory-only on flip
- Arvika: 1 schools, 0 action-eligible, 1 directory-only on flip
- Avesta: 1 schools, 0 action-eligible, 1 directory-only on flip
- Bandhagen: 2 schools, 0 action-eligible, 2 directory-only on flip
- Bankeryd: 1 schools, 0 action-eligible, 1 directory-only on flip
- Boden: 3 schools, 0 action-eligible, 3 directory-only on flip
- Bollnäs: 2 schools, 0 action-eligible, 2 directory-only on flip
- Borlänge: 5 schools, 0 action-eligible, 5 directory-only on flip
- Borås: 6 schools, 0 action-eligible, 6 directory-only on flip
- Bromma: 2 schools, 0 action-eligible, 2 directory-only on flip
- Brämhult: 1 schools, 0 action-eligible, 1 directory-only on flip
- Bålsta: 1 schools, 0 action-eligible, 1 directory-only on flip
- Båstad: 1 schools, 0 action-eligible, 1 directory-only on flip
- Danderyd: 3 schools, 0 action-eligible, 3 directory-only on flip
- Eksjö: 2 schools, 0 action-eligible, 2 directory-only on flip
- Emmaboda: 1 schools, 0 action-eligible, 1 directory-only on flip
- Enköping: 2 schools, 0 action-eligible, 2 directory-only on flip
- Enskededalen: 1 schools, 0 action-eligible, 1 directory-only on flip
- Eskilstuna: 4 schools, 0 action-eligible, 4 directory-only on flip
- Eslöv: 1 schools, 0 action-eligible, 1 directory-only on flip
- Fagersta: 2 schools, 0 action-eligible, 2 directory-only on flip
- Falkenberg: 5 schools, 0 action-eligible, 5 directory-only on flip
- Falköping: 4 schools, 0 action-eligible, 4 directory-only on flip
- Falun: 4 schools, 0 action-eligible, 4 directory-only on flip
- Farsta: 6 schools, 0 action-eligible, 6 directory-only on flip
- Filipstad: 1 schools, 0 action-eligible, 1 directory-only on flip
- Finspång: 1 schools, 0 action-eligible, 1 directory-only on flip
- Flen: 1 schools, 0 action-eligible, 1 directory-only on flip
- Fränsta: 1 schools, 0 action-eligible, 1 directory-only on flip
- Gislaved: 2 schools, 0 action-eligible, 2 directory-only on flip
- Gnesta: 1 schools, 0 action-eligible, 1 directory-only on flip
- Grängesberg: 1 schools, 0 action-eligible, 1 directory-only on flip
- Grästorp: 1 schools, 0 action-eligible, 1 directory-only on flip
- Gustavsberg: 1 schools, 0 action-eligible, 1 directory-only on flip
- Gällivare: 1 schools, 0 action-eligible, 1 directory-only on flip
- Gävle: 3 schools, 0 action-eligible, 3 directory-only on flip
- Göteborg: 28 schools, 0 action-eligible, 28 directory-only on flip
- Hallsberg: 1 schools, 0 action-eligible, 1 directory-only on flip
- Hallstahammar: 1 schools, 0 action-eligible, 1 directory-only on flip
- Halmstad: 9 schools, 0 action-eligible, 9 directory-only on flip
- Hammarstrand: 1 schools, 0 action-eligible, 1 directory-only on flip
- Handen: 2 schools, 0 action-eligible, 2 directory-only on flip
- Haparanda: 1 schools, 0 action-eligible, 1 directory-only on flip
- Hedemora: 1 schools, 0 action-eligible, 1 directory-only on flip
- Helsingborg: 9 schools, 0 action-eligible, 9 directory-only on flip
- Herrljunga: 1 schools, 0 action-eligible, 1 directory-only on flip
- Hisings Backa: 2 schools, 0 action-eligible, 2 directory-only on flip
- Hisings Kärra: 1 schools, 0 action-eligible, 1 directory-only on flip
- Hisings-backa: 1 schools, 0 action-eligible, 1 directory-only on flip
- Hjärnarp: 1 schools, 0 action-eligible, 1 directory-only on flip
- Huddinge: 5 schools, 0 action-eligible, 5 directory-only on flip
- Hudiksvall: 3 schools, 0 action-eligible, 3 directory-only on flip
- Hultsfred: 2 schools, 0 action-eligible, 2 directory-only on flip
- Huskvarna: 2 schools, 0 action-eligible, 2 directory-only on flip
- Hägersten: 3 schools, 0 action-eligible, 3 directory-only on flip
- Härnösand: 2 schools, 0 action-eligible, 2 directory-only on flip
- Hässleholm: 7 schools, 0 action-eligible, 7 directory-only on flip
- Höllviken: 1 schools, 0 action-eligible, 1 directory-only on flip
- Hörnefors: 1 schools, 0 action-eligible, 1 directory-only on flip
- Höör: 1 schools, 0 action-eligible, 1 directory-only on flip
- Indal: 1 schools, 0 action-eligible, 1 directory-only on flip
- Johanneshov: 3 schools, 0 action-eligible, 3 directory-only on flip
- Junosuando: 1 schools, 0 action-eligible, 1 directory-only on flip
- Järfälla: 7 schools, 0 action-eligible, 7 directory-only on flip
- Jönköping: 9 schools, 0 action-eligible, 9 directory-only on flip
- Kalix: 2 schools, 0 action-eligible, 2 directory-only on flip
- Kalmar: 6 schools, 0 action-eligible, 6 directory-only on flip
- Karlshamn: 3 schools, 0 action-eligible, 3 directory-only on flip
- Karlskoga: 2 schools, 0 action-eligible, 2 directory-only on flip
- Karlskrona: 3 schools, 0 action-eligible, 3 directory-only on flip
- Karlstad: 3 schools, 0 action-eligible, 3 directory-only on flip
- Katrineholm: 1 schools, 0 action-eligible, 1 directory-only on flip
- Kinna: 1 schools, 0 action-eligible, 1 directory-only on flip
- Kisa: 1 schools, 0 action-eligible, 1 directory-only on flip
- Kista: 1 schools, 0 action-eligible, 1 directory-only on flip
- Klippan: 3 schools, 0 action-eligible, 3 directory-only on flip
- Kramfors: 1 schools, 0 action-eligible, 1 directory-only on flip
- Kristianstad: 9 schools, 0 action-eligible, 9 directory-only on flip
- Kristinehamn: 1 schools, 0 action-eligible, 1 directory-only on flip
- Krylbo: 1 schools, 0 action-eligible, 1 directory-only on flip
- Kumla: 1 schools, 0 action-eligible, 1 directory-only on flip
- Kungens Kurva: 1 schools, 0 action-eligible, 1 directory-only on flip
- Kungsbacka: 5 schools, 0 action-eligible, 5 directory-only on flip
- Kungsängen: 1 schools, 0 action-eligible, 1 directory-only on flip
- Kungälv: 4 schools, 0 action-eligible, 4 directory-only on flip
- Köping: 3 schools, 0 action-eligible, 3 directory-only on flip
- Laholm: 1 schools, 0 action-eligible, 1 directory-only on flip
- Landskrona: 3 schools, 0 action-eligible, 3 directory-only on flip
- Leksand: 2 schools, 0 action-eligible, 2 directory-only on flip
- Lerum: 2 schools, 0 action-eligible, 2 directory-only on flip
- Lidingö: 1 schools, 0 action-eligible, 1 directory-only on flip
- Lidköping: 4 schools, 0 action-eligible, 4 directory-only on flip
- Limhamn: 2 schools, 0 action-eligible, 2 directory-only on flip
- Lindesberg: 1 schools, 0 action-eligible, 1 directory-only on flip
- Linköping: 9 schools, 0 action-eligible, 9 directory-only on flip
- Ljungby: 3 schools, 0 action-eligible, 3 directory-only on flip
- Ljusdal: 1 schools, 0 action-eligible, 1 directory-only on flip
- Lomma: 1 schools, 0 action-eligible, 1 directory-only on flip
- Ludvika: 3 schools, 0 action-eligible, 3 directory-only on flip
- Luleå: 6 schools, 0 action-eligible, 6 directory-only on flip
- Lund: 10 schools, 0 action-eligible, 10 directory-only on flip
- Lycksele: 1 schools, 0 action-eligible, 1 directory-only on flip
- Lysekil: 2 schools, 0 action-eligible, 2 directory-only on flip
- Malmköping: 1 schools, 0 action-eligible, 1 directory-only on flip
- Malmö: 14 schools, 0 action-eligible, 14 directory-only on flip
- Malung: 1 schools, 0 action-eligible, 1 directory-only on flip
- Mariestad: 3 schools, 0 action-eligible, 3 directory-only on flip
- Mjölby: 2 schools, 0 action-eligible, 2 directory-only on flip
- Mora: 3 schools, 0 action-eligible, 3 directory-only on flip
- Motala: 3 schools, 0 action-eligible, 3 directory-only on flip
- Märsta: 1 schools, 0 action-eligible, 1 directory-only on flip
- Mölndal: 4 schools, 0 action-eligible, 4 directory-only on flip
- Mölnlycke: 1 schools, 0 action-eligible, 1 directory-only on flip
- Nacka: 5 schools, 0 action-eligible, 5 directory-only on flip
- Norberg: 1 schools, 0 action-eligible, 1 directory-only on flip
- Norrköping: 20 schools, 0 action-eligible, 20 directory-only on flip
- Norrtälje: 1 schools, 0 action-eligible, 1 directory-only on flip
- Norrtällje: 1 schools, 0 action-eligible, 1 directory-only on flip
- Norsborg: 1 schools, 0 action-eligible, 1 directory-only on flip
- Nybro: 2 schools, 0 action-eligible, 2 directory-only on flip
- Nyköping: 6 schools, 0 action-eligible, 6 directory-only on flip
- Nynäshamn: 1 schools, 0 action-eligible, 1 directory-only on flip
- Nässjö: 2 schools, 0 action-eligible, 2 directory-only on flip
- Olofström: 1 schools, 0 action-eligible, 1 directory-only on flip
- Osby: 1 schools, 0 action-eligible, 1 directory-only on flip
- Oskarshamn: 1 schools, 0 action-eligible, 1 directory-only on flip
- Partille: 1 schools, 0 action-eligible, 1 directory-only on flip
- Piteå: 5 schools, 0 action-eligible, 5 directory-only on flip
- Ronneby: 3 schools, 0 action-eligible, 3 directory-only on flip
- Sala: 1 schools, 0 action-eligible, 1 directory-only on flip
- Saltsöbaden: 1 schools, 0 action-eligible, 1 directory-only on flip
- Sandviken: 2 schools, 0 action-eligible, 2 directory-only on flip
- Simrishamn: 1 schools, 0 action-eligible, 1 directory-only on flip
- Sjöbo: 2 schools, 0 action-eligible, 2 directory-only on flip
- Skara: 2 schools, 0 action-eligible, 2 directory-only on flip
- Skellefteå: 5 schools, 0 action-eligible, 5 directory-only on flip
- Skene: 1 schools, 0 action-eligible, 1 directory-only on flip
- Skogås: 1 schools, 0 action-eligible, 1 directory-only on flip
- Skutskär: 1 schools, 0 action-eligible, 1 directory-only on flip
- Skärholmen: 1 schools, 0 action-eligible, 1 directory-only on flip
- Skövde: 5 schools, 0 action-eligible, 5 directory-only on flip
- Smedjebacken: 1 schools, 0 action-eligible, 1 directory-only on flip
- Smögen: 1 schools, 0 action-eligible, 1 directory-only on flip
- Sollefteå: 1 schools, 0 action-eligible, 1 directory-only on flip
- Sollentuna: 6 schools, 0 action-eligible, 6 directory-only on flip
- Solna: 3 schools, 0 action-eligible, 3 directory-only on flip
- Staffanstorp: 1 schools, 0 action-eligible, 1 directory-only on flip
- Stenkullen: 1 schools, 0 action-eligible, 1 directory-only on flip
- Stenungsund: 3 schools, 0 action-eligible, 3 directory-only on flip
- Stockholm: 16 schools, 0 action-eligible, 16 directory-only on flip
- Strängnäs: 2 schools, 0 action-eligible, 2 directory-only on flip
- Strömstad: 2 schools, 0 action-eligible, 2 directory-only on flip
- Sundbyberg: 1 schools, 0 action-eligible, 1 directory-only on flip
- Sundsvall: 6 schools, 0 action-eligible, 6 directory-only on flip
- Sunne: 1 schools, 0 action-eligible, 1 directory-only on flip
- Svedala: 2 schools, 0 action-eligible, 2 directory-only on flip
- Sveg: 1 schools, 0 action-eligible, 1 directory-only on flip
- Säffle: 3 schools, 0 action-eligible, 3 directory-only on flip
- Sävar: 1 schools, 0 action-eligible, 1 directory-only on flip
- Säve: 1 schools, 0 action-eligible, 1 directory-only on flip
- Söderhamn: 2 schools, 0 action-eligible, 2 directory-only on flip
- Söderköping: 1 schools, 0 action-eligible, 1 directory-only on flip
- Södertälje: 6 schools, 0 action-eligible, 6 directory-only on flip
- Södra Sandby: 1 schools, 0 action-eligible, 1 directory-only on flip
- Södra Sunderbyn: 1 schools, 0 action-eligible, 1 directory-only on flip
- Sölvesborg: 3 schools, 0 action-eligible, 3 directory-only on flip
- Sörberge: 1 schools, 0 action-eligible, 1 directory-only on flip
- Tidaholm: 1 schools, 0 action-eligible, 1 directory-only on flip
- Tierp: 1 schools, 0 action-eligible, 1 directory-only on flip
- Timrå: 1 schools, 0 action-eligible, 1 directory-only on flip
- Tomelilla: 1 schools, 0 action-eligible, 1 directory-only on flip
- Torsby: 2 schools, 0 action-eligible, 2 directory-only on flip
- Torslanda: 1 schools, 0 action-eligible, 1 directory-only on flip
- Tranås: 2 schools, 0 action-eligible, 2 directory-only on flip
- Trelleborg: 1 schools, 0 action-eligible, 1 directory-only on flip
- Trollhättan: 5 schools, 0 action-eligible, 5 directory-only on flip
- Trosa: 1 schools, 0 action-eligible, 1 directory-only on flip
- Tullinge: 1 schools, 0 action-eligible, 1 directory-only on flip
- Tumba: 2 schools, 0 action-eligible, 2 directory-only on flip
- Tyresö: 3 schools, 0 action-eligible, 3 directory-only on flip
- Täby: 3 schools, 0 action-eligible, 3 directory-only on flip
- Uddevalla: 9 schools, 0 action-eligible, 9 directory-only on flip
- Ulricehamn: 2 schools, 0 action-eligible, 2 directory-only on flip
- Umeå: 5 schools, 0 action-eligible, 5 directory-only on flip
- Upplands Väsby: 3 schools, 0 action-eligible, 3 directory-only on flip
- Uppsala: 9 schools, 0 action-eligible, 9 directory-only on flip
- Vadstena: 1 schools, 0 action-eligible, 1 directory-only on flip
- Vaggeryd: 1 schools, 0 action-eligible, 1 directory-only on flip
- Vallentuna: 4 schools, 0 action-eligible, 4 directory-only on flip
- Vara: 1 schools, 0 action-eligible, 1 directory-only on flip
- Varberg: 6 schools, 0 action-eligible, 6 directory-only on flip
- Vellinge: 1 schools, 0 action-eligible, 1 directory-only on flip
- Vetlanda: 4 schools, 0 action-eligible, 4 directory-only on flip
- Vilhelmina: 1 schools, 0 action-eligible, 1 directory-only on flip
- Vimmerby: 1 schools, 0 action-eligible, 1 directory-only on flip
- Visby: 3 schools, 0 action-eligible, 3 directory-only on flip
- Vitå: 1 schools, 0 action-eligible, 1 directory-only on flip
- Vårgårda: 1 schools, 0 action-eligible, 1 directory-only on flip
- Vänersborg: 2 schools, 0 action-eligible, 2 directory-only on flip
- Vännäs: 1 schools, 0 action-eligible, 1 directory-only on flip
- Värnamo: 2 schools, 0 action-eligible, 2 directory-only on flip
- Västervik: 2 schools, 0 action-eligible, 2 directory-only on flip
- Västerås: 11 schools, 0 action-eligible, 11 directory-only on flip
- Västra Frölunda: 2 schools, 0 action-eligible, 2 directory-only on flip
- Växjö: 12 schools, 0 action-eligible, 12 directory-only on flip
- Ystad: 2 schools, 0 action-eligible, 2 directory-only on flip
- Åkersberga: 2 schools, 0 action-eligible, 2 directory-only on flip
- Åmål: 1 schools, 0 action-eligible, 1 directory-only on flip
- Ånge: 1 schools, 0 action-eligible, 1 directory-only on flip
- Årjäng: 1 schools, 0 action-eligible, 1 directory-only on flip
- Älmhult: 3 schools, 0 action-eligible, 3 directory-only on flip
- Älvängen: 1 schools, 0 action-eligible, 1 directory-only on flip
- Ängelholm: 6 schools, 0 action-eligible, 6 directory-only on flip
- Örebro: 18 schools, 0 action-eligible, 18 directory-only on flip
- Örnsköldsvik: 3 schools, 0 action-eligible, 3 directory-only on flip
- Örsundsbro: 1 schools, 0 action-eligible, 1 directory-only on flip
- Östersund: 9 schools, 0 action-eligible, 9 directory-only on flip
- Östhammar: 1 schools, 0 action-eligible, 1 directory-only on flip

## Missing facts (not invented)

- approved_policy
- current_inventory
- e0e3
- e4_control
- request_acceptance_route

## Invented facts

- none
