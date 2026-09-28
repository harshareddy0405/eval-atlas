# Engineering notes

## Product contract

Deterministic fictional model profiles, case management, comparison matrices, safe CSV export, and guarded run state.

### Walkthrough

Add a difficult test case, compare the fictional models, run the simulator, and inspect the exported scorecard.

### Honest boundary

Scores are synthetic and the model names are fictional. This is evaluation-interface design, not evidence of model performance.

## Code map

| File          | Responsibility                                                             |
| ------------- | -------------------------------------------------------------------------- |
| `index.html`  | Semantic application shell and controls                                    |
| `app.js`      | Product state, algorithms, interactions, rendering, exports                |
| `schema.js`   | Runtime validation of persisted workspace data                             |
| `storage.js`  | Guarded persistence, session-only fallback, recoverable invalid data       |
| `styles.css`  | Project-specific visual language and responsive layout                     |
| `quality.css` | Hidden-state correctness, focus visibility, reduced-motion and recovery UI |
| `tests/`      | DOM-based regression tests and test-only browser API shims                 |

There is no server-side data store and no runtime package installation. Development dependencies are pinned in `package-lock.json`; they are not loaded by the application.

## State and recovery

- Input is rendered as text or escaped before interpolation into markup.
- Persisted workspaces must satisfy a project-specific schema before rendering.
- Invalid saved data opens a fresh workspace and exposes a downloadable recovery file. The original is retained under the workspace key with a `.recovery` suffix when storage allows it.
- Denied storage or quota exhaustion switches to an explicit session-only mode. Export before closing the tab.
- Browser storage is not encrypted. Do not enter credentials, regulated data, or customer secrets.
- Each app has a separate key. Multiple tabs are not collaboratively synchronized; the last save wins.

## Verification

```bash
npm ci --ignore-scripts
npm run check
npm test
npm run format:check
```

Node.js 24+ is needed only for the development checks. CI executes the same commands on pushes and pull requests, using read-only repository permissions and commit-pinned GitHub Actions.

Tests cover startup, malformed saved data, prototype-shaped input, denied storage, quota failure, core product interactions, export behavior, and an automated axe-core semantic accessibility scan. The test harness uses jsdom: canvas, dialog, clipboard, and animation APIs have test doubles. **These tests are not a visual browser certification or a WCAG conformance claim.** Color contrast, layout, native dialog behavior, touch/pointer interaction, and screen-reader experience require manual browser review.

## Manual release checklist

- [ ] Open the app in current Chrome, Firefox, and Safari.
- [ ] Check a wide desktop viewport and a 390px mobile viewport.
- [ ] Navigate the full workflow using only the keyboard.
- [ ] Verify focus visibility, dialog dismissal, and focus return.
- [ ] Try reduced motion and 200% text zoom.
- [ ] Export a real document and open it outside the app.
- [ ] Refresh after editing; repeat once with storage disabled.
- [ ] Confirm the UI never represents a simulation as a live integration.

## Extension strategy

Keep the local design tool functional without an account. If adding a live provider, introduce a server-side adapter with explicit consent, timeouts, cancellation, rate limits, and observable failures. Never place a provider secret in browser JavaScript or localStorage. Extend the schema and regression tests before changing the persisted format.
