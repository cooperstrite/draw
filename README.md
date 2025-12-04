# Draw

Small in-browser sketch pad. Open `index.html` in your browser and draw with your mouse or touch. Use the controls to change brush color/size/opacity, undo, clear, toggle the eraser, or download your canvas as a PNG.

## Tools
- Brush, Pen, Pencil, Marker, Highlighter, plus an eraser toggle. Each tool has distinct stroke styling (watercolor brush with bristly edges, jittered pencil, dashed highlighter, shadowed marker). Adjust size/opacity to fine-tune each tool.
- Background button lets you change the canvas color without clearing your strokes.

## Deploying to GitHub Pages
- Workflow: `.github/workflows/deploy.yml` deploys the repository root to Pages on pushes to `main` (or via manual dispatch).
- First-time setup: in the repo Settings → Pages, choose "GitHub Actions" as the source.
- After a run, the published site URL will appear in the Pages environment output in the workflow logs.

## Cover image
- `assets/cover.png` is used for social previews (Open Graph/Twitter) and as the favicon.
