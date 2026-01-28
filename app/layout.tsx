import type { Metadata } from "next";

// app/layout.js
import "./globals.css";

import { Providers } from "./provider";
import UnderDevelopmentBanner from "@/components/UnderDevelopmentBanner";

export const metadata: Metadata = {
  title: "Financial Advice",
  description:
    "Get accurate answers to your complex financial questions with our AI-powered advisory tool.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/logo.svg" type="image/svg+xml" />

        <meta
          name="format-detection"
          content="telephone=no, date=no, email=no, address=no"
        />
      </head>
      {/**/}
      <body className=" bg-[#F8F6EC]  flex flex-col justify-between ">
        <UnderDevelopmentBanner />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
