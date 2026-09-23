/* Ce qu'on demande aux modeles, et rien d'autre.
 *
 * LA CHANSON est decrite, pas ecrite : Suno recoit un brief de moins de 500
 * caracteres ou TOUT vient de leurs reponses — prenoms, relation, occasion,
 * genre, voix, langue, leur histoire, ce qu'ils aiment chez l'autre, leur
 * message — et c'est lui qui ecrit des paroles qui riment, dans la bonne
 * langue. Coller leurs phrases telles quelles dans des paroles toutes faites
 * donnait des vers boiteux, et des vers en francais dans une chanson anglaise.
 *
 * LES SIX SCENES suivent le meme ordre que le brief : la rencontre, le coup de
 * foudre, ce qui rend l'autre unique, la vie a deux, le moment de l'occasion,
 * pour toujours. La chanson raconte leur histoire dans cet ordre-la, les
 * images aussi : les deux vont ensemble.
 *
 * Le prompt image ne DECRIT jamais un visage. Il dit de garder ceux des photos,
 * et ne parle que du decor, des tenues et de la lumiere. Decrire un visage,
 * c'est se battre contre la photo — et c'est la photo qui perd.
 */

// Le rendu. Un seul endroit a changer si le proprietaire veut un autre style.
export const LOOK = 'Photorealistic cinematic film still, shot on 35mm, soft natural light, '
  + 'shallow depth of field, warm romantic colour grade, wide 16:9 frame. '
  + 'No text, no letters, no watermark, no logo, no borders, one single image.';

const KEEP = ' Treat the reference photos as the ground truth for both faces: keep each '
  + "person's real face, features, skin tone, hair colour and hairstyle exactly as in the "
  + 'photos, so they instantly recognise themselves. Do not change their age or body type, '
  + 'do not beautify, smooth or restyle their faces, and never paste a photograph in. '
  + 'Only the setting, the outfits, the pose and the light change.';

function who(n) {
  return n > 1
    ? 'Two reference photos: the first shows one partner, the second shows the other partner. '
      + 'Show the two of them together in this scene: '
    : 'The reference photo shows the couple. Show the two of them together in this scene: ';
}

