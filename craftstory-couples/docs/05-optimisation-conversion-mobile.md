# Optimisation conversion + mobile — mesures avant/après

2026-09-17. Toutes les valeurs viennent d'un rendu réel dans Chromium (Playwright),
pas d'une estimation.

## Comment c'est mesuré

`craftstory.co` est bloqué par la politique réseau de l'environnement, donc la page ne
peut pas être ouverte sur la boutique depuis ici. Contournement : un **banc de rendu
local**. `qa/build_mock.py` extrait le CSS réel des fichiers de section, reconstruit le
markup que Liquid produit avec les réglages du template, et écrit un HTML statique.
`qa/shoot.py` et `qa/final_qa.py` le rendent dans Chromium et mesurent. `qa/test_bar.py`
teste la logique de la barre collante sur 13 positions de scroll.

Chromium est préinstallé dans l'environnement et `file://` ne passe pas par le proxy,
donc ça fonctionne sans accès réseau.

## Ce que le diagnostic a trouvé

Rendu initial à 375 × 667 px :

| Problème | Mesure |
|---|---|
| **Le CTA du hero tombait sous le pli** | bouton à 720 px, pli à 667 px |
| Le pli s'arrêtait au milieu de la liste à puces | aucune action visible à l'arrivée |
| Section démos = zone morte | 1871 px (2,8 écrans) de 6 vidéos empilées, 1 seul CTA au bout |
| Page très longue | 6521 px, 9,8 écrans |

## Les quatre corrections

1. **Hero réordonné en mobile.** Les puces passent **sous** le bouton (`order` CSS), titre
   resserré (`clamp(1.62rem,6.6vw,2.1rem)`), padding haut réduit, sous-titre raccourci.
   Le bouton remonte de 720 px à **399 px**.
2. **Barre CTA collante** (`cs-duo-bar`, section nouvelle). Épinglée en bas, elle
   apparaît **uniquement quand aucun bouton n'est à l'écran** et disparaît dès qu'il y en
   a un — via IntersectionObserver, donc pas de doublon visuel. `env(safe-area-inset-bottom)`
   pour l'encoche iPhone. Masquée sur desktop par défaut.
3. **Démos en carrousel swipe** sous 700 px. `scroll-snap-type:x mandatory`, cartes à 82 %
   de largeur pour que la suivante dépasse (c'est l'affordance qui donne envie de swiper).
   Le débordement horizontal reste **dans la piste**, jamais sur la page.
4. **Rythme vertical resserré** : cartes d'étapes en grid 2 colonnes (numéro en ligne avec
   le titre), paddings de section réduits en mobile — overrides scopés sous `.cs-duo-*`,
   `cs-head` n'est pas touché.

## Résultat

| Mesure à 375 px | Avant | Après |
|---|---|---|
| CTA hero au-dessus du pli | **non** (720 px) | **oui** (399 px) |
| Hauteur de page | 6521 px | **5038 px** (−23 %) |
| Écrans à scroller | 9,8 | **7,6** |
| Section démos | 1871 px | **821 px** (−56 %) |
| Débordement horizontal | aucun | aucun |
| Cibles tactiles < 44 px | 0 | 0 |
| CTA sur la page | 6 | 7 + barre collante |

Balayage final sur les largeurs de la checklist projet :

| Largeur | Débordement H | CTA < pli | CTA y | Page | Écrans | Tap < 44 px | Texte coupé |
|---|---|---|---|---|---|---|---|
| 320 | aucun | oui | 397 | 5471 | 9,6 | 0 | aucun |
| 375 | aucun | oui | 399 | 5038 | 7,6 | 0 | aucun |
| 390 | aucun | oui | 408 | 5024 | 6,0 | 0 | aucun |
| 414 | aucun | oui | 426 | 4894 | 5,5 | 0 | aucun |
| 768 | aucun | oui | 586 | 5480 | 5,4 | 0 | aucun |
| 1280 | aucun | oui | 594 | 5250 | 5,8 | 0 | aucun |

## Deux bugs trouvés par le banc, corrigés

- **Indice « Swipe » invisible.** `.cs-dd-swipe{display:none}` était déclaré *après* la
  media query qui met `display:flex` : à spécificité égale, la règle la plus tardive
  gagne. La base est maintenant placée avant la media query. Vérifié : `display:flex`
  visible en mobile, `none` en desktop.
- **Chips étirées sur toute la largeur.** En passant les cartes d'étapes en `display:grid`,
  `justify-self` valait `stretch` par défaut, donc « 2 minutes » et « Included »
  ressemblaient à des boutons désactivés. Corrigé avec `justify-self:start` (82 px dans
  une carte de 331 px).

## Barre collante — test fonctionnel

13 positions de scroll, règle attendue « active si et seulement si aucun CTA à l'écran » :
**13/13 conformes, zéro erreur JS**. Elle ne se déclenche que dans les 3 trous réels de
la page (≈600, ≈2600, ≈4200 px).

## Ce qui reste non vérifié

Le rendu sur la vraie boutique, avec les vraies vidéos et le thème Horizon autour. Le banc
reproduit le CSS et le markup, pas le contexte complet du thème.
