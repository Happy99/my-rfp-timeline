import { useState } from 'preact/hooks';
import {
  exportSelectionsAsJson,
  importSelectionsFromJson,
  clearAllSelections,
  selections,
} from '~/lib/store';

type Props = { onClose: () => void };

function downloadFile(name: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ImportExportModal({ onClose }: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'replace' | 'merge'>('replace');

  function handleExport() {
    const json = exportSelectionsAsJson();
    downloadFile(`rfp-2026-picks-${new Date().toISOString().slice(0, 10)}.json`, json, 'application/json');
    setStatus('Backup downloaded.');
    setError(null);
  }

  async function handleImport(ev: Event) {
    setError(null);
    setStatus(null);
    const input = ev.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const text = await file.text();
    const result = importSelectionsFromJson(text, mode);
    if (result.ok) {
      setStatus(`Imported ${result.count} picks (${result.mode}).`);
    } else {
      setError(result.reason);
    }
    input.value = '';
  }

  function handleClear() {
    if (window.confirm(`Clear all ${selections.value.size} picks?`)) {
      clearAllSelections();
      setStatus('All picks cleared.');
    }
  }

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 px-4"
      onClick={onClose}
    >
      <div
        class="relative w-full max-w-md border-2 border-ink bg-paper p-5 shadow-[6px_6px_0_var(--color-blood)] rotate-[-0.5deg]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          class="absolute -right-3 -top-3 size-8 border-2 border-ink bg-neon font-display text-base rotate-[6deg] cursor-pointer"
          aria-label="Close"
        >
          ×
        </button>
        <h2 class="font-display text-xl uppercase tracking-tight">Backup / Restore</h2>
        <p class="font-mono text-xs mt-1 text-ink/80">
          Your picks live in this browser. Use these tools to sync across devices.
        </p>

        <div class="mt-4 space-y-3">
          <button
            type="button"
            onClick={handleExport}
            class="w-full border-2 border-ink bg-paper px-3 py-2 font-display uppercase tracking-tight hover:bg-neon hover:shadow-[3px_3px_0_var(--color-ink)] hover:-translate-y-0.5 transition-transform cursor-pointer"
          >
            ↓ Download picks (JSON)
          </button>

          <div class="border-2 border-ink p-3">
            <div class="flex items-center gap-3">
              <label class="font-mono text-xs flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="import-mode"
                  checked={mode === 'replace'}
                  onChange={() => setMode('replace')}
                />
                Replace
              </label>
              <label class="font-mono text-xs flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name="import-mode"
                  checked={mode === 'merge'}
                  onChange={() => setMode('merge')}
                />
                Merge
              </label>
            </div>
            <label class="mt-2 block w-full text-center border-2 border-dashed border-ink/60 px-3 py-2 font-mono text-xs cursor-pointer hover:bg-paper-dark">
              ↑ Choose backup file…
              <input type="file" accept="application/json" class="hidden" onChange={handleImport} />
            </label>
          </div>

          <button
            type="button"
            onClick={handleClear}
            class="w-full border-2 border-blood bg-paper px-3 py-2 font-display uppercase tracking-tight text-blood hover:bg-blood hover:text-paper transition-colors cursor-pointer"
          >
            ✕ Clear all picks
          </button>
        </div>

        {status && (
          <p class="mt-3 font-mono text-xs border-l-4 border-neon bg-neon/30 px-2 py-1">{status}</p>
        )}
        {error && (
          <p class="mt-3 font-mono text-xs border-l-4 border-blood bg-blood/10 px-2 py-1 text-blood-dark">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
