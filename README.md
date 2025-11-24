# FourSG Plugin for Obsidian

**S**uper **S**imple **S**tatic **S**ite **G**enerator (FourSG, pronounced "Force-G")

## Overview

FourSG transforms your Obsidian vault into a clean, minimal static website with automatic navigation, SEO optimization, and wiki-link conversion. The generated site maintains your vault's folder structure and converts Obsidian's wiki links into standard HTML.

Unlike more complex static site generators, FourSG prioritizes **simplicity and manual authoring** over automation. You write markdown, add optional frontmatter for customization, and FourSG handles the rest—no build scripts, complex templating, or configuration files required.

## Design Principles

FourSG is built around these core principles:

- **Simplicity First** - Easy to use with minimal configuration
- **Markdown Only** - All your site content can be maintained in Obsidian
- **Manual Authoring** - You control the content; FourSG handles the structure
- **Vault-Like Structure** - Generated site mirrors your vault organization
- **Classic Web Aesthetic** - Clean, simple presentation is the default 
- **Optional Customization** - Extend with custom CSS and templates only if desired
- **Purposefully Limited** - Fewer features means less complexity
- **SEO Enabled** - Make sure people can find your content
## Quick Start

1. Install the FourSG plugin
2. Create an `index.md` file at the root of your vault
3. Run the command: **FourSG: Generate static site**
4. Your site will be generated in `obsidian-foursg/site/`

## First Run Actions

The first time you run FourSG, it will create an `obsidian-foursg/` directory in your vault. This directory contains:
- `templates/` - For HTML template files. A default.html is automatically created
- `css/` - For CSS files. A default.css is automatically created
- `site/` - The generated website
- `robots.txt` - Default robots.txt file
- `README.md` - This file

After this, the `obsidian-foursg/` directory will persist in your vault. You can modify the contents of the
`templates/` and `css/` directories to customize the appearance of your site. These files will not be overwritten when the
site is regenerated. If default.html or default.css are deleted or renamed, new default files will be created (even if
they are not used in the site).

The `site/` subdirectory is always emptied and rebuilt with each site generation, so you should not make any modifications
there as they will be lost with the next site generation.

## Commands

FourSG provides the following commands (accessible via Command Palette with `Ctrl/Cmd+P`):

### **FourSG: Generate static site**
Converts your entire vault into a static website. This will:
- Process all markdown files (except those in `obsidian-foursg/`)
- Convert wiki links and image embeds to standard HTML
- Generate navigation based on folder structure
- Create SEO metadata for all pages
- Generate `sitemap.xml` and `robots.txt`
- Copy all images and CSS files
- Output everything to `obsidian-foursg/site/`

### **FourSG: Clear output directory**
Deletes the generated site directory (`obsidian-foursg/site/`). Useful for:
- Starting fresh before regenerating
- Removing old generated files
- Troubleshooting build issues

**Note:** This only clears the site output, not your templates or CSS.

### **FourSG: Enable debug logging**
Enables detailed console logging for troubleshooting. When enabled, you'll see:
- File processing details
- Template loading information
- Navigation tree building
- Image copying progress
- Other diagnostic information

Check the Developer Console (`Ctrl/Cmd+Shift+I`) to view debug logs.

### **FourSG: Disable debug logging**
Turns off debug logging. Only essential messages (site generation start/complete, warnings, errors) will be shown.

## Site Configuration

Site-wide settings are defined in the frontmatter of `index.md` at the root of your vault:

```yaml
---
site_name: My Awesome Site
site_url: https://mysite.com
---
```

### Site Configuration Fields

| Field | Required | Description | Default |
|-------|----------|-------------|---------|
| `site_name` | No | Name of your site (appears in page titles and header) | `My Site` |
| `site_url` | Recommended | Base URL of your site (required for proper SEO) | `https://example.com` |

**⚠️ Warning:** If `site_url` is not defined, a warning will be logged and `https://example.com` will be used as a placeholder.

