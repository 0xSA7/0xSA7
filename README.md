# 0xSA7 @ Saleh Diaa Ahmed

Personal blog and portfolio. Built with Astro.

Live at: [0xsa7.github.io/0xSA7](https://0xsa7.github.io/0xSA7/)

## Stack

- **Framework**: Astro
- **Styling**: Custom CSS (Kanagawa Light + Solarized Dark themes)
- **Content**: Markdown with content collections
- **Deploy**: GitHub Pages via GitHub Actions

## Local development

```sh
npm install
npm run dev
```

Open `http://localhost:4321/0xSA7/` in your browser.

## Build

```sh
npm run build
```

Output goes to `./dist/`.

## Preview production build

```sh
npm run preview
```

## Project structure

```
public/
├── favicon.svg                 # Favicon / OG image
└── scripts/
src/
├── content/
│   ├── blog/                # Markdown posts
│   └── config.ts            # Content collection schema
├── layouts/
│   └── BlogPost.astro       # Blog post layout
├── pages/
│   ├── index.astro          # Homepage
│   └── blog/
│       ├── index.astro      # Blog listing
│       └── [slug].astro     # Blog post route
└── styles/
    └── global.css           # Global styles + themes
```

## Writing a blog post

1. Create a `.md` file in `src/content/blog/`
2. Use this frontmatter:

```yaml
---
title: "Post title"
description: "One-line description for SEO and previews"
pubDate: 2026-10-27
tags: ["tag1", "tag2"]
draft: false
readTime: "5 min read"
pr: "https://github.com/owner/repo/pull/123"   # optional
repo: "https://github.com/owner/repo"          # optional
---
```

3. Run `npm run build` to verify
4. Commit and push to the `website` branch — GitHub Actions will deploy

## Deployment

Pushing to the `website` branch triggers the GitHub Actions workflow in
`.github/workflows/deploy.yml`, which builds the site and publishes to
GitHub Pages. No manual deployment step is needed.

## License

MIT.