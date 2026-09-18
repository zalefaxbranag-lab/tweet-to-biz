# Pousser des fichiers de thème sans les retranscrire

## Le problème

`themeFilesUpsert` accepte un corps `TEXT`, ce qui oblige à faire passer le
contenu entier du fichier dans l'appel d'outil. Pour 20 sections, cela
représente ~305 Ko à retranscrire à la main, avec le risque d'erreur que ça
suppose et un coût de contexte absurde.

## La voie rapide, vérifiée

`OnlineStoreThemeFileBodyInput.type` accepte aussi **`URL`**. Et
`shopify-staged-uploads.storage.googleapis.com` **est joignable** depuis cet
environnement — un GET nu renvoie `403`, c'est-à-dire une réponse du serveur et
non un refus de `CONNECT` du proxy. Donc :

1. **`stagedUploadsCreate`** — une seule requête pour N cibles, avec
   `resource: FILE`, `mimeType: "text/plain"`, `httpMethod: POST`. Chaque cible
   renvoie une `resourceUrl` et une liste de `parameters`.
2. **`curl -F "file=@chemin/local"`** vers `https://shopify-staged-uploads.storage.googleapis.com/`
   en rejouant tous les `parameters` comme champs de formulaire. Le fichier part
   **depuis le disque** : rien ne transite par le contexte. Succès = `HTTP 201`.
3. **`themeFilesUpsert`** avec `body: { type: URL, value: <resourceUrl> }`.

Coût total : 3 appels d'API au lieu de 40, et zéro octet retranscrit.

## Ce qu'il faut savoir avant de s'en servir

- **L'upsert est asynchrone.** Il renvoie `upsertedThemeFiles: []` et
  `userErrors: []` même quand il a accepté le travail. Ne jamais conclure à un
  échec sur une liste vide : **revérifier par une requête**
  `theme(id:){ files(filenames:){ nodes { size checksumMd5 } } }` et comparer
  les MD5 aux fichiers locaux. Les gros fichiers arrivent en dernier.
- Les cibles expirent au bout de 24 h et ne servent qu'une fois.
- La signature et la politique sont propres à chaque cible ; seuls
  `x-goog-date`, `x-goog-credential` et `x-goog-algorithm` sont communs au lot.
- `acl` vaut `private`, et Shopify sait quand même lire l'objet : c'est son
  propre bucket de transit.
- Cela ne marche que sur un thème **non publié**. Le connecteur bloque
  volontairement toute écriture sur le thème live, et c'est la règle du projet :
  le propriétaire publie, pas l'assistant.

## Vérification systématique après un push

```
md5sum theme/sections/*.liquid theme/templates/page.couples.json
```
puis la même liste côté thème, et comparaison. Un MD5 identique est la seule
preuve que le fichier est réellement arrivé à l'octet près.

## Les rejets silencieux de Shopify — lire avant de pousser une section

`themeFilesUpsert` peut renvoyer **201 a l'upload et `userErrors: []` a l'upsert
sans appliquer le fichier**. Aucune erreur, nulle part. Deux causes ont ete
isolees a la main, les deux invisibles cote API :

| Cause | Symptome | Ce qui bloquait |
|---|---|---|
| `"default": ""` sur un setting | fichier jamais applique, zero erreur | `cs-duo-hero`, `cs-duo-trust` |
| `name` de section, de bloc ou de preset **> 25 caracteres** | idem | `cs-duo-how` (`"CraftStory Duo How It Works"` = 27) |

Un `default` present doit etre non vide : **on omet la cle** plutot que de la
mettre a `""`.

`qa/schema_check.py` refuse desormais ces deux motifs, plus tout ce que la
documentation Shopify liste et qui coute zero a verifier : cles racine inconnues,
ids dupliques, `select` sans options ou avec un default hors options, `range` a
plus de 101 pas ou dont le pas ne divise pas l'intervalle, `header`/`paragraph`
portant un id ou un default, preset depassant `max_blocks`, et tout
`section.settings.x` lu dans le markup mais absent du schema.

**A lancer avant chaque push, avec les deux autres portes :**

```bash
python3 qa/liquid_check.py theme/sections/*.liquid   # balises Liquid equilibrees
python3 qa/schema_check.py theme/sections/*.liquid   # rejets silencieux
```

## Un piege qui n'a rien a voir avec l'API : l'editeur de theme

L'editeur de theme Shopify **reecrit `templates/page.*.json` en entier** depuis
son etat interne. Shopify l'ecrit lui-meme en tete du fichier. Concretement : une
seule sauvegarde dans l'editeur annule toutes les poussees API faites sur ce
template. C'est arrive une fois sur ce projet — le template est revenu de 21 a 11
sections, avec l'ancien titre et l'ancien bouton.

Donc : **relire le template depuis le theme avant de le modifier**, et fusionner
depuis cette version. Jamais pousser une version locale par-dessus sans l'avoir
relue, sinon on ecrase le travail fait dans l'editeur.

## Un fichier plus gros que ~34 Ko ne passe pas

Constate, pas documente : `cs-duo-reviews.liquid` (42 236 octets) est refuse
alors que `cs-duo-hero.liquid` (33 579) passe, avec un schema propre dans les
deux cas. Le plafond se situe donc entre les deux. A verifier en decoupant la
section si le besoin revient.
