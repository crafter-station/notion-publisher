# Native publication sets: hosted editor verification

Source commit: `dd63a2b56f0e433797091f77d17c3a5549320fe7`.
Private deployment: `appgdep_6aba7c48345481919dff9dd5c2823a72`.
Saved version: `appgprj_6a9f705d212c81919faf0ab726e4dfc6~appgver_1bd41eaff234819188bcd903e853624c`.
Succeeded 2026-09-28T14:40:36.431687Z, environment revision 3.

The normal workflow completed compilation but failed packaging because the Sites plugin cache disappeared during execution. Fallback packed the generated dist (Worker, assets, hosting manifest, migrations including 0009), checked for runtime-state/secret files and symlinks, pushed source using a transient credential without persisting it, and verified the remote SHA before private deployment. No access policy change.

Authenticated production browser acceptance:
- ChatGPT security verification completed without interacting with a CAPTCHA.
- Hosted Typefully connection returned six accounts in the expected group.
- Created native set “Prueba privada · conjunto Typefully” with X.
- Saved internal draft “[Prueba privada] Conjunto persistente · 2026-09-28”, revision 1, with that set.
- “Comprobar cuentas” returned “Cuenta encontrada” and the expected group for the saved account.
- Reloaded the hosted editor and reopened the draft; its title, selected set and revision-1 account snapshot persisted. Screenshot inspected.
- No copy was sent to Typefully; no social publishing, scheduling or approval action.

Migration 0009 is deployed and must not be edited. Production draft save exercises its publication_set field. Live D1 overview confirms ten user tables. Local API/MCP, authorization, snapshot and mobile acceptance details are in publisher-web/docs/publication-set-editor-acceptance.md.

Still incomplete: global set filtering, full set management, agent runtimes and client onboarding, remaining channel adapters, media transfer to platforms, scheduling, analytics, broader UI polish and the rest of the original goal.
