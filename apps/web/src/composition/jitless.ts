/**
 * Turns off Zod's compiled validators, before any schema is built.
 *
 * @remarks Zod compiles validators with the `Function` constructor unless told not to, and checks whether it can as
 * each object schema is built; the content security policy refuses it (security §4). Imported first by `main.tsx`,
 * so the setting is in place before the core's schemas are built.
 * @packageDocumentation
 */
import { config } from "zod";

config({ jitless: true });
