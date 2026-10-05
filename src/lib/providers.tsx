"use client";

import { ThemeProvider } from "styled-components";
import StyledComponentsRegistry from "./registry";
import { theme } from "@/styles/theme";
import { GlobalStyles } from "@/styles/GlobalStyles";

export function Providers({
  nonce,
  children,
}: {
  nonce?: string;
  children: React.ReactNode;
}) {
  return (
    <StyledComponentsRegistry nonce={nonce}>
      <ThemeProvider theme={theme}>
        <GlobalStyles />
        {children}
      </ThemeProvider>
    </StyledComponentsRegistry>
  );
}
