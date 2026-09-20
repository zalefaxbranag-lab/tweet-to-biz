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
