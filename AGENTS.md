# AGENT INSTRUCTIONS

These instructions apply to the entire repository and describe non-functional conventions that should be followed with each change.

## Asset Versioning
- HTML files reference local `.js` and `.css` files using a query string number for cache busting (e.g. `trello-player.css?6`). Whenever any referenced JS or CSS file is modified, increment the corresponding version number in all HTML files.

## Web Components
- Prefer the Web Components pattern for reusable UI logic. Define custom elements with `customElements.define`.

## Theme Support
- Support both light and dark themes by using CSS variables and the `prefers-color-scheme` media query. New styles should work in both themes.

## Coding Standards
- Use plain ES6 JavaScript without build tools or frameworks.
- Indent using two spaces and include semicolons.
- Keep CSS simple and readable.

## Trello Attachment Access
- Trello blocks cross-origin requests to attachments, so Power-Up scripts cannot fetch them directly. Features that require attachment data must rely on the user downloading the file or using the Power-Up API.

Currently there are no automated tests, so verify changes manually and run basic sanity checks such as `git status` and `git log -1 --stat` before committing.
