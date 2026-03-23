#!/bin/sh
set -e

node ace.js migration:run --force

exec "$@"