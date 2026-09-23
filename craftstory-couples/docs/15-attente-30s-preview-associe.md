# Page unique : 30 s d'attente, puis la preview de l'associé dessous

Base : le thème live **v35 « COUPLES LOADING + PREVIEW »**, fichier pour fichier.
Deux fichiers changent, rien d'autre :

| Fichier | Changement |
|---|---|
| `sections/cs-duo-flow.liquid` | l'attente (barre de 30 s, 1 min au plus) et l'ouverture automatique de la page dessous |
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
3. En **30 s**, la barre est pleine et tout s'ouvre dessous, **sans clic**. La
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
| Studio qui refuse (photo, etc.) | retour au questionnaire avec **son** message |
| Rechargement pendant l'attente | l'attente reprend où elle en était |
| Rechargement après l'ouverture | la page reste ouverte, la preview revient dévoilée |
| « Back to the questionnaire » (dans sa preview) | on repart de zéro sur la même page |
| Gabarit sans preview dessous | à la fin des 30 s, `/pages/couples-preview#preview=…` s'ouvre seule (son chemin d'origine, sans clic) |
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

`qa/live30_drive.py` : 76 vérifications dans Chromium, avec son vrai JS et sa
vraie CSS. Son studio est remplacé par un faux servi par le test : aucune
génération réelle. `qa/build_live30.py` rend les pages depuis les vrais gabarits.

## Poussé sur le brouillon

Le brouillon **v36 « CraftStory v36 LIVE v35 + attente 30s (a publier) »**
(`208474538315`) est une copie exacte du live. Seuls les deux fichiers
ci-dessus diffèrent, vérifié fichier par fichier : la section au MD5 près
(`f4140032…`), le gabarit sur son contenu.

## À savoir

- Aucune vidéo d'attente n'est réglée, ni sur le live ni avant. Tant qu'il n'y
  en a pas, leur photo occupe le cadre. Pour en mettre une : éditeur, section
  du questionnaire, « Clip (upload MP4) ».
- Le bouton de l'offre mène toujours à `/pages/couples`, comme sur le live.
  Aucun paiement n'y est branché.
