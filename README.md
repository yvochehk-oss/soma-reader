# Soma Reader

## Book metadata and publishing

Every book folder contains `story_meta.json`, `book_synopsis.md`, its Markdown manuscript, and a cover image. The importer accepts either a flat list of book folders or a parent folder containing `<book title>/English` and `<book title>/Kiswahili` subfolders. It uses the `Version B` (English) or `Toleo B` (Kiswahili) section of `book_synopsis.md` as the reader-facing detail-page description and uploads it together with the book.

```json
{
  "title": "The Last Oath of the Rift Valley",
  "title_original": "The Last Oath of the Rift Valley",
  "language": "English (en)"
}
```

`title_original` pairs translations with their original work. For the original English version it is optional; the Kiswahili version should use the English original title.

Publishing requires a non-empty Version B / Toleo B synopsis. A legacy `description` field in `story_meta.json` remains a fallback. The batch import page at `/admin/import` disables immediate publishing and names the affected books when a detail synopsis is missing it. Draft imports may omit it temporarily.

Command-line batch import:

```bash
npm run import:books -- "0.0书籍正文" --publish
```

The `--publish` command performs the same description check. Add `--dry-run` to inspect the import without uploading.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
