import { useState, useRef, useCallback } from "react";

const MODELS = [
  { id: "claude_haiku-4-5", label: "Haiku 4.5", tier: "fast", color: "#10b981" },
  { id: "claude_sonnet-4-5", label: "Sonnet 4.5", tier: "balanced", color: "#6366f1" },
  { id: "claude_opus-4-6", label: "Opus 4.6", tier: "powerful", color: "#f59e0b" },
  { id: "claude_haiku-3-5", label: "Haiku 3.5", tier: "fast", color: "#14b8a6" },
  { id: "claude_sonnet-3-5", label: "Sonnet 3.5", tier: "balanced", color: "#8b5cf6" },
  { id: "claude_opus-4-5", label: "Opus 4.5", tier: "powerful", color: "#f97316" },
  { id: "groq/openai-oss-20b", label: "OpenAI OSS 20B", tier: "fast", color: "#ec4899", isGroq: true },
  { id: "groq/openai-oss-120b", label: "OpenAI OSS 120B", tier: "balanced", color: "#e11d48", isGroq: true },
];

const BASE_URL = "";

const PRESETS = [
  { label: "🧠 Explain", prompt: "Explain how a neural network learns, in 3 sentences." },
  { label: "🐍 Python", prompt: "Write a Python function that finds all prime numbers up to n using the Sieve of Eratosthenes." },
  { label: "📖 Story", prompt: "Write a 4-sentence micro-story about a librarian who discovers their library's catalog system has become sentient." },
  { label: "🔍 Compare", prompt: "Compare conda and pip in 3 bullet points." },
  { label: "🎭 Creative", prompt: "Write a haiku about debugging code at 3am." },
];

async function callModel(model, prompt, systemPrompt, maxTokens, temperature) {
  const isGroq = model.isGroq;
  const endpoint = isGroq ? `/${model.id}` : `/bedrock/${model.id}`;
  const url = `${BASE_URL}${endpoint}`;
  const start = performance.now();

  const payload = {
    messages: [{ role: "user", content: prompt }],
    max_tokens: maxTokens,
  };
  if (systemPrompt) payload.system = systemPrompt;
  if (temperature !== undefined) payload.temperature = temperature;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": "Bearer dogfoodit",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const elapsed = performance.now() - start;
    if (!res.ok) {
      const errText = await res.text();
      return { model, error: `HTTP ${res.status}: ${errText}`, elapsed };
    }
    const data = await res.json();
    const text = data.content?.map(c => c.text || "").join("") || JSON.stringify(data);
    const usage = data.usage || {};
    return { model, text, elapsed, usage, stopReason: data.stop_reason };
  } catch (e) {
    return { model, error: e.message, elapsed: performance.now() - start };
  }
}