## Page Frontmatter

Each markdown file can include optional frontmatter to control its appearance, SEO, and behavior.

### Display & Template Options

```yaml
---
title: Custom Page Title
page_template: custom.html
page_css: custom.css
---
```

| Field | Description | Default |
|-------|-------------|---------|
| `title` | Page title (overrides filename) | Filename |
| `page_template` | Custom HTML template file (must exist in `obsidian-foursg/templates/`) | `default.html` |
| `page_css` | Custom CSS file (must exist in `obsidian-foursg/css/`) | `default.css` |

### SEO Fields

All SEO fields are optional but recommended for better search engine visibility:

```yaml
---
title: My Article Title
description: A brief description for search engines
keywords: ["obsidian", "static-site", "seo"]
author: Your Name
og_image: images/preview.jpg
type: article
published_date: 2025-11-24
last_modified_date: 2025-11-24
section: Blog
canonical: https://mysite.com/custom-url
---
```

| Field | Description | Auto-generated Default |
|-------|-------------|------------------------|
| `description` | Meta description for SEO and social sharing | None |
| `keywords` | Array of keywords for SEO | None |
| `author` | Author name (used in meta tags and structured data) | None |
| `og_image` | Path to Open Graph image for social sharing (relative or absolute URL) | None |
| `type` | Content type: `article` or `website` | `article` for nested pages, `website` for root |
| `published_date` | Publication date (ISO 8601 format recommended: `YYYY-MM-DD`) | None |
| `last_modified_date` | Last modified date (ISO 8601 format recommended: `YYYY-MM-DD`) | File modification time |
| `section` | Article section/category | Parent folder name |
| `canonical` | Canonical URL if different from page URL | Page URL |

### Sitemap Fields

Control how your pages appear in the generated `sitemap.xml`:

```yaml
---
changefreq: weekly
priority: 0.9
---
```

| Field | Description | Auto-generated Default |
|-------|-------------|------------------------|
| `changefreq` | How often the page changes: `always`, `hourly`, `daily`, `weekly`, `monthly`, `yearly`, `never` | `weekly` for root pages, `monthly` for nested |
| `priority` | Sitemap priority (0.0 to 1.0) | `1.0` for root index, `0.8` for nested index, `0.6` for other pages |

### Complete Example

```yaml
---
title: Understanding Static Site Generators
description: A comprehensive guide to building fast, secure websites with static site generators
keywords: ["static-site", "jamstack", "web-development"]
author: Jane Developer
og_image: images/ssg-guide.jpg
type: article
published_date: 2025-11-24
last_modified_date: 2025-11-24
section: Tutorials
page_template: article.html
page_css: article.css
changefreq: monthly
priority: 0.8
---
```

## Generated Files

When you run the site generator, the following files are automatically created:

- **`obsidian-foursg/site/`** - Your complete static website
- **`obsidian-foursg/site/sitemap.xml`** - XML sitemap for search engines
- **`obsidian-foursg/site/robots.txt`** - Robots.txt file (customizable)

### Customization

You can customize templates and styles by editing files in:

- **`obsidian-foursg/templates/`** - HTML templates
- **`obsidian-foursg/css/`** - CSS stylesheets
- **`obsidian-foursg/robots.txt`** - Custom robots.txt (overrides default)

## SEO Features

FourSG automatically generates comprehensive SEO metadata:

- Meta description, keywords, and author tags
- Open Graph tags for social media sharing (Facebook, LinkedIn)
- Twitter Card tags
- JSON-LD structured data (Schema.org Article/WebPage)
- Canonical URLs
- XML sitemap with priorities and change frequencies
- Robots.txt

## Dates

For `published_date` and `last_modified_date`, use ISO 8601 format for best results:

- **Recommended:** `2025-11-24`
- Also supported: `2025-11-24T14:30:00`, `November 24, 2025`, `11/24/2025`

Both these fields default to the last modified date of the file.

## Useful Links

https://docs.obsidian.md/Home