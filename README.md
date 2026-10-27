
# BigCommerce Tailwind Starter

A reusable Tailwind CSS v4 setup for BigCommerce Stencil /
Cornerstone themes.

## Requirements

- Node.js 20+
- npm
- Git
- BigCommerce Stencil CLI for local storefront development

## 1. Clone this starter

```bash
git clone https://github.com/YOUR_USERNAME/bigcommerce-tailwind-starter.git
cd bigcommerce-tailwind-starter
npm install
```

## 2. Configure an existing theme

```bash
npm run setup -- --target ../my-store-theme
```

Replace `../my-store-theme` with your existing Stencil
theme directory.

## 3. Create a fresh Cornerstone theme

```bash
npm run setup:fresh -- --target ./my-new-theme
```

This clones the official Cornerstone repository and configures
Tailwind CSS in the new theme directory.

## 4. Build Tailwind CSS

```bash
cd ../my-store-theme
npm run tailwind:build
```

For development, run:

```bash
npm run tailwind:watch
```

Keep the watch command running in one terminal. Start the
Stencil development server in another terminal using the
commands supported by your theme.

## 5. Use Tailwind utilities

```html
<div class="tw:flex tw:items-center tw:gap-4">
  <h2 class="tw:text-xl tw:font-bold">Hello Store</h2>
</div>
```

## Important

- Tailwind classes use the `tw:` prefix.
- Keep the existing Cornerstone build system intact.
- Build Tailwind before previewing or bundling the theme.
- Do not commit API tokens or store credentials.
- Test the generated CSS with your actual Stencil theme before
  publishing.
