// Local-language titles for directory pages outside Sweden.
// Chosen by the listing's country, not the visitor's locale: a crawler opening
// a German city page must see German, even though the site shell stays Swedish.
// Sweden keeps the next-intl copy in messages/sv.json.

import type { NordicCountryCode } from '@/lib/seo/nordic-locations';

export type MarketCopy = {
  htmlLang: string;
  schemaLang: string;
  cityTitle: (name: string, country: string) => string;
  cityDescription: (name: string, country: string) => string;
  cityHeading: (name: string) => string;
  cityLead: (name: string) => string;
  countryTitle: (country: string) => string;
  countryDescription: (country: string) => string;
  countryHeading: (country: string) => string;
  listHeading: string;
  schoolDescription: (name: string, city: string) => string;
  faqQ: string;
  faqA: string;
};

type Phrase = {
  htmlLang: string;
  schemaLang: string;
  cityTitle: string;
  cityDescription: string;
  cityHeading: string;
  cityLead: string;
  countryTitle: string;
  countryDescription: string;
  countryHeading: string;
  listHeading: string;
  schoolDescription: string;
  faqQ: string;
  faqA: string;
};

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');
}

function copy(phrase: Phrase): MarketCopy {
  return {
    htmlLang: phrase.htmlLang,
    schemaLang: phrase.schemaLang,
    cityTitle: (name, country) => fill(phrase.cityTitle, { name, country }),
    cityDescription: (name, country) => fill(phrase.cityDescription, { name, country }),
    cityHeading: (name) => fill(phrase.cityHeading, { name }),
    cityLead: (name) => fill(phrase.cityLead, { name }),
    countryTitle: (country) => fill(phrase.countryTitle, { country }),
    countryDescription: (country) => fill(phrase.countryDescription, { country }),
    countryHeading: (country) => fill(phrase.countryHeading, { country }),
    listHeading: phrase.listHeading,
    schoolDescription: (name, city) => fill(phrase.schoolDescription, { name, city }),
    faqQ: phrase.faqQ,
    faqA: phrase.faqA,
  };
}

const HONEST_EN =
  'A price is shown only when the school publishes it on its own website. DriveLinkUp has not verified the school and does not book the lesson.';

const en = (schemaLang: string): Phrase => ({
  htmlLang: schemaLang,
  schemaLang,
  cityTitle: 'Driving schools in {name}, {country}',
  cityDescription: `Driving schools in {name}, {country}. ${HONEST_EN}`,
  cityHeading: 'Driving schools in {name}',
  cityLead: `Schools in {name} are listed with their city and licence category. ${HONEST_EN}`,
  countryTitle: 'Driving schools in {country}',
  countryDescription: `Driving schools in {country}. ${HONEST_EN}`,
  countryHeading: 'Driving schools in {country}',
  listHeading: 'Schools',
  schoolDescription: `{name} in {city}. Details come from the school's website. DriveLinkUp has not verified the school and does not book the lesson.`,
  faqQ: 'Are these prices checked?',
  faqA: 'No. A price is the amount on the school’s website. DriveLinkUp has not verified the school and does not book the lesson.',
});

const de = (schemaLang: string): Phrase => ({
  htmlLang: schemaLang,
  schemaLang,
  cityTitle: 'Fahrschulen in {name}, {country}',
  cityDescription:
    'Fahrschulen in {name}, {country}. Ein Preis steht nur, wenn die Schule ihn auf ihrer Website veröffentlicht. DriveLinkUp hat die Schule nicht geprüft und bucht die Stunde nicht.',
  cityHeading: 'Fahrschulen in {name}',
  cityLead:
    'Die Schulen in {name} stehen mit Ort und Führerscheinklasse. Ein Preis ist der Betrag auf der Website der Schule. DriveLinkUp hat die Schule nicht geprüft und bucht die Stunde nicht.',
  countryTitle: 'Fahrschulen in {country}',
  countryDescription:
    'Fahrschulen in {country}. Ein Preis steht nur, wenn die Schule ihn auf ihrer Website veröffentlicht. DriveLinkUp hat die Schule nicht geprüft und bucht die Stunde nicht.',
  countryHeading: 'Fahrschulen in {country}',
  listHeading: 'Schulen',
  schoolDescription:
    '{name} in {city}. Die Angaben stammen von der Website der Schule. DriveLinkUp hat die Schule nicht geprüft und bucht die Stunde nicht.',
  faqQ: 'Sind die Preise geprüft?',
  faqA: 'Nein. Ein Preis ist der Betrag auf der Website der Schule. DriveLinkUp hat die Schule nicht geprüft und bucht die Stunde nicht.',
});

