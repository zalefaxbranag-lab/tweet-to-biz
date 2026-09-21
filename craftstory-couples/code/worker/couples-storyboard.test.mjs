/* Le scenario et l'alignement, sans reseau.
 *
 *     node code/worker/couples-storyboard.test.mjs
 *
 * Ces deux fonctions decident de tout ce qui sera fabrique. Une faute ici
 * coute une generation entiere par client, donc elles sont testees seules,
 * avant tout appel.
 */
import { storyboard, alignBeats, oneLine } from './couples-storyboard.js';

let ok = true;
function check(label, got, want) {
  const good = JSON.stringify(got) === JSON.stringify(want);
  ok = ok && good;
  console.log((good ? '  OK   ' : '  FAIL ') + label + '  -> ' + JSON.stringify(got)
    + (good ? '' : '  (attendu ' + JSON.stringify(want) + ')'));
}

const FULL = {
  their_name: 'Marie', your_name: 'Thomas', relationship: 'Wife', occasion: 'Wedding',
  genre: 'Soul / R&B', voice: 'Duet',
  qualities: 'Elle rit avant la fin de la blague, et elle chante faux dans la voiture.',
  story: 'Un train rate a Lyon en 2019, on a attendu deux heures sur le quai.'
};

console.log('\n--- UNE PHRASE DE LEURS MOTS ---');
check('la premiere proposition', oneLine('She laughs early. She also sings badly.', 58),
  'She laughs early');
check('pas de mot vide en fin de ligne', oneLine('We waited two hours on the', 58),
  'We waited two hours');
check('pas d auxiliaire en fin de ligne',
  oneLine('She remembers every birthday of everyone she has ever met and never forgets', 55),
  'She remembers every birthday of everyone');
check('coupe avant une conjonction',
  oneLine('A power cut in August and the whole street was outside until midnight', 44),
  'A power cut in August');
check('vide reste vide', oneLine('', 58), '');
check('vide reste vide meme sur du blanc', oneLine('   \n  ', 58), '');

console.log('\n--- LE SCENARIO ---');
const sb = storyboard(FULL);
check('six temps', sb.beats.length, 6);
check('l occasion est reconnue', sb.occasion, 'wedding');
check('un decor par occasion', sb.beats[0].template, 'craftstory-duo-wedding');
check('le meme decor pour les six',
  sb.beats.every(b => b.template === 'craftstory-duo-wedding'), true);
check('le titre porte son prenom', sb.title, "Marie's Song");
check('le style ne laisse pas d intro', sb.style.indexOf('no long intro') > -1, true);
check('la voix demandee est portee', sb.style.indexOf('male and female duet') > -1, true);
check('leurs mots sont une ligne entiere', sb.beats[1].line, 'Un train rate a Lyon en 2019');
check('leur qualite aussi', sb.beats[2].line, 'Elle rit avant la fin de la blague');
check('les paroles portent les six lignes',
  sb.beats.every(b => sb.lyrics.indexOf(b.line) > -1), true);
check('et les reperes de structure',
  ['[Verse]', '[Pre-Chorus]', '[Chorus]'].every(t => sb.lyrics.indexOf(t) > -1), true);

console.log('\n--- LE PROMPT IMAGE NE DECRIT JAMAIS LEURS VISAGES ---');
// La photo est la verite de terrain. Decrire un visage, c'est se battre contre
// elle et perdre la ressemblance : c'est la lecon du tunnel enfants, et la
// regle de securite du projet.
const BANNED = ['skin', 'hair colour', 'hair color', 'eyes are', 'blonde', 'brunette',
  'age ', 'years old', 'beautiful woman', 'handsome man', 'caucasian', 'asian', 'black man'];
for (const b of sb.beats) {
  const low = b.scene.toLowerCase();
  check('plan ' + b.n + ' ne decrit pas de visage',
    BANNED.filter(w => low.indexOf(w) > -1), []);
}
check('leur histoire est DANS le decor du plan 2',
  sb.beats[1].scene.indexOf('Un train rate a Lyon en 2019') > -1, true);
check('leur qualite est DANS le decor du plan 3',
  sb.beats[2].scene.indexOf('Elle rit avant la fin de la blague') > -1, true);

