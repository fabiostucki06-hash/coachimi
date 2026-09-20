// Browser-only file helpers for the local backup feature (Settings). The PWA is
// the primary target; callers must gate on Platform.OS === 'web'.

/** Triggers a browser download of `content` as `filename`. */
export function downloadTextFile(filename: string, content: string, mimeType = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked on a timer, not synchronously: Safari can cancel the download otherwise.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Opens the native file picker and resolves with the chosen file's text, or null if the user cancelled. */
export function pickTextFile(accept = 'application/json,.json'): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      file.text().then(resolve, reject);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
