/* CraftStory — le scenario des trente secondes.
 *
 * Un seul objet decide de TOUT ce qui sera fabrique : les paroles, les six
 * plans, et ce qui bouge dans chacun. C'est volontaire, et c'est la seule
 * facon d'obtenir une video qui raconte la meme chose que la chanson :
 * la ligne chantee et le plan qui la porte sont ecrits ENSEMBLE, dans la meme
 * ligne de code. On ne peut pas les desynchroniser par accident.
 *
 * L'arc est le meme pour tout le monde — rencontre, quotidien, bascule,
 * epreuve, promesse, aujourd'hui. Ce sont leurs reponses qui remplissent les
 * trous. C'est exactement le tour de force du tunnel enfants applique au
 * recit : la structure est pre-faite, l'histoire est la leur.
 *
 * Pourquoi un arc fixe plutot qu'un modele de texte qui improvise :
 *   - on comprend l'histoire SANS le son, parce que les six plans sont six
 *     etapes reconnaissables et pas six jolies images sans ordre ;
 *   - aucun appel de plus, aucune latence de plus, aucun refus de modele ;
 *   - le plan et sa parole ne peuvent pas se contredire.
 *
 * Ce fichier ne fait AUCUN appel reseau. Il est teste tel quel.
 */

/* Les mots interdits du projet : jamais « movie », jamais « film ». */

// Le decor. Une image de reference par occasion et par plan, generee UNE FOIS
// avec un couple quelconque et reutilisee par tout le monde : c'est le seul
// element pre-genere du systeme. Les visages, eux, viennent de leur photo.
const SCENES = {
  wedding: 'craftstory-duo-wedding',
  proposal: 'craftstory-duo-proposal',
  anniversary: 'craftstory-duo-anniv',
  valentine: 'craftstory-duo-valentine',
  birthday: 'craftstory-duo-birthday',
  default: 'craftstory-duo-default'
};

/* Les six temps. `line` est chante, `scene` est vu, `motion` est ce qui bouge.
 * Les trois se lisent sur la meme ligne : c'est la garantie de coherence.
 *
 * REGLE, payee une fois : leurs mots a eux occupent une ligne ENTIERE, jamais
 * un morceau glisse au milieu d'une phrase ecrite par nous. « Then {how}, and
 * nothing was ever quiet again » donnait, avec une vraie reponse :
 *
 *     Then Un train rate a Lyon en 2019, on a, and nothing was ever quiet again
 *
 * Grammaire cassee, majuscule au milieu, coupure sur « on a ». Seule, la meme
 * reponse fait une ligne qui se chante : « Un train rate a Lyon en 2019 ».
 * Donc : soit la ligne est a nous et ne contient que des jetons courts et surs
 * (un prenom, une relation), soit elle est a eux et elle est seule. `alt` est
 * la ligne de repli quand ils n'ont rien ecrit.
 */
const ARC = [
  {
    key: 'before',
    line: 'Before {name}, the days all looked the same',
    alt: 'Before you, the days all looked the same',
    scene: 'wide establishing shot, one person alone at {place}, early light, '
      + 'muted colours, quiet and still',
    motion: 'very slow push in, almost imperceptible',
    drift: 'in'
  },
  {
    key: 'meeting',
    line: '{how}',
    alt: 'Then one evening that was never meant to matter',
    scene: 'the moment they first met — {how} — the two of them seeing each '
      + 'other, warm light breaking in, colour returning to the frame',
    motion: 'slow dolly from one face to the other',
    drift: 'out'
  },
  {
    key: 'everyday',
    line: '{quality}',
    alt: 'And nothing was ordinary again',
    scene: 'the two of them close together in an ordinary moment — {quality} — '
      + 'laughing, golden hour, shallow depth of field',
    motion: 'handheld drift, small natural movement, hair and fabric moving',
    drift: 'left'
  },
  {
    key: 'storm',
    line: 'Through the year that tried to break us',
    alt: 'Through the year that tried to break us',
    scene: 'the two of them holding on to each other, rain or dusk, '
      + 'cooler light, faces lit from one side',
    motion: 'slow orbit around the pair, rain falling',
    drift: 'in'
  },
  {
    key: 'promise',
    line: 'Still here. Still choosing you.',
    alt: 'Still here. Still choosing you.',
    scene: 'the two of them {gesture}, warm rich light, the frame at its most '
      + 'beautiful, everything in focus on their faces',
    motion: 'rise on them, slow, steady, ending on both faces',
    drift: 'right'
  },
  {
    key: 'now',
    line: '{name}, this one is yours.',
    alt: 'This one is yours.',
    scene: 'the two of them together at {place} dressed for {occasion}, '
      + 'the fullest, brightest frame of the six',
    motion: 'slow pull back revealing the whole scene around them',
    drift: 'out'
  }
];

