// Single source of truth: packages/schema/schemas/*.schema.json (JSON Schema 2020-12).
// Generates Zod (packages/schema-ts/src) and Pydantic v2 (python/verity_schema/src/verity_schema).
// CI runs `pnpm --filter @verity/schema check` and fails if generated files drift.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { jsonSchemaToZod } from "json-schema-to-zod";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const schemaDir = resolve(here, "../schemas");
const tsOut = join(root, "packages/schema-ts/src");
const pyOut = join(root, "python/verity_schema/src/verity_schema");
mkdirSync(tsOut, { recursive: true });
mkdirSync(pyOut, { recursive: true });

// Inline local "#/$defs/..." references so the Zod generator sees plain schemas.
function deref(node, defs) {
  if (Array.isArray(node)) return node.map((n) => deref(n, defs));
  if (node && typeof node === "object") {
    if (typeof node.$ref === "string" && node.$ref.startsWith("#/$defs/")) {
      return deref(defs[node.$ref.slice("#/$defs/".length)], defs);
    }
    const out = {};
    for (const [k, v] of Object.entries(node)) if (k !== "$defs") out[k] = deref(v, defs);
    return out;
  }
  return node;
}

const toCamel = (s) => s.replace(/[-_](\w)/g, (_, c) => c.toUpperCase());
const header = "// Generated from packages/schema/schemas by `pnpm gen:schema`. Do not edit.\n";
const index = [];
const pyModules = [];

for (const file of readdirSync(schemaDir).filter((f) => f.endsWith(".schema.json")).sort()) {
  const base = file.replace(".schema.json", "");
  const schema = JSON.parse(readFileSync(join(schemaDir, file), "utf8"));
  const name = `${toCamel(base)}Schema`;
  const code = jsonSchemaToZod(deref(schema, schema.$defs ?? {}), { module: "esm", name, type: true });
  writeFileSync(join(tsOut, `${base}.ts`), header + code);
  index.push(`export * from "./${base}";`);

  const pyModule = base.replace(/-/g, "_");
  pyModules.push(pyModule);
  execFileSync(
    "uvx",
    [
      "--from", "datamodel-code-generator==0.36.*", "datamodel-codegen",
      "--input", join(schemaDir, file),
      "--input-file-type", "jsonschema",
      "--output", join(pyOut, `${pyModule}.py`),
      "--output-model-type", "pydantic_v2.BaseModel",
      "--target-python-version", "3.12",
      "--use-standard-collections", "--use-union-operator", "--field-constraints",
      "--disable-timestamp", "--use-title-as-name",
    ],
    { stdio: "inherit" },
  );
}

writeFileSync(join(tsOut, "index.ts"), header + index.join("\n") + "\n");
writeFileSync(
  join(pyOut, "__init__.py"),
  '"""Generated from packages/schema/schemas by `pnpm gen:schema`. Do not edit."""\n',
);
console.log(`generated: ${pyModules.join(", ")}`);
