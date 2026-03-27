# ReDeal Forms

Modular real estate forms platform. Starting with Seller Disclosure Addendum.

## Setup

```bash
npm install
cp .env.example .env.local
# Fill in .env.local values
npm run dev
```

## Stack
- Next.js 14 (App Router)
- Supabase (database + storage)
- pdf-lib (PDF generation)
- Nodemailer + Gmail (email)
- Deployed on Vercel
