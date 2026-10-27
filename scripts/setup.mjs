
import {
  cp,
  mkdir,
  readFile,
  writeFile,
  access,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoDir = path.resolve(scriptDir, "..");

function parseArgs(args) {
  const result = { fresh: false, target: null };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--fresh") {
      result.fresh = true;
    } else if (args[i] === "--target") {
      result.target = args[++i];
    } else if (args[i] === "--help") {
      console.log(`
BigCommerce Tailwind Starter

Usage:
  npm run setup -- --target ../my-theme
  npm run setup:fresh -- --target ./my-new-theme

Options:
  --target PATH   Theme directory
  --fresh         Clone official Cornerstone first
  --help          Show this help
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${args[i]}`);
    }
  }

  if (!result.target) {
    throw new Error("Please provide --target PATH");
  }

  return result;
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      ...options,
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const target = path.resolve(process.cwd(), options.target);

  if (target === repoDir || repoDir.startsWith(target + path.sep)) {
    throw new Error("Choose a theme folder outside the starter repository.");
  }

  if (options.fresh) {
    if (await exists(target)) {
      const files = await import("node:fs/promises");
      const entries = await files.readdir(target);

      if (entries.length > 0) {
        throw new Error(
          `Fresh target must be empty: ${target}`
        );
      }
    } else {
      await mkdir(target, { recursive: true });
    }

    const entries = await import("node:fs/promises");
    const existing = await entries.readdir(target);

    if (existing.length > 0) {
      throw new Error("Fresh target directory is not empty.");
    }

    await run("git", [
      "clone",
      "--depth",
      "1",
      "https://github.com/bigcommerce/cornerstone.git",
      target,
    ]);
  }

  const required = [
    "package.json",
    "templates/layout/base.html",
    "assets",
    "templates",
  ];

  for (const relative of required) {
    if (!(await exists(path.join(target, relative)))) {
      throw new Error(
        `Not a recognized Stencil theme: missing ${relative}`
      );
    }
  }

  const sourceTemplate = path.join(
    repoDir,
    "templates",
    "tailwind.css"
  );

  const cssDir = path.join(target, "assets", "css");
  await mkdir(cssDir, { recursive: true });

  const inputCss = path.join(cssDir, "tailwind.css");
  const outputCss = path.join(cssDir, "tailwind.generated.css");

  if (!(await exists(inputCss))) {
    await cp(sourceTemplate, inputCss);
  } else {
    console.log("Keeping existing assets/css/tailwind.css");
  }

  const pkgPath = path.join(target, "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));

  pkg.scripts ??= {};

  if (
    pkg.scripts["tailwind:build"] &&
    !pkg.scripts["tailwind:build"].includes("tailwind.generated.css")
  ) {
    throw new Error(
      "Existing tailwind:build script detected. Merge it manually."
    );
  }

  pkg.scripts["tailwind:build"] =
    "tailwindcss -i ./assets/css/tailwind.css -o ./assets/css/tailwind.generated.css";

  pkg.scripts["tailwind:watch"] =
    "npm run tailwind:build -- --watch";

  pkg.scripts["tailwind:check"] =
    "node -e \"require('node:fs').accessSync('assets/css/tailwind.generated.css')\"";

  pkg.devDependencies ??= {};
  pkg.devDependencies.tailwindcss = "^4.0.0";
  pkg.devDependencies["@tailwindcss/cli"] = "^4.0.0";

  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

  const basePath = path.join(
    target,
    "templates",
    "layout",
    "base.html"
  );

  let base = await readFile(basePath, "utf8");

  const marker = "<!-- tailwind-starter:stylesheet -->";
  const link =
    `${marker}\n` +
    `    {{stylesheet 'assets/css/tailwind.generated.css'}}`;

  if (!base.includes(marker)) {
    if (!base.includes("</head>")) {
      throw new Error(
        "Could not find </head> in templates/layout/base.html. Add the stylesheet manually."
      );
    }

    base = base.replace("</head>", `    ${link}\n</head>`);
    await writeFile(basePath, base);
  }

  const gitignorePath = path.join(target, ".gitignore");
  const gitignore = (await exists(gitignorePath))
    ? await readFile(gitignorePath, "utf8")
    : "";

  if (!gitignore.split(/\r?\n/).includes("assets/css/tailwind.generated.css")) {
    await writeFile(
      gitignorePath,
      gitignore.trimEnd() +
        "\nassets/css/tailwind.generated.css\n"
    );
  }

  console.log("\nInstalling Tailwind CSS v4 CLI...");
  await run("npm", ["install"], { cwd: target });

  console.log(`
Tailwind setup complete!

Next:
  cd "${target}"
  npm run tailwind:build
  npm run tailwind:watch

The generated stylesheet is referenced from the Stencil base layout.
`);
}

main().catch((error) => {
  console.error("\nSetup failed:", error.message);
  process.exitCode = 1;
});
