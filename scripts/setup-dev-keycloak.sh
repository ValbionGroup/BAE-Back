#!/usr/bin/env bash
#
# Monte un realm `bae` de développement dans un Keycloak local, avec un client
# confidentiel PKCE et un utilisateur de test.
#
# Il existe parce que **EirbConnect n'est pas disponible** : ses identifiants sont
# une demande en attente chez EirbWare. Ce realm en tient lieu, et doit imiter le
# contrat réel de la DSI : `email`, `firstName`, `lastName` et `username` passent
# par le modèle utilisateur du realm — donc par les claims standards
# `email`, `given_name`, `family_name`, `preferred_username` — tandis que `ecole`
# et `diplome`, qui n'ont pas d'équivalent standard, sont des attributs custom
# avec leurs propres mappers.
#
# ⚠️ Ce script a longtemps posé des mappers `uid`/`prenom`/`nom`, calqués sur une
# lecture erronée du contrat. Le realm était alors conforme au code plutôt qu'à
# l'IdP : la suite passait au vert contre un IdP imaginaire. Il se corrige
# toujours en même temps que `app/services/oidc_service.ts`.
#
# Passer à EirbConnect ne demandera que de changer les variables `KEYCLOAK_*`.
#
# Prérequis : un Keycloak joignable (par défaut http://localhost:8080) dont le
# compte d'amorçage est admin/admin.
#
# Usage :  bash scripts/setup-dev-keycloak.sh [url-keycloak]
set -euo pipefail

KC="${1:-http://localhost:8080}"
REALM=bae
CLIENT=bae-back
TEST_USER=ttest
TEST_PASSWORD=bae-dev-password

# ⚠️ **Une seule URI de callback, quel que soit le nombre de fronts.** En mode BFF
# le `redirect_uri` est celui du back : l'URL d'un front n'entre jamais dans le
# flux OAuth, la destination est résolue côté serveur depuis la session (§9.5).
# C'est ce qui évite d'en faire whitelister une seconde chez EirbWare.
CALLBACK_URL="${KEYCLOAK_CALLBACK_URL:-http://localhost:3333/v1/auth/keycloak/callback}"

# La déconnexion, elle, ramène bien sur un front : les deux sont donc à déclarer.
DASHBOARD_URL="${DASHBOARD_URL:-http://localhost:4200}"
PUBLIC_APP_URL="${PUBLIC_APP_URL:-http://localhost:4201}"

say() { printf '  %s\n' "$1"; }

TOKEN=$(curl -s -X POST "$KC/realms/master/protocol/openid-connect/token" \
  -d "client_id=admin-cli" -d "username=admin" -d "password=admin" -d "grant_type=password" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['access_token'])")

auth() { curl -s -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" "$@"; }

# --- Realm ------------------------------------------------------------------
if auth "$KC/admin/realms/$REALM" | grep -q '"realm"'; then
  say "realm $REALM : déjà présent"
else
  auth -X POST "$KC/admin/realms" -d "{\"realm\":\"$REALM\",\"enabled\":true}" > /dev/null
  say "realm $REALM : créé"
fi

# --- Adresse publique du realm ----------------------------------------------
# ⚠️ Sans `frontendUrl`, Keycloak dérive `issuer` et **tous** ses endpoints de
# l'en-tête `Host` de l'appelant. Une API en conteneur qui l'interroge via
# `host.docker.internal` reçoit donc des métadonnées portant ce nom, et y renvoie
# le navigateur — qui ne le résout pas. Le figer rend les métadonnées
# indépendantes du chemin emprunté ; le serveur passe par `KEYCLOAK_INTERNAL_URL`.
PUBLIC_URL="${KC_PUBLIC_URL:-$KC}"
auth "$KC/admin/realms/$REALM" > /tmp/bae-kc-realm.json
PUBLIC_URL="$PUBLIC_URL" python3 - << 'PY'
import json, os
path = '/tmp/bae-kc-realm.json'
realm = json.load(open(path))
realm.setdefault('attributes', {})['frontendUrl'] = os.environ['PUBLIC_URL']
json.dump(realm, open(path, 'w'))
PY
auth -X PUT "$KC/admin/realms/$REALM" -d @/tmp/bae-kc-realm.json > /dev/null
say "adresse publique du realm : $PUBLIC_URL"

# --- Profil utilisateur -----------------------------------------------------
# ⚠️ Depuis Keycloak 24, le « declarative user profile » **supprime
# silencieusement** tout attribut non déclaré : l'API admin renvoie 204 et jette
# la valeur. `ecole` et `diplome` n'atteindraient donc jamais les mappers, et le
# seul symptôme serait un claim absent en bout de chaîne. À déclarer AVANT
# d'écrire le moindre attribut.
#
# `firstName`, `lastName`, `email` et `username` ne sont pas concernés : ce sont
# des champs du modèle utilisateur, pas des attributs libres.
auth "$KC/admin/realms/$REALM/users/profile" > /tmp/bae-kc-profile.json
python3 - << 'PY'
import json
path = '/tmp/bae-kc-profile.json'
profile = json.load(open(path))
profile['unmanagedAttributePolicy'] = 'ENABLED'
known = {attribute['name'] for attribute in profile.get('attributes', [])}
for name in ('ecole', 'diplome'):
    if name not in known:
        profile.setdefault('attributes', []).append({
            'name': name,
            'displayName': name,
            'multivalued': False,
            'permissions': {'view': ['admin', 'user'], 'edit': ['admin']},
        })
json.dump(profile, open(path, 'w'))
PY
auth -X PUT "$KC/admin/realms/$REALM/users/profile" \
  --data-binary @/tmp/bae-kc-profile.json > /dev/null
say "profil utilisateur : attributs ecole/diplome autorisés"

# --- Client confidentiel, PKCE S256 obligatoire ------------------------------
CLIENT_UUID=$(auth "$KC/admin/realms/$REALM/clients?clientId=$CLIENT" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[0]['id'] if d else '')")

# ⚠️ Sans `post.logout.redirect.uris`, Keycloak valide la redirection de
# déconnexion contre les `redirectUris` — donc contre le seul callback du back.
# Le logout global (`id_token_hint`) serait alors refusé sur les deux fronts.
# Séparateur `##`, c'est la convention de l'API admin.
CLIENT_PAYLOAD="{
  \"clientId\": \"$CLIENT\",
  \"enabled\": true,
  \"protocol\": \"openid-connect\",
  \"publicClient\": false,
  \"standardFlowEnabled\": true,
  \"directAccessGrantsEnabled\": false,
  \"redirectUris\": [\"$CALLBACK_URL\"],
  \"webOrigins\": [\"+\"],
  \"attributes\": {
    \"pkce.code.challenge.method\": \"S256\",
    \"post.logout.redirect.uris\": \"$DASHBOARD_URL/*##$PUBLIC_APP_URL/*\"
  }
}"

