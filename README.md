# BigCommerce Tailwind Starter

Tailwind CSS v4 setup for BigCommerce Stencil / Cornerstone themes.
Requirements: Node 20+, npm, Git, Stencil CLI.

## A) Existing theme

```bash
git clone https://github.com/harshad-navigate/bigcommerce-tailwind-install.git
cd bigcommerce-tailwind-install
npm run setup -- --target ../my-store-theme
```

## B) Fresh Cornerstone theme

```bash
npm run setup:fresh -- --target ../my-new-theme
```

## Options

| Option | Meaning |
|---|---|
| `--prefix tw` | Classes need `tw:` prefix (e.g. `tw:flex`). Use this if class names clash with theme CSS |
| `--no-install` | Skip `npm install` |
| `--keep-git` | (fresh) keep Cornerstone git history |

Setup is safe to run again. Nothing is duplicated.

## Team members (after theme is pushed to git)

```bash
git clone <theme-repo-url>
cd <theme-repo>
npm install      # tailwind.css is generated automatically
npm run dev      # tailwind watch + stencil start
```

## Commands (inside the theme)

| Command | Use |
|---|---|
| `npm run dev` | Tailwind watch + `stencil start` |
| `npm run tailwind:build` | One-time minified build |
| `npm run push` | Build Tailwind + `stencil push` |
| `npm run build` | Tailwind build + theme webpack build |

Always use `npm run push` (not plain `stencil push`), otherwise `tailwind.css` may be missing or old.

## Usage

```html
<button class="px-[20px] py-[10px] rounded-[4px] w-full font-bold">Add To Cart</button>
```
With `--prefix tw`: `class="tw:flex tw:gap-4"`.
