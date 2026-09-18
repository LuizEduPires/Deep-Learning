FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends squid ca-certificates netcat-openbsd \
    && rm -rf /var/lib/apt/lists/* \
    && install -d -o proxy -g proxy -m 0750 /var/log/squid \
    && touch /var/log/squid/access.log /var/log/squid/cache.log \
    && chown proxy:proxy /var/log/squid/access.log /var/log/squid/cache.log
COPY squid.conf /etc/squid/squid.conf
COPY allowed-domains.txt /etc/squid/allowed-domains.txt
COPY entrypoint.sh /usr/local/bin/pitaya-egress
RUN chmod +x /usr/local/bin/pitaya-egress \
    && squid -k parse -f /etc/squid/squid.conf
EXPOSE 3128
CMD ["/usr/local/bin/pitaya-egress"]
