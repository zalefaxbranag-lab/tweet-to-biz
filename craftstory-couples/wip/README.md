# Sections écrites mais non déployées

## `cs-duo-reviews-carousel.liquid` — 42 250 octets

Variante carrousel de la section avis : 5 colonnes au lieu de 4, flèches,
pagination par pas réglable, cartes vidéo UGC, débord sur les bords.

**Pourquoi elle n'est pas sur le thème.** `themeFilesUpsert` la refuse en
silence : 201 à l'upload, `userErrors: []` à l'upsert, fichier jamais appliqué.
Ce n'est pas le schéma — `qa/schema_check.py` la valide. C'est la taille. Les
mesures faites sur ce thème :

| Fichier | Octets | Résultat |
|---|---|---|
| `cs-duo-faq.liquid` | 25 364 | appliqué |
| `cs-duo-head.liquid` | 25 247 | appliqué |
| `cs-duo-hero.liquid` | 33 622 | appliqué |
| ce fichier | 42 250 | **refusé** |

Le plafond est donc entre 33 622 et 42 250 octets.

**Ce qui est déployé à la place.** `sections/cs-duo-reviews.liquid`, 6 798
octets : même place dans la page, même rôle, grille de 4 cartes sur ordinateur
et rail à balayage sur mobile. Le `templates/page.couples.json` pilote cette
version-là, réglage par réglage ; il ne pilote pas le carrousel.

**Pour la déployer un jour**, il faut descendre sous ~34 000 octets. La voie
propre : sortir le JavaScript (9 764 octets) dans `assets/cs-duo-rev.js` et
l'appeler avec `{{ 'cs-duo-rev.js' | asset_url | script_tag }}`, puis réécrire
l'entrée `reviews` du template avec les réglages du carrousel
(`cols_desktop`, `per_move_desktop`, `heading_count`, `brand`…), qui ne sont
pas ceux de la version déployée.

Tant qu'aucun avis réel n'existe, les deux versions rendent la même chose :
rien. Les deux se cachent d'elles-mêmes sur la boutique tant qu'aucun bloc ne
porte une citation ou une capture d'écran.
