const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

export const buildDownloadFilename = (title: string): string => {
  const base = title
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 80);

  if (!base) {
    return 'podcast_episode.mp3';
  }

  return `${base}.mp3`;
};

export const buildHtmlAudioEmbedCode = (
  audioUrl: string,
  title: string,
  detailUrl: string
): string => {
  const safeUrl = escapeHtml(audioUrl);
  const safeTitle = escapeHtml(title);
  const safeDetailUrl = escapeHtml(detailUrl);
  const downloadFilename = escapeHtml(buildDownloadFilename(title));

  return `<figure class="q-podcast-embed">\n  <figcaption style="font-family: 'Arial', sans-serif; font-size: 20px; color: #2c3e50; font-weight: bold; margin-bottom: 10px;">${safeTitle}</figcaption>\n  <audio controls preload="none" src="${safeUrl}"></audio>\n  <div style="margin-top: 10px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">\n    <a href="${safeUrl}" download="${downloadFilename}" style="text-decoration: none; color: #555; font-size: 0.9em; font-family: Arial, sans-serif;">📥 Download this episode</a>\n    <span style="color: #777; font-size: 0.9em; font-family: Arial, sans-serif; padding: 0 2px;">|</span>\n    <a href="${safeDetailUrl}" style="text-decoration: none; color: #555; font-size: 0.9em; font-family: Arial, sans-serif;">🔍 Open detail info</a>\n  </div>\n</figure>`;
};
