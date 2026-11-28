/**
 * `register`: doors 1–3 from one handler table (contract §9).
 *
 *   assertHost(ctx, manifest)
 *   const registration = await register(ctx, manifest, handlers)
 *   await registration.bus.emit("changed", { … })
 *
 * Every method is written once and reached as an agent tool in the `<name>` namespace, as `tools.<name>.<method>` in
 * Code Mode and automations, and as `POST /api/rpc/<name>/<method>` with `{ sessionID, input }` under the session's
 * rules. The module validates input and output, resolves the account through `accounts`, asserts permissions on
 * `<alias>:<operation>`, applies the `access` rules through `ctx.agent.transform`, and maps every failure to contract
 * §12. A non-read method over RPC needs a permission ask or a valid `grant`; without either it is refused (LD-5).
 *
 * `docs/register.md` is the guide.
 */
export { register } from "./register/register.ts"
export type { RegisterContext, RegisterWiring, Registration } from "./register/register.ts"
export type { TelemetryWiring } from "./register/telemetry.ts"
export { assertHost } from "./register/host.ts"
export type { HostContext } from "./register/host.ts"
export { methodEntries } from "./register/handlers.ts"
export type { Door, HandlerTable, MethodCall, MethodEntry, MethodHandler } from "./register/handlers.ts"
export { COMMIT_INPUT, PLAN_OUTPUT } from "./register/validate.ts"
export { PLAN_MAX_BYTES } from "./register/plans.ts"
export { refusal, refusalOf, RegisterError } from "./register/errors.ts"
export type { Refusal } from "./register/errors.ts"
export type { GrantWiring } from "./register/rpc.ts"
