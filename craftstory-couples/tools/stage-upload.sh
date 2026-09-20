#!/bin/sh
# Envoie chaque fichier local vers sa cible de transit Shopify.
# GD (x-goog-date) et EXP (expiration de la policy) viennent de stagedUploadsCreate ;
# la date de l'identifiant se deduit de GD, sinon la signature ne colle plus au
# passage de minuit.
GD="$2"
EXP="$3"
DAY=$(printf '%s' "$GD" | cut -c1-8)
CRED="merchant-assets@shopify-tiers.iam.gserviceaccount.com/$DAY/auto/storage/goog4_request"
PFX=tmp/108353159499/files/
while IFS='	' read -r keysuf sig local; do
  [ -z "$keysuf" ] && continue
  key="$PFX$keysuf"
  pol=$(printf '{"conditions":[{"Content-Type":"text/plain"},{"success_action_status":"201"},{"acl":"private"},["content-length-range",1,20971520],{"bucket":"shopify-staged-uploads"},{"key":"%s"},{"x-goog-date":"%s"},{"x-goog-credential":"%s"},{"x-goog-algorithm":"GOOG4-RSA-SHA256"}],"expiration":"%s"}' \
        "$key" "$GD" "$CRED" "$EXP" | sed 's|/|\\/|g' | base64 -w0)
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST https://shopify-staged-uploads.storage.googleapis.com/ \
    -F "Content-Type=text/plain" -F "success_action_status=201" -F "acl=private" \
    -F "key=$key" -F "x-goog-date=$GD" -F "x-goog-credential=$CRED" \
    -F "x-goog-algorithm=GOOG4-RSA-SHA256" -F "x-goog-signature=$sig" -F "policy=$pol" \
    -F "file=@theme/$local")
  printf '%5s  %s\n' "$code" "$local"
done < "$1"
