import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
} from "docx";

export async function buildDocxBuffer(
  title: string,
  body: string
): Promise<Buffer> {
  const lines = body.split(/\n+/).filter(Boolean);
  const children = [
    new Paragraph({
      text: title,
      heading: HeadingLevel.HEADING_1,
    }),
    ...lines.map(
      (line) =>
        new Paragraph({
          children: [new TextRun(line)],
        })
    ),
  ];
  const doc = new Document({ sections: [{ children }] });
  return Buffer.from(await Packer.toBuffer(doc));
}
