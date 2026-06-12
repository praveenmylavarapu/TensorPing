# TensorPing

TensorPing™ — A daily logic puzzle where players reverse-engineer a hidden mathematical network.

## Deploy to GitHub Pages

This repository is configured for automatic GitHub Pages deployment with GitHub Actions.

### One-time repository setup

1. Open **Settings → Pages** in this repository.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.

### Deploy flow

- Push to the `main` branch.
- The workflow at `.github/workflows/deploy-pages.yml` publishes the site.
- After deployment, the app is available at:
  `https://praveenmylavarapu.github.io/TensorPing/`
