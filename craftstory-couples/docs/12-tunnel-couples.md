# Le tunnel couples — `cs-duo-flow`

Page dediee, ecrans instantanes. Un seul chargement : `/pages/couples-start`
charge la page une fois, puis chaque ecran s'echange dans le DOM. L'etat reste
en memoire, rien n'est stocke.

## Les sept ecrans

| # | Ecran | Champs | Obligatoire |
|---|---|---|---|
| 1 | Les bases | relation, son prenom, ton prenom, occasion | oui |
| 2 | Le son | genre, voix | oui |
| 3 | Ce qui la/le rend unique | qualites (texte libre) | oui |
| 4 | Votre histoire | souvenirs (texte libre) | oui |
| 5 | Un mot de toi | message (texte libre) | **non** |
| 6 | **La photo** | une ou deux images + consentement | **oui** |
| 7 | Contact | langue, e-mail, telephone | e-mail oui |

## L'ecran photo

Il n'est plus derriere un reglage, et il n'est plus optionnel : **sans visage,
il n'y a pas de preview a montrer**. C'est la meme place que dans le tunnel
enfants — juste avant le contact, apres l'histoire, quand la personne a deja
tout raconte et n'abandonne plus.

Un seul champ, `multiple`, **une ou deux images** : une photo du couple, ou une
de chacun. Les deux se valent comme reference — le modele accepte plusieurs
images en entree, et deux visages separes donnent meme une meilleure
ressemblance qu'une photo de groupe. Au-dela de deux, les deux premieres sont
gardees et un message le dit.

### Reduites dans le navigateur, envoyees en dataURL

Une photo de telephone pese 4 Mo. Chaque fichier passe par un `canvas` :
**1280 px sur le grand cote, JPEG qualite 0,82**, forme conservee. Puis
`toDataURL`, et le dataURL part **dans le meme JSON que les reponses**
(`photo`, `photo2`, `photo_count`).

Pas de `multipart` : c'est exactement le format que le worker des enfants
recoit deja (`cs-generate.js` envoie un dataURL dans un POST JSON). Rien a
ecrire de son cote.

### Obligatoire, mais jamais redemande

Le champ porte `data-req`, et le script le lui **retire des qu'une photo est
gardee**. Il faut ce detour : apres un rechargement un champ fichier est
toujours vide, alors que la photo, elle, est encore la. Sans ca l'ecran
redemanderait un fichier deja fourni.

Les photos sont posees dans le `sessionStorage` (`csDuoPhotos`) **des le
depot**, pas seulement a l'envoi : un rechargement au milieu du tunnel, ou le
retour du POST natif, ne fait pas recommencer. Le quota peut refuser deux
images ; ce n'est pas bloquant, elles partent quand meme avec l'envoi.

### Deux messages d'erreur a elles

« Remplis ce champ » ne veut rien dire devant un depot de photo ou une case a
cocher. `valid()` lit un `data-req-msg` par champ :

- sans photo → « Add at least one photo to continue. »
- consentement non coche → « Please tick the box so we can use your photo. »

### Sans `api_url`, la photo ne peut pas partir

Un formulaire de contact Shopify **ne sait pas porter de fichier**. On ne fait
pas semblant : le message qui arrive dans la boite mail dit combien de photos
ont ete deposees, qu'elles sont restees dans le navigateur du visiteur, et quoi
remplir pour les recevoir. Le reglage **API URL** est le seul chemin.

### Leur photo prend la place du cadre vide

Sur l'ecran d'attente, si aucun clip n'est charge, leur premiere photo remplit
le cadre (assombrie, en `object-fit:cover`). L'attente devient la leur au lieu
d'un rectangle vide, et ca leur prouve d'un coup d'oeil que la photo est bien
partie avec le reste.

## « Other » et son champ libre

La derniere occasion de la liste ouvre un champ texte : beaucoup de choix
proposes, et quand meme la place d'ecrire un besoin precis. Trois reglages :
**Option that opens a free field** (`Other`, mot pour mot comme dans la liste),
son libelle et son invite.

Le champ vit dans le meme `fieldset` que ses boutons, et le script part de la
pour retrouver le groupe : le deplacer dans un autre fieldset suffit a
l'attacher a un autre choix, sans toucher au code.

