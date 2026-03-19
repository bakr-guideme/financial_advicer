import type { Metadata } from "next";

// app/layout.js
import "./globals.css";

import { Providers } from "./provider";
import UnderDevelopmentBanner from "@/components/UnderDevelopmentBanner";

export const metadata: Metadata = {
  title: "BAKR — Business & Accountants Knowledge Resource",
  description:
    "Professional financial tools, guided assessments, and educational resources for accountants, financial planners, and their clients.",
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
