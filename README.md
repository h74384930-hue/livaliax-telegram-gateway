# LIVALIAX Personal Telegram Gateway

This service provides personal-account Telegram authentication through MTProto. It is not a bot connector.

Required secrets: `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, and `TELEGRAM_ACCOUNT_GATEWAY_SECRET`. Never commit them. Deploy this service on a conventional container host with outbound TCP access and HTTPS, then set its HTTPS origin and shared secret as `TELEGRAM_ACCOUNT_GATEWAY_URL` and `TELEGRAM_ACCOUNT_GATEWAY_SECRET` in the LIVALIAX Site.

The current implementation is an MVP authentication gateway. Challenges are short-lived and memory-backed, so production deployment must use one instance or replace the challenge store with an encrypted shared store before horizontal scaling. Returned `StringSession` values are credentials and must be encrypted immediately by LIVALIAX; they must never be logged or returned to the browser.
