#!/usr/bin/env bash
#
# Monte un realm `bae` de développement dans un Keycloak local, avec un client
# confidentiel PKCE et un utilisateur de test.
#
# Il existe parce que **EirbConnect n'est pas disponible** : ses identifiants sont
# une demande en attente chez EirbWare. Ce realm en tient lieu, et n'imite qu'une
# chose — mais la bonne : les claims **non standards** `uid`, `prenom`, `nom`.
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

# --- Profil utilisateur -----------------------------------------------------
# ⚠️ Depuis Keycloak 24, le « declarative user profile » **supprime
# silencieusement** tout attribut non déclaré : l'API admin renvoie 204 et jette
# la valeur. `uid`, `prenom` et `nom` n'atteignaient donc jamais les mappers, et
# le seul symptôme était un claim absent en bout de chaîne. À déclarer AVANT
# d'écrire le moindre attribut.
auth "$KC/admin/realms/$REALM/users/profile" > /tmp/bae-kc-profile.json
python3 - << 'PY'
import json
path = '/tmp/bae-kc-profile.json'
profile = json.load(open(path))
profile['unmanagedAttributePolicy'] = 'ENABLED'
known = {attribute['name'] for attribute in profile.get('attributes', [])}
for name in ('uid', 'prenom', 'nom'):
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
say "profil utilisateur : attributs uid/prenom/nom autorisés"

# --- Client confidentiel, PKCE S256 obligatoire ------------------------------
CLIENT_UUID=$(auth "$KC/admin/realms/$REALM/clients?clientId=$CLIENT" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[0]['id'] if d else '')")

if [ -z "$CLIENT_UUID" ]; then
  auth -X POST "$KC/admin/realms/$REALM/clients" -d "{
    \"clientId\": \"$CLIENT\",
    \"enabled\": true,
    \"protocol\": \"openid-connect\",
    \"publicClient\": false,
    \"standardFlowEnabled\": true,
    \"directAccessGrantsEnabled\": false,
    \"redirectUris\": [\"http://localhost:3333/v1/auth/keycloak/callback\"],
    \"webOrigins\": [\"+\"],
    \"attributes\": { \"pkce.code.challenge.method\": \"S256\" }
  }" > /dev/null
  CLIENT_UUID=$(auth "$KC/admin/realms/$REALM/clients?clientId=$CLIENT" \
    | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['id'])")
  say "client $CLIENT : créé (confidentiel, PKCE S256)"
else
  say "client $CLIENT : déjà présent"
fi

# --- Mappers : les claims d'EirbConnect ne sont PAS les claims standards -----
for pair in "uid:uid" "prenom:prenom" "nom:nom"; do
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
say "mappers uid / prenom / nom : posés"

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
# Keycloak impose l'action VERIFY_PROFILE et n'atteint jamais le callback.
auth -X PUT "$KC/admin/realms/$REALM/users/$USER_ID" -d "{
  \"firstName\": \"Tom\",
  \"lastName\": \"Test\",
  \"email\": \"tom.test@bordeaux-inp.fr\",
  \"emailVerified\": true,
  \"requiredActions\": [],
  \"attributes\": { \"uid\": [\"$TEST_USER\"], \"prenom\": [\"Tom\"], \"nom\": [\"Test\"] }
}" > /dev/null
say "utilisateur $TEST_USER : prêt (mot de passe $TEST_PASSWORD)"

SECRET=$(auth "$KC/admin/realms/$REALM/clients/$CLIENT_UUID/client-secret" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['value'])")

cat << EOF

À reporter dans .env :

  KEYCLOAK_ISSUER=$KC/realms/$REALM
  KEYCLOAK_CLIENT_ID=$CLIENT
  KEYCLOAK_CLIENT_SECRET=$SECRET
  KEYCLOAK_CALLBACK_URL=http://localhost:3333/v1/auth/keycloak/callback
  KEYCLOAK_ALLOW_INSECURE=true

EOF