function ModelCard({ result, isLoading }) {
  const m = result?.model;
  if (!m) return null;

  const tierColors = { fast: "#10b981", balanced: "#6366f1", powerful: "#f59e0b" };

  return (
    <div style={{
      background: "#1a1a2e",
      borderRadius: 12,
      border: `1px solid ${m.color}33`,
      padding: 20,
      display: "flex",
      flexDirection: "column",
      gap: 12,
      minHeight: 200,
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            width: 10, height: 10, borderRadius: "50%",
            background: isLoading ? "#fbbf24" : result?.error ? "#ef4444" : result?.text ? "#10b981" : "#4b5563",
            boxShadow: isLoading ? "0 0 8px #fbbf2488" : "none",
            animation: isLoading ? "pulse 1.5s infinite" : "none",
          }} />
          <span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 14 }}>{m.label}</span>
        </div>
        <span style={{
          fontSize: 10, padding: "2px 8px", borderRadius: 10,
          background: `${tierColors[m.tier]}22`, color: tierColors[m.tier],
          textTransform: "uppercase", fontWeight: 700, letterSpacing: 1,
        }}>{m.tier}</span>
      </div>

      {/* Stats */}
      {result?.elapsed && (
        <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#94a3b8" }}>
          <span>⏱ {(result.elapsed / 1000).toFixed(2)}s</span>
          {result.usage?.input_tokens && <span>📥 {result.usage.input_tokens} tok</span>}
          {result.usage?.output_tokens && <span>📤 {result.usage.output_tokens} tok</span>}
          {result.usage?.output_tokens && result.elapsed && (
            <span>⚡ {(result.usage.output_tokens / (result.elapsed / 1000)).toFixed(0)} tok/s</span>
          )}
        </div>
      )}

      {/* Content */}
      <div style={{
        flex: 1, fontSize: 13, lineHeight: 1.6,
        color: result?.error ? "#fca5a5" : "#cbd5e1",
        whiteSpace: "pre-wrap", overflowY: "auto", maxHeight: 400,
        fontFamily: result?.error ? "monospace" : "inherit",
      }}>
        {isLoading && !result?.text ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#94a3b8" }}>
            <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
            Thinking...
          </div>
        ) : result?.error ? (
          <span>❌ {result.error}</span>
        ) : result?.text ? (
          result.text
        ) : (
          <span style={{ color: "#4b5563", fontStyle: "italic" }}>Waiting for prompt...</span>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [maxTokens, setMaxTokens] = useState(1024);
  const [temperature, setTemperature] = useState(0.7);
  const [selectedModels, setSelectedModels] = useState(["claude_haiku-4-5", "claude_sonnet-4-5", "claude_opus-4-6"]);
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const abortRef = useRef(false);

  const toggleModel = (id) => {
    setSelectedModels(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const runArena = useCallback(async () => {
    if (!prompt.trim() || selectedModels.length === 0) return;
    abortRef.current = false;
    setResults({});
    const modelsToRun = MODELS.filter(m => selectedModels.includes(m.id));
    setLoading(new Set(modelsToRun.map(m => m.id)));

    const promises = modelsToRun.map(async (model) => {
      const result = await callModel(model, prompt, systemPrompt, maxTokens, temperature);
      if (!abortRef.current) {
        setResults(prev => ({ ...prev, [model.id]: result }));
        setLoading(prev => { const n = new Set(prev); n.delete(model.id); return n; });
      }
      return result;
    });

    await Promise.allSettled(promises);
  }, [prompt, systemPrompt, maxTokens, temperature, selectedModels]);

  const resultsList = selectedModels.map(id => ({
    model: MODELS.find(m => m.id === id),
    ...(results[id] || {}),
  }));

  const fastestResult = Object.values(results).filter(r => r.text && r.elapsed).sort((a, b) => a.elapsed - b.elapsed)[0];

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)",
      color: "#e2e8f0",
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      <style>{`
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
        @keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
        textarea:focus, input:focus { outline: none; border-color: #6366f1 !important; }
      `}</style>

      {/* Header */}
      <div style={{
        padding: "32px 24px 24px",
        textAlign: "center",
        borderBottom: "1px solid #ffffff0a",
      }}>
        <h1 style={{
          fontSize: 28, fontWeight: 800, margin: 0,
          background: "linear-gradient(135deg, #6366f1, #f59e0b, #10b981)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          ⚡ AI Catalyst Model Arena
        </h1>
        <p style={{ color: "#64748b", margin: "8px 0 0", fontSize: 14 }}>
          Compare models side-by-side • Powered by Anaconda's CKO AI Proxy
        </p>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
        {/* Model Selection */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
            Select Models
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {MODELS.map(m => {
              const sel = selectedModels.includes(m.id);
              return (
                <button key={m.id} onClick={() => toggleModel(m.id)} style={{
                  padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                  border: `1.5px solid ${sel ? m.color : "#334155"}`,
                  background: sel ? `${m.color}18` : "transparent",
                  color: sel ? m.color : "#64748b",
                  cursor: "pointer", transition: "all 0.2s",
                }}>
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Prompt Input */}
        <div style={{ marginBottom: 16 }}>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Enter your prompt to compare across models..."
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) runArena(); }}
            style={{
              width: "100%", boxSizing: "border-box", minHeight: 90, padding: 16,
              background: "#0f172a", border: "1px solid #334155", borderRadius: 12,
              color: "#e2e8f0", fontSize: 14, resize: "vertical", lineHeight: 1.5,
              fontFamily: "inherit",
            }}
          />
        </div>

        {/* Presets */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {PRESETS.map(p => (
            <button key={p.label} onClick={() => setPrompt(p.prompt)} style={{
              padding: "5px 12px", borderRadius: 16, fontSize: 12,
              border: "1px solid #334155", background: "#0f172a",
              color: "#94a3b8", cursor: "pointer",
            }}>
              {p.label}
            </button>
          ))}
          <button onClick={() => setShowSettings(!showSettings)} style={{
            padding: "5px 12px", borderRadius: 16, fontSize: 12,
            border: "1px solid #334155", background: showSettings ? "#1e293b" : "#0f172a",
            color: "#94a3b8", cursor: "pointer", marginLeft: "auto",
          }}>
            ⚙️ Settings
          </button>
        </div>

        {/* Settings */}
        {showSettings && (
          <div style={{
            background: "#0f172a", border: "1px solid #334155", borderRadius: 12,
            padding: 16, marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 16,
          }}>
            <div style={{ flex: "1 1 300px" }}>
              <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>System Prompt</label>
              <input
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                placeholder="Optional system prompt..."
                style={{
                  width: "100%", boxSizing: "border-box", padding: "8px 12px",
                  background: "#1a1a2e", border: "1px solid #334155", borderRadius: 8,
                  color: "#e2e8f0", fontSize: 13,
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>Max Tokens</label>
              <input
                type="number" value={maxTokens} onChange={e => setMaxTokens(+e.target.value)}
                style={{
                  width: 90, padding: "8px 12px",
                  background: "#1a1a2e", border: "1px solid #334155", borderRadius: 8,
                  color: "#e2e8f0", fontSize: 13,
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>Temperature: {temperature}</label>
              <input
                type="range" min="0" max="1" step="0.1" value={temperature}
                onChange={e => setTemperature(+e.target.value)}
                style={{ width: 120, accentColor: "#6366f1" }}
              />
            </div>
          </div>
        )}

        {/* Run Button */}
        <button
          onClick={runArena}
          disabled={!prompt.trim() || selectedModels.length === 0 || loading.size > 0}
          style={{
            width: "100%", padding: "14px", borderRadius: 12, fontSize: 15, fontWeight: 700,
            border: "none", cursor: loading.size > 0 ? "wait" : "pointer",
            background: loading.size > 0
              ? "linear-gradient(135deg, #334155, #475569)"
              : "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: "#fff", marginBottom: 24, letterSpacing: 0.5,
            opacity: (!prompt.trim() || selectedModels.length === 0) ? 0.4 : 1,
          }}
        >
          {loading.size > 0 ? `⏳ Waiting on ${loading.size} model${loading.size > 1 ? "s" : ""}...` : `🚀 Run ${selectedModels.length} Model${selectedModels.length > 1 ? "s" : ""}`}
        </button>

        {/* Winner Banner */}
        {fastestResult && loading.size === 0 && Object.keys(results).length > 1 && (
          <div style={{
            background: "linear-gradient(135deg, #10b98122, #06b6d422)",
            border: "1px solid #10b98144",
            borderRadius: 12, padding: "12px 20px", marginBottom: 20,
            display: "flex", justifyContent: "center", alignItems: "center", gap: 8,
            fontSize: 14,
          }}>
            🏆 <strong style={{ color: fastestResult.model.color }}>{fastestResult.model.label}</strong>
            <span style={{ color: "#94a3b8" }}>was fastest at</span>
            <strong>{(fastestResult.elapsed / 1000).toFixed(2)}s</strong>
          </div>
        )}

        {/* Results Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: selectedModels.length === 1 ? "1fr" : selectedModels.length === 2 ? "1fr 1fr" : "repeat(auto-fit, minmax(340px, 1fr))",
          gap: 16,
        }}>
          {resultsList.map(r => (
            <ModelCard
              key={r.model?.id}
              result={r}
              isLoading={loading.has(r.model?.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}