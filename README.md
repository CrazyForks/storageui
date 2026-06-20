# Drive UI

A browser-based, Finder-style file explorer for S3, Cloudflare R2, and other
S3-compatible object storage. Built with Next.js and Extend UI.

## Features

- Icon, list, column, and gallery views
- Search, filtering, sorting, and lazy folder loading
- PDF, DOCX, XLSX, image, text, and code previews
- Multiple storage connections with local persistence
- Responsive layout and dark mode

## Development

```bash
bun install
cp .env.example .env.local
bun dev
```

Open [http://localhost:3000](http://localhost:3000). Storage connections can be
configured through environment variables or added directly in the app.

> This project has no backend. Connection credentials are exposed to and stored
> in the browser. Use it only in a trusted environment and configure bucket CORS
> accordingly.

## License

MIT
