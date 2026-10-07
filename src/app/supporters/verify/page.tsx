import type { Metadata } from "next";
import { VerifyClient } from "./VerifyClient";

export const metadata: Metadata = {
  title: "Confirm your email — Sarah's Foundation",
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: "3rem 1.25rem" }}>
      <h1>Confirm your email</h1>
      <VerifyClient token={token ?? ""} />
    </main>
  );
}