// Ce que chaque occasion change : le geste du cinquieme plan et le lieu du
// sixieme. Rien d'autre — l'arc tient pour toutes.
const BY_OCCASION = {
  wedding: { gesture: 'at the altar, hands joined', place: 'the aisle' },
  proposal: { gesture: 'on one knee, ring in hand', place: 'the place they met' },
  anniversary: { gesture: 'dancing slowly in their own kitchen', place: 'their home' },
  valentine: { gesture: 'forehead to forehead, eyes closed', place: 'a lamplit room' },
  birthday: { gesture: 'laughing over candlelight', place: 'a table set for two' },
  default: { gesture: 'holding each other, forehead to forehead', place: 'their own place' }
};

function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z]+/g, '');
}

function occasionKey(occasion) {
  const k = slug(occasion);
  if (!k) return 'default';
  if (k.indexOf('wedding') > -1 || k.indexOf('marriage') > -1) return 'wedding';
  if (k.indexOf('propos') > -1 || k.indexOf('engage') > -1) return 'proposal';
  if (k.indexOf('anniversar') > -1) return 'anniversary';
  if (k.indexOf('valentin') > -1) return 'valentine';
  if (k.indexOf('birthday') > -1) return 'birthday';
  return 'default';
}

/* Une phrase de leurs mots, coupee proprement.
 *
 * Leurs reponses sont des paragraphes : « Elle rit avant la fin de la blague,
 * et elle chante faux dans la voiture ». Chante, il en faut UNE, courte, qui
 * tient dans une ligne et qu'on peut lire a l'ecran en cinq secondes. On prend
 * la premiere proposition et on la ramene a vingt-six caracteres utiles.
 */
// Les mots qui ne terminent pas une ligne chantee. « …on a », « …and »,
// « …the » : la ligne s'arrete au milieu d'une respiration et ca s'entend.
const TAIL = /^(a|an|the|and|or|of|on|in|at|to|for|with|from|but|so|very|has|have|had|is|are|was|were|be|been|will|would|can|could|never|ever|every|i|you|he|she|it|we|they|him|her|them|my|your|his|our|their|et|de|du|des|la|le|les|un|une|que|qui|quand|on|je|elle|il|nous|mais|puis|avec|dans|pour|sur|tres|jamais|toujours)$/i;

function oneLine(text, max) {
  let t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  let first = t.split(/[.!?;\n]/)[0].trim();
  const cap = max || 46;
  if (first.length > cap) {
    // Trois essais, du plus propre au moins pire : une virgule (proposition
    // complete), sinon une conjonction qu'on jette avec (« … and the whole
    // street » vaut mieux ampute avant le « and » qu'apres), sinon le dernier
    // mot. Couper au hasard donne « A power cut in August and the whole ».
    const upto = first.slice(0, cap + 1);
    const comma = upto.lastIndexOf(',');
    const conj = upto.search(/\s(?:and|et|but|or|mais|puis)\s[^]*$/i);
    const lastConj = (function () {
      const m = upto.match(/^[^]*\s(?=(?:and|et|but|or|mais|puis)\s)/i);
      return m ? m[0].length - 1 : -1;
    })();
    if (comma > cap * 0.45) {
      first = upto.slice(0, comma);
    } else if (lastConj > cap * 0.45) {
      first = upto.slice(0, lastConj);
    } else {
      const sp = upto.lastIndexOf(' ');
      first = sp > 0 ? upto.slice(0, sp) : upto;
    }
    void conj;
  }
  first = first.replace(/[,;:\s]+$/, '');
  let guard = 0;
  while (guard++ < 5) {
    const m = first.match(/\s(\S+)$/);
    if (!m || !TAIL.test(m[1])) break;
    first = first.slice(0, first.length - m[0].length).replace(/[,;:\s]+$/, '');
  }
  return first;
}

/* Le gabarit, et le menage quand une reponse manque.
 *
 * Meme regle que sur la page : on retire le trou ET ce qui l'entoure, plutot
 * que de chanter « Then , and nothing was ever quiet again ».
 */
