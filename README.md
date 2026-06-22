# Drive UI

A browser-based, Finder-style file explorer for AWS S3, Cloudflare R2, Alibaba
Cloud OSS, Backblaze B2, and other S3-compatible object storage. Built with
Next.js and Extend UI.

## Features

- Icon, list, column, and gallery views
- Search, filtering, sorting, and lazy folder loading
- PDF, DOCX, XLSX, image, text, and code previews
- Multiple storage connections with local persistence
- Per-bucket read-only mode for environment-configured connections
- Responsive layout and dark mode

## Development

```bash
bun install
cp .env.example .env.local
bun dev
```

Open [http://localhost:3000](http://localhost:3000). Storage connections can be
configured through environment variables or added directly in the app.

> Connections configured through environment variables keep their credentials
> on the server. Connections added in the app are stored in the browser and sent
> to the Next.js server for each operation. Use local connections only in a
> trusted environment and configure bucket CORS for direct signed transfers.

## License

MIT
