import PptxGenJS from "pptxgenjs";

export async function buildPptxBuffer(
  title: string,
  slides: Array<{ title: string; bullets: string[] }>
): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.author = "Chai";
  pptx.title = title;

  slides.forEach((s) => {
    const slide = pptx.addSlide();
    slide.addText(s.title, { x: 0.5, y: 0.4, w: 9, h: 1, fontSize: 28, bold: true });
    if (s.bullets.length) {
      slide.addText(
        s.bullets.map((b) => ({ text: b, options: { bullet: true } })),
        { x: 0.7, y: 1.5, w: 8.5, h: 4.5, fontSize: 16 }
      );
    }
  });

  const data = (await pptx.write({ outputType: "nodebuffer" })) as ArrayBuffer;
  return Buffer.from(data);
}

export async function buildRoadmapPptx(
  title: string,
  phases: Array<{ name: string; items: string[] }>
): Promise<Buffer> {
  return buildPptxBuffer(
    title,
    phases.map((p) => ({ title: p.name, bullets: p.items }))
  );
}
