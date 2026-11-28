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
export { register } from "./register/register.js";
export type { RegisterContext, RegisterWiring, Registration } from "./register/register.js";
export type { TelemetryWiring } from "./register/telemetry.js";
export { assertHost } from "./register/host.js";
export type { HostContext } from "./register/host.js";
export { methodEntries } from "./register/handlers.js";
export type { Door, HandlerTable, MethodCall, MethodEntry, MethodHandler } from "./register/handlers.js";
export { COMMIT_INPUT, PLAN_OUTPUT } from "./register/validate.js";
export { PLAN_MAX_BYTES } from "./register/plans.js";
export { refusal, refusalOf, RegisterError } from "./register/errors.js";
export type { Refusal } from "./register/errors.js";
export type { GrantWiring } from "./register/rpc.js";
