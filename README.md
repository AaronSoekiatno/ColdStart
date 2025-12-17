This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Prerequisites

This project uses [Helix](https://helix.dev) database, which requires GLIBC 2.39. If you're using WSL with Ubuntu 22.04 or earlier, you'll need to upgrade.

### Fixing GLIBC 2.39 Requirement

**Option 1: Upgrade WSL to Ubuntu 24.10+ (Recommended)**
```bash
# In WSL, upgrade to Ubuntu 24.10
sudo do-release-upgrade
```

**Option 2: Use Docker for Helix**
If upgrading isn't possible, ensure Helix runs in a Docker container with a newer base image.

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Resend (for waitlist emails)
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=your_verified_email@yourdomain.com  # Optional, defaults to noreply@joinhermes.co

# App URL (for email links)
NEXT_PUBLIC_APP_URL=https://yourdomain.com  # Optional, defaults to https://coldstart.ai

# Waitlist Email Content (optional - can customize in script)
WAITLIST_EMAIL_SUBJECT=Your Launch Subject
WAITLIST_EMAIL_HTML=<your HTML email template>
WAITLIST_EMAIL_TEXT=<your plain text email template>
```

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
