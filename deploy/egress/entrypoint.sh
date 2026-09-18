#!/bin/sh
set -eu

invalid_openai_url() {
  echo "OPENAI_BASE_URL deve usar um domínio HTTPS público na porta 443 (ex.: https://llm.exemplo.com/v1)." >&2
  exit 1
}

# O app não tem rota direta para a internet. Libere somente o domínio
# configurado, sem permitir endereços privados ou outras portas no Squid.
if [ -n "${OPENAI_BASE_URL:-}" ]; then
  case "$OPENAI_BASE_URL" in
    *\?*|*\#*) invalid_openai_url ;;
    https://*) authority=${OPENAI_BASE_URL#https://} ;;
    *) invalid_openai_url ;;
  esac
  authority=${authority%%/*}
  case "$authority" in
    *:443) host=${authority%:443} ;;
    *:*) invalid_openai_url ;;
    *) host=$authority ;;
  esac
  case "$host" in
    ''|.*|*.|*..*|-*|*.-*|*-.*|*[!A-Za-z0-9.-]*) invalid_openai_url ;;
    *.*) ;;
    *) invalid_openai_url ;;
  esac
  case "$host" in
    *[!0-9.]*) ;;
    *) invalid_openai_url ;;
  esac
  if ! grep -Fxq "$host" /etc/squid/allowed-domains.txt; then
    printf '%s\n' "$host" >> /etc/squid/allowed-domains.txt
  fi
fi

tail -n 0 -F /var/log/squid/access.log /var/log/squid/cache.log &
exec squid -N -f /etc/squid/squid.conf
