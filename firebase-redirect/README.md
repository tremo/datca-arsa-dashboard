# datca-arsa.web.app → GitHub Pages

The dashboard lives on GitHub Pages and is published from `main`. The Firebase Hosting site `datca-arsa.web.app` only redirects there
(302, every path), so it can never fall behind again (it served the 4 Oct 2026 build until 15 Oct). Deploy from this folder:
`firebase deploy --only hosting`.
