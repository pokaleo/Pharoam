// Type-checks translation keys against the English file, so a missing or mistyped key fails the build.
import type { RESOURCES } from "./i18n.ts";

declare module "i18next" {
  interface CustomTypeOptions {
    resources: (typeof RESOURCES)["en"];
  }
}
