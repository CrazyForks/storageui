
![storage ui cover](public/readme/github-banner.png)

# Storage UI

<p align="start">
  <a href="https://cloud.dify.ai">Website</a> ·
  <a href="https://docs.dify.ai/getting-started/install-self-hosted">Self-hosting</a> ·
  <a href="https://docs.dify.ai">Documentation</a> ·
</p>

A browser-based, Finder-style file explorer for AWS S3, Cloudflare R2, Alibaba
Cloud OSS, Tencent Cloud COS, Backblaze B2, and other S3-compatible object
storage. Built with Next.js and Extend UI.

## Features

- Icon, list, column, and gallery views
- Search, filtering, sorting, and lazy folder loading
- PDF, DOCX, XLSX, image, text, and code previews
- Multiple storage connections with local persistence
- Per-bucket read-only mode for environment-configured connections
- Responsive layout and dark mode

## Quick Start

### Option 1: With OpenAI (Cloud)

```bash
git clone https://github.com/ibelick/zola.git
cd zola
npm install
echo "OPENAI_API_KEY=your-key" > .env.local
npm run dev
```

## License

MIT
