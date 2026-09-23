# Page unique : l'attente (2 min 30), puis la preview de l'associé dessous

Base : le thème live **v35 « COUPLES LOADING + PREVIEW »**, fichier pour fichier.
Deux fichiers changent, rien d'autre :

| Fichier | Changement |
|---|---|
| `sections/cs-duo-flow.liquid` | l'attente (barre de 2 min 30, réglable, la durée du clip) et l'ouverture automatique de la page dessous |
| `templates/page.couples-start.json` | sous le questionnaire, les sections de la page preview, réglages recopiés à l'identique |

**Non modifiés** : la preview de l'associé (`cs-duo-generated-preview`,
`assets/cs-couples-preview.js`, `assets/cs-couples-preview.css`), la page
`/pages/couples-preview` et son gabarit, l'offre, les avis, la FAQ, l'aide, et
tout le reste du thème.

## Ce que voit le visiteur

1. Il remplit le questionnaire (inchangé, consentement « adultes » compris).
2. Au dernier clic, sur la même page, l'écran d'attente apparaît tout de suite.
   On y voit le clip d'attente (ou leur photo s'il n'y en a pas), la barre, la
   notice et « DON'T LEAVE THIS PAGE! ». En même temps, la preview est lancée
   chez le studio de l'associé, avec les mêmes données qu'avant.
3. En **2 min 30** (la durée du clip d'attente), la barre est pleine et tout s'ouvre dessous, **sans clic**. La
   page descend doucement jusqu'à la preview. Avant ça, rien n'est visible
   dessous.
4. La preview de l'associé continue sa fabrication sous ses yeux (ses étapes,
   son compteur). Quand elle est prête, elle se dévoile **seule**, sans le
   bouton « Reveal our preview ». L'offre, les avis et la FAQ apparaissent
   alors, selon sa propre règle, qui n'a pas été touchée.

## Les cas limites

| Cas | Comportement |
|---|---|
| Studio lent (photos lourdes) | la barre attend à 99 % que la preview soit lancée |
| Studio qui ne répond pas | il coupe à 45 s (son code) ; notre plafond est 60 s ; retour au questionnaire avec un message lisible |
| Studio qui refuse (photo, plafond du jour, etc.) | retour au questionnaire avec **son** message, réponses gardées (ex. « Our free preview studio is at capacity. Please try again tomorrow. » : c'est son studio qui est plein, pas la page) |
| Rechargement pendant l'attente | l'attente reprend où elle en était |
| Rechargement après l'ouverture | la page reste ouverte, la preview revient dévoilée |
| « Back to the questionnaire » (dans sa preview) | on repart de zéro sur la même page |
| Gabarit sans preview dessous | à la fin de la barre, `/pages/couples-preview#preview=…` s'ouvre seule (son chemin d'origine, sans clic) |
| Éditeur de thème | aucun verrou, tout est visible |
| Sa preview échoue (ou n'est plus disponible) | la suite (aide, FAQ, offre) s'affiche quand même : jamais de page sans issue |

## Comment c'est branché sans toucher à ses fichiers

- Sa section démarre au chargement de la page, sans preview à suivre. Quand
  la sienne est lancée, on la remplace par une copie neuve rendue par Shopify
  (Section Rendering API). On émet ensuite `shopify:section:load`, l'événement
  qu'il écoute déjà : elle redémarre sur la nouvelle preview.
- Pour ne pas cliquer sur « Reveal », on pose `csCouplesRevealed` à l'avance.
  C'est la clé que son code utilise déjà pour une preview déjà vue.
- La preview voyage aussi dans l'adresse (`#preview=…`, comme sur sa page) :
  elle démarre même si le navigateur refuse de garder quoi que ce soit.
- Son offre lit le prénom au chargement de la page. Sur la page unique, le
  prénom n'existe qu'après le questionnaire : on relance l'offre au dernier
  clic, avec le même événement. Son bouton dit alors « Unlock Marie's full
  music video ».
- Si sa chanson se met à jouer, le clip d'attente se met en pause.
- Dans l'éditeur, tout se voit, offre comprise.

## Tests

`qa/live30_drive.py` : 96 vérifications dans Chromium, avec son vrai JS et sa
vraie CSS. Son studio est remplacé par un faux servi par le test : aucune
génération réelle. `qa/build_live30.py` rend les pages depuis les vrais gabarits.

## Poussé sur le brouillon

Le brouillon **v36 « CraftStory v36 LIVE v35 + attente 2m30 (a publier) »**
(`208474538315`) est une copie exacte du live. Seuls les deux fichiers
ci-dessus diffèrent, vérifié fichier par fichier : la section au MD5 près
(`545df140…`), le gabarit sur son contenu.

## La durée de la vraie génération

Le studio de l'associé n'est pas joignable depuis l'environnement de travail
(refus du réseau), donc pas de mesure directe. Ce qu'on sait : son propre
écran de chargement annonce « a few minutes » et ne parle de retard qu'après
4 min ; ses étapes s'enchaînent (plan, avatar, puis les 4 scènes ; la chanson
en parallèle), et sur KIE une image prend ~30-60 s, une chanson complète
~1-2 min. D'où les 2 à 3 min observées. Avec la barre à 2 min 30 : si la
preview est prête avant, elle s'affiche d'emblée ; si elle prend 3 min, on
voit sa progression ~30 s de plus, puis elle se dévoile seule (testé).

## La vidéo d'attente

Éditeur → section du questionnaire → « Clip (upload MP4) ». On y prend la
meilleure version MP4 (jusqu'à 1080p), la forme du clip (rien n'est rogné,
réglage « Clip shape » = « Same as the clip ») et sa première image pendant
le chargement. Régler « How long the bar takes » sur la durée du clip
(150 s = 2 min 30, par défaut). Sans clip, leur photo occupe le cadre.

## Le clip façon « music video » (brouillon v37, à tester)

Section à part, `cs-duo-montage`, posée tout en bas de la page unique : elle
n'affiche rien d'elle-même. Quand la preview de l'associé est dévoilée, son
grand cadre devient un clip : ses 4 scènes se relaient sur SA chanson (un plan
toutes les 5 s, en fondu, zoom avant, arrière, glissements), la légende de la
scène en bas, un grand bouton de lecture (qui passe par SON lecteur), une
carte de fin avec le prénom et « Get the full music video » qui descend à
l'offre. Ses fichiers ne changent pas ; retirer la section rend sa preview
d'origine.

## À savoir
- Le bouton de l'offre mène toujours à `/pages/couples`, comme sur le live.
  Aucun paiement n'y est branché.
