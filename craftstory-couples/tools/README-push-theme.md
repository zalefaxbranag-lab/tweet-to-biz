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
