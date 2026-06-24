import { getValidToken } from "./tokens";

async function googleFetch(token: string, url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error?.message || data.error?.status || "Google API error");
  }
  return data;
}

export async function createGoogleDoc(
  userId: string,
  title: string,
  plainText: string
) {
  const token = await getValidToken(userId, "google");
  const doc = await googleFetch(
    token,
    "https://docs.googleapis.com/v1/documents",
    { method: "POST", body: JSON.stringify({ title }) }
  );
  if (plainText) {
    await googleFetch(
      token,
      `https://docs.googleapis.com/v1/documents/${doc.documentId}:batchUpdate`,
      {
        method: "POST",
        body: JSON.stringify({
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: plainText,
              },
            },
          ],
        }),
      }
    );
  }
  return {
    fileId: doc.documentId,
    url: `https://docs.google.com/document/d/${doc.documentId}/edit`,
    embedUrl: `https://docs.google.com/document/d/${doc.documentId}/edit?embedded=true`,
  };
}

export async function createGoogleSheet(
  userId: string,
  title: string,
  rows: string[][]
) {
  const token = await getValidToken(userId, "google");
  const sheet = await googleFetch(
    token,
    "https://sheets.googleapis.com/v4/spreadsheets",
    {
      method: "POST",
      body: JSON.stringify({
        properties: { title },
        sheets: [{ properties: { title: "Sheet1" } }],
      }),
    }
  );
  if (rows.length) {
    await googleFetch(
      token,
      `https://sheets.googleapis.com/v4/spreadsheets/${sheet.spreadsheetId}/values/Sheet1!A1:append?valueInputOption=RAW`,
      {
        method: "POST",
        body: JSON.stringify({ values: rows }),
      }
    );
  }
  return {
    fileId: sheet.spreadsheetId,
    url: `https://docs.google.com/spreadsheets/d/${sheet.spreadsheetId}/edit`,
    embedUrl: `https://docs.google.com/spreadsheets/d/${sheet.spreadsheetId}/edit?widget=true&headers=false`,
  };
}

export async function createGoogleSlides(
  userId: string,
  title: string,
  slides: Array<{ title: string; bullets: string[] }>
) {
  const token = await getValidToken(userId, "google");
  const pres = await googleFetch(
    token,
    "https://slides.googleapis.com/v1/presentations",
    { method: "POST", body: JSON.stringify({ title }) }
  );
  const requests: object[] = [];
  slides.forEach((s, i) => {
    const slideId = `slide_${i}`;
    requests.push({ createSlide: { objectId: slideId, slideLayoutReference: { predefinedLayout: "TITLE_AND_BODY" } } });
    requests.push({
      insertText: {
        objectId: slideId,
        insertionIndex: 0,
        text: `${s.title}\n${s.bullets.map((b) => `• ${b}`).join("\n")}`,
      },
    });
  });
  if (requests.length) {
    await googleFetch(
      token,
      `https://slides.googleapis.com/v1/presentations/${pres.presentationId}:batchUpdate`,
      { method: "POST", body: JSON.stringify({ requests }) }
    );
  }
  return {
    fileId: pres.presentationId,
    url: `https://docs.google.com/presentation/d/${pres.presentationId}/edit`,
    embedUrl: `https://docs.google.com/presentation/d/${pres.presentationId}/embed`,
  };
}
