# Le tunnel couples — `cs-duo-flow`

Page dediee, ecrans instantanes. Un seul chargement : `/pages/couples-start`
charge la page une fois, puis chaque ecran s'echange dans le DOM. L'etat reste
en memoire, rien n'est stocke.

## Les six ecrans (sept avec la photo)

| # | Ecran | Champs | Obligatoire |
|---|---|---|---|
| 1 | Les bases | relation, son prenom, ton prenom, occasion | oui |
| 2 | Le son | genre, voix | oui |
| 3 | Ce qui la/le rend unique | qualites (texte libre) | oui |
| 4 | Votre histoire | souvenirs (texte libre) | oui |
| 5 | Un mot de toi | message (texte libre) | **non** |
| 6 | La photo | fichier + consentement | reglage, eteint |
| 7 | Contact | langue, e-mail, telephone | e-mail oui |

L'ecran 6 est derriere la case **Ask for a photo**, eteinte par defaut : le
formulaire de contact de Shopify ne sait pas porter de fichier. On l'allume le
jour ou l'API existe.

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

1. **`api_url` rempli** → `POST` JSON vers cet endpoint (ou `multipart` si une
   photo accompagne la demande). C'est la porte pour brancher la generation :
   un champ a remplir dans l'editeur, rien a recoder.
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
python3 qa/flow_render.py theme/sections/cs-duo-flow.liquid -o flow.html
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

## Le haut de la page, et pourquoi la barre ne triche pas

Le haut reprend la page du concurrent : un emplacement pour ton logo ou ta
creation, le titre en serif sombre, **la seconde ligne en coraille**, le clip,
la barre d'avancement, puis l'encart coraille.

La barre **n'invente rien**. Quand il y a un clip :

- la barre est l'avancee de sa lecture ;
- l'horloge en haut a gauche est le temps qu'il reste ;
- l'etiquette change au fil des etapes (« Reading your story… », « Writing your
  lyrics… », « Recording your song… », « Animating your music video… »).

C'est exactement ce que fait la page qu'on reprend : chez eux `06:05` et `4%`
sont le restant et l'avancee de leur video, pas une animation. Un clip de deux
minutes donne donc une barre qui se remplit en deux minutes, sans rien regler.

Sans clip, elle se remplit sur **Fill time without a clip** (deux minutes par
defaut) et n'annonce alors qu'une attente.

Le clip demarre muet et **sans commandes natives** : elles se posaient pile sur
le sous-titre incruste. Le son revient par un bouton en haut a droite — jamais
en bas, le bas appartient a la legende — et un doigt sur l'image met en pause.
