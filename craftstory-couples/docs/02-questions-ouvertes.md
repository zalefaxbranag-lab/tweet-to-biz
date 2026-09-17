# Arbitrages et questions bloquantes

Relevé du 2026-09-17. Rien ci-dessous n'est tranché sans le propriétaire.

---

## A. Bloquants d'accès (à lever avant les étapes 3 et 4)

| # | Blocage | Conséquence |
|---|---|---|
| A1 | `api.kie.ai`, `docs.kie.ai`, `kieai.redpandaai.co` — **bloqués** par la politique réseau de l'environnement | Impossible de vérifier le catalogue de modèles, de lire les schémas, de tester une génération, de valider l'intégration |
| A2 | Connecteur **Shopify déconnecté** (ré-authentification requise) | Impossible de créer la landing page, de lister les thèmes, de préparer un draft |
| A3 | `unique-song.com`, `craftstory.co`, `cdn.shopify.com` — bloqués | Analyse concurrent faite via Trendtrack ; les 5 points du §8 du teardown restent non vérifiés |

Seul `github.com` est joignable. Trendtrack (MCP) fonctionne : 60 600 crédits restants.

---

## B. La brique musique — le trou dans le plan

Le skill `craftstory-project` documente pour KIE :

- **Images** : `nano-banana-pro` (~18 crédits), `seedream/4.5-edit` (~6 crédits)
- **Vidéo** : `kling-3.0/video` (~78 cr, 3–15 s, `multi_shots`, `multi_prompt`),
  `kling-2.6/image-to-video` et `text-to-video` (~55 cr, 5 ou 10 s), `veo3_fast`,
  `sora-2-text-to-video` (« interface temporarily paused » au dernier test)
- **Musique** : **aucun modèle documenté.**

Or le produit *est* une chanson. Question B1 ci-dessous est la question n°1 du projet.

---

## C. Questions à trancher

### Produit et modèle économique

1. **Prix du cœur d'offre.** UniqueSong est à 79 $, CraftStory à 39 $. Avec la vidéo en
   plus, 39 $ n'est pas tenable. Proposition : 79–99 $, en utilisant le prix du concurrent
   comme ancrage. À valider.
2. **Où vit la vidéo : preview gratuite ou unlock payant ?** Argument pour la mettre
   uniquement côté payant : elle est ~25× plus chère que la preview image actuelle, et
   elle casserait la promesse « preview en 10 minutes » qui est le levier n°1 du
   concurrent. Recommandation : preview = extrait audio 30–45 s livré vite ; vidéo =
   contenu du déverrouillage.
3. **Délai promis.** Le concurrent promet 10 min (preview) / 24–48 h (final) / 30 min en
   option payante. Quel délai on s'engage à tenir, sachant que la vidéo allonge tout ?
4. **Marché.** Le concurrent est à 91,5 % US, zéro francophone. On l'attaque sur son
   terrain (US/AU/CA/NZ, en anglais) ou on prend le marché francophone qu'il laisse vide ?
   Les deux ont des implications opposées sur la VSL, les voix et la preuve sociale.
5. **Sous-niche mariage.** Couple/épouse/mari est le cœur *le plus scalé* du concurrent.
   Le vrai espace libre visible dans les données : les occasions mariage spécifiques
   (première danse, vœux, cadeau des invités ou des parents). Est-ce qu'on assume ce
   positionnement étroit, ou on tape large sur « couples » ?

### Créa — le point de friction le plus net

6. **Vidéos de réaction 100 % IA.** Leur créa la plus performante (1,74 M impressions,
   86 jours) repose sur une **voix humaine réelle qui réagit**. Une réaction générée par
   IA à une chanson générée par IA, sur un produit dont toute la promesse est l'émotion
   authentique, pose trois problèmes : détectabilité, risque de policy Meta sur le
   témoignage synthétique, et autodestruction du seul point de preuve qui compte.
   **Statics et plans de VSL en IA : oui, sans réserve. Réactions : je recommande de la
   vraie UGC client (avec consentement, contre remise) — ce n'est pas du tournage.**
   Décision du propriétaire.
7. **Vocabulaire.** Le concurrent ne dit jamais « IA » : « we recorded », « studio
   quality », « their team does the rest ». On aligne ? Et comment ça cohabite avec la
   règle CraftStory « ne jamais dire movie/film » ?

### Technique

8. **KIE et la musique** (question n°1) : existe-t-il un modèle musique/Suno sur le compte
   KIE ? Si non, quel fournisseur pour la chanson (Suno API, Mureka, ElevenLabs Music) —
   et qui a le compte ?
9. **Taux de conversion crédits → dollars** sur KIE, pour calculer la marge réelle.
   Ordre de grandeur à vérifier : une vidéo de 60 s en clips de 10 s ≈ 6 × 78 ≈ **468
   crédits**, contre **18 crédits** pour toute la preview actuelle.
10. **Architecture asynchrone.** Le funnel actuel a un timeout client de **300 s** et le
    pire cas du worker est déjà à ~420 s. La vidéo ne peut pas vivre dans cette requête
    synchrone. Il faut une file + webhook + livraison par email — ce qui est exactement
    ce que fait le concurrent (« in your inbox »). Où on met l'état : Supabase, Shopify
    metafields, KV Cloudflare ?
11. **Exposition de coût.** Le worker actuel est sans authentification et sans rate limit,
    et son URL est en clair dans un asset public du thème. À 18 crédits l'appel c'est un
    risque tolérable ; à ~500 crédits l'appel, ce n'en est plus un. Il faut une
    protection avant de brancher la vidéo.
12. **Réutilisation ou isolation.** On étend le worker `craftstory-kie` (risque : casser
    un flux de production qui tourne) ou on crée un worker séparé pour l'avatar couple ?
    Recommandation : **worker séparé**, conformément à la règle « travail additif ».
13. **Gestion des échecs.** Que reçoit le client si la musique passe mais pas la vidéo ?
    Si les deux échouent ? Remboursement automatique, relance manuelle, livraison
    partielle ? Le funnel enfants actuel affiche un placeholder silencieux — ce
    comportement n'est pas transposable à une commande payée.

### Ce que tu dois me fournir

14. La bibliothèque Trendtrack : **déjà accessible** (brandtracker « Unique Song » ajouté
    au workspace le 2026-09-17). Rien à faire.
15. Le **second lien de référence** annoncé : pas encore reçu.
16. Les accès Shopify (voir A2) et une clé KIE de **développement** — jamais la clé de
    production.

---

## D. Sécurité de la clé KIE

La clé transmise en conversation doit être considérée comme compromise : elle est dans un
transcript. Le skill CraftStory note déjà qu'« une clé a déjà fuité une fois ».

- À **faire tourner** avant toute mise en production.
- À stocker en **secret Cloudflare** uniquement, jamais dans le thème (le thème est public).
- Une seule balance de crédits pour toutes les clés du compte : une clé de dev qui fuite
  vide le compte de production.