# Appliqué à chaque exécution, création **ou** mise à jour : un bloc réservé à la
# création laisse tout realm déjà monté sans les réglages ajoutés depuis, et le
# script cesse alors de décrire ce qu'il configure.
if [ -z "$CLIENT_UUID" ]; then
  auth -X POST "$KC/admin/realms/$REALM/clients" -d "$CLIENT_PAYLOAD" > /dev/null
  CLIENT_UUID=$(auth "$KC/admin/realms/$REALM/clients?clientId=$CLIENT" \
    | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['id'])")
  say "client $CLIENT : créé (confidentiel, PKCE S256)"
else
  auth -X PUT "$KC/admin/realms/$REALM/clients/$CLIENT_UUID" -d "$CLIENT_PAYLOAD" > /dev/null
  say "client $CLIENT : mis à jour"
fi
say "  callback   : $CALLBACK_URL"
say "  post-logout: $DASHBOARD_URL/* et $PUBLIC_APP_URL/*"

# --- Mappers : uniquement les deux claims sans équivalent standard -----------
# `preferred_username`, `given_name`, `family_name` et `email` sont déjà portés
# par les mappers intégrés des scopes `profile` et `email` : en reposer un ici
# créerait un doublon.
for pair in "ecole:ecole" "diplome:diplome"; do
  attribute="${pair%%:*}"
  claim="${pair##*:}"
  auth -X POST "$KC/admin/realms/$REALM/clients/$CLIENT_UUID/protocol-mappers/models" -d "{
    \"name\": \"$claim\",
    \"protocol\": \"openid-connect\",
    \"protocolMapper\": \"oidc-usermodel-attribute-mapper\",
    \"config\": {
      \"user.attribute\": \"$attribute\",
      \"claim.name\": \"$claim\",
      \"jsonType.label\": \"String\",
      \"id.token.claim\": \"true\",
      \"access.token.claim\": \"true\",
      \"userinfo.token.claim\": \"true\"
    }
  }" > /dev/null 2>&1 || true
done
say "mappers ecole / diplome : posés"

# --- Utilisateur de test ----------------------------------------------------
USER_ID=$(auth "$KC/admin/realms/$REALM/users?username=$TEST_USER" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[0]['id'] if d else '')")

if [ -z "$USER_ID" ]; then
  auth -X POST "$KC/admin/realms/$REALM/users" -d "{
    \"username\": \"$TEST_USER\",
    \"enabled\": true,
    \"credentials\": [{ \"type\": \"password\", \"value\": \"$TEST_PASSWORD\", \"temporary\": false }]
  }" > /dev/null
  USER_ID=$(auth "$KC/admin/realms/$REALM/users?username=$TEST_USER" \
    | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['id'])")
fi

# `firstName`/`lastName` sont requis par la politique de profil : sans eux
# Keycloak impose l'action VERIFY_PROFILE et n'atteint jamais le callback. Ce
# sont aussi eux qui alimentent `given_name`/`family_name`, et le `username` du
# compte qui alimente `preferred_username` — d'où l'absence d'attribut custom
# pour ces trois-là.
auth -X PUT "$KC/admin/realms/$REALM/users/$USER_ID" -d "{
  \"firstName\": \"Tom\",
  \"lastName\": \"Test\",
  \"email\": \"tom.test@bordeaux-inp.fr\",
  \"emailVerified\": true,
  \"requiredActions\": [],
  \"attributes\": { \"ecole\": [\"ENSEIRB-MATMECA\"], \"diplome\": [\"3A Informatique\"] }
}" > /dev/null
say "utilisateur $TEST_USER : prêt (mot de passe $TEST_PASSWORD)"

SECRET=$(auth "$KC/admin/realms/$REALM/clients/$CLIENT_UUID/client-secret" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['value'])")

cat << EOF

À reporter dans .env :

  KEYCLOAK_ISSUER=$PUBLIC_URL/realms/$REALM
  KEYCLOAK_CLIENT_ID=$CLIENT
  KEYCLOAK_CLIENT_SECRET=$SECRET
  KEYCLOAK_CALLBACK_URL=$CALLBACK_URL
  KEYCLOAK_ALLOW_INSECURE=true

  # Vide si l'API tourne sur l'hôte. En conteneur, \`localhost\` désigne le
  # conteneur lui-même : il lui faut ce second chemin vers l'IdP.
  KEYCLOAK_INTERNAL_URL=

EOF
