# Website hosting

The owner requires GitHub Pages for the public website, always:
https://drax12341.github.io/minecraft-pvp-community/

Do not deploy website changes to Sites/GPT hosting or another host, and do not
redirect GitHub Pages visitors there. Only change this if the owner explicitly
reverses this preference. Existing Discord bot infrastructure is separate.

The static entry is `web/pages.html`, built into `dist/index.html` by
`npm run build`. Keep links and public-data requests compatible with the GitHub
project subdirectory. Rankings must use published community records; layout
previews and tier calculations must never become real placements.