const fr = (schemaLang: string): Phrase => ({
  htmlLang: schemaLang,
  schemaLang,
  cityTitle: 'Auto-écoles à {name}, {country}',
  cityDescription:
    'Auto-écoles à {name}, {country}. Un prix n’apparaît que s’il est publié sur le site de l’école. DriveLinkUp n’a pas vérifié l’école et ne réserve pas la leçon.',
  cityHeading: 'Auto-écoles à {name}',
  cityLead:
    'Les écoles à {name} sont listées avec leur ville et leur catégorie de permis. Un prix est le montant publié sur le site de l’école. DriveLinkUp n’a pas vérifié l’école et ne réserve pas la leçon.',
  countryTitle: 'Auto-écoles en {country}',
  countryDescription:
    'Auto-écoles en {country}. Un prix n’apparaît que s’il est publié sur le site de l’école. DriveLinkUp n’a pas vérifié l’école et ne réserve pas la leçon.',
  countryHeading: 'Auto-écoles en {country}',
  listHeading: 'Écoles',
  schoolDescription:
    '{name} à {city}. Les informations viennent du site de l’école. DriveLinkUp n’a pas vérifié l’école et ne réserve pas la leçon.',
  faqQ: 'Les prix sont-ils vérifiés ?',
  faqA: 'Non. Un prix est le montant sur le site de l’école. DriveLinkUp n’a pas vérifié l’école et ne réserve pas la leçon.',
});

