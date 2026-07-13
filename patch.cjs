const fs = require('fs');
const code = fs.readFileSync('src/App.tsx', 'utf8');

const updated = code.replace(
  "  const [gateConfig, setGateConfig] = useState<any>(null);\n  const [token, setToken] = useState<string | null>(null);",
  "  const [gateConfig, setGateConfig] = useState<any>(null);\n  const [token, setToken] = useState<string | null>(null);\n  const [oauthError, setOauthError] = useState<string | null>(null);"
).replace(
  "    if (hash.includes('access_token')) {\n      hashParams = new URLSearchParams(hash.substring(1));\n      oauthToken = hashParams.get('access_token');\n      oauthState = hashParams.get('state');             \n      if (oauthToken) {\n        setToken(oauthToken);\n      }\n    }",
  "    if (hash.includes('access_token') || hash.includes('error=')) {\n      hashParams = new URLSearchParams(hash.substring(1));\n      oauthToken = hashParams.get('access_token');\n      oauthState = hashParams.get('state');\n      const err = hashParams.get('error');\n      if (oauthToken) {\n        setToken(oauthToken);\n      }\n      if (err) {\n        const details = hashParams.get('details');\n        setOauthError(details ? `${err}: ${details}` : err);\n      }\n    }"
).replace(
  "} else if (oauthState === 'gate_auth') { ",
  "} else if (oauthState === 'gate_auth' || oauthError || oauthToken) { "
).replace(
  "} else if (hashParams && hashParams.has('access_token')) {",
  "} else if (hashParams && (hashParams.has('access_token') || hashParams.has('error'))) {"
).replace(
  "  if (gateConfig) {\n    return <GateView config={gateConfig} token={token} setToken={setToken} />;\n  }",
  "  if (gateConfig) {\n    if (oauthError) {\n      return <ErrorDisplay error={oauthError} onRetry={() => { setOauthError(null); window.history.replaceState(null, '', window.location.pathname + window.location.search); window.location.reload(); }} />;\n    }\n    return <GateView config={gateConfig} token={token} setToken={setToken} />;\n  }"
) + "\nfunction ErrorDisplay({ error, onRetry }: { error: string, onRetry: () => void }) {\n  return (\n    <div className=\"min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 md:p-8 font-sans\">\n      <div className=\"w-full max-w-[480px] bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center text-center\">\n        <AlertCircle className=\"w-12 h-12 text-red-500 mb-4\" />\n        <h2 className=\"text-2xl font-black text-zinc-900 mb-2\">Connection Failed</h2>\n        <p className=\"text-zinc-600 mb-6\">{error}</p>\n        <button onClick={onRetry} className=\"w-full bg-zinc-900 hover:bg-black text-white font-bold py-4 rounded-xl transition-colors uppercase tracking-widest text-sm\">\n          Try Again\n        </button>\n      </div>\n    </div>\n  );\n}";

fs.writeFileSync('src/App.tsx', updated);
