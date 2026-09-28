# Security and privacy

This is a client-side design tool, not a production AI runtime. It contains no API credentials and does not execute provider requests. Browser storage is local but **not encrypted**; use fictional or non-sensitive input.

If you discover a vulnerability, use the repository's private security-reporting option when available. Do not publish working credentials, personal data, or a weaponized exploit in a public issue. A report should describe affected behavior, impact, and a minimal non-sensitive reproduction.

Exports are user-controlled documents. Review their content before sharing or importing them elsewhere. GitHub hosting and optional font providers have their own network/privacy behavior; local-first describes application data, not anonymity from the hosting service.

The automated test suite checks several input and persistence failure paths. It is not a comprehensive security audit.