Il devient obligatoire quand l'option est cochee, et **se vide en se
refermant** : une precision abandonnee ne part pas avec le reste. Les champs
vides ne sont plus portes du tout dans le message — un telephone non renseigne
n'apparait plus comme une ligne vide.

## Ou partent les reponses

1. **`api_url` rempli** → un seul `POST` JSON vers cet endpoint, reponses et
   photos ensemble (`photo`, `photo2` en dataURL, `photo_count`). C'est la
   porte pour brancher la generation : un champ a remplir dans l'editeur, rien
   a recoder.
2. **`api_url` vide** → formulaire de contact natif de Shopify, donc la boite
   mail de la boutique. Aucun worker, aucune application.

### Pourquoi un vrai envoi de formulaire, et pas un fetch

Le second cas fait un `<form>` que le navigateur poste lui-meme. C'etait un
`fetch` au depart, et c'etait un mauvais choix pour deux raisons :

- Un `fetch` peut repondre **200 alors que Shopify a servi une page de
  captcha**. Rien n'est parti, et on annoncerait quand meme au client que son
  histoire est envoyee. Avec un envoi natif, c'est Shopify qui tranche : il ne
  renvoie sur `?contact_posted=true` qu'en cas de reussite reelle.
- Si un captcha est demande, le visiteur le voit et peut le resoudre.

Ca coute un rechargement au tout dernier clic. Le prenom et l'e-mail sont mis
de cote dans le `sessionStorage` de l'onglet juste avant, relus au retour pour
garder l'ecran final personnalise, puis effaces.

### Tester depuis l'editeur de theme ne prouve rien

Shopify **bloque les envois de formulaire dans l'editeur**. Le tunnel detecte
`Shopify.designMode` : il montre l'ecran final sans rien envoyer et affiche un
encart jaune qui le dit. Sans ce cas, tester le tunnel depuis l'editeur
finissait toujours sur « We could not send that », une erreur qui n'existe pas
sur la boutique en ligne.

Pour verifier un envoi reel, il faut donc **publier la page** et l'ouvrir sur
la boutique, pas dans l'editeur.

Pas de produit, pas de panier, pas de paiement : le tunnel collecte et se
termine sur un message. C'est volontaire.

## Le pre-remplissage depuis la landing page

Les six cartes « Gift a Song » pointent vers le tunnel avec l'occasion deja
choisie :

```
/pages/couples-start?occasion=Proposal
/pages/couples-start?occasion=Anniversary
/pages/couples-start?occasion=First%20dance
/pages/couples-start?occasion=Just%20because
```

La valeur est comparee sans tenir compte de la casse aux lignes de
**Occasion options**. Renommer une option sans corriger le lien fait
simplement retomber sur un ecran 1 vierge — rien ne casse.

Les neuf autres appels a l'action de la page couples pointent sur
`/pages/couples-start` sans parametre.

## Deux pieges deja payes

