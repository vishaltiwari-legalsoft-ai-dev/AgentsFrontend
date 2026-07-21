import type { Metadata } from "next";
import Script from "next/script";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "LegalSoft Console",
  description: "AI agent automation platform for marketing creatives and brand assets",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the saved color theme before first paint to avoid a flash.
            Legacy values (ocean/sky/prussian) fall through to the light default. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('app-theme');if(t==='dark')document.documentElement.dataset.theme='dark';}catch(e){}",
          }}
        />
      </head>
      <body>
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