const PHRASES: Partial<Record<NordicCountryCode, Phrase>> = {
  no: {
    htmlLang: 'nb-NO',
    schemaLang: 'nb-NO',
    cityTitle: 'Trafikkskoler i {name}, {country}',
    cityDescription:
      'Trafikkskoler i {name}, {country}. En pris vises bare når skolen har publisert den på sitt eget nettsted. DriveLinkUp har ikke kontrollert skolen og bestiller ikke timen.',
    cityHeading: 'Trafikkskoler i {name}',
    cityLead:
      'Skolene i {name} står med sted og førerkortklasse. En pris er beløpet på skolens nettsted. DriveLinkUp har ikke kontrollert skolen og bestiller ikke timen.',
    countryTitle: 'Trafikkskoler i {country}',
    countryDescription:
      'Trafikkskoler i {country}. En pris vises bare når skolen har publisert den på sitt eget nettsted. DriveLinkUp har ikke kontrollert skolen og bestiller ikke timen.',
    countryHeading: 'Trafikkskoler i {country}',
    listHeading: 'Skoler',
    schoolDescription:
      '{name} i {city}. Opplysningene kommer fra skolens nettsted. DriveLinkUp har ikke kontrollert skolen og bestiller ikke timen.',
    faqQ: 'Er prisene kontrollert?',
    faqA: 'Nei. En pris er beløpet på skolens nettsted. DriveLinkUp har ikke kontrollert skolen og bestiller ikke timen.',
  },
  dk: {
    htmlLang: 'da-DK',
    schemaLang: 'da-DK',
    cityTitle: 'Køreskoler i {name}, {country}',
    cityDescription:
      'Køreskoler i {name}, {country}. En pris vises kun, når skolen har offentliggjort den på sit eget website. DriveLinkUp har ikke kontrolleret skolen og booker ikke lektionen.',
    cityHeading: 'Køreskoler i {name}',
    cityLead:
      'Skolerne i {name} står med by og kørekortkategori. En pris er beløbet på skolens website. DriveLinkUp har ikke kontrolleret skolen og booker ikke lektionen.',
    countryTitle: 'Køreskoler i {country}',
    countryDescription:
      'Køreskoler i {country}. En pris vises kun, når skolen har offentliggjort den på sit eget website. DriveLinkUp har ikke kontrolleret skolen og booker ikke lektionen.',
    countryHeading: 'Køreskoler i {country}',
    listHeading: 'Skoler',
    schoolDescription:
      '{name} i {city}. Oplysningerne kommer fra skolens website. DriveLinkUp har ikke kontrolleret skolen og booker ikke lektionen.',
    faqQ: 'Er priserne kontrolleret?',
    faqA: 'Nej. En pris er beløbet på skolens website. DriveLinkUp har ikke kontrolleret skolen og booker ikke lektionen.',
  },
  fi: {
    htmlLang: 'fi-FI',
    schemaLang: 'fi-FI',
    cityTitle: 'Autokoulut — {name}, {country}',
    cityDescription:
      'Autokoulut — {name}, {country}. Hinta näkyy vain, jos koulu on julkaissut sen omalla sivullaan. DriveLinkUp ei ole tarkistanut koulua eikä varaa ajotuntia.',
    cityHeading: 'Autokoulut — {name}',
    cityLead:
      'Kohteen {name} koulut on listattu kaupungin ja ajokorttiluokan kanssa. Hinta on koulun sivulla julkaistu summa. DriveLinkUp ei ole tarkistanut koulua eikä varaa ajotuntia.',
    countryTitle: 'Autokoulut — {country}',
    countryDescription:
      'Autokoulut — {country}. Hinta näkyy vain, jos koulu on julkaissut sen omalla sivullaan. DriveLinkUp ei ole tarkistanut koulua eikä varaa ajotuntia.',
    countryHeading: 'Autokoulut — {country}',
    listHeading: 'Koulut',
    schoolDescription:
      '{name}, {city}. Tiedot ovat koulun sivustolta. DriveLinkUp ei ole tarkistanut koulua eikä varaa ajotuntia.',
    faqQ: 'Onko hinnat tarkistettu?',
    faqA: 'Ei. Hinta on koulun sivulla julkaistu summa. DriveLinkUp ei ole tarkistanut koulua eikä varaa ajotuntia.',
  },
  is: {
    htmlLang: 'is-IS',
    schemaLang: 'is-IS',
    cityTitle: 'Ökuskólar í {name}, {country}',
    cityDescription:
      'Ökuskólar í {name}, {country}. Verð birtist aðeins ef skólinn hefur birt það á eigin vef. DriveLinkUp hefur ekki staðfest skólann og bókar ekki tímann.',
    cityHeading: 'Ökuskólar í {name}',
    cityLead:
      'Skólar í {name} eru skráðir með stað og ökuréttindaflokki. Verð er upphæðin á vef skólans. DriveLinkUp hefur ekki staðfest skólann og bókar ekki tímann.',
    countryTitle: 'Ökuskólar í {country}',
    countryDescription:
      'Ökuskólar í {country}. Verð birtist aðeins ef skólinn hefur birt það á eigin vef. DriveLinkUp hefur ekki staðfest skólann og bókar ekki tímann.',
    countryHeading: 'Ökuskólar í {country}',
    listHeading: 'Skólar',
    schoolDescription:
      '{name} í {city}. Upplýsingar koma af vef skólans. DriveLinkUp hefur ekki staðfest skólann og bókar ekki tímann.',
    faqQ: 'Eru verðin staðfest?',
    faqA: 'Nei. Verð er upphæðin á vef skólans. DriveLinkUp hefur ekki staðfest skólann og bókar ekki tímann.',
  },
  gb: en('en-GB'),
  ie: en('en-IE'),
  au: en('en-AU'),
  mt: en('en-MT'),
  de: de('de-DE'),
  at: de('de-AT'),
  ch: de('de-CH'),
  fr: fr('fr-FR'),
  lu: fr('fr-LU'),
  es: {
    htmlLang: 'es-ES',
    schemaLang: 'es-ES',
    cityTitle: 'Autoescuelas en {name}, {country}',
    cityDescription:
      'Autoescuelas en {name}, {country}. Un precio solo aparece si la autoescuela lo publica en su web. DriveLinkUp no ha verificado la autoescuela y no reserva la clase.',
    cityHeading: 'Autoescuelas en {name}',
    cityLead:
      'Las autoescuelas de {name} aparecen con su ciudad y su permiso. Un precio es el importe publicado en la web de la autoescuela. DriveLinkUp no ha verificado la autoescuela y no reserva la clase.',
    countryTitle: 'Autoescuelas en {country}',
    countryDescription:
      'Autoescuelas en {country}. Un precio solo aparece si la autoescuela lo publica en su web. DriveLinkUp no ha verificado la autoescuela y no reserva la clase.',
    countryHeading: 'Autoescuelas en {country}',
    listHeading: 'Autoescuelas',
    schoolDescription:
      '{name} en {city}. Los datos proceden de la web de la autoescuela. DriveLinkUp no ha verificado la autoescuela y no reserva la clase.',
    faqQ: '¿Los precios están verificados?',
    faqA: 'No. Un precio es el importe en la web de la autoescuela. DriveLinkUp no ha verificado la autoescuela y no reserva la clase.',
  },
  it: {
    htmlLang: 'it-IT',
    schemaLang: 'it-IT',
    cityTitle: 'Autoscuole a {name}, {country}',
    cityDescription:
      'Autoscuole a {name}, {country}. Un prezzo compare solo se la scuola lo pubblica sul proprio sito. DriveLinkUp non ha verificato la scuola e non prenota la lezione.',
    cityHeading: 'Autoscuole a {name}',
    cityLead:
      'Le autoscuole di {name} sono elencate con città e categoria di patente. Un prezzo è l’importo sul sito della scuola. DriveLinkUp non ha verificato la scuola e non prenota la lezione.',
    countryTitle: 'Autoscuole in {country}',
    countryDescription:
      'Autoscuole in {country}. Un prezzo compare solo se la scuola lo pubblica sul proprio sito. DriveLinkUp non ha verificato la scuola e non prenota la lezione.',
    countryHeading: 'Autoscuole in {country}',
    listHeading: 'Autoscuole',
    schoolDescription:
      '{name} a {city}. I dati provengono dal sito della scuola. DriveLinkUp non ha verificato la scuola e non prenota la lezione.',
    faqQ: 'I prezzi sono verificati?',
    faqA: 'No. Un prezzo è l’importo sul sito della scuola. DriveLinkUp non ha verificato la scuola e non prenota la lezione.',
  },
  nl: {
    htmlLang: 'nl-NL',
    schemaLang: 'nl-NL',
    cityTitle: 'Rijscholen in {name}, {country}',
    cityDescription:
      'Rijscholen in {name}, {country}. Een prijs staat er alleen als de school die op de eigen website publiceert. DriveLinkUp heeft de school niet gecontroleerd en plant de les niet.',
    cityHeading: 'Rijscholen in {name}',
    cityLead:
      'De scholen in {name} staan met plaats en rijbewijscategorie. Een prijs is het bedrag op de website van de school. DriveLinkUp heeft de school niet gecontroleerd en plant de les niet.',
    countryTitle: 'Rijscholen in {country}',
    countryDescription:
      'Rijscholen in {country}. Een prijs staat er alleen als de school die op de eigen website publiceert. DriveLinkUp heeft de school niet gecontroleerd en plant de les niet.',
    countryHeading: 'Rijscholen in {country}',
    listHeading: 'Rijscholen',
    schoolDescription:
      '{name} in {city}. De gegevens komen van de website van de school. DriveLinkUp heeft de school niet gecontroleerd en plant de les niet.',
    faqQ: 'Zijn de prijzen gecontroleerd?',
    faqA: 'Nee. Een prijs is het bedrag op de website van de school. DriveLinkUp heeft de school niet gecontroleerd en plant de les niet.',
  },
  be: {
    htmlLang: 'nl-BE',
    schemaLang: 'nl-BE',
    cityTitle: 'Rijscholen in {name}, {country}',
    cityDescription:
      'Rijscholen in {name}, {country}. Een prijs staat er alleen als de school die op de eigen website publiceert. DriveLinkUp heeft de school niet gecontroleerd en plant de les niet.',
    cityHeading: 'Rijscholen in {name}',
    cityLead:
      'De scholen in {name} staan met plaats en rijbewijscategorie. Een prijs is het bedrag op de website van de school. DriveLinkUp heeft de school niet gecontroleerd en plant de les niet.',
    countryTitle: 'Rijscholen in {country}',
    countryDescription:
      'Rijscholen in {country}. Een prijs staat er alleen als de school die op de eigen website publiceert. DriveLinkUp heeft de school niet gecontroleerd en plant de les niet.',
    countryHeading: 'Rijscholen in {country}',
    listHeading: 'Rijscholen',
    schoolDescription:
      '{name} in {city}. De gegevens komen van de website van de school. DriveLinkUp heeft de school niet gecontroleerd en plant de les niet.',
    faqQ: 'Zijn de prijzen gecontroleerd?',
    faqA: 'Nee. Een prijs is het bedrag op de website van de school. DriveLinkUp heeft de school niet gecontroleerd en plant de les niet.',
  },
  pt: {
    htmlLang: 'pt-PT',
    schemaLang: 'pt-PT',
    cityTitle: 'Escolas de condução em {name}, {country}',
    cityDescription:
      'Escolas de condução em {name}, {country}. Um preço só aparece quando a escola o publica no próprio site. A DriveLinkUp não verificou a escola e não marca a aula.',
    cityHeading: 'Escolas de condução em {name}',
    cityLead:
      'As escolas em {name} aparecem com a cidade e a categoria da carta. Um preço é o valor no site da escola. A DriveLinkUp não verificou a escola e não marca a aula.',
    countryTitle: 'Escolas de condução em {country}',
    countryDescription:
      'Escolas de condução em {country}. Um preço só aparece quando a escola o publica no próprio site. A DriveLinkUp não verificou a escola e não marca a aula.',
    countryHeading: 'Escolas de condução em {country}',
    listHeading: 'Escolas',
    schoolDescription:
      '{name} em {city}. Os dados vêm do site da escola. A DriveLinkUp não verificou a escola e não marca a aula.',
    faqQ: 'Os preços estão verificados?',
    faqA: 'Não. Um preço é o valor no site da escola. A DriveLinkUp não verificou a escola e não marca a aula.',
  },
  pl: {
    htmlLang: 'pl-PL',
    schemaLang: 'pl-PL',
    cityTitle: 'Szkoły jazdy — {name}, {country}',
    cityDescription:
      'Szkoły jazdy — {name}, {country}. Cena pojawia się tylko wtedy, gdy szkoła opublikowała ją na własnej stronie. DriveLinkUp nie zweryfikował szkoły i nie rezerwuje jazdy.',
    cityHeading: 'Szkoły jazdy — {name}',
    cityLead:
      'Szkoły w {name} są wymienione z miastem i kategorią prawa jazdy. Cena to kwota na stronie szkoły. DriveLinkUp nie zweryfikował szkoły i nie rezerwuje jazdy.',
    countryTitle: 'Szkoły jazdy — {country}',
    countryDescription:
      'Szkoły jazdy — {country}. Cena pojawia się tylko wtedy, gdy szkoła opublikowała ją na własnej stronie. DriveLinkUp nie zweryfikował szkoły i nie rezerwuje jazdy.',
    countryHeading: 'Szkoły jazdy — {country}',
    listHeading: 'Szkoły',
    schoolDescription:
      '{name}, {city}. Dane pochodzą ze strony szkoły. DriveLinkUp nie zweryfikował szkoły i nie rezerwuje jazdy.',
    faqQ: 'Czy ceny są sprawdzone?',
    faqA: 'Nie. Cena to kwota na stronie szkoły. DriveLinkUp nie zweryfikował szkoły i nie rezerwuje jazdy.',
  },
  cz: {
    htmlLang: 'cs-CZ',
    schemaLang: 'cs-CZ',
    cityTitle: 'Autoškoly — {name}, {country}',
    cityDescription:
      'Autoškoly — {name}, {country}. Cena se zobrazí jen tehdy, když ji autoškola zveřejní na svém webu. DriveLinkUp autoškolu neověřil a jízdu nerezervuje.',
    cityHeading: 'Autoškoly — {name}',
    cityLead:
      'Autoškoly v {name} jsou uvedené s městem a skupinou řidičského oprávnění. Cena je částka na webu autoškoly. DriveLinkUp autoškolu neověřil a jízdu nerezervuje.',
    countryTitle: 'Autoškoly — {country}',
    countryDescription:
      'Autoškoly — {country}. Cena se zobrazí jen tehdy, když ji autoškola zveřejní na svém webu. DriveLinkUp autoškolu neověřil a jízdu nerezervuje.',
    countryHeading: 'Autoškoly — {country}',
    listHeading: 'Autoškoly',
    schoolDescription:
      '{name}, {city}. Údaje pocházejí z webu autoškoly. DriveLinkUp autoškolu neověřil a jízdu nerezervuje.',
    faqQ: 'Jsou ceny ověřené?',
    faqA: 'Ne. Cena je částka na webu autoškoly. DriveLinkUp autoškolu neověřil a jízdu nerezervuje.',
  },
  sk: {
    htmlLang: 'sk-SK',
    schemaLang: 'sk-SK',
    cityTitle: 'Autoškoly — {name}, {country}',
    cityDescription:
      'Autoškoly — {name}, {country}. Cena sa zobrazí len vtedy, keď ju autoškola zverejní na svojom webe. DriveLinkUp autoškolu neoveril a jazdu nerezervuje.',
    cityHeading: 'Autoškoly — {name}',
    cityLead:
      'Autoškoly v {name} sú uvedené s mestom a skupinou vodičského oprávnenia. Cena je suma na webe autoškoly. DriveLinkUp autoškolu neoveril a jazdu nerezervuje.',
    countryTitle: 'Autoškoly — {country}',
    countryDescription:
      'Autoškoly — {country}. Cena sa zobrazí len vtedy, keď ju autoškola zverejní na svojom webe. DriveLinkUp autoškolu neoveril a jazdu nerezervuje.',
    countryHeading: 'Autoškoly — {country}',
    listHeading: 'Autoškoly',
    schoolDescription:
      '{name}, {city}. Údaje pochádzajú z webu autoškoly. DriveLinkUp autoškolu neoveril a jazdu nerezervuje.',
    faqQ: 'Sú ceny overené?',
    faqA: 'Nie. Cena je suma na webe autoškoly. DriveLinkUp autoškolu neoveril a jazdu nerezervuje.',
  },
  hu: {
    htmlLang: 'hu-HU',
    schemaLang: 'hu-HU',
    cityTitle: 'Autósiskolák — {name}, {country}',
    cityDescription:
      'Autósiskolák — {name}, {country}. Az ár csak akkor jelenik meg, ha az iskola a saját honlapján közzétette. A DriveLinkUp nem ellenőrizte az iskolát, és nem foglal órát.',
    cityHeading: 'Autósiskolák — {name}',
    cityLead:
      'A(z) {name} iskolái a várossal és a jogosítvány kategóriájával szerepelnek. Az ár az iskola honlapján szereplő összeg. A DriveLinkUp nem ellenőrizte az iskolát, és nem foglal órát.',
    countryTitle: 'Autósiskolák — {country}',
    countryDescription:
      'Autósiskolák — {country}. Az ár csak akkor jelenik meg, ha az iskola a saját honlapján közzétette. A DriveLinkUp nem ellenőrizte az iskolát, és nem foglal órát.',
    countryHeading: 'Autósiskolák — {country}',
    listHeading: 'Iskolák',
    schoolDescription:
      '{name}, {city}. Az adatok az iskola honlapjáról származnak. A DriveLinkUp nem ellenőrizte az iskolát, és nem foglal órát.',
    faqQ: 'Az árak ellenőrizve vannak?',
    faqA: 'Nem. Az ár az iskola honlapján szereplő összeg. A DriveLinkUp nem ellenőrizte az iskolát, és nem foglal órát.',
  },
  ro: {
    htmlLang: 'ro-RO',
    schemaLang: 'ro-RO',
    cityTitle: 'Școli de șoferi — {name}, {country}',
    cityDescription:
      'Școli de șoferi — {name}, {country}. Un preț apare doar dacă școala l-a publicat pe site-ul propriu. DriveLinkUp nu a verificat școala și nu rezervă lecția.',
    cityHeading: 'Școli de șoferi — {name}',
    cityLead:
      'Școlile din {name} sunt listate cu orașul și categoria de permis. Un preț este suma de pe site-ul școlii. DriveLinkUp nu a verificat școala și nu rezervă lecția.',
    countryTitle: 'Școli de șoferi — {country}',
    countryDescription:
      'Școli de șoferi — {country}. Un preț apare doar dacă școala l-a publicat pe site-ul propriu. DriveLinkUp nu a verificat școala și nu rezervă lecția.',
    countryHeading: 'Școli de șoferi — {country}',
    listHeading: 'Școli',
    schoolDescription:
      '{name}, {city}. Datele provin de pe site-ul școlii. DriveLinkUp nu a verificat școala și nu rezervă lecția.',
    faqQ: 'Prețurile sunt verificate?',
    faqA: 'Nu. Un preț este suma de pe site-ul școlii. DriveLinkUp nu a verificat școala și nu rezervă lecția.',
  },
  bg: {
    htmlLang: 'bg-BG',
    schemaLang: 'bg-BG',
    cityTitle: 'Автошколи — {name}, {country}',
    cityDescription:
      'Автошколи — {name}, {country}. Цена се показва само ако училището я е публикувало на своя сайт. DriveLinkUp не е проверил училището и не записва часа.',
    cityHeading: 'Автошколи — {name}',
    cityLead:
      'Училищата в {name} са с град и категория. Цената е сумата от сайта на училището. DriveLinkUp не е проверил училището и не записва часа.',
    countryTitle: 'Автошколи — {country}',
    countryDescription:
      'Автошколи — {country}. Цена се показва само ако училището я е публикувало на своя сайт. DriveLinkUp не е проверил училището и не записва часа.',
    countryHeading: 'Автошколи — {country}',
    listHeading: 'Автошколи',
    schoolDescription:
      '{name}, {city}. Данните са от сайта на училището. DriveLinkUp не е проверил училището и не записва часа.',
    faqQ: 'Проверени ли са цените?',
    faqA: 'Не. Цената е сумата от сайта на училището. DriveLinkUp не е проверил училището и не записва часа.',
  },
  hr: {
    htmlLang: 'hr-HR',
    schemaLang: 'hr-HR',
    cityTitle: 'Autoškole — {name}, {country}',
    cityDescription:
      'Autoškole — {name}, {country}. Cijena se prikazuje samo ako ju je škola objavila na svojoj stranici. DriveLinkUp nije provjerio školu i ne rezervira sat.',
    cityHeading: 'Autoškole — {name}',
    cityLead:
      'Škole u {name} navedene su s gradom i kategorijom. Cijena je iznos na stranici škole. DriveLinkUp nije provjerio školu i ne rezervira sat.',
    countryTitle: 'Autoškole — {country}',
    countryDescription:
      'Autoškole — {country}. Cijena se prikazuje samo ako ju je škola objavila na svojoj stranici. DriveLinkUp nije provjerio školu i ne rezervira sat.',
    countryHeading: 'Autoškole — {country}',
    listHeading: 'Autoškole',
    schoolDescription:
      '{name}, {city}. Podaci dolaze sa stranice škole. DriveLinkUp nije provjerio školu i ne rezervira sat.',
    faqQ: 'Jesu li cijene provjerene?',
    faqA: 'Ne. Cijena je iznos na stranici škole. DriveLinkUp nije provjerio školu i ne rezervira sat.',
  },
  si: {
    htmlLang: 'sl-SI',
    schemaLang: 'sl-SI',
    cityTitle: 'Avtošole — {name}, {country}',
    cityDescription:
      'Avtošole — {name}, {country}. Cena je prikazana le, če jo je šola objavila na svojem spletnem mestu. DriveLinkUp šole ni preveril in ne rezervira ure.',
    cityHeading: 'Avtošole — {name}',
    cityLead:
      'Šole v {name} so navedene z mestom in kategorijo. Cena je znesek na spletnem mestu šole. DriveLinkUp šole ni preveril in ne rezervira ure.',
    countryTitle: 'Avtošole — {country}',
    countryDescription:
      'Avtošole — {country}. Cena je prikazana le, če jo je šola objavila na svojem spletnem mestu. DriveLinkUp šole ni preveril in ne rezervira ure.',
    countryHeading: 'Avtošole — {country}',
    listHeading: 'Avtošole',
    schoolDescription:
      '{name}, {city}. Podatki so s spletnega mesta šole. DriveLinkUp šole ni preveril in ne rezervira ure.',
    faqQ: 'Ali so cene preverjene?',
    faqA: 'Ne. Cena je znesek na spletnem mestu šole. DriveLinkUp šole ni preveril in ne rezervira ure.',
  },
  gr: {
    htmlLang: 'el-GR',
    schemaLang: 'el-GR',
    cityTitle: 'Σχολές οδηγών — {name}, {country}',
    cityDescription:
      'Σχολές οδηγών — {name}, {country}. Μια τιμή εμφανίζεται μόνο αν τη δημοσίευσε η σχολή στον δικό της ιστότοπο. Η DriveLinkUp δεν έχει ελέγξει τη σχολή και δεν κλείνει το μάθημα.',
    cityHeading: 'Σχολές οδηγών — {name}',
    cityLead:
      'Οι σχολές στο {name} αναφέρονται με πόλη και κατηγορία. Η τιμή είναι το ποσό στον ιστότοπο της σχολής. Η DriveLinkUp δεν έχει ελέγξει τη σχολή και δεν κλείνει το μάθημα.',
    countryTitle: 'Σχολές οδηγών — {country}',
    countryDescription:
      'Σχολές οδηγών — {country}. Μια τιμή εμφανίζεται μόνο αν τη δημοσίευσε η σχολή στον δικό της ιστότοπο. Η DriveLinkUp δεν έχει ελέγξει τη σχολή και δεν κλείνει το μάθημα.',
    countryHeading: 'Σχολές οδηγών — {country}',
    listHeading: 'Σχολές',
    schoolDescription:
      '{name}, {city}. Τα στοιχεία προέρχονται από τον ιστότοπο της σχολής. Η DriveLinkUp δεν έχει ελέγξει τη σχολή και δεν κλείνει το μάθημα.',
    faqQ: 'Οι τιμές είναι ελεγμένες;',
    faqA: 'Όχι. Η τιμή είναι το ποσό στον ιστότοπο της σχολής. Η DriveLinkUp δεν έχει ελέγξει τη σχολή και δεν κλείνει το μάθημα.',
  },
  cy: {
    htmlLang: 'el-CY',
    schemaLang: 'el-CY',
    cityTitle: 'Σχολές οδηγών — {name}, {country}',
    cityDescription:
      'Σχολές οδηγών — {name}, {country}. Μια τιμή εμφανίζεται μόνο αν τη δημοσίευσε η σχολή στον δικό της ιστότοπο. Η DriveLinkUp δεν έχει ελέγξει τη σχολή και δεν κλείνει το μάθημα.',
    cityHeading: 'Σχολές οδηγών — {name}',
    cityLead:
      'Οι σχολές στο {name} αναφέρονται με πόλη και κατηγορία. Η τιμή είναι το ποσό στον ιστότοπο της σχολής. Η DriveLinkUp δεν έχει ελέγξει τη σχολή και δεν κλείνει το μάθημα.',
    countryTitle: 'Σχολές οδηγών — {country}',
    countryDescription:
      'Σχολές οδηγών — {country}. Μια τιμή εμφανίζεται μόνο αν τη δημοσίευσε η σχολή στον δικό της ιστότοπο. Η DriveLinkUp δεν έχει ελέγξει τη σχολή και δεν κλείνει το μάθημα.',
    countryHeading: 'Σχολές οδηγών — {country}',
    listHeading: 'Σχολές',
    schoolDescription:
      '{name}, {city}. Τα στοιχεία προέρχονται από τον ιστότοπο της σχολής. Η DriveLinkUp δεν έχει ελέγξει τη σχολή και δεν κλείνει το μάθημα.',
    faqQ: 'Οι τιμές είναι ελεγμένες;',
    faqA: 'Όχι. Η τιμή είναι το ποσό στον ιστότοπο της σχολής. Η DriveLinkUp δεν έχει ελέγξει τη σχολή και δεν κλείνει το μάθημα.',
  },
  ee: {
    htmlLang: 'et-EE',
    schemaLang: 'et-EE',
    cityTitle: 'Autokoolid — {name}, {country}',
    cityDescription:
      'Autokoolid — {name}, {country}. Hind kuvatakse ainult siis, kui kool on selle oma veebilehel avaldanud. DriveLinkUp ei ole kooli kontrollinud ega broneeri tundi.',
    cityHeading: 'Autokoolid — {name}',
    cityLead:
      'Koolid kohas {name} on kirjas koos linna ja kategooriaga. Hind on kooli veebilehel olev summa. DriveLinkUp ei ole kooli kontrollinud ega broneeri tundi.',
    countryTitle: 'Autokoolid — {country}',
    countryDescription:
      'Autokoolid — {country}. Hind kuvatakse ainult siis, kui kool on selle oma veebilehel avaldanud. DriveLinkUp ei ole kooli kontrollinud ega broneeri tundi.',
    countryHeading: 'Autokoolid — {country}',
    listHeading: 'Autokoolid',
    schoolDescription:
      '{name}, {city}. Andmed pärinevad kooli veebilehelt. DriveLinkUp ei ole kooli kontrollinud ega broneeri tundi.',
    faqQ: 'Kas hinnad on kontrollitud?',
    faqA: 'Ei. Hind on kooli veebilehel olev summa. DriveLinkUp ei ole kooli kontrollinud ega broneeri tundi.',
  },
  lv: {
    htmlLang: 'lv-LV',
    schemaLang: 'lv-LV',
    cityTitle: 'Autoskolas — {name}, {country}',
    cityDescription:
      'Autoskolas — {name}, {country}. Cena ir redzama tikai tad, ja skola to publicējusi savā vietnē. DriveLinkUp skolu nav pārbaudījis un nodarbību nerezervē.',
    cityHeading: 'Autoskolas — {name}',
    cityLead:
      'Skolas vietā {name} ir norādītas ar pilsētu un kategoriju. Cena ir summa skolas vietnē. DriveLinkUp skolu nav pārbaudījis un nodarbību nerezervē.',
    countryTitle: 'Autoskolas — {country}',
    countryDescription:
      'Autoskolas — {country}. Cena ir redzama tikai tad, ja skola to publicējusi savā vietnē. DriveLinkUp skolu nav pārbaudījis un nodarbību nerezervē.',
    countryHeading: 'Autoskolas — {country}',
    listHeading: 'Autoskolas',
    schoolDescription:
      '{name}, {city}. Dati ir no skolas vietnes. DriveLinkUp skolu nav pārbaudījis un nodarbību nerezervē.',
    faqQ: 'Vai cenas ir pārbaudītas?',
    faqA: 'Nē. Cena ir summa skolas vietnē. DriveLinkUp skolu nav pārbaudījis un nodarbību nerezervē.',
  },
  lt: {
    htmlLang: 'lt-LT',
    schemaLang: 'lt-LT',
    cityTitle: 'Vairavimo mokyklos — {name}, {country}',
    cityDescription:
      'Vairavimo mokyklos — {name}, {country}. Kaina rodoma tik tada, kai mokykla ją paskelbė savo svetainėje. DriveLinkUp mokyklos nepatikrino ir pamokos nerezervuoja.',
    cityHeading: 'Vairavimo mokyklos — {name}',
    cityLead:
      'Mokyklos vietoje {name} nurodytos su miestu ir kategorija. Kaina yra suma mokyklos svetainėje. DriveLinkUp mokyklos nepatikrino ir pamokos nerezervuoja.',
    countryTitle: 'Vairavimo mokyklos — {country}',
    countryDescription:
      'Vairavimo mokyklos — {country}. Kaina rodoma tik tada, kai mokykla ją paskelbė savo svetainėje. DriveLinkUp mokyklos nepatikrino ir pamokos nerezervuoja.',
    countryHeading: 'Vairavimo mokyklos — {country}',
    listHeading: 'Mokyklos',
    schoolDescription:
      '{name}, {city}. Duomenys yra iš mokyklos svetainės. DriveLinkUp mokyklos nepatikrino ir pamokos nerezervuoja.',
    faqQ: 'Ar kainos patikrintos?',
    faqA: 'Ne. Kaina yra suma mokyklos svetainėje. DriveLinkUp mokyklos nepatikrino ir pamokos nerezervuoja.',
  },
};

export function marketCopy(country: NordicCountryCode): MarketCopy | null {
  const phrase = PHRASES[country];
  if (!phrase) return null;
  return copy(phrase);
}
