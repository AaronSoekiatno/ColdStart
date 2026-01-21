import "./globals.css";
import { Public_Sans } from "next/font/google";
import { Button } from "@/components/ui/button";
import { GithubIcon } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { NotificationBell } from "@/components/notifications/notification-bell";

const publicSans = Public_Sans({ subsets: ["latin"] });
//test
const Logo = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 240 41"
    className="h-8 flex-shrink-0 self-start"
  >
  </svg>
);

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <title>Notification Assessment</title>
        <link rel="shortcut icon" href="/images/favicon.ico" />
        <meta
          name="description"
          content="Real-time Notification System Assessment"
        />
        <meta property="og:title" content="Notification Assessment" />
        <meta
          property="og:description"
          content="Real-time Notification System Assessment"
        />
        <meta property="og:image" content="/images/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Notification Assessment" />
        <meta
          name="twitter:description"
          content="Real-time Notification System Assessment"
        />
        <meta name="twitter:image" content="/images/og-image.png" />
      </head>
      <body className={publicSans.className}>
        <NuqsAdapter>
          <div className="bg-slate-900 h-[100dvh] overflow-hidden">
            {/* The main workspace container */}
            <div className="h-full relative overflow-hidden">
              {children}
            </div>
          </div>
          <Toaster />
        </NuqsAdapter>
      </body>
    </html>
  );
}
