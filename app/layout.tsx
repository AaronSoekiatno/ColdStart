import type { Metadata } from "next";
import { Geist, Geist_Mono, Sora } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
// @thecred/posthog:start
import { CredPostHogProvider, AppRouterTracker } from "@thecred/posthog";
// @thecred/posthog:end

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Join Agencity - AI Job Search for YC Startups | Land Startup Jobs While You Sleep",
  description:
    "Join Agencity: Your AI agent networks with 2000+ YC founders automatically. AI-powered job search, personalized outreach, and automated networking for startup jobs. 500+ students landing interviews at top YC startups.",
  keywords: [
    "Join Agencity",
    "Agencity AI job search",
    "YC startup jobs",
    "AI job search tool",
    "startup job networking",
    "YC founder networking",
    "automated job applications",
    "AI career agent",
    "startup interview tool",
    "Y Combinator jobs"
  ],
  authors: [{ name: "Agencity" }],
  creator: "Agencity",
  publisher: "Agencity",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://agencity.co'),
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: '/images/hermes.png',
    shortcut: '/images/hermes.png',
    apple: '/images/hermes.png',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://agencity.co',
    siteName: 'Join Agencity',
    title: 'Join Agencity - AI Job Search for YC Startups',
    description: 'Your AI agent networks with 2000+ YC founders automatically. Land startup jobs while you sleep with AI-powered networking.',
    images: [
      {
        url: '/images/hermes-og.png',
        width: 1200,
        height: 630,
        alt: 'Join Agencity - AI Job Search for YC Startups',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Join Agencity - AI Job Search for YC Startups',
    description: 'Your AI agent networks with 2000+ YC founders automatically. Land startup jobs while you sleep.',
    images: ['/images/hermes-og.png'],
    creator: '@agencity',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Join Agencity',
    alternateName: 'Agencity AI Job Search',
    url: 'https://agencity.co',
    description: 'AI-powered job search agent that networks with 2000+ YC founders automatically to help you land startup jobs',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      category: 'Job Search Platform',
    },
    featureList: [
      'AI-powered networking with YC founders',
      'Automated personalized outreach',
      'Resume tailoring for startup jobs',
      'Email tracking and analytics',
      'Access to 2000+ YC startup founders'
    ],
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '500',
      bestRating: '5',
      worstRating: '1'
    },
    brand: {
      '@type': 'Brand',
      name: 'Agencity',
      slogan: 'Land Jobs at Top Startups While You Sleep'
    },
    keywords: 'AI job search, YC startups, startup jobs, automated networking, job applications, Y Combinator, career agent',
  };

  return (
    <html lang="en" className="dark">
      <head>
        {/* Google tag (gtag.js) */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-M67TTTXFKS"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-M67TTTXFKS');
            `,
          }}
        />
        {process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION && (
          <meta
            name="google-site-verification"
            content={process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION}
          />
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${sora.variable} antialiased`}
        suppressHydrationWarning
      >
        {/* @thecred/posthog:start */}
        <CredPostHogProvider>
          <AppRouterTracker />
          {children}
        </CredPostHogProvider>
        {/* @thecred/posthog:end */}
        <Toaster />
        <Sonner />
      </body>
    </html>
  );
}
