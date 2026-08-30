# Trust boundary inventory

| Surface                                                                              | Kind                  | Trust                                       | Test / gate                                     |
| ------------------------------------------------------------------------------------ | --------------------- | ------------------------------------------- | ----------------------------------------------- |
| Landing `/`, `/sample`                                                               | Public UI             | Unauthenticated; read-only fixtures         | `e2e/public-sample.spec.ts`, sample React tests |
| `/auth`                                                                              | Public UI             | Convex Auth                                 | `e2e/auth-shell.spec.ts`, auth React tests      |
| Private routes                                                                       | UI                    | Redirect when signed out                    | `e2e/approval-safety.spec.ts`                   |
| `workspaces:*`, `offers:*`, `documents:*`, `questions:*`, `research:*`, `profiles:*` | Convex query/mutation | `requireActiveWorkspace` / owner            | `*.test.ts` under `convex/`                     |
| `researchActions:*`, `agentMailActions:*`, `fireworks:*`                             | Internal actions      | Deployment-only; generation stamps          | Convex tests + live smokes                      |
| HTTP webhooks (Firecrawl / AgentMail / etc.)                                         | HTTP                  | Signed secrets; ignore stale generation     | Convex HTTP / webhook tests                     |
| Storage / raw docs                                                                   | Files                 | Owner workspace; retention + cascade delete | documents / workspace deletion tests            |
| Sample comparison                                                                    | Domain                | Deterministic cents math                    | `src/domain/comparison.test.ts`                 |

No public mutation may send email, delete another user’s workspace, or mutate comparison amounts without an authenticated owner and, for outbound mail, an explicit **Approve and send**.
