FROM ghcr.io/gitroomhq/postiz-app@sha256:785f97312f66a347fb96cdccc4ded5a33ced69a672c89a9adc8054e7d6a21dc5

# Keep the installed upstream release; repair only the Dribbble renewal route.
COPY patch-dribbble.cjs check-dribbble.cjs /app/open-publisher-patches/
RUN node /app/open-publisher-patches/patch-dribbble.cjs && node /app/open-publisher-patches/check-dribbble.cjs