// Leurs mots, nettoyes et coupes proprement : une proposition entiere plutot
// qu'une phrase tranchee au milieu d'un mot.
export function clip(text, max) {
  let t = String(text || '').replace(/[\u0000-\u001f<>{}\[\]\\`]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t || max <= 0) return '';
  if (t.length <= max) return t.replace(/[\s,;:.]+$/, '');
  const cut = t.slice(0, max + 1);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '), cut.lastIndexOf(', '));
  const sp = cut.lastIndexOf(' ');
  t = stop > max * 0.5 ? cut.slice(0, stop) : (sp > 0 ? cut.slice(0, sp) : cut.slice(0, max));
  return t.replace(/[\s,;:.]+$/, '');
}

function name(s) {
  return clip(String(s || '').replace(/[^\p{L}\p{M}'’ \-]/gu, ''), 24);
}

export function occasionKey(a) {
  const o = String((a && (a.occasion_other || a.occasion)) || '').toLowerCase();
  if (/wedding|marri|first dance/.test(o)) return 'wedding';
  if (/propos|engage/.test(o)) return 'proposal';
  if (/anniversar/.test(o)) return 'anniversary';
  if (/valentin/.test(o)) return 'valentine';
  if (/birthday/.test(o)) return 'birthday';
  return 'default';
}

function occasionPhrase(a) {
  const other = clip(a.occasion_other, 60);
  if (other) return 'for ' + other;
  const o = String(a.occasion || '').trim();
  if (!o || /other/i.test(o)) return '';
  if (/just because/i.test(o)) return 'just because';
  if (/first dance/i.test(o)) return 'for our first dance';
  if (/valentin/i.test(o)) return "for Valentine's Day";
  return 'for our ' + o.toLowerCase();
}

function voicePhrase(v) {
  const s = String(v || '').toLowerCase();
  if (s.indexOf('duet') > -1) return 'a male and female duet';
  if (s.indexOf('female') > -1) return 'sung by a female voice';
  if (s.indexOf('male') > -1) return 'sung by a male voice';
  return '';
}

/* LE BRIEF DE LA CHANSON.
 *
 * Moins de 500 caracteres : c'est la limite du mode ou Suno ecrit lui-meme les
 * paroles. Le cadre fixe passe d'abord, puis leurs mots se partagent la place
 * qui reste, l'histoire en premier parce que c'est elle qui fait la chanson.
 */
export function songPrompt(a) {
  const them = name(a.their_name) || 'my love';
  const me = name(a.your_name);
  const rel = String(a.relationship || '').trim();
  const both = /two of us/i.test(rel);
  const relWord = (!rel || /other|two of us/i.test(rel)) ? '' : rel.toLowerCase();
  const genre = clip(a.genre, 24).toLowerCase() || 'pop';
  const lang = clip(a.language, 14) || 'English';
  const voice = voicePhrase(a.voice);
  const occ = occasionPhrase(a);

  let head = 'A heartfelt ' + genre + ' love song in ' + lang + (voice ? ', ' + voice : '') + ', ';
  head += both
    ? 'about ' + (me ? me + ' and ' : 'us and ') + them
    : 'from ' + (me || 'me') + ' to ' + them + (relWord ? ', my ' + relWord : '');
  head += (occ ? ', ' + occ : '') + '.';
  const hasName = !!name(a.their_name);
  const tail = (hasName ? ' Sing ' + them + "'s name in the chorus." : '')
    + ' Start straight on the vocals, no long intro.';

  // La place qui reste est partagee entre leurs trois textes, a parts
  // ponderees : l'histoire d'abord, puis le message, puis ce qu'ils aiment.
  // Ce qu'un texte court n'utilise pas revient aux autres — sinon un message
  // de dix mots se faisait couper a « Ten years and I would miss ».
  const labels = {
    story: ' Our story: ',
    message: ' Message: ',
    qualities: ' What I love about ' + them + ': '
  };
  const want = {
    story: String(a.story || '').replace(/\s+/g, ' ').trim(),
    message: String(a.message || '').replace(/\s+/g, ' ').trim(),
    qualities: String(a.qualities || '').replace(/\s+/g, ' ').trim()
  };
  const weight = { story: 0.45, message: 0.25, qualities: 0.30 };
  const order = ['story', 'qualities', 'message'];
  let room = 490 - head.length - tail.length;
  for (const k of order) if (want[k]) room -= labels[k].length + 1;
  const give = {};
  let spare = 0;
  let totalW = 0;
  for (const k of order) if (want[k]) totalW += weight[k];
  for (const k of order) {
    if (!want[k]) continue;
    const share = Math.floor(room * weight[k] / totalW);
    give[k] = Math.min(want[k].length, share);
    spare += share - give[k];
  }
  // Deuxieme passe : le reste va a ceux qui ont ete coupes.
  for (const k of order) {
    if (!want[k] || spare <= 0) continue;
    const more = Math.min(spare, want[k].length - give[k]);
    give[k] += more;
    spare -= more;
  }
  const parts = [];
  for (const k of order) {
    const t = want[k] ? clip(want[k], give[k]) : '';
    if (t) parts.push(labels[k] + t + '.');
  }

  let out = head + parts.join('') + tail;
  // Filet de securite : jamais au-dela de la limite, quoi qu'aient ecrit les gens.
  if (out.length > 499) out = out.slice(0, 496).replace(/\s+\S*$/, '') + '.';
  return out;
}

// Le moment de l'occasion : la cinquieme scene, celle qui dit POURQUOI.
const MOMENT = {
  wedding: 'their wedding day, dancing their first dance in a softly lit reception hall '
    + 'under warm string lights, dressed for the wedding',
  proposal: 'the proposal: one of them down on one knee holding an open ring box, the other '
    + 'overwhelmed with joy, on a scenic overlook at golden hour',
  anniversary: 'their anniversary: a candlelit dinner for two, raising their glasses to each '
    + 'other across the table, soft bokeh behind them',
  valentine: "Valentine's evening: walking arm in arm through city lights, one holding a "
    + 'bouquet of red roses',
  birthday: 'a birthday celebration: laughing over a cake with glowing candles in a cozy room',
  default: 'dancing slowly together in their living room in warm evening light'
};

/* LES SIX SCENES, dans l'ordre de la chanson.
 *
 * `safe` est la meme scene sans leurs mots a eux : si le modele refuse une
 * scene a cause d'un texte libre, on la relance une fois sans ce texte. On ne
 * contourne rien sur la photo elle-meme — un refus sur la photo reste un refus.
 */
export function scenes(a, photoCount) {
  const them = name(a.their_name);
  const story = clip(a.story, 150);
  const love = clip(a.qualities, 110);
  const occ = occasionKey(a);
  const lead = who(photoCount);

  const raw = [
    {
      k: 'meet',
      scene: story
        ? 'the day they met — ' + story + ' — the first moment they notice each other, a spark between them, candid'
        : '',
      safe: 'the day they met: two people sharing a first laugh at a small sunlit cafe, a spark between them, candid'
    },
    {
      k: 'falling',
      scene: 'falling in love: walking hand in hand along a sunlit street, laughing together, golden hour',
      safe: 'falling in love: walking hand in hand along a sunlit street, laughing together, golden hour'
    },
    {
      k: 'special',
      scene: love
        ? 'a tender candid moment that shows what makes ' + (them || 'them') + ' special — ' + love
        : '',
      safe: 'a playful candid moment in a bright kitchen, one of them making the other burst out laughing'
    },
    {
      k: 'home',
      scene: 'their life together: a cozy morning at home, sharing coffee and a quiet smile on the sofa, soft window light',
      safe: 'their life together: a cozy morning at home, sharing coffee and a quiet smile on the sofa, soft window light'
    },
    { k: 'moment', scene: MOMENT[occ] || MOMENT.default, safe: MOMENT[occ] || MOMENT.default },
    {
      k: 'forever',
      scene: 'forever: holding each other forehead to forehead on a beach at sunset, warm backlight, '
        + 'the most beautiful frame of all',
      safe: 'forever: holding each other forehead to forehead on a beach at sunset, warm backlight, '
        + 'the most beautiful frame of all'
    }
  ];

  return raw.map(function (s) {
    return {
      k: s.k,
      prompt: lead + (s.scene || s.safe) + '.' + KEEP + ' ' + LOOK,
      safe: lead + s.safe + '.' + KEEP + ' ' + LOOK,
      motion: motion(s.safe)
    };
  });
}

/* LA VIDEO COMPLETE : les plans qui suivent les six de la preview.
 *
 * Une bibliotheque de moments de couple, dans un ordre qui raconte une vie a
 * deux, puis le moment de l'occasion vers la fin, puis le final. Le point de
 * depart dans la bibliotheque depend de leurs prenoms : deux couples n'ont pas
 * le meme film, et le meme couple retrouve toujours le sien.
 */
const LIFE = [
  'a spontaneous road trip: laughing together in a vintage convertible on a coastal road, wind in their hair',
  'cooking dinner together in a warm kitchen, one offering the other a taste from a wooden spoon, laughing',
  'sharing one umbrella on a rainy city street at night, neon reflections on the wet pavement',
  'a picnic on a blanket in a meadow of wildflowers, sharing strawberries in the late afternoon sun',
  'dancing barefoot in the living room to a record player, cozy lamps, candid joy',
  'walking through a snowy park in winter coats, snowflakes falling, holding gloved hands',
  'watching the city lights from a rooftop at blue hour, wrapped in the same blanket',
  'riding bicycles side by side along a tree-lined path in autumn, golden leaves falling',
  'at a lively night market under strings of lanterns, sharing street food and laughing',
  'on a small wooden rowing boat on a calm lake at sunrise, soft mist over the water',
  'lying on a blanket beside a campfire, looking up at a sky full of stars',
  'in a cozy bookstore, one reading a passage aloud while the other smiles',
  'on a ferris wheel at a fair at dusk, the town glowing below them',
  'reaching a mountain viewpoint on a hike and hugging, a vast green valley behind them',
  'a slow dance in the kitchen late at night, foreheads touching, soft warm light',
  'inside a pillow fort with fairy lights on a rainy afternoon, laughing',
  'walking along a wooden pier at golden hour, the sea sparkling behind them',
  'painting the walls of their new home together, a little paint on their cheeks, laughing',
  'sitting on the steps of an old European street eating gelato in warm evening light',
  'running hand in hand through a summer rain shower, soaked and laughing',
  'a slow Sunday morning in bed with coffee, sunlight through linen curtains',
  'looking out of a train window at the countryside, one resting their head on the other\'s shoulder',
  'under a tree in full blossom in spring, petals drifting down around them',
  'on a balcony strung with fairy lights, sharing a toast with two glasses',
  'walking along a cliff path above the ocean, sharing one scarf in the wind',
  'at a farmers market carrying a basket of flowers and fresh bread',
  'on the sofa under a blanket, one dozing on the other\'s shoulder, a gentle smile',
  'dancing in an empty street under a warm streetlight at midnight',
  'at the edge of the sea at sunset, jeans rolled up, splashing each other',
  'feeding ducks by a pond in an old park, sharing a laugh on a bench'
];

const FINALE = [
  'an embrace in a golden wheat field at sunset, warm lens flare',
  'forever: smiling cheek to cheek in golden sunset light, the most beautiful portrait of all'
];

function seedOf(a) {
  const s = String((a && a.their_name) || '') + '|' + String((a && a.your_name) || '');
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function fullScenes(a, count, photoCount) {
  const n = Math.max(0, count | 0);
  const lead = who(photoCount);
  const moment = MOMENT[occasionKey(a)] || MOMENT.default;
  const love = clip(a && a.qualities, 110);
  const them = name(a && a.their_name);
  const list = [];
  const start = seedOf(a) % LIFE.length;
  for (let i = 0; i < n; i++) list.push(LIFE[(start + i) % LIFE.length]);
  // Ce qu'ils aiment chez l'autre revient au milieu, s'ils l'ont ecrit.
  if (love && n >= 10) list[Math.floor(n / 2)] = 'a tender candid moment that shows what makes ' + (them || 'them') + ' special — ' + love;
  // L'occasion vers les trois quarts, le final a la fin.
  if (n >= 4) list[Math.floor(n * 0.75)] = moment;
  if (n >= 2) list[n - 2] = FINALE[0];
  if (n >= 1) list[n - 1] = FINALE[1];
  return list.map(function (scene, i) {
    const safe = /special —/.test(scene) ? LIFE[(start + i) % LIFE.length] : scene;
    return {
      prompt: lead + scene + '.' + KEEP + ' ' + LOOK,
      safe: lead + safe + '.' + KEEP + ' ' + LOOK,
      motion: motion(scene)
    };
  });
}

// Le mouvement du plan anime : doux, vivant, jamais de visage qui se deforme.
export function motion(scene) {
  const what = String(scene || '').split(':').pop().split(' — ')[0].trim();
  return 'Cinematic, slow and gentle camera movement. The two people in the image move naturally and tenderly'
    + (what ? ' (' + what.slice(0, 160) + ')' : '')
    + '. Keep both faces exactly as in the image, realistic skin and eyes, no morphing, no text, no extra people.';
}

// Le peu de reponses que le jeton doit porter pour relancer une scene ou la
// chanson sans rien redemander au client. Coupees court : le jeton voyage.
export function carry(a) {
  return {
    their_name: name(a.their_name),
    your_name: name(a.your_name),
    relationship: clip(a.relationship, 20),
    occasion: clip(a.occasion, 30),
    occasion_other: clip(a.occasion_other, 60),
    genre: clip(a.genre, 24),
    voice: clip(a.voice, 20),
    language: clip(a.language, 14),
    story: clip(a.story, 170),
    qualities: clip(a.qualities, 120),
    message: clip(a.message, 90)
  };
}
