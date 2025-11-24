---
trigger: always_on
description: 
globs: 
---

This project is a plugin for the Obsidian text editor that will convert the contents of an Obsidian Vault into a static website. These are the design goals for this project:

- Simplicity of use is essential.
- The user should never need to interact with html, javascript, or any templating languages.
- The user can optionally provide their own styles via a single .css file, or select from a few default ones.
- The plugin favors manual authoring over automatic generation and indexing.
- It is understood that the capability of this static site generator will be limited compared to others.
- The structure of the generated website should resemble the source vault as close as reasonably possible.
- The generated website will be simple in constuction and presentation, similar in spirit to the world wide web of the late 1990s.

The relationship between the plugin directory and the user's Obsidian valult:

Plugin directory → Source of defaults (copy once)
obsidian-foursg directory → Always read from here during site generation

- Templates and CSS must be read from obsidian-foursg/templates/ and obsidian-foursg/css/ in the user's vault
- Never read directly from the plugin directory during site generation
- Plugin directory only provides initial defaults that get copied to obsidian-foursg on first run
- This ensures users can customize templates and CSS, and their changes are always used.