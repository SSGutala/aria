import { db } from "@/lib/db";
import type { ExternalLink, FlowEdge, FlowNode, RoadmapTask } from "@/lib/types";
import * as google from "./google";
import * as microsoft from "./microsoft";
import * as lucid from "./lucidchart";
import * as figma from "./figma";
import {
  contentToPlainText,
  contentToSheetRows,
  contentToSlides,
  parseArtifactContent,
  parseExternalLinks,
} from "./suggest";
import { getValidToken } from "./tokens";

export type ConnectTarget =
  | "google_docs"
  | "google_sheets"
  | "google_slides"
  | "microsoft_word"
  | "microsoft_excel"
  | "microsoft_ppt"
  | "lucidchart"
  | "figma";

export async function connectArtifact(
  userId: string,
  artifactId: string,
  target: ConnectTarget
): Promise<ExternalLink> {
  const artifact = await db.artifact.findUnique({ where: { id: artifactId } });
  if (!artifact) throw new Error("Artifact not found");

  const content = parseArtifactContent(artifact.content);
  const title = artifact.title;
  let link: ExternalLink;

  switch (target) {
    case "google_docs": {
      const r = await google.createGoogleDoc(
        userId,
        title,
        contentToPlainText(content)
      );
      link = {
        provider: "google",
        url: r.url,
        embedUrl: r.embedUrl,
        fileId: r.fileId,
        connectedAt: new Date().toISOString(),
      };
      break;
    }
    case "google_sheets": {
      const r = await google.createGoogleSheet(
        userId,
        title,
        contentToSheetRows(content)
      );
      link = {
        provider: "google",
        url: r.url,
        embedUrl: r.embedUrl,
        fileId: r.fileId,
        connectedAt: new Date().toISOString(),
      };
      break;
    }
    case "google_slides": {
      const r = await google.createGoogleSlides(
        userId,
        title,
        contentToSlides(content)
      );
      link = {
        provider: "google",
        url: r.url,
        embedUrl: r.embedUrl,
        fileId: r.fileId,
        connectedAt: new Date().toISOString(),
      };
      break;
    }
    case "microsoft_word": {
      const r = await microsoft.createWordDocument(
        userId,
        title,
        contentToPlainText(content)
      );
      link = {
        provider: "microsoft",
        url: r.url,
        embedUrl: r.embedUrl,
        fileId: r.fileId,
        connectedAt: new Date().toISOString(),
      };
      break;
    }
    case "microsoft_excel": {
      const r = await microsoft.createExcelWorkbook(
        userId,
        title,
        contentToSheetRows(content)
      );
      link = {
        provider: "microsoft",
        url: r.url,
        embedUrl: r.embedUrl,
        fileId: r.fileId,
        connectedAt: new Date().toISOString(),
      };
      break;
    }
    case "microsoft_ppt": {
      const r = await microsoft.createPowerPointDeck(
        userId,
        title,
        contentToSlides(content)
      );
      link = {
        provider: "microsoft",
        url: r.url,
        embedUrl: r.embedUrl,
        fileId: r.fileId,
        connectedAt: new Date().toISOString(),
      };
      break;
    }
    case "lucidchart": {
      const token = await getValidToken(userId, "lucidchart");
      const nodes = (content.flowNodes || content.nodes || []) as FlowNode[];
      const edges = (content.flowEdges || content.edges || []) as FlowEdge[];
      const tasks = (content.tasks || []) as RoadmapTask[];

      let result;
      if (artifact.type === "roadmap" && tasks.length) {
        const doc = lucid.roadmapToLucidImport(title, tasks);
        result = await lucid.createLucidDocumentWithImport(token, title, doc);
      } else if (nodes.length) {
        const doc = lucid.flowToLucidImport(title, nodes, edges);
        result = await lucid.createLucidDocumentWithImport(token, title, doc);
      } else {
        result = await lucid.createEmptyLucidDocument(token, title);
      }

      link = {
        provider: "lucidchart",
        url: result.editUrl,
        embedUrl: result.embedUrl,
        fileId: result.documentId,
        connectedAt: new Date().toISOString(),
      };
      break;
    }
    case "figma": {
      throw new Error("Use design variant connect for Figma handoff");
    }
    default:
      throw new Error(`Unknown connect target: ${target}`);
  }

  const links = parseExternalLinks(artifact.externalLinks);
  const filtered = links.filter((l) => l.provider !== link.provider);
  filtered.push(link);

  await db.artifact.update({
    where: { id: artifactId },
    data: { externalLinks: JSON.stringify(filtered) },
  });

  return link;
}

export async function connectDesignVariant(
  userId: string,
  variantId: string
) {
  const variant = await db.designVariant.findUnique({ where: { id: variantId } });
  if (!variant) throw new Error("Design variant not found");

  const templateKey = process.env.FIGMA_TEMPLATE_FILE_KEY;
  if (!templateKey) {
    throw new Error("FIGMA_TEMPLATE_FILE_KEY not configured");
  }

  const token = await getValidToken(userId, "figma");
  let spec = variant.figmaSpec ? JSON.parse(variant.figmaSpec) : null;
  if (!spec && variant.previewHtml) {
    spec = figma.mockupHtmlToSpec(variant.previewHtml, variant.name);
    await db.designVariant.update({
      where: { id: variantId },
      data: { figmaSpec: JSON.stringify(spec) },
    });
  }

  const comment = [
    `Chai design handoff: ${variant.name}`,
    spec ? `\n\`\`\`json\n${JSON.stringify(figma.specToPluginPayload(spec), null, 2)}\n\`\`\`` : "",
    variant.previewImage
      ? `\nReference PNG attached in Chai (variant ${variantId}).`
      : "",
    "\nRun the Chai Figma plugin → Import from Chai to create frames.",
  ].join("");

  await figma.postFigmaComment(token, templateKey, comment);

  const embedUrl = figma.buildFigmaEmbedUrl(templateKey);
  const openUrl = `https://www.figma.com/file/${templateKey}`;

  await db.designVariant.update({
    where: { id: variantId },
    data: { figmaEmbedUrl: embedUrl, figmaOpenUrl: openUrl },
  });

  return { embedUrl, openUrl, spec, pluginPayload: spec ? figma.specToPluginPayload(spec) : null };
}
