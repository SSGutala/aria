import React, { useMemo, useEffect, useRef } from 'react'
import { SandpackProvider, SandpackPreview, SandpackLayout, useSandpack } from '@codesandbox/sandpack-react'

/**
 * ErrorWatcher — lives inside the Sandpack context and reports the FIRST
 * compile/runtime error of each error-storm up to its parent. This is what lets
 * Aria fix its own code: the parent auto-triggers a repair instead of asking the
 * user to. Resets on a clean compile so a *new* error after a fix is reported too.
 */
function ErrorWatcher({ onError }) {
  const { listen } = useSandpack()
  const reported = useRef(false)
  useEffect(() => {
    const stop = listen((msg) => {
      // A new compile cycle is starting — clear the latch so THIS cycle's first
      // error (if any) gets reported. This is what lets the auto-repair loop keep
      // going: after a fix pushes new files, the recompile re-surfaces any error
      // that's still present instead of staying silent.
      if (msg.type === 'start' || (msg.type === 'status' && (msg.status === 'transpiling' || msg.status === 'evaluating'))) {
        reported.current = false
      }
      if (msg.type === 'action' && msg.action === 'show-error') {
        const text = [msg.title, msg.message].filter(Boolean).join(': ').trim()
        if (text && !reported.current) { reported.current = true; onError?.(text) }
      } else if (msg.type === 'success' || (msg.type === 'status' && msg.status === 'idle')) {
        reported.current = false // clean compile — allow the next genuine error through
      }
    })
    return stop
  }, [listen, onError])
  return null
}

/**
 * AppPreview — live, in-browser preview of a generated multi-file React project
 * using Sandpack (CodeSandbox's in-browser bundler). No server sandbox, no E2B,
 * no API key. Bundler/runtime errors surface in Sandpack's overlay, which is our
 * Phase-3 "validation" signal (and feeds the Phase-5 repair loop).
 *
 * Props: { files: { "/path": "content" }, entry }
 */
export default function AppPreview({ files = {}, entry = '/App.js', onRuntimeError }) {
  // Sandpack accepts { "/path": "code" } directly. Ensure the required scaffold
  // exists so the bundle always mounts even if generation was partial.
  const sandpackFiles = useMemo(() => {
    const f = { ...files }
    if (!f['/index.js'] && !f['/index.jsx']) {
      f['/index.js'] = `import React from "react";
import { createRoot } from "react-dom/client";
import App from "${entry.replace(/\.jsx?$/, '')}";
createRoot(document.getElementById("root")).render(<App />);`
    }
    if (!f['/public/index.html']) {
      f['/public/index.html'] = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><script src="https://cdn.tailwindcss.com"></script></head><body><div id="root"></div></body></html>`
    }
    return f
  }, [files, entry])

  const paths = Object.keys(files)
  if (!paths.length) {
    return <div style={{ padding: 24, color: '#737373', fontSize: 13 }}>Nothing to preview yet.</div>
  }

  return (
    <div style={{ height: '100%', width: '100%', background: '#FFFFFF' }}>
      {/* Force the whole Sandpack chain to fill the available height. Without
          this, SandpackLayout falls back to its ~300px default and the preview
          renders only partway down the panel, leaving white space below. */}
      <style>{`
        .aria-sp-preview, .aria-sp-preview .sp-wrapper, .aria-sp-preview .sp-layout,
        .aria-sp-preview .sp-stack, .aria-sp-preview .sp-preview-container { height: 100% !important; }
        .aria-sp-preview .sp-preview-container { display: flex; flex-direction: column; flex: 1; }
        .aria-sp-preview .sp-preview-iframe { flex: 1 1 auto; height: 100% !important; }
      `}</style>
      <div className="aria-sp-preview" style={{ height: '100%', width: '100%' }}>
      <SandpackProvider
        template="react"
        files={sandpackFiles}
        options={{
          recompileMode: 'delayed',
          recompileDelay: 400,
          // Inject the Tailwind Play CDN directly into the preview iframe. This is
          // far more reliable than relying on a <script> inside a custom
          // /public/index.html (which Sandpack's react template can strip/override).
          // Without this, every generated className is inert and the app renders as
          // raw serif HTML.
          externalResources: ['https://cdn.tailwindcss.com'],
        }}
        customSetup={{ entry: sandpackFiles['/index.jsx'] ? '/index.jsx' : '/index.js' }}
      >
        {onRuntimeError && <ErrorWatcher onError={onRuntimeError} />}
        <SandpackLayout style={{ border: 'none', borderRadius: 0, height: '100%' }}>
          <SandpackPreview
            showOpenInCodeSandbox={false}
            showRefreshButton={true}
            style={{ height: '100%', minHeight: 400 }}
          />
        </SandpackLayout>
      </SandpackProvider>
      </div>
    </div>
  )
}
