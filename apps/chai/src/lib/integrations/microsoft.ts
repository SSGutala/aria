import { getValidToken } from "./tokens";

type GraphItem = {
  id: string;
  name: string;
  webUrl: string;
};

async function graphFetch(
  token: string,
  path: string,
  init?: RequestInit
) {
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data.error?.message || data.message || `Graph error ${res.status}`
    );
  }
  return data;
}

export async function uploadToOneDrive(
  userId: string,
  filename: string,
  content: Buffer | Uint8Array,
  contentType: string
): Promise<GraphItem> {
  const token = await getValidToken(userId, "microsoft");
  const bytes = new Uint8Array(content instanceof Buffer ? content : content);
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/root:/Chai/${encodeURIComponent(filename)}:/content`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": contentType,
      },
      body: bytes as BodyInit,
    }
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || "OneDrive upload failed");
  }
  return { id: data.id, name: data.name, webUrl: data.webUrl };
}

export async function createWordDocument(
  userId: string,
  title: string,
  htmlBody: string
) {
  const { buildDocxBuffer } = await import("@/lib/export/docx");
  const buffer = await buildDocxBuffer(title, htmlBody);
  const item = await uploadToOneDrive(
    userId,
    `${title}.docx`,
    buffer,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
  return {
    fileId: item.id,
    url: item.webUrl,
    embedUrl: `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(item.webUrl)}`,
  };
}

export async function createExcelWorkbook(
  userId: string,
  title: string,
  rows: string[][]
) {
  const { buildXlsxBuffer } = await import("@/lib/export/xlsx");
  const buffer = buildXlsxBuffer(rows);
  const item = await uploadToOneDrive(
    userId,
    `${title}.xlsx`,
    buffer,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  return {
    fileId: item.id,
    url: item.webUrl,
    embedUrl: `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(item.webUrl)}`,
  };
}

export async function createPowerPointDeck(
  userId: string,
  title: string,
  slides: Array<{ title: string; bullets: string[] }>
) {
  const { buildPptxBuffer } = await import("@/lib/export/pptx");
  const buffer = await buildPptxBuffer(title, slides);
  const item = await uploadToOneDrive(
    userId,
    `${title}.pptx`,
    buffer,
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  );
  return {
    fileId: item.id,
    url: item.webUrl,
    embedUrl: `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(item.webUrl)}`,
  };
}

export async function getMicrosoftConnectionStatus(userId: string) {
  try {
    const token = await getValidToken(userId, "microsoft");
    await graphFetch(token, "/me?$select=displayName");
    return { connected: true };
  } catch {
    return { connected: false };
  }
}
