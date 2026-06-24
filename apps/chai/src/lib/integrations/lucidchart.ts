export async function createEmptyLucidDocument(
  accessToken: string,
  title: string
) {
  const res = await fetch("https://api.lucid.co/v1/documents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ title, product: "lucidchart" }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Lucid create failed");
  const documentId = data.documentId || data.id;
  return {
    documentId,
    editUrl: data.editUrl || `https://lucid.app/lucidchart/${documentId}/edit`,
    embedUrl:
      data.embedUrl ||
      `https://lucid.app/documents/embed/${documentId}#border=0&scale=fit`,
  };
}
