# Architecture Decision Records (index)

Keep this table up to date whenever an ADR's status changes. "Accepted" means the team and (where needed) the supervisor agreed. Anything still "Proposed" is not final.

| ADR                                 | Decision                                                                       | Status                 | Owner                      | Reviewer                   | Open item                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------ | ---------------------- | -------------------------- | -------------------------- | -------------------------------------------------------------------------------- |
| [0001](0001-npm-workspaces.md)      | npm workspaces, TypeScript project references, Vitest, ESM, Node 22            | Proposed (in use)      | Lama Hany Shaker           | Esraa Ahmed Abo-Elaas      | Mark Accepted; revisit pnpm only if installs get slow                            |
| [0002](0002-privacy-boundary.md)    | Allow-list: only `UsageEvent` crosses to the cloud                             | Proposed (in use)      | Ahmed Mohamed Ahmed Yousry | Abdallah Elwasify          | Mark Accepted; threat model from S1-07                                           |
| [0003](0003-anonymous-ids.md)       | Random project ID in `.lens/project-id.json`, random session ID                | **Accepted** (S2-14)   | Ahmed Mohamed Ahmed Yousry | Esraa Ahmed Abo-Elaas      | Dashboard must say anonymity is not absolute                                     |
| [0004](0004-redis-role.md)          | Redis for rate limiting and dashboard aggregate cache; drop it if no real need | Proposed               | Abdallah Elwasify          | Ahmed Mohamed Ahmed Yousry | Check hosting free-tier limits                                                   |
| [0005](0005-history-summaries.md)   | Rule-based history summaries first; optional external LLM later                | Proposed               | Amr Mohamed Abdelrahman    | Ahmed Mohamed Ahmed Yousry | **Needs supervisor (Dr. Gaber Hassan)**: is an optional external LLM acceptable? |
| [0006](0006-evaluation-setup.md)    | Scripted agent loop for main numbers + small manual run in a real agent        | Proposed               | Abdallah Mohamed Ramdan    | Lama Hany Shaker           | **Needs supervisor**: models, providers, API budget, machine for the harness     |
| [0007](0007-one-command-install.md) | `npx` package + documented MCP config; `init` command later                    | Proposed               | Esraa Ahmed Abo-Elaas      | Aya Saad Rizk              | npm package name and account; first supported agents (S1-10)                     |
| [0008](0008-branching-strategy.md)  | `develop` + `main`, merge commits only                                         | Proposed (in use)      | Esraa Ahmed Abo-Elaas      | Abdallah Elwasify          | Mark Accepted                                                                    |
| [0009](0009-tree-sitter-loading.md) | WASM tree-sitter behind a `Parser` interface, pinned versions                  | Proposed (provisional) | Aya Saad Rizk              | Amr Mohamed Abdelrahman    | Windows and macOS results; TSX test; large-file benchmark                        |
| [0010](0010-tiktoken-counter.md)    | `js-tiktoken@1.0.21`, `cl100k_base`, fallback to approximate counter           | Proposed               | Amr Mohamed Abdelrahman    | **TBD**                    | Assign a reviewer before merge; counts are estimates for non-OpenAI models       |

## Notes

- Several ADRs are already followed in practice but still say "Proposed". Accepting them in a team meeting (and updating the status line) keeps the docs honest.
- ADRs 0005 and 0006 cannot be finalised without the supervisor.
