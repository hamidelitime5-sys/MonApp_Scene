import { Setlist, Song } from '../types';

export const INITIAL_SONGS: Song[] = [
  {
    id: 'song-1',
    title: 'Les Champs-Élysées',
    artist: 'Joe Dassin',
    key: 'C',
    bpm: 112,
    timeSignature: '4/4',
    durationSeconds: 160,
    tags: ['Chanson Française', 'Classique', 'Variété', 'Acoustique'],
    notes: 'Intro guitare rythmique en C. Rythmique balancée et dynamique. Refrain chanté par toute la foule.',
    chordProContent: `{title: Les Champs-Élysées}
{artist: Joe Dassin}
{key: C}

[Couplet 1]
Je m'ba[C]ladais sur l'a[E7]venue, le cœur ou[Am]vert à l'incon[C7]nu
J'a[F]vais envie de [C]dire bonjour à [D7]n'importe [G7]qui
N'im[C]porte qui et ce fut [E7]toi, je t'ai [Am]dit n'importe [C7]quoi
Il [F]suffisait de [C]te parler pour [G7]t'appri[C]voiser

[Refrain]
Aux [C]Champs-Ély[E7]sées, aux [Am]Champs-Ély[C7]sées
Au [F]soleil, sous la [C]pluie, à [D7]midi ou à mi[G7]nuit
Il y a [C]tout ce que vous vo[E7]ulez aux [Am]Champs-Ély[C7]sées

[Couplet 2]
Tu m'as [C]dit "J'ai rendez-[E7]vous dans un sous-[Am]sol avec des [C7]fous
Qui [F]jouent de la gui[C]tare du soir au [D7]ma[G7]tin"
Alors [C]je t'ai accompa[E7]gnée, on a [Am]chanté, on a dan[C7]sé
Et [F]l'on n'a même pas [C]pensé à [G7]s'embras[C]ser

[Refrain]
Aux [C]Champs-Ély[E7]sées, aux [Am]Champs-Ély[C7]sées
Au [F]soleil, sous la [C]pluie, à [D7]midi ou à mi[G7]nuit
Il y a [C]tout ce que vous vo[E7]ulez aux [Am]Champs-Ély[C7]sées
`,
    createdAt: Date.now() - 86400000 * 5,
    updatedAt: Date.now() - 86400000 * 5
  },
  {
    id: 'song-2',
    title: 'Hotel California',
    artist: 'Eagles',
    key: 'Bm',
    bpm: 74,
    timeSignature: '4/4',
    durationSeconds: 390,
    capo: 7,
    tuning: 'Standard (E A D G B E)',
    tags: ['Rock', 'Classique', 'Acoustique', 'Solo Guitare'],
    notes: 'Intro duo guitare 12 cordes. Capo 7ème frette pour la guitare solo. Solo de guitare épique à la fin.',
    chordProContent: `{title: Hotel California}
{artist: Eagles}
{key: Bm}
{capo: 7}

[Verse 1]
On a [Bm]dark desert highway, [F#7]cool wind in my hair
[A]Warm smell of colitas, [E7]rising up through the air
[G]Up ahead in the distance, I [D]saw a shimmering light
[Em]My head grew heavy and my sight grew dim, [F#7]I had to stop for the night

[Chorus]
[G]Welcome to the Hotel Cali[D]fornia
Such a [F#7]lovely place (Such a lovely place), Such a [Bm]lovely face
[G]Plenty of room at the Hotel Cali[D]fornia
Any [Em]time of year (Any time of year), You can [F#7]find it here

[Solo Outro]
[Bm] [F#7] [A] [E7] [G] [D] [Em] [F#7]
`,
    createdAt: Date.now() - 86400000 * 4,
    updatedAt: Date.now() - 86400000 * 4
  },
  {
    id: 'song-3',
    title: 'Santiano',
    artist: 'Hugues Aufray',
    key: 'Em',
    bpm: 128,
    timeSignature: '4/4',
    durationSeconds: 195,
    tags: ['Folk', 'Chanson Française', 'Énergique', 'Chant de Marin'],
    notes: 'Rythme marin très rapide et entraînant. Accélération progressive sur les derniers refrains.',
    chordProContent: `{title: Santiano}
{artist: Hugues Aufray}
{key: Em}

[Couplet 1]
C'est un [Em]fameux trois-mâts, fin comme un [D]oiseau
[Em]Hisse et ho, [D]Santia[Em]no !
Dix-[G]huit nœuds, quatre cent [D]tonneaux
Il est [Em]fier d'être ma[D]te[Em]lot !

[Refrain]
[Em]Tiens bon la vague et tiens bon le [D]vent
[Em]Hisse et ho, [D]Santia[Em]no !
Si [G]Dieu veut, toujours droit de[D]vant
Nous i[Em]rons jusqu'à San [D]Fran[Em]cisco !

[Couplet 2]
Je [Em]pars pour de longs mois en laissant [D]Monique
[Em]Hisse et ho, [D]Santia[Em]no !
D'y [G]penser, j'ai le cœur [D]chagrin
Mais je [Em]rapporterai du [D]or en [Em]mains !

[Refrain]
[Em]Tiens bon la vague et tiens bon le [D]vent
[Em]Hisse et ho, [D]Santia[Em]no !
Si [G]Dieu veut, toujours droit de[D]vant
Nous i[Em]rons jusqu'à San [D]Fran[Em]cisco !
`,
    createdAt: Date.now() - 86400000 * 3,
    updatedAt: Date.now() - 86400000 * 3
  },
  {
    id: 'song-4',
    title: 'Hallelujah',
    artist: 'Jeff Buckley / Leonard Cohen',
    key: 'C',
    bpm: 56,
    timeSignature: '6/8',
    durationSeconds: 270,
    capo: 5,
    tuning: 'Standard',
    tags: ['Ballade', 'Acoustique', 'Voix'],
    notes: 'Style arpégé en 6/8. Capo 5. Montée en puissance progressive jusqu\'au couplet 4.',
    chordProContent: `{title: Hallelujah}
{artist: Jeff Buckley}
{key: C}

[Couplet 1]
I've [C]heard there was a [Am]secret chord
That [C]David played, and it [Am]pleased the Lord
But [F]you don't really [G]care for music, [C]do ya? [G]
It [C]goes like this, the [F]fourth, the [G]fifth
The [Am]minor fall, the [F]major lift
The [G]baffled king com[E7]posing Halle[Am]lujah

[Refrain]
Halle[F]lujah, Halle[Am]lujah
Halle[F]lujah, Halle[C]lu--[G]--[C]jah
`,
    createdAt: Date.now() - 86400000 * 2,
    updatedAt: Date.now() - 86400000 * 2
  },
  {
    id: 'song-5',
    title: 'Sweet Child O\' Mine',
    artist: 'Guns N\' Roses',
    key: 'D',
    bpm: 125,
    timeSignature: '4/4',
    durationSeconds: 355,
    tags: ['Rock', '80s', 'Énergique', 'Ouverture'],
    notes: 'Intro guitare culte en Re (D). Accordage un demi-ton plus bas. Entrée puissante de tout le groupe mesure 9.',
    chordProContent: `{title: Sweet Child O' Mine}
{artist: Guns N' Roses}
{key: D}

[Intro]
[D] [C] [G] [D] (x4)

[Verse 1]
She's got a [D]smile that it seems to me
Re[C]minds me of childhood memories
Where [G]everything was as fresh as the bright blue [D]sky

[Chorus]
[A]Whoa oh [C]oh, Sweet child o' [D]mine
[A]Whoa oh, oh, [C]oh, Sweet love of [D]mine
`,
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000
  },
  {
    id: 'song-6',
    title: 'Couleur Café',
    artist: 'Serge Gainsbourg',
    key: 'G',
    bpm: 110,
    timeSignature: '4/4',
    durationSeconds: 160,
    tags: ['Débutant', 'Chanson Française', 'Gainsbourg', '3 Accords', 'MIDI Multi-pistes'],
    notes: 'Version Gainsbourg (G, C, G7). Pistes MIDI séparées : Guitare Rythmique, Basse Afro-Cubaine, Piano/Rhodes, Percussions & Cuivres.',
    midiFileName: 'couleur_cafe.mid',
    fichier_sampler: 'couleur_cafe.vs3',
    simpleInstruments: {
      "canal_1": 33,  // 33 = Basse Électrique
      "canal_3": 22,  // 22 = Accordéon
      "canal_10": 0   // 0 = Kit de Batterie Standard
    },
    vSamplerConfig: {
      enabled: true,
      fichier_sampler: 'couleur_cafe.vs3',
      masterPresetName: 'Couleur Café (couleur_cafe.vs3)',
      channels: [
        { channel: 0, enabled: true, name: 'Basse Électrique', program: 33, bankMsb: 0, bankLsb: 0, volume: 110, pan: 64, reverb: 20 },
        { channel: 1, enabled: false, name: 'Slot 2 (Libre)', program: 0, bankMsb: 0, bankLsb: 0, volume: 90, pan: 64 },
        { channel: 2, enabled: true, name: 'Accordéon', program: 22, bankMsb: 0, bankLsb: 0, volume: 100, pan: 70, reverb: 35 },
        { channel: 3, enabled: false, name: 'Slot 4 (Libre)', program: 0, bankMsb: 0, bankLsb: 0, volume: 90, pan: 64 },
        { channel: 4, enabled: false, name: 'Slot 5 (Libre)', program: 0, bankMsb: 0, bankLsb: 0, volume: 90, pan: 64 },
        { channel: 5, enabled: false, name: 'Slot 6 (Libre)', program: 0, bankMsb: 0, bankLsb: 0, volume: 90, pan: 64 },
        { channel: 6, enabled: false, name: 'Slot 7 (Libre)', program: 0, bankMsb: 0, bankLsb: 0, volume: 90, pan: 64 },
        { channel: 7, enabled: false, name: 'Slot 8 (Libre)', program: 0, bankMsb: 0, bankLsb: 0, volume: 90, pan: 64 },
        { channel: 8, enabled: false, name: 'Slot 9 (Libre)', program: 0, bankMsb: 0, bankLsb: 0, volume: 90, pan: 64 },
        { channel: 9, enabled: true, name: 'Kit de Batterie Standard', program: 0, bankMsb: 127, bankLsb: 0, volume: 105, pan: 64, reverb: 25 },
        { channel: 10, enabled: false, name: 'Slot 11 (Libre)', program: 0, bankMsb: 0, bankLsb: 0, volume: 90, pan: 64 },
        { channel: 11, enabled: false, name: 'Slot 12 (Libre)', program: 0, bankMsb: 0, bankLsb: 0, volume: 90, pan: 64 },
        { channel: 12, enabled: false, name: 'Slot 13 (Libre)', program: 0, bankMsb: 0, bankLsb: 0, volume: 90, pan: 64 },
        { channel: 13, enabled: false, name: 'Slot 14 (Libre)', program: 0, bankMsb: 0, bankLsb: 0, volume: 90, pan: 64 },
        { channel: 14, enabled: false, name: 'Slot 15 (Libre)', program: 0, bankMsb: 0, bankLsb: 0, volume: 90, pan: 64 },
        { channel: 15, enabled: false, name: 'Slot 16 (Master/Aux)', program: 0, bankMsb: 0, bankLsb: 0, volume: 90, pan: 64 },
      ]
    },
    chordProContent: `{title: Couleur Café}
{artist: Serge Gainsbourg}
{key: G}
{tempo: 110}

[Intro]
[G]  |  [C]  |  [G7]
[C]  |  [G7]

[Couplet 1]
[G]J'aime [C]ta couleur ca[G7]fé
[C]Tes cheveux ca[G7]fé
[C]Ta gorge ca[G7]fé
[C]J'aime quand pour moi tu [G7]danses
Alors [C]j'entends murmu[G7]rer
[C]Tous tes brace[G7]lets
[C]Jolis brace[G7]lets
[C]A tes pieds ils se ba[G7]lancent

[Refrain]
[C]Couleur ca[G7]fé
Que j'aime ta couleur ca[C]fé

[Couplet 2]
[G]C'est quand [C]même fou l'ef[G7]fet
[C]L'effet que ça [G7]fait
[C]De te voir rou[G7]ler
[C]Ainsi des yeux et des [G7]hanches
Si tu [C]fais comme le ca[G7]fé
[C]Rien qu'à m'éner[G7]ver
[C]Rien qu'à m'exci[G7]ter
[C]Ce soir la nuit sera [G7]blanche

[Refrain]
[C]Couleur ca[G7]fé
Que j'aime ta couleur ca[C]fé

[Couplet 3]
[G]L'amour [C]sans philoso[G7]pher
[C]C'est comm' le ca[G7]fé
[C]Très vite pas[G7]sé
[C]Mais que veux tu que j'y [G7]fasse
On en [C]a marr' de ca[G7]fé
[C]Et c'est termi[G7]né
[C]Pour tout oubli[G7]er
[C]On attend que ça se [G7]tasse

[Refrain]
[C]Couleur ca[G7]fé
Que j'aime ta couleur ca[C]fé

[Outro]
[G]  |  [C]  |  [G7]  |  [C]
`,
    createdAt: 1700000000000,
    updatedAt: 1700000000000
  },
  {
    id: 'song-7',
    title: "L'amour à la machine",
    artist: 'Alain Souchon',
    key: 'Em',
    bpm: 118,
    timeSignature: '4/4',
    durationSeconds: 220,
    tags: ['Chanson Française', 'Alain Souchon', 'Pop Acoustique', 'MIDI Multi-pistes', 'Guitare', 'Culte'],
    notes: "Tonalité originale Mi mineur (Em). Cadence pop en Em - G - C - D. Pistes MIDI incluses : Batterie pop, Basse électrique, Guitare 12 cordes, Guitare électrique riff Souchon/Voulzy, Rhodes & Guide chant.",
    midiFileName: "Alain_Souchon_L_amour_a_la_machine_FullTrack.mid",
    chordProContent: `{title: L'amour à la machine}
{artist: Alain Souchon}
{key: Em}
{tempo: 118}
{duration: 3:40}

[Intro]
[Em]  |  [G]  |  [C]  |  [D]
[Em]  |  [G]  |  [C]  |  [D]

[Couplet 1]
Re[Em]garde un peu les sentiments [G]comme ils sont froissés
[C]C'est plus la peine de faire sem[D]blant de s'aimer
Y a [Em]des taches de vin, des taches de chagrin, [G]des faux plis dans le satin
Et [C]des traces de baisers sur le [D]chemin

[Refrain]
[Em]Passe, passe, passe [G]l'amour à la machine
[C]Pour voir si les cou[D]leurs d'origine
[Em]Peuvent reve[G]nir
[C]Est-ce qu'on peut la[D]ver l'amour
[Em]Est-ce qu'on peut le [G]sécher
[C]Lui redonner sa fraî[D]cheur de la première jour[Em]née ?
[Em]  |  [G]  |  [C]  |  [D]

[Couplet 2]
Re[Em]garde un peu les chemises [G]de nos illusions
[C]Elles ont tourné au gris de nos [D]maisons
Y a [Em]des boutons partis, du fil décousu, [G]du tissu élimé
Et [C]nos cœurs rétrécis à force [D]d'avoir lavé

[Refrain]
[Em]Passe, passe, passe [G]l'amour à la machine
[C]Pour voir si les cou[D]leurs d'origine
[Em]Peuvent reve[G]nir
[C]Est-ce qu'on peut la[D]ver l'amour
[Em]Est-ce qu'on peut le [G]sécher
[C]Lui redonner sa fraî[D]cheur de la première jour[Em]née ?

[Pont]
[Am]On a beau frotter, [Em]on a beau rincer
[Am]Y a des marques indé[D]lébiles qu'on peut pas effacer
[Em]  |  [G]  |  [C]  |  [D]
[Em]  |  [G]  |  [C]  |  [D]

[Solo Guitare / Clavier]
[Em]  |  [G]  |  [C]  |  [D]
[Em]  |  [G]  |  [C]  |  [D]

[Refrain Final]
[Em]Passe, passe, passe [G]l'amour à la machine
[C]Pour voir si les cou[D]leurs d'origine
[Em]Peuvent reve[G]nir
[C]Est-ce qu'on peut la[D]ver l'amour
[Em]Est-ce qu'on peut le [G]sécher
[C]Lui redonner sa fraî[D]cheur de la première jour[Em]née ?

[Outro]
[Em]Passe, passe, passe... [G] [C] [D]
[Em]L'amour à la machine [G] [C] [D]
[Em]  |  [G]  |  [C]  |  [D]  |  [Em]
`,
    createdAt: 1700000000000 + 1000,
    updatedAt: 1700000000000 + 1000
  },
  {
    id: 'song-8',
    title: 'No Woman No Cry',
    artist: 'Bob Marley & The Wailers',
    key: 'C',
    bpm: 78,
    timeSignature: '4/4',
    durationSeconds: 245,
    tags: ['Reggae', 'Roots', 'Bob Marley', 'Acoustique', 'MIDI Multi-pistes', 'Légende'],
    notes: "Tonalité originale Do majeur (C). Grille iconique : C - G/B - Am - F | C - F - C - G. Pistes MIDI incluses : Batterie One-Drop Carlton Barrett, Basse Roots Aston Barrett, Skank guitare, Orgue Hammond B3 bubbling, Grand Piano et Lead vocal.",
    midiFileName: "Bob_Marley_No_Woman_No_Cry_Roots_Reggae.mid",
    chordProContent: `{title: No Woman No Cry}
{artist: Bob Marley & The Wailers}
{key: C}
{tempo: 78}
{duration: 4:05}

[Intro]
[C]  [G/B]  |  [Am]  [F]  |  [C]  [F]  |  [C]  [G]
[C]  [G/B]  |  [Am]  [F]  |  [C]  [F]  |  [C]  [G]

[Chorus]
[C]No [G/B]woman, no [Am]cry  [F]
[C]No [F]woman, no [C]cry  [G]
[C]No [G/B]woman, no [Am]cry  [F]
[C]No [F]woman, no [C]cry  [G]

[Verse 1]
Said, [C]said, said I re[G/B]member when we [Am]used to sit [F]
[C]In the government [G/B]yard in [Am]Trenchtown [F]
[C]Oba, ob[G/B]serving the [Am]hypocrites [F]
As they would [C]mingle with the [G/B]good people we [Am]meet [F]
[C]Good friends we [G/B]have, oh, [Am]good friends we've [F]lost
[C]A[G/B]long the [Am]way [F]
[C]In this great [G/B]future, you [Am]can't forget your [F]past
[C]So dry your [G/B]tears, I [Am]seh [F]

[Chorus]
[C]No [G/B]woman, no [Am]cry  [F]
[C]No [F]woman, no [C]cry  [G]
[C]Little darlin', [G/B]don't shed no [Am]tears  [F]
[C]No [F]woman, no [C]cry  [G]

[Verse 2]
Said, [C]said, said I re[G/B]member when we [Am]used to sit [F]
[C]In the government [G/B]yard in [Am]Trenchtown [F]
[C]And then Georgie would [G/B]make the [Am]fire lights [F]
As it was [C]logwood burning [G/B]through the [Am]night [F]
[C]Then we would [G/B]cook cornmeal [Am]porridge [F]
[C]Of which I'll [G/B]share with [Am]you [F]
[C]My feet is my [G/B]only [Am]carriage [F]
[C]So I've got to [G/B]push on [Am]through, but while I'm gone... [F]

[Bridge]
[C]Everything's [G/B]gonna be alright, [Am]everything's [F]gonna be alright
[C]Everything's [G/B]gonna be alright, [Am]everything's [F]gonna be alright
[C]Everything's [G/B]gonna be alright, [Am]everything's [F]gonna be alright
[C]Everything's [G/B]gonna be alright, [Am]everything's [F]gonna be alright

[Chorus]
[C]No [G/B]woman, no [Am]cry  [F]
[C]No [F]woman, no [C]cry  [G]
[C]Little darlin', [G/B]don't shed no [Am]tears  [F]
[C]No [F]woman, no [C]cry  [G]

[Solo Orgue / Clavier]
[C]  [G/B]  |  [Am]  [F]  |  [C]  [F]  |  [C]  [G]
[C]  [G/B]  |  [Am]  [F]  |  [C]  [F]  |  [C]  [G]

[Chorus Final]
[C]No [G/B]woman, no [Am]cry  [F]
[C]No [F]woman, no [C]cry  [G]
[C]Little sister, [G/B]don't shed no [Am]tears  [F]
[C]No [F]woman, no [C]cry  [G]
[C]
`,
    createdAt: 1700000000000 + 2000,
    updatedAt: 1700000000000 + 2000
  }
];

