# Contributing

Start with a focused issue or pull request describing the user-visible problem. Small, reviewable changes are preferred.

1. Serve the folder with `python3 -m http.server 8080`.
2. Use Node.js 24+ and `npm ci --ignore-scripts` for development checks.
3. Add a regression test for a behavior change.
4. Run `npm run check && npm test && npm run format:check`.
5. Include desktop/mobile captures for UI changes and describe keyboard behavior.

Keep the application local-first and zero-build. Do not add analytics, external integrations, runtime packages, or secret handling without discussing the data and permission boundaries. See [engineering notes](docs/ENGINEERING.md) for the manual review checklist and known limits.
