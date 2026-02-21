export const copyToClipboard = async (value: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Fallback to legacy clipboard copy below.
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const isCopied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return isCopied;
  } catch {
    return false;
  }
};

export const buildEpisodeDeepLink = (episodeKey: string): string => {
  const params = new URLSearchParams();
  params.set('episode', episodeKey);
  return `qortal://APP/Q-Podcasts?${params.toString()}`;
};

export const triggerFileDownload = (url: string, filename: string): void => {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
};