export const INITIAL_SETLISTS: Setlist[] = [
  {
    id: 'setlist-1',
    name: 'Grand Concert Festival d\'Été 2026',
    venue: 'Scène Principale du Parc',
    date: '2026-08-20',
    targetDurationMinutes: 45,
    tags: ['Festival', 'Scène Principale', 'Live Band'],
    entries: [
      {
        id: 'entry-1',
        type: 'song',
        songId: 'song-3', // Santiano
        targetKey: 'Em'
      },
      {
        id: 'entry-2',
        type: 'song',
        songId: 'song-1', // Les Champs-Élysées
        targetKey: 'C'
      },
      {
        id: 'entry-3',
        type: 'interlude',
        interludeTitle: 'Changement de Guitare & Discours d\'Accueil',
        interludeDurationSeconds: 120,
        notes: 'Le guitariste passe sur guitare 12 cordes acoustique. Le chanteur salue le public.'
      },
      {
        id: 'entry-4',
        type: 'song',
        songId: 'song-2', // Hotel California
        targetKey: 'Bm',
        capo: 7
      },
      {
        id: 'entry-5',
        type: 'interlude',
        interludeTitle: 'Présentation des Musiciens',
        interludeDurationSeconds: 90,
        notes: 'Le clavier joue un fond d\'ambiance doux en Do majeur.'
      },
      {
        id: 'entry-6',
        type: 'song',
        songId: 'song-5', // Sweet Child O' Mine
        targetKey: 'D'
      }
    ],
    createdAt: Date.now() - 86400000 * 2,
    updatedAt: Date.now() - 86400000 * 2
  },
  {
    id: 'setlist-2',
    name: 'Session Acoustique Coucher de Soleil',
    venue: 'Rooftop Lounge & Bar',
    date: '2026-08-25',
    targetDurationMinutes: 30,
    tags: ['Acoustique', 'Chill', 'Unplugged'],
    entries: [
      {
        id: 'entry-201',
        type: 'song',
        songId: 'song-4', // Hallelujah
        targetKey: 'C',
        capo: 5
      },
      {
        id: 'entry-202',
        type: 'song',
        songId: 'song-1', // Les Champs-Élysées
        targetKey: 'C'
      },
      {
        id: 'entry-203',
        type: 'song',
        songId: 'song-2', // Hotel California
        targetKey: 'Bm',
        capo: 7
      }
    ],
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000
  }
];

