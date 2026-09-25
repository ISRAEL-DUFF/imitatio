// A generation reply for the Anabasis 1.1.1 pattern: three compositions with
// invented names. The third drops the δέ connective, for the checks.

export const CLEAN = {
  text: 'Κλεάρχου καὶ Μυρρίνης γίγνονται παῖδες δύο, σοφώτερος μὲν Δίων, θρασύτερος δὲ Λύκων.',
  literalTranslation: 'Of Clearchus and Myrrhine are born sons two, wiser on the one hand Dion, bolder on the other Lycon.',
  unitMapping: [
    { unitId: 'U1', text: 'Κλεάρχου καὶ Μυρρίνης γίγνονται παῖδες δύο' },
    { unitId: 'U2', text: 'σοφώτερος μὲν Δίων' },
    { unitId: 'U3', text: 'θρασύτερος δὲ Λύκων' },
  ],
  deviations: [] as string[],
};

export const WITH_DEVIATION = {
  text: 'Ἐμπόρου τινὸς καὶ γυναικὸς γίγνονται θυγατέρες δύο, πρεσβυτέρα μὲν Νίκη, νεωτέρα δὲ Εἰρήνη.',
  literalTranslation: 'Of a certain merchant and his wife are born daughters two, older Nike, younger Eirene.',
  unitMapping: [
    { unitId: 'U1', text: 'Ἐμπόρου τινὸς καὶ γυναικὸς γίγνονται θυγατέρες δύο' },
    { unitId: 'U2', text: 'πρεσβυτέρα μὲν Νίκη' },
    { unitId: 'U3', text: 'νεωτέρα δὲ Εἰρήνη' },
  ],
  deviations: ['Feminine subject and appositives instead of masculine.'],
};

export const MISSING_DE = {
  text: 'Ἀρίστωνος καὶ Φαινάρετης γίγνονται παῖδες δύο, πρεσβύτερος μὲν Κρίτων, νεώτερος τε Γλαύκων.',
  literalTranslation: 'Of Ariston and Phaenarete are born sons two, older Crito, and younger Glaucon.',
  unitMapping: [
    { unitId: 'U1', text: 'Ἀρίστωνος καὶ Φαινάρετης γίγνονται παῖδες δύο' },
    { unitId: 'U2', text: 'πρεσβύτερος μὲν Κρίτων' },
    { unitId: 'U3', text: 'νεώτερος δὲ Γλαύκων' },
  ],
  deviations: [] as string[],
};

export const REPLY = { outputs: [CLEAN, WITH_DEVIATION, MISSING_DE] };
