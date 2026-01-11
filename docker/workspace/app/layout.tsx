import "./globals.css";
import { Public_Sans } from "next/font/google";
import { Button } from "@/components/ui/button";
import { GithubIcon } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { NuqsAdapter } from "nuqs/adapters/next/app";

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
        <title>Insights Dashboard</title>
        <link rel="shortcut icon" href="/images/favicon.ico" />
        <meta
          name="description"
          content="Insights Dashboard - View ad performance scores and viral predictions"
        />
        <meta property="og:title" content="Insights Dashboard" />
        <meta
          property="og:description"
          content="Insights Dashboard - View ad performance scores and viral predictions"
        />
        <meta property="og:image" content="/images/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Insights Dashboard" />
        <meta
          name="twitter:description"
          content="Insights Dashboard - View ad performance scores and viral predictions"
        />
        <meta name="twitter:image" content="/images/og-image.png" />
      </head>
      <body className={publicSans.className}>
        <NuqsAdapter>
          <div className="bg-secondary grid grid-rows-[auto,1fr] h-[100dvh]">
            <div className="grid grid-cols-[1fr,auto] gap-2 p-4">
              <div className="flex gap-4 flex-col md:flex-row md:items-center">
                <a
                  href="/insights"
                  className="flex items-center gap-2"
                >
                  <Logo />
                </a>
              </div>

            </div>
            <div className="bg-background mx-4 relative grid rounded-t-2xl border border-input border-b-0">
              <div className="absolute inset-0">{children}</div>
            </div>
          </div>
          <Toaster />
        </NuqsAdapter>
      </body>
    </html>
  );
}
