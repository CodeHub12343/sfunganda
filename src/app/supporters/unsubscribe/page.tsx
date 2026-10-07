import { UnsubscribeClient } from "./UnsubscribeClient";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "3rem 1.25rem" }}>
      <h1>Unsubscribe</h1>
      <UnsubscribeClient token={token ?? ""} />
    </main>
  );
}
