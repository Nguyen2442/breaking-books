import Script from "next/script";
import "./globals.css";

export const metadata = {
  title: "Breaking Books — Interactive Technical Book Studio & Reader",
  description:
    "Nền tảng đọc sách kỹ thuật tương tác theo phong cách Mintlify & Stripe Docs: bóc tách từng chương, sơ đồ SVG thao tác trực tiếp, flashcards và quiz.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Literata:ital,opsz,wght@0,7..72,400..700;1,7..72,400..600&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <Script src="/ddia-runtime.js" strategy="beforeInteractive" />
      </head>
      <body className="min-h-screen antialiased selection:bg-orange-500/15 selection:text-orange-700 dark:selection:text-orange-300">
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('bb_theme');
                  if (saved === 'dark') {
                    document.documentElement.classList.add('dark');
                  }
                  var fontMode = localStorage.getItem('bb_font');
                  if (fontMode === 'serif') {
                    document.documentElement.classList.add('font-serif-mode');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        {children}
      </body>
    </html>
  );
}
