// Learn more https://docs.expo.dev/router/reference/static-rendering/#root-html

import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.

// The compact/app-icon logo - used for the favicon, the PWA homescreen icon
// (referenced again from public/manifest.json) and the iOS "add to home
// screen" icon. Unlike app.json's `icon`/`web.favicon` fields (which must be
// local files Expo's build bundles and rasterizes into favicon.ico), a plain
// <link> tag is resolved by the browser at page-load time, so it can point
// straight at the Supabase-hosted asset.
const SMALL_LOGO_URL = 'https://nejndycalbepcfmmuiai.supabase.co/storage/v1/object/public/assets/Logo/Coach%20imi_Logo_klein.png';

export default function Root({ children }: { children: React.ReactNode }) {

  // This is only required for server-side rendering.
  const { bodyAttributes, bodyNodes, htmlAttributes, headNodes } = useServerDocumentContext();

  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/*
          Without this, iOS Safari (especially as an installed/standalone
          PWA) ignores `prefers-color-scheme: dark` entirely and always
          reports light, no matter the device's actual appearance setting —
          this is what made dark mode "force light" specifically on iPhone.
        */}
        <meta name="color-scheme" content="light dark" />
        <meta name="theme-color" content="#F4F6F8" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#020617" media="(prefers-color-scheme: dark)" />

        {/*
          Applies the persisted theme (or falls back to the OS preference)
          before the app's own JS has hydrated, so there's no flash of the
          wrong theme while zustand's AsyncStorage-backed persist middleware
          is still rehydrating asynchronously. Reads the same storage key/
          shape as store/themeStore.ts.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var raw=localStorage.getItem('coach-imi-theme-storage');var pref=raw?JSON.parse(raw).state.themePreference:'system';var isDark=pref==='dark'||(pref==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(isDark)document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />

        {/*
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native.
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />

        <link rel="icon" type="image/png" href={SMALL_LOGO_URL} />
        <link rel="apple-touch-icon" href={SMALL_LOGO_URL} />
        <link rel="manifest" href="/manifest.json" />

        {/*
          iOS Safari / WebKit touch tuning for the web build. RNW's own ScrollView already
          sets -webkit-overflow-scrolling: touch inline per-instance, so this only needs to
          cover what's shell-wide: no elastic bounce leaking past the app frame, no 300ms
          tap delay on any element, and no gray flash on tap.
        */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body, #root { height: 100%; overscroll-behavior-y: none; touch-action: manipulation; }
              * { -webkit-tap-highlight-color: transparent; }
            `,
          }}
        />

        {headNodes}

        {/* Add any additional <head> elements that you want globally available on web... */}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
