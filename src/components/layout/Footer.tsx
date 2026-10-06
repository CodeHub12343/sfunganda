"use client";

import NextLink from "next/link";
import styled from "styled-components";
import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/ui/Logo";
import { footer, brand } from "@/data/content";
import { media } from "@/styles/theme";

function FooterLinkEl({ href, label }: { href: string; label: string }) {
  // External and mailto/tel links must render as a plain anchor; internal
  // routes use next/link.
  const isExternal = /^(https?:|mailto:|tel:)/i.test(href) || href.startsWith("//");
  if (isExternal) {
    const external = /^https?:\/\//i.test(href);
    return (
      <a href={href} rel={external ? "noopener noreferrer" : undefined} target={external ? "_blank" : undefined}>
        {label}
      </a>
    );
  }
  return <NextLink href={href}>{label}</NextLink>;
}

const Wrap = styled.footer`
  background: ${({ theme }) => theme.colors.bgDark};
  color: ${({ theme }) => theme.colors.onDarkSoft};
  padding-block: ${({ theme }) => theme.space[12]} ${({ theme }) => theme.space[6]};
  position: relative;
  overflow: hidden;
`;

const Glow = styled.div`
  position: absolute;
  inset: -40% 0 auto 0;
  height: 60%;
  background: radial-gradient(
    60% 80% at 50% 0%,
    rgba(247, 183, 51, 0.18),
    transparent 70%
  );
  pointer-events: none;
`;

const Grid = styled.div`
  position: relative;
  display: grid;
  gap: 3rem;
  grid-template-columns: 1fr;
  ${media.md} {
    grid-template-columns: 1.4fr repeat(2, minmax(0, 1fr));
  }
  ${media.lg} {
    grid-template-columns: 1.4fr repeat(4, minmax(0, 1fr));
  }
`;

const Brand = styled.div`
  p {
    margin-top: 1.25rem;
    max-width: 34ch;
    color: ${({ theme }) => theme.colors.onDarkSoft};
    font-size: 0.95rem;
  }
`;

const Col = styled.div`
  h4 {
    color: #fff;
    font-family: ${({ theme }) => theme.font.body};
    font-size: 0.8rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    margin-bottom: 1.1rem;
  }
  ul {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }
  a {
    color: ${({ theme }) => theme.colors.onDarkSoft};
    font-size: 0.95rem;
    transition: color 0.2s;
    text-decoration: none;
    &:hover,
    &:focus-visible {
      color: ${({ theme }) => theme.colors.hopeGold};
    }
    &:focus-visible {
      outline: 2px solid ${({ theme }) => theme.colors.hopeGold};
      outline-offset: 3px;
      border-radius: 2px;
    }
  }
`;

const Bottom = styled.div`
  position: relative;
  margin-top: 3.5rem;
  padding-top: 1.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  font-size: 0.85rem;
`;

const Pillars = styled.div`
  display: flex;
  gap: 1.25rem;
  flex-wrap: wrap;
  span {
    color: ${({ theme }) => theme.colors.hopeGold};
    font-weight: ${({ theme }) => theme.weight.semibold};
    letter-spacing: 0.04em;
  }
`;

export function Footer() {
  return (
    <Wrap>
      <Glow />
      <Container $wide>
        <Grid>
          <Brand>
            <Logo onDark />
            <p>{footer.blurb}</p>
          </Brand>
          {footer.columns.map((col) => (
            <Col key={col.title}>
              <h4>{col.title}</h4>
              <ul>
                {col.links.map((l) => (
                  <li key={l.href}>
                    <FooterLinkEl href={l.href} label={l.label} />
                  </li>
                ))}
              </ul>
            </Col>
          ))}
        </Grid>
        <Bottom>
          <span>
            © {new Date().getFullYear()} {brand.fullName}. In partnership with
            Honest Need · Uganda.
          </span>
          <Pillars>
            {brand.pillars.map((p) => (
              <span key={p}>{p}</span>
            ))}
            {/* Staff and supporter sign-in — second entry point so admins
                can always find the login from any page. */}
            <NextLink href="/sign-in" style={{ marginLeft: "0.5rem", opacity: 0.9 }}>
              Staff sign in
            </NextLink>
          </Pillars>
        </Bottom>
      </Container>
    </Wrap>
  );
}
