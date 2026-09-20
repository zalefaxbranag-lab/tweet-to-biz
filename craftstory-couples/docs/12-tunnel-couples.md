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

## Ou partent les reponses

1. **`api_url` rempli** → `POST` JSON vers cet endpoint (ou `multipart` si une
   photo accompagne la demande). C'est la porte pour brancher la generation :
   un champ a remplir dans l'editeur, rien a recoder.
2. **`api_url` vide** → formulaire de contact natif de Shopify, donc la boite
   mail de la boutique. Aucun worker, aucune application.

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
