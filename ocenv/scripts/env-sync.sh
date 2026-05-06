#!/usr/bin/env bash
set -euo pipefail

set -a
source /root/.openclaw/.env.bootstrap
set +a
op inject -f -i /root/.openclaw/.env.tpl -o /root/.openclaw/.env
chmod 600 /root/.openclaw/.env
printf 'Wrote /root/.openclaw/.env\n'
