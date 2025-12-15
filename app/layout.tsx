import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { FeedbackButton } from "@/components/FeedbackButton";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Join Hermes - AI Job Search for YC Startups | Land Startup Jobs While You Sleep",
  description:
    "Join Hermes: Your AI agent networks with 2000+ YC founders automatically. AI-powered job search, personalized outreach, and automated networking for startup jobs. 500+ students landing interviews at top YC startups.",
  keywords: [
    "Join Hermes",
    "Hermes AI job search",
    "YC startup jobs",
    "AI job search tool",
    "startup job networking",
    "YC founder networking",
    "automated job applications",
    "AI career agent",
    "startup interview tool",
    "Y Combinator jobs"
  ],
  authors: [{ name: "Hermes" }],
  creator: "Hermes",
  publisher: "Hermes",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://joinhermes.co'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://joinhermes.co',
    siteName: 'Join Hermes',
    title: 'Join Hermes - AI Job Search for YC Startups',
    description: 'Your AI agent networks with 2000+ YC founders automatically. Land startup jobs while you sleep with AI-powered networking.',
    images: [
      {
        url: '/images/hermes-og.png',
        width: 1200,
        height: 630,
        alt: 'Join Hermes - AI Job Search for YC Startups',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Join Hermes - AI Job Search for YC Startups',
    description: 'Your AI agent networks with 2000+ YC founders automatically. Land startup jobs while you sleep.',
    images: ['/images/hermes-og.png'],
    creator: '@joinhermes',
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
    name: 'Join Hermes',
    alternateName: 'Hermes AI Job Search',
    url: 'https://joinhermes.co',
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
      name: 'Hermes',
      slogan: 'Land Jobs at Top Startups While You Sleep'
    },
    keywords: 'AI job search, YC startups, startup jobs, automated networking, job applications, Y Combinator, career agent',
  };

  return (
    <html lang="en" className="dark">
      <head>
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        {children}
        <Toaster />
        <FeedbackButton />
      </body>
    </html>
  );
}
