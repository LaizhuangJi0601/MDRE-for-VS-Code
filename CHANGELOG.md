# Changelog

## 0.3.0

- Added a PDF viewer with 10%–400% zoom, page indicator, page thumbnails with numbers, and on-demand reading for large files.
- Word documents open in a read-only continuous viewer; plain text and common code files open in VS Code's own editor with highlighting and editing.
- Added an 80%–200% interface scale with a dropdown, −/+ buttons and Ctrl+wheel; body text is unaffected and the choice is remembered.
- Settings now take effect and save immediately; Apply and Cancel are removed.
- The Find bar opens above the document instead of using the sidebar, with matching previous and next arrows.
- Transitions now run for about 0.4 seconds and remaining flickers are fixed; auxiliary windows appear directly at their remembered position.
- File open dialogs accept PDF, Word, text and code files.

## 0.2.7

- Fixed Mermaid diagrams failing to display when labels contain line breaks or other HTML tags; diagram source is normalized to valid SVG, and common diagram types, themes, and complex labels are covered.
- Reworked transitions into in-place cross-fades of about 0.8 seconds: outgoing content fades out where it is and incoming content fades in at its final position, with no sliding or fly-in motion. Fixed flickers during some view changes; composition input protection and reduced-motion support are kept.
- Settings now open as a popup inside the editor instead of a separate VS Code editor page, matching the desktop layout; apply, cancel, defaults, search, and language switching are unchanged.
- Exported `.docx` files follow the Markdown content without extra "document snapshot" titles.
- The A4 zoom level is remembered globally and reused for every newly opened document (25%–250%).
- Settings, help, and shortcuts windows reopen at their last position and are kept inside the visible screen.
- Body and monospace font choices now list fonts installed on the system.
- Improved rendering performance for long documents.
- Removed the "offline help" footer from the help page so the content area gets more room.
- Reviewed and fixed basic syntax rendering, in particular links and heading anchors.

## 0.2.6

- Added Word import and export with Pandoc, including common document structures and equations.
- Added English and Simplified Chinese interfaces, categorized settings with search and preview, and searchable offline help with chapter navigation.
- Refined settings draft recovery, dialog controls, resizing, and configurable fade transitions.
- Added 60%–100% reading width outside A4, four text alignments, and image display preferences across layouts.
- Improved selection-wide paragraph formatting, table menu organization, and composition input handling.
- Reduced duplicate font assets and loaded editor resources on demand.
- Updated extension details and version summaries in English.

## 0.2.5

- Added an image sidebar with document-order references, navigation, and folder access.
- Added shareable ZIP export containing Markdown and referenced local images.
- Added rich-text copying and HTML-to-Markdown pasting for common web, Word, and spreadsheet content.
- Added table column resizing, alignment, merging and splitting, and conversion to Markdown tables; HTML and PDF exports preserve table formatting.

## 0.2.4

- Fixed embedding of local images referenced by absolute file URLs in HTML and PDF exports.
- Consolidated the view, typography, table selection, search, and PDF improvements from 0.2.3.

## 0.2.3

- Consolidated editing presets and restored saved view combinations, including the F11 focus shortcut.
- Added px/em font-size controls, grouped context menus, and batch alignment for table selections.
- Fixed empty-list editing, numeric paragraphs, horizontal-rule deletion, and automatic saving.
- Improved save-status placement, previous-match search, and paged or long-page PDF export.

## 0.2.2

- Introduced the transparent MD logo and Marketplace icon.
- Refined the extension overview, repository metadata, and help entry points.

## 0.2.1

- Reorganized the formatting toolbar, context menus, export controls, and responsive settings.
- Added table-cell alignment controls and improved reading-mode feedback.
- Fixed startup theme restoration and explicit heading-anchor navigation; the outline follows reading position.
- Improved horizontal rules, HTML source editing, and help documentation.

## 0.2.0

- Introduced synchronized Markdown source and rich-text editing with VS Code saving, autosave, undo, and redo.
- Added formatting tools, tables, images, links, syntax highlighting, visual equation editing, and Mermaid diagrams.
- Added continuous and paged A4 layouts, zoom, outline navigation, and configurable typography and image display.
- Added HTML/PDF export and packaged the editor as a standalone VS Code extension.
