# Editor modes: local acceptance, 2026-09-25

Implemented the Typefully-inspired mode menu using the existing Base UI menu:
Write, Plan and Analyze. Settings, channels/integrations and agent access link to
the existing screens. The editor remains mounted when switching modes; the
planning view reads the latest 100 draft records and groups their actual review
states. It does not claim to implement scheduling. Analyze explicitly has no
connected metrics yet.

Observed through the local browser at localhost:5178:

- Entered an unsaved title and an X variant, switched to Plan via Enter/Down/Enter,
  then returned to Write. Both input values and the unsaved status were preserved.
- Plan loaded the local fixture database: 32 drafts, zero in review, seven approved.
  These are local test records, not production statistics.
- At 390×844, the mode menu was visible and fit within the viewport. Screenshot
  inspection confirmed all six entries were legible.
- Escape closed the menu and returned focus to its trigger.

TypeScript and scoped lint passed. Pending acceptance: production navigation,
changing mode during an active upload, guarded external navigation with an
unsaved draft, full keyboard traversal, and complete responsive editor redesign.
No draft was saved or published during this UI check. No user session or logout
controls were fabricated; those remain to be integrated into the menu.
