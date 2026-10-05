"use client";

// Styled-components SSR registry with CSP nonce. The nonce is set by
// `middleware.ts` on the response header `x-csp-nonce`, read in `layout.tsx`,
// and passed in here so every injected <style> tag carries the matching
// nonce — the CSP policy accepts them while rejecting any style the browser
// didn't see us emit.
import { useState } from "react";
import { useServerInsertedHTML } from "next/navigation";
import { ServerStyleSheet, StyleSheetManager } from "styled-components";
import React from "react";

export default function StyledComponentsRegistry({
  nonce,
  children,
}: {
  nonce?: string;
  children: React.ReactNode;
}) {
  const [styledComponentsStyleSheet] = useState(() => new ServerStyleSheet());

  useServerInsertedHTML(() => {
    const styles = styledComponentsStyleSheet.getStyleElement();
    styledComponentsStyleSheet.instance.clearTag();
    // Clone each injected <style> to carry the CSP nonce; styled-components
    // v6 doesn't accept a nonce argument on getStyleElement.
    const withNonce = Array.isArray(styles)
      ? styles.map((s, i) =>
          React.cloneElement(s as React.ReactElement<{ nonce?: string }>, {
            key: (s as React.ReactElement).key ?? i,
            nonce,
          })
        )
      : styles;
    return <>{withNonce}</>;
  });

  // On the client, render children directly (styles are already injected).
  if (typeof window !== "undefined") return <>{children}</>;

  return (
    <StyleSheetManager sheet={styledComponentsStyleSheet.instance}>
      {children}
    </StyleSheetManager>
  );
}
