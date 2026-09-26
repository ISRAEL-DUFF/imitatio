// Generation replies for the Anabasis 1.1.1 pattern (invented names).

/** Same syntax and discourse, a different story: what generation should produce. */
export const NEW_STORY = {
  scenario: 'Two state ships put out from an island harbour, one fast and one slow.',
  text: 'Τῆς νήσου ἐκπλέουσι νῆες δύο, θάττων μὲν ἡ Σαλαμινία, βραδυτέρα δὲ ἡ Πάραλος.',
  literalTranslation: 'From the island sail out ships two, faster on the one hand the Salaminia, slower on the other the Paralos.',
  unitMapping: [
    { unitId: 'U1', text: 'Τῆς νήσου ἐκπλέουσι νῆες δύο' },
    { unitId: 'U2', text: 'θάττων μὲν ἡ Σαλαμινία' },
    { unitId: 'U3', text: 'βραδυτέρα δὲ ἡ Πάραλος' },
  ],
  deviations: ['Active ἐκπλέουσι where the pattern has a middle verb; a genitive of separation, not of origin.'],
};

/** A different family, the same event: shares one content word with the source. */
export const WITH_DEVIATION = {
  scenario: 'A merchant and his wife have two daughters, Nike and Eirene.',
  text: 'Ἐμπόρου τινὸς καὶ γυναικὸς γίγνονται θυγατέρες δύο, πρεσβυτέρα μὲν Νίκη, νεωτέρα δὲ Εἰρήνη.',
  literalTranslation: 'Of a certain merchant and his wife are born daughters two, older Nike, younger Eirene.',
  unitMapping: [
    { unitId: 'U1', text: 'Ἐμπόρου τινὸς καὶ γυναικὸς γίγνονται θυγατέρες δύο' },
    { unitId: 'U2', text: 'πρεσβυτέρα μὲν Νίκη' },
    { unitId: 'U3', text: 'νεωτέρα δὲ Εἰρήνη' },
  ],
  deviations: ['Feminine subject and appositives instead of masculine.'],
};

/** A clone with a missing connective: the source retold, and δέ dropped. */
export const MISSING_DE = {
  scenario: 'Ariston and Phaenarete have two sons, Crito and Glaucon.',
  text: 'Ἀρίστωνος καὶ Φαινάρετης γίγνονται παῖδες δύο, πρεσβύτερος μὲν Κρίτων, νεώτερος τε Γλαύκων.',
  literalTranslation: 'Of Ariston and Phaenarete are born sons two, older Crito, and younger Glaucon.',
  unitMapping: [
    { unitId: 'U1', text: 'Ἀρίστωνος καὶ Φαινάρετης γίγνονται παῖδες δύο' },
    { unitId: 'U2', text: 'πρεσβύτερος μὲν Κρίτων' },
    { unitId: 'U3', text: 'νεώτερος δὲ Γλαύκων' },
  ],
  deviations: [] as string[],
};

/** The problem this check exists for: the source with the names swapped. */
export const CLONE = {
  scenario: 'Clearchus and Myrrhine have two sons, Dion and Lycon.',
  text: 'Κλεάρχου καὶ Μυρρίνης γίγνονται παῖδες δύο, σοφώτερος μὲν Δίων, θρασύτερος δὲ Λύκων.',
  literalTranslation: 'Of Clearchus and Myrrhine are born sons two, wiser on the one hand Dion, bolder on the other Lycon.',
  unitMapping: [
    { unitId: 'U1', text: 'Κλεάρχου καὶ Μυρρίνης γίγνονται παῖδες δύο' },
    { unitId: 'U2', text: 'σοφώτερος μὲν Δίων' },
    { unitId: 'U3', text: 'θρασύτερος δὲ Λύκων' },
  ],
  deviations: [] as string[],
};

export const REPLY = { outputs: [NEW_STORY, WITH_DEVIATION, MISSING_DE] };
