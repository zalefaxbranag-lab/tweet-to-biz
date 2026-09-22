# La page unique, la generation, le paiement

Etat au 22/09/2026. Remplace la navigation vers `/pages/couples-preview` :
tout se passe maintenant sur `/pages/couples-start`.

## Ce que voit le client

1. Le tunnel : sept ecrans, photo comprise.
2. **Au dernier clic, l'attente s'affiche tout de suite, sur la meme page.**
   La video d'attente joue, la barre part pour **trois minutes**.
3. Pendant ce temps, rien d'autre n'est visible : ni la preview, ni l'offre.
4. Quand **la barre est pleine ET la video est finie ET la preview est
   prete**, toute l'ancienne page d'apres **s'ouvre dessous** : la preview,
   la preuve, le tarif, l'offre, les avis, les questions. On ne change pas de
   page ; un encart « ✓ Your preview is ready — scroll down » dit ou regarder.
5. La preview : **six images de cinq secondes**, un leger zoom, la chanson
   coupee a trente secondes, calee sur le premier mot chante.
6. Le bouton « Unlock » met le choix au panier et ouvre le **checkout
   Shopify** (Shopify Payments).

## Les trois conditions, et leurs cas limites

| Situation | Ce qui se passe |
|---|---|
| Preview prete avant 3 min | la barre finit ses 3 min, puis ca s'ouvre |
| Preview en retard | la barre attend a **99 %** sur « Almost there… », et s'ouvre des qu'elle arrive |
| Barre pleine, video encore en cours | « Your preview is ready — it appears right after the video. », ouverture a la fin de la video |
| Video bloquee par le telephone (lecture auto refusee, economie d'energie) | elle ne bloque personne |
| Generation perdue pour de bon | ca s'ouvre quand meme, avec un message a la place de la preview ; l'offre reste la |
| Rechargement pendant l'attente | l'attente reprend ou elle en etait, la page continue d'interroger l'API |
| Rechargement apres ouverture | tout est deja ouvert |
| Editeur de theme | aucun verrou : tout est visible pour etre regle |

## Comment le bas de la page est cache

Le tunnel pose dans le HTML une regle :
`html[data-cs-duo-gate="closed"] #shopify-section-<flow> ~ .shopify-section {display:none}`.
Elle vise **les sections qui suivent le tunnel, et elles seules**. Rien a
regler dans les autres sections. Pose par le HTML et non par le script, sinon
le bas s'afficherait une fraction de seconde avant d'etre cache.

## La generation

Voir `api-couples/README.md`. En bref : une fonction Supabase Edge
(`craftstory-couples`), sans etat, qui lance ensemble la chanson complete
(Suno V5, paroles ecrites par Suno depuis un brief fait de leurs reponses) et
six images `nano-banana-pro` avec leurs photos en reference. La page
l'interroge toutes les cinq secondes.

**Tant que `KIE_KEY` n'est pas dans les secrets Supabase, `/start` repond
503 et chaque client voit le message de repli.** A regler avant de publier.

## Le prospect

Le message part toujours vers la boite mail de la boutique (formulaire de
contact Shopify), mais **par fetch, sans quitter la page** : un rechargement
couperait l'attente. Limite connue : si Shopify impose un captcha a ce
message precis, il ne part pas (on le sait : `data-lead="held"` sur la
section). La commande, elle, porte tout.

## Le paiement

| Produit | Handle | Variante | Prix |
|---|---|---|---|
| Couples Music Video — 30-minute delivery | `couples-music-video` | `58564120510795` | 119 $ |
| Couples Music Video — 48-hour delivery | `couples-music-video` | `58564120543563` | 79 $ |
| Lyrics Keepsake | `couples-lyrics-keepsake` | `58564120936779` | 19 $ |

Statut **UNLISTED** : achetables par le panier, invisibles dans la boutique
(ni recherche, ni collections). Publies sur la Boutique en ligne. Pas
d'expedition, pas de stock suivi.

Chaque bloc Speed (et l'Add-on) de la section offre porte sa variante. Le
bouton envoie `POST /cart/add.js` puis ouvre `/checkout`. La ligne porte :

| Propriete | Visible du client |
|---|---|
| For, From, Occasion, Song language, Genre, Voice | oui |
| _Relationship, _Story, _What they love, _Message, _Phone | non |
| _Preview song, _Preview scenes (6 URL), _Photos, _Song title | non |

Les proprietes en « _ » ne sont montrees ni au checkout ni dans les e-mails
du client ; elles sont dans la commande, pour l'atelier. Les liens KIE sont
**temporaires** (quelques jours) : a traiter dans les 48 h, ce qui colle aux
delais vendus.

## Tests

```
python3 qa/onepage_drive.py   # la page unique de bout en bout, horloge simulee
python3 qa/flow_drive.py      # le tunnel seul, et l'ancien chemin sans API
python3 qa/take_drive.py      # le lecteur de montage
python3 qa/pv_drive.py        # l'ancienne page d'apres
node api-couples/test/run.mjs # l'API contre un faux KIE
```