// `fill` renvoie la chaine ; `fillInfo` dit en plus si un jeton manquait, ce
// qui permet de preferer la ligne de repli a une ligne rabotee.
function fillInfo(tpl, map) {
  let out = String(tpl);
  let missing = false;
  for (const k in map) {
    if (out.indexOf('{' + k + '}') < 0) continue;
    if (map[k]) { out = out.split('{' + k + '}').join(map[k]); } else { missing = true; }
  }
  if (missing) {
    // On retire le jeton ET la ponctuation collee des DEUX cotes, sinon
    // « Before {name}, the days » laissait « Before , the days » : une virgule
    // orpheline qui se chante comme une faute.
    out = out.replace(/\s*\([^()]*\{\w+\}[^()]*\)/g, '')
      .replace(/\{\w+\}'s\s*/g, '')
      .replace(/\s*[,;:—-]?\s*\{\w+\}\s*[,;:—-]?\s*/g, ' ')
      .replace(/\s+([,.;:!?])/g, '$1')
      .replace(/\b(and|et|or|then)\s+\1\b/gi, '$1')
      .replace(/^\s*(and|et|or|then)\s+/i, '')
      .replace(/\s*,\s*,/g, ',')
      .replace(/\s{2,}/g, ' ')
      .replace(/^[\s,—·-]+|[\s,—·-]+$/g, '');
    // Une majuscule perdue avec le jeton : on la remet, la ligne s'affiche.
    if (out) out = out.charAt(0).toUpperCase() + out.slice(1);
  }
  return { out: out.replace(/\s{2,}/g, ' ').trim(), missing: missing };
}

function fill(tpl, map) {
  return fillInfo(tpl, map).out;
}

/* Le style musical envoye a Suno.
 *
 * On ne laisse pas le modele choisir le tempo : une preview de trente secondes
 * qui demarre sur vingt secondes d'intro ne vend rien. « starts on the vocal,
 * no long intro » est la seule instruction non negociable.
 */
function style(a) {
  const bits = [];
  if (a.genre) bits.push(String(a.genre).toLowerCase());
  const v = String(a.voice || '').toLowerCase();
  if (v.indexOf('duet') > -1) bits.push('male and female duet');
  else if (v.indexOf('female') > -1) bits.push('female lead vocal');
  else if (v.indexOf('male') > -1) bits.push('male lead vocal');
  bits.push('warm, intimate, cinematic build');
  bits.push('starts on the vocal, no long intro');
  return bits.join(', ');
}

/* LE SCENARIO.
 *
 * Renvoie exactement ce qu'il faut pour lancer la fabrication, et rien de
 * plus : un titre, un style, des paroles, et six plans qui savent chacun ce
 * qu'on chante dessus et ce qui doit bouger dedans.
 */
function storyboard(answers) {
  const a = answers || {};
  const occ = occasionKey(a.occasion_other || a.occasion);
  const local = BY_OCCASION[occ] || BY_OCCASION.default;

  const map = {
    name: (a.their_name || '').trim(),
    you: (a.your_name || '').trim(),
    rel: (a.relationship || '').trim(),
    occasion: (a.occasion_other || a.occasion || '').trim().toLowerCase(),
    // Cinquante-huit caracteres : c'est ce qu'une ligne chantee porte sans
    // se couper, et ce qu'un ecran de telephone affiche sur deux lignes.
    quality: oneLine(a.qualities, 58),
    how: oneLine(a.story, 58),
    gesture: local.gesture,
    place: local.place
  };

  const beats = ARC.map(function (b, n) {
    // La ligne a eux si elle existe, la notre sinon. Jamais un trou, et jamais
    // une ligne rabotee quand un repli entier existe : sans reponse,
    // « Before {name}, the days » devenait « Before the days all looked the
    // same », qui se chante de travers.
    const got = fillInfo(b.line, map);
    let line = got.out;
    if (!line || got.missing) {
      const back = fillInfo(b.alt, map);
      if (back.out && !back.missing) line = back.out;
      else if (!line) line = back.out;
    }
    return {
      n: n + 1,
      key: b.key,
      line: line,
      // Le prompt image ne decrit JAMAIS leurs visages : la photo est la
      // verite de terrain, le texte ne parle que du decor et de la lumiere.
      // Decrire les visages, c'est se battre contre la photo et perdre la
      // ressemblance — c'est la lecon du tunnel enfants.
      scene: fill(b.scene, map),
      motion: b.motion,
      drift: b.drift,
      template: SCENES[occ] || SCENES.default
    };
  }).filter(function (b) { return b.line; });

  // Les paroles envoyees a Suno : les six lignes dans l'ordre, avec les
  // reperes de structure. Ce sont ces lignes-la qu'on retrouvera dans les
  // horodatages pour poser les coupes.
  const lyrics = [
    '[Verse]', beats[0] ? beats[0].line : '', beats[1] ? beats[1].line : '',
    '[Pre-Chorus]', beats[2] ? beats[2].line : '', beats[3] ? beats[3].line : '',
    '[Chorus]', beats[4] ? beats[4].line : '', beats[5] ? beats[5].line : ''
  ].filter(Boolean).join('\n');

  return {
    occasion: occ,
    title: map.name ? map.name + "'s Song" : 'Our Song',
    style: style(a),
    lyrics: lyrics,
    beats: beats
  };
}

/* LES COUPES, POSEES SUR LA CHANSON.
 *
 * C'est l'etape qui fait la difference entre un diaporama et un montage. On ne
 * decide pas que chaque plan dure cinq secondes : on cherche a quel instant
 * chaque ligne est REELLEMENT chantee, et on coupe la.
 *
 * `words` est la liste horodatee rendue par Suno : [{word, startS, endS}, …].
 * On aligne mot a mot, dans l'ordre, sans jamais reculer : si un mot chante
 * n'est pas exactement celui qu'on a ecrit (le modele avale un « the », en
 * ajoute un autre), la ligne suivante repart d'ou on en etait.
 *
 * Quand l'alignement echoue ou que les horodatages manquent, on retombe sur un
 * decoupage regulier. La preview existe quand meme, elle est juste moins
 * precise — et ca, on peut le dire honnetement au client.
 */
function alignBeats(beats, words, cap) {
  const total = cap || 30;
  const even = function () {
    const d = total / beats.length;
    return beats.map(function (b, n) {
      return Object.assign({}, b, { at: +(n * d).toFixed(2), dur: +d.toFixed(2), aligned: false });
    });
  };
  if (!words || !words.length) return even();

  const norm = function (s) { return String(s || '').toLowerCase().replace(/[^a-z0-9']/g, ''); };
  const said = words
    .map(function (w) { return { w: norm(w.word || w.text), t: Number(w.startS != null ? w.startS : w.start) }; })
    .filter(function (w) { return w.w && isFinite(w.t); });
  if (!said.length) return even();

  let cursor = 0;
  const starts = [];
  for (let i = 0; i < beats.length; i++) {
    const want = beats[i].line.split(/\s+/).map(norm).filter(Boolean);
    let found = -1;
    // On cherche le premier mot de la ligne, puis on verifie qu'un deuxieme
    // mot suit dans les six suivants : un seul mot commun ne prouve rien.
    for (let k = cursor; k < said.length; k++) {
      if (said[k].w !== want[0]) continue;
      if (want.length < 2) { found = k; break; }
      for (let j = k + 1; j < Math.min(said.length, k + 7); j++) {
        if (said[j].w === want[1]) { found = k; break; }
      }
      if (found > -1) break;
    }
    if (found < 0) return even();
    starts.push(said[found].t);
    cursor = found + Math.max(1, want.length - 1);
  }

  // Les debuts doivent monter. Sinon l'alignement a trouve n'importe quoi.
  for (let i = 1; i < starts.length; i++) {
    if (!(starts[i] > starts[i - 1])) return even();
  }

  // On repart de la premiere ligne chantee : l'intro ne fait pas partie des
  // trente secondes qu'on montre. C'est ce qui evite une preview qui commence
  // sur du vide.
  const t0 = starts[0];
  const out = [];
  for (let i = 0; i < beats.length; i++) {
    const at = +(starts[i] - t0).toFixed(2);
    if (at >= total - 0.5) break;
    let dur = +((i + 1 < starts.length ? starts[i + 1] - starts[i] : total - at)).toFixed(2);
    if (at + dur > total) dur = +(total - at).toFixed(2);
    // Un plan de moins de deux secondes ne se voit pas, un plan de plus de
    // dix n'existe pas chez le modele video : on borne.
    out.push(Object.assign({}, beats[i], {
      at: at,
      dur: Math.max(2, Math.min(10, dur)),
      aligned: true,
      offset: +t0.toFixed(2)
    }));
  }
  return out.length ? out : even();
}

export { storyboard, alignBeats, oneLine, fill, fillInfo, occasionKey, ARC, SCENES };
