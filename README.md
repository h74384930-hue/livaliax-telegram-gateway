# LIVALIAX Personal Telegram Gateway

This service provides personal-account Telegram authentication through MTProto. It is not a bot connector.

Required secrets: `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, and `TELEGRAM_ACCOUNT_GATEWAY_SECRET`. Never commit them. Deploy this service on a conventional container host with outbound TCP access and HTTPS, then set its HTTPS origin and shared secret as `TELEGRAM_ACCOUNT_GATEWAY_URL` and `TELEGRAM_ACCOUNT_GATEWAY_SECRET` in the LIVALIAX Site.

The current implementation is a closed-pilot authentication gateway for at most five invited LIVALIAX accounts. Challenges are short-lived and memory-backed, so it must use one instance and is not approved for public onboarding or horizontal scaling. Returned `StringSession` values are credentials and must be encrypted immediately by the LIVALIAX server; they must never be logged or returned to the browser. Telegram sending is permitted only through LIVALIAX's immutable human-confirmation flow for the exact recipient and content; the gateway itself does not grant autonomous send authority.