const LOCAL_STORAGE_SONGS_KEY = 'liveset_app_songs_v2';
const LOCAL_STORAGE_SETLISTS_KEY = 'liveset_app_setlists_v2';

export function loadSongsFromStorage(): Song[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SONGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Replace or merge default songs so updates to sample songs are reflected
        const defaultSong6 = INITIAL_SONGS.find((s) => s.id === 'song-6');
        const defaultSong7 = INITIAL_SONGS.find((s) => s.id === 'song-7');
        const defaultSong8 = INITIAL_SONGS.find((s) => s.id === 'song-8');
        const updatedParsed = parsed.map((s: Song) => {
          if (s.id === 'song-6' && defaultSong6) return defaultSong6;
          if (s.id === 'song-7' && defaultSong7) return defaultSong7;
          if (s.id === 'song-8' && defaultSong8) return defaultSong8;
          return s;
        });

        const existingIds = new Set(updatedParsed.map((s: Song) => s.id));
        const missingDefaults = INITIAL_SONGS.filter((s) => !existingIds.has(s.id));
        const merged = [...updatedParsed, ...missingDefaults];
        saveSongsToStorage(merged);
        return merged;
      }
    }
  } catch (e) {
    console.error('Failed to load songs from localStorage', e);
  }
  return INITIAL_SONGS;
}

export function saveSongsToStorage(songs: Song[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_SONGS_KEY, JSON.stringify(songs));
  } catch (e) {
    console.error('Failed to save songs to localStorage', e);
  }
}

export function loadSetlistsFromStorage(): Setlist[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SETLISTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Failed to load setlists from localStorage', e);
  }
  return INITIAL_SETLISTS;
}

export function saveSetlistsToStorage(setlists: Setlist[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_SETLISTS_KEY, JSON.stringify(setlists));
  } catch (e) {
    console.error('Failed to save setlists to localStorage', e);
  }
}