- **`{% javascript %}` ne voit pas Liquid.** Ce bloc est mutualise entre toutes
  les instances de la section : il ne peut pas interpoler un reglage. Les six
  libelles reglables (boutons, messages d'erreur) passent donc par des
  attributs `data-` poses sur la racine. Les lire depuis un global
  `window.*` revenait a les ignorer.
- **`hidden` perd contre une regle d'auteur.** `.cs-flow-top{display:flex}` bat
  le `display:none` de la feuille du navigateur : sans
  `.cs-duo-flow [hidden]{display:none !important}`, le bouton Retour s'affiche
  des le premier ecran et la barre de progression reste par-dessus l'ecran
  final.

## Verifier avant de pousser

```
python3 qa/schema_check.py theme/sections/cs-duo-flow.liquid
python3 qa/template_check.py theme/templates/page.couples-start.json
```

Puis le rendu reel, qui a trouve les deux pieges ci-dessus :

```
python3 qa/build_pages.py # theme/sections/cs-duo-flow.liquid -o flow.html
python3 qa/flow_drive.py      # 31 assertions, du premier ecran a l'envoi
```

---

# La page d'apres : `/pages/couples-preview`

Ce qui vient apres le tunnel. **Structure et formulaires seulement** : rien
n'est branche sur une generation ni sur un paiement. La plupart des champs sont
donc vides au depart, volontairement, et se remplissent quand le contenu existe.

Deux sections neuves, et deux deja ecrites qu'on reutilise :

| Section | Ce qu'elle porte |
|---|---|
| `cs-duo-pv-song` | le logo, les deux titres, le clip, la barre d'avancement, l'encart, l'apercu du morceau, la preuve, le tarif, le rebours, les lignes du morceau complet |
| `cs-duo-pv-offer` | le choix de vitesse, l'option, le bouton, la garantie, la suite, la barre du bas |
| `cs-duo-reviews` | les avis, en disposition **liste** (nouveau reglage) avec le recapitulatif de note |
| `cs-duo-faq` | les questions, telle quelle |

## `{name}`

Ecrit `{name}` dans un titre, un bouton ou une etape : il devient le prenom de
la personne. Il arrive par `?name=` dans l'URL, et le tunnel l'ajoute tout seul
a son bouton final. Sans le parametre, le gabarit est retire au lieu de laisser
un trou dans la phrase.

## Le choix voyage dans le lien

Aucun achat n'a lieu sur cette page. Le bouton est un lien reglable, et la
vitesse choisie plus l'option s'y ajoutent en parametres :

```
/pages/couples?speed=48h&addon=1&name=Marie
```

Le jour ou un produit existe, on colle son URL dans **Button link** et le choix
du client arrive avec, sans une ligne de code.

## Le rebours

Eteint par defaut. Allume, l'echeance est posee **une seule fois par visiteur**
et gardee dans son navigateur : elle ne repart pas a chaque rechargement. Un
rebours qui redemarre n'est pas une echeance, c'est un decor — et de la fausse
urgence, que les regles de redaction de cette boutique interdisent. Quand il
arrive a zero, la ligne **When it runs out** remplace le chiffre.

## Les chiffres et les avis

Le recapitulatif de note n'apparait que si un score est saisi, et les blocs
d'avis sont vides. C'est la meme regle que sur la landing page : des mots de
vrais clients ou rien. Une note inventee, un nombre d'avis invente et des
temoignages inventes sont illegaux aux Etats-Unis et au Royaume-Uni, font
refuser les comptes publicitaires, et sont deja interdits par les regles de
redaction du projet.

## Le banc d'essai

`qa/mock_render.py` rend n'importe quelle section hors Shopify, a partir d'un
petit gabarit JSON — reglages, blocs, boucles, conditions, filtres courants :

```
python3 qa/mock_render.py gabarit.json -o page.html
```

C'est ce qui a montre les etapes numerotees 4, 5, 6 : `forloop.index` comptait
aussi les vitesses et l'option. Un compteur a part regle ca.

## L'enchainement complet

Il n'y a pas d'ecran de confirmation. Le clic sur le dernier bouton remplace la
question par **l'attente, sur la meme page**, sans rechargement :

```
/pages/couples-start          six ecrans
      |  clic sur le dernier bouton
      |  envoi natif vers /contact, retour en ?contact_posted=true
      v
  L'ATTENTE prend la place du formulaire, meme page
      |  logo, titre, seconde ligne coraille, clip, barre, encart
      |  la barre se remplit sur mk_minutes (cinq par defaut)
      v
  BARRE PLEINE -> un bouton apparait
      |  « Your music video preview »
      v
/pages/couples-preview?name=Marie      tout le long ecran
```

Cet ecran **ne bouge plus** une fois affiche. Aucun saut automatique : le seul
changement de page vient du bouton, et seulement a 100 %.

L'echeance est posee une fois par visiteur et gardee dans son navigateur :
recharger ne fait pas repartir la barre, et une attente finie reste finie.

Le clip n'est **charge qu'a cet instant** (`preload="none"`, `src` posee par le
script) : personne ne telecharge une video qu'il ne verra qu'a la fin du
tunnel, ou jamais.

### Tester depuis l'editeur de theme

Shopify **bloque les envois de formulaire** dans l'editeur. L'attente s'affiche
quand meme — c'est le seul endroit ou le marchand peut la voir tant que ses
pages ne sont pas publiees — avec un encart qui dit que rien n'est parti.

### Les reponses suivent, sans serveur

Le tunnel met **toutes** ses reponses de cote dans le `sessionStorage` de
l'onglet avant d'envoyer. La page d'apres les relit pour composer ses titres :

| Gabarit | Devient |
|---|---|
| `{name}` | son prenom |
| `{you}` | ton prenom |
| `{rel}` | la relation (Wife, Partner…) |
| `{occasion}` | l'occasion, la precision libre si elle existe |
| `{genre}` | le genre musical |
| `{voice}` | la voix |

D'ou `Marie's Unique Music Video` et `Soul / R&B melody, written for Marie
(Wife)`. Rien n'est stocke cote serveur, et ca meurt avec l'onglet. Un
`?name=` dans l'URL sert de secours pour qu'un lien partage reste lisible.

Quand une reponse manque, le gabarit **et ce qui l'entoure** sont retires : pas
de `('s song` ni de parenthese vide.

## Le verrou de la page d'apres, eteint par defaut

`cs-duo-pv-song` sait masquer tout ce qui suit son bloc d'attente, tant que
`html[data-cs-lock="1"]`. **Le reglage est eteint**, parce que l'attente a lieu
sur la page du tunnel et qu'on n'arrive ici qu'en cliquant son bouton.

Verrou eteint, la page s'ouvre d'entree **et retire sa barre** : relancer un
rebours a zero ferait croire a la personne qu'elle doit attendre une deuxieme
fois.

On l'allume seulement si l'on fait de cette page le point d'arrivee direct.
Jamais dans l'editeur de theme, sinon le bas de la page serait inmodifiable.

## Le haut de l'attente

Le haut reprend la page du concurrent : un emplacement pour ton logo ou ta
creation, le titre en serif sombre, **la seconde ligne en coraille**, le clip,
la barre d'avancement, puis l'encart coraille.

La barre porte l'attente avant l'ouverture, sur **How long the bar takes**
(cinq minutes par defaut). L'horloge sur le clip montre le temps qu'il reste,
et l'etiquette suit les etapes (« Reading your story… », « Writing your
lyrics… », « Recording your song… », « Animating your music video… »).

C'est une vraie echeance, pas un decor : elle est posee une fois par visiteur,
elle ne repart pas au rechargement, et elle ouvre reellement la page. Ce qu'elle
**ne fait pas** encore, c'est refleter une production en cours — il n'y en a
pas. Le jour ou `api_url` renvoie une tache a suivre, c'est ici que son
avancement reel se branche, et la structure est deja la.

Le clip demarre muet et **sans commandes natives** : elles se posaient pile sur
le sous-titre incruste. Le son revient par un bouton en haut a droite — jamais
en bas, le bas appartient a la legende — et un doigt sur l'image met en pause.

## Le piege des marges de paragraphe

`cs-head` pose `.cs p{margin:0}`. Sa specificite est **0,1,1** — une classe plus
un type. Une classe seule posee sur un paragraphe vaut **0,1,0** et **perd**,
quel que soit l'ordre des feuilles de style, parce que la specificite passe
avant l'ordre.

Consequence : dans toutes les sections de ce theme, **chaque marge ecrite sur un
`<p>` avec une classe seule ne s'applique pas du tout**. On croit avoir regle un
rythme vertical, et l'espacement qu'on voit vient d'ailleurs — interlignes,
`gap` de flex, marges du parent.

Trouve en mesurant : l'espace entre la ligne coraille et le clip valait `0`
alors que la regle annonçait `24px`.

La correction est d'ecrire la racine de la section devant :

```css
.cs-duo-flow .cs-flow-mk-sub{margin:8px 0 24px}   /* 0,2,0 : gagne */
```

`cs-duo-flow` et `cs-duo-pv-song` ont un bloc dedie en fin de feuille qui releve
ainsi les dix-sept marges concernees, avec le pourquoi ecrit a cote.

**Les autres sections du theme ont le meme probleme et n'ont pas ete touchees** :
corriger leurs marges deplacerait visiblement la landing page, sur laquelle
tournent des publicites. A faire quand ce sera le moment, section par section.

## Le cadre vide du clip

Tant qu'aucun MP4 n'est charge, le bloc video affiche un cadre en pointilles a
la bonne forme, avec une phrase reglable. Sans lui, la page paraissait amputee
et on ne voyait pas ou deposer le fichier. Meme chose sur le clip du haut de la
page d'apres.

## L'avertissement en capitales

L'encart coraille porte deux lignes : la phrase, puis **DON'T LEAVE THIS PAGE!**
en capitales, separee par un filet. C'est elle qui evite qu'on quitte la page
pendant que la barre tourne. Reglable, et elle disparait avec l'encart des que
le bouton apparait.

---

# Le thème à publier : v32

`CraftStory v32 LIVE + couples (a publier)` — id **208344875339**, non publié.

## Pourquoi une duplication et pas une mise a jour du brouillon

Le brouillon (`v31 + page couples`) datait du 19 septembre. Entre-temps **une
seule chose avait change sur le live** : `config/settings_data.json`, le 21 a
14:53, parce que **Microsoft Clarity** avait ete installe. Publier le brouillon
tel quel aurait donc **arrete le suivi Clarity** sans que rien ne le signale.

Rapatrier ce fichier dans le brouillon demandait de le retranscrire a la main :
191 reglages qui portent les couleurs, les polices et le logo de TOUT le site.
Essai fait, **le MD5 l'a refuse** (11263 octets au lieu de 9096). Une erreur sur
une couleur ou une police y passerait inapercue et casserait la boutique.

D'ou le choix : **`themeDuplicate` sur le live**. Shopify recopie lui-meme ses
507 fichiers, a l'octet, `settings_data.json` compris. Je n'ecris plus que les
fichiers que j'ai ecrits, verifiables au MD5 contre mes copies locales.

## Ce qui a ete pousse sur v32

| Quoi | Combien | Verification |
|---|---|---|
| Sections du tunnel et des pages | 14 | MD5 identique a mes copies locales |
| Sections retouchees mais inutilisees (`demos`, `trust`, `vsl`) | 3 | MD5 identique |
| `templates/page.couples-preview.json` | 1 | **MD5 identique au brouillon** |
| `templates/page.couples-start.json` | 1 | reglages vides des deux cotes |
| `templates/page.couples.json` | 1 | verifie **valeur par valeur** |

Le dernier ne peut pas se verifier au MD5 : Shopify normalise un gabarit quand
l'**editeur** enregistre, pas quand l'API ecrit. Sa verification est donc
semantique — et elle a servi : l'editeur avait change sept questions de la FAQ
(« song » → « music video », espaces avant les `?`) et le titre de la section
aide, que ma copie locale avait perdus (`'Still Have'` tronque). Les valeurs du
brouillon ont ete reportees, puis reverifiees une a une.

## Ce qui n'a PAS ete repris

`cs-duo-cta`, `cs-duo-order`, `cs-duo-popup`, `cs-duo-totop` et
`snippets/cs-duo-probe.liquid`. Aucun gabarit ne les reference, et les quatre
premiers sont precisement les elements que le proprietaire avait demande de
retirer. Ils restent sur l'ancien brouillon si besoin.

## La preuve

- 25 fichiers critiques du live (layout, reglages, en-tete, pied de page, page
  d'accueil, panier, les 9 gabarits produits, les assets `cs-*` du tunnel
  enfants) : **empreintes identiques au live**, aucune absente.
- 14 sections couples : **empreintes identiques aux copies locales**.
- 79 verifications sur le tunnel, 37 sur la page d'apres : **tout passe**.

## Les six emplacements de plans, prets dans l'editeur

`page.couples-preview.json` porte **six blocs Beat** avec leurs paroles deja
ecrites, au-dessus des blocs Face. Il reste a chacun un fichier a deposer, et
un champ **Song file URL** au niveau de la section : le montage tourne des que
les sept fichiers sont la.

Le gabarit est arrive **a l'octet** cette fois (10 240, MD5 identique) parce
qu'on n'y a ecrit que ce qui s'ECARTE du schema. Tout le reste vit dans le
schema de la section, ou Shopify ne peut pas l'effacer.

## Ce qui reste a faire, par le proprietaire

1. Publier **v32** : Boutique en ligne → Themes → Publier.
2. Passer les trois pages en **Visible** : `couples`, `couples-start`,
   `couples-preview`. Elles sont encore masquees, et une page masquee renvoie
   404 quel que soit le theme publie.

Dans cet ordre : publiees avant le theme, elles s'afficheraient vides.
