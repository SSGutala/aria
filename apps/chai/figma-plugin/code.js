// Chai Figma plugin — creates frames from mockupSpec served by Chai API
figma.showUI(
  `<style>body{font:13px Inter,sans-serif;margin:16px}label{display:block;margin:12px 0 4px;font-weight:600}input,textarea{width:100%;padding:8px;border:1px solid #ccc;border-radius:6px}button{margin-top:12px;padding:10px 14px;background:#4f46e5;color:#fff;border:0;border-radius:8px;cursor:pointer;width:100%}#log{margin-top:12px;font-size:12px;color:#475569}</style>
  <h3>Chai Mockup Importer</h3>
  <label>Spec URL</label><input id="url" placeholder=".../api/integrations/figma/plugin-spec?variantId=..." />
  <button id="importUrl">Import from URL</button>
  <label>Or JSON</label><textarea id="json" rows="6"></textarea>
  <button id="importJson">Import JSON</button>
  <div id="log"></div>
  <script>
  const log=m=>document.getElementById('log').textContent=m;
  document.getElementById('importUrl').onclick=()=>{const u=document.getElementById('url').value.trim();if(!u)return log('Enter URL');parent.postMessage({pluginMessage:{type:'import-from-url',url:u}},'*');};
  document.getElementById('importJson').onclick=()=>{try{parent.postMessage({pluginMessage:{type:'import-spec',spec:JSON.parse(document.getElementById('json').value)}},'*');}catch(e){log(e.message);}};
  onmessage=e=>{const m=e.data.pluginMessage;if(m?.type==='done')log('Created '+m.count+' frames');if(m?.type==='error')log(m.message);};
  </script>`,
  { width: 420, height: 480 }
);

figma.ui.onmessage = async (msg) => {
  if (msg.type === "import-from-url") {
    try {
      const res = await fetch(msg.url);
      const payload = await res.json();
      await createFramesFromSpec(payload.spec || payload);
      figma.ui.postMessage({ type: "done", count: (payload.spec || payload).frames?.length || 0 });
    } catch (e) {
      figma.ui.postMessage({ type: "error", message: String(e.message || e) });
    }
  }
  if (msg.type === "import-spec") {
    try {
      await createFramesFromSpec(msg.spec);
      figma.ui.postMessage({ type: "done", count: msg.spec.frames?.length || 0 });
    } catch (e) {
      figma.ui.postMessage({ type: "error", message: String(e.message || e) });
    }
  }
  if (msg.type === "close") figma.closePlugin();
};

async function createFramesFromSpec(spec) {
  if (!spec || !spec.frames) throw new Error("Invalid mockup spec");

  const page = figma.currentPage;
  const root = figma.createFrame();
  root.name = spec.title || "Chai Mockup";
  root.resize(spec.width || 1280, spec.height || 800);
  root.fills = [solidPaint(spec.background || "#0f172a")];
  page.appendChild(root);

  for (const f of spec.frames) {
    await addFrame(root, f);
  }
  figma.viewport.scrollAndZoomIntoView([root]);
}

async function addFrame(parent, f) {
  const frame = figma.createFrame();
  frame.name = f.name || "Frame";
  frame.x = f.x || 0;
  frame.y = f.y || 0;
  frame.resize(f.width || 200, f.height || 120);
  if (f.fill) frame.fills = [solidPaint(f.fill)];
  parent.appendChild(frame);

  if (f.text) {
    const text = figma.createText();
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    text.characters = f.text;
    text.fontSize = f.fontSize || 14;
    text.x = 12;
    text.y = 12;
    text.resize(f.width - 24, f.height - 24);
    frame.appendChild(text);
  }

  if (f.children) {
    for (const child of f.children) {
      await addFrame(frame, child);
    }
  }
}

function solidPaint(hex) {
  const c = hexToRgb(hex);
  return { type: "SOLID", color: c };
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((x) => x + x).join("") : h, 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}