console.log('\n--- SANS REPONSES, AUCUN TROU ---');
const bare = storyboard({});
check('six temps quand meme', bare.beats.length, 6);
check('aucun jeton laisse', bare.beats.filter(b => /[{}]/.test(b.line)), []);
check('aucune virgule orpheline', bare.beats.filter(b => /\s,|,\s*$|^\s*,/.test(b.line)), []);
check('aucune ligne vide', bare.beats.filter(b => !b.line.trim()), []);
check('le repli entier est prefere a une ligne rabotee',
  bare.beats[0].line, 'Before you, the days all looked the same');

console.log('\n--- LES OCCASIONS ---');
for (const [given, want] of [['Wedding', 'wedding'], ['Proposal', 'proposal'],
  ['Anniversary', 'anniversary'], ["Valentine's Day", 'valentine'], ['Birthday', 'birthday'],
  ['Just because', 'default'], ['', 'default']]) {
  check('« ' + given + ' »', storyboard({ occasion: given }).occasion, want);
}

console.log('\n--- LES COUPES, POSEES SUR LA CHANSON ---');
// Une piste ou les lignes tombent a 3,0 / 8,5 / 12,0 / 18,5 / 23,0 / 27,0.
function said(lines, at) {
  const out = [];
  lines.forEach((line, i) => {
    line.split(/\s+/).forEach((w, k) => out.push({ word: w, startS: at[i] + k * 0.3 }));
  });
  return out;
}
const AT = [3.0, 8.5, 12.0, 18.5, 23.0, 27.0];
const words = said(sb.beats.map(b => b.line), AT);
const cut = alignBeats(sb.beats, words, 30);
check('six plans alignes', cut.length, 6);
check('tous alignes sur le son', cut.every(b => b.aligned), true);
// L intro ne fait pas partie des trente secondes : on repart de la premiere
// ligne chantee, sinon la preview commence sur du vide.
check('la preview demarre sur la voix', cut[0].at, 0);
check('l intro retiree est notee', cut[0].offset, 3);
check('les coupes suivent la chanson', cut.map(b => b.at), [0, 5.5, 9, 15.5, 20, 24]);
check('les durees decoulent des coupes', cut.map(b => b.dur), [5.5, 3.5, 6.5, 4.5, 4, 6]);
check('rien ne depasse le plafond',
  cut.every(b => b.at + b.dur <= 30.001), true);
check('les paroles suivent leur plan', cut.map(b => b.n), [1, 2, 3, 4, 5, 6]);

console.log('\n--- QUAND LES HORODATAGES MANQUENT ---');
const even = alignBeats(sb.beats, null, 30);
check('un decoupage regulier', even.map(b => b.at), [0, 5, 10, 15, 20, 25]);
check('et il le dit', even.every(b => b.aligned === false), true);
check('des durees egales', even.map(b => b.dur), [5, 5, 5, 5, 5, 5]);

console.log('\n--- QUAND L ALIGNEMENT EST FAUX ---');
// Des mots qui ne sont pas les notres : on ne bricole pas, on retombe sur le
// decoupage regulier. Une coupe posee au hasard est pire que reguliere.
const junk = said(['la la la', 'na na na'], [1, 5]);
check('mots inconnus -> decoupage regulier', alignBeats(sb.beats, junk, 30).every(b => !b.aligned), true);
// Des debuts qui reculent : l alignement a trouve n importe quoi.
const back = said(sb.beats.map(b => b.line), [3, 2, 12, 18, 23, 27]);
check('debuts qui reculent -> regulier', alignBeats(sb.beats, back, 30).every(b => !b.aligned), true);
check('liste vide -> regulier', alignBeats(sb.beats, [], 30).every(b => !b.aligned), true);

console.log('\n--- UNE CHANSON QUI TRAINE ---');
// Les lignes arrivent tard : on garde ce qui rentre dans les trente secondes
// et on borne le dernier plan, plutot que de promettre une image figee.
const slow = said(sb.beats.map(b => b.line), [2, 9, 20, 34, 48, 60]);
const cutSlow = alignBeats(sb.beats, slow, 30);
check('seuls les plans qui rentrent', cutSlow.length, 3);
check('aucun plan de plus de dix secondes', cutSlow.every(b => b.dur <= 10), true);
check('aucun plan de moins de deux secondes', cutSlow.every(b => b.dur >= 2), true);

console.log('\n' + (ok ? 'TOUT PASSE' : 'ECHECS CI-DESSUS'));
process.exit(ok ? 0 : 1);
