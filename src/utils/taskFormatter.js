/**
 * Normalizes task rich text descriptions to ensure high readability
 * across both light and dark mode themes, preventing low-contrast
 * text collisions caused by inline styles copied from external editors.
 */
export const sanitizeTaskHtml = (html) => {
  if (!html) return '';
  return html
    // Replace non-breaking spaces with normal spaces to allow natural responsive line breaks
    .replace(/&nbsp;/g, ' ')
    .replace(/\u00A0/g, ' ')
    // Replace black/near-black inline font colors with inherit so they follow theme text
    .replace(/color\s*:\s*(?:#000000|#000|#111111|#111|#1a1a1a|#222222|#222|#2d3748|#2c3e50|#333333|#333|#444444|#444|#1f2937|#111827|#0f172a|black|rgb\(\s*0\s*,\s*0\s*,\s*0\s*\)|rgb\(\s*15\s*,\s*23\s*,\s*42\s*\)|rgb\(\s*17\s*,\s*24\s*,\s*39\s*\)|rgb\(\s*31\s*,\s*41\s*,\s*55\s*\)|rgb\(\s*34\s*,\s*34\s*,\s*34\s*\)|rgb\(\s*51\s*,\s*51\s*,\s*51\s*\)|rgb\(\s*55\s*,\s*65\s*,\s*81\s*\)|rgb\(\s*68\s*,\s*68\s*,\s*68\s*\)|rgb\(\s*75\s*,\s*85\s*,\s*99\s*\))/gi, 'color: inherit')
    // Remove hardcoded white background highlights copied into rich text
    .replace(/background-color\s*:\s*(?:#ffffff|#fff|white|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))/gi, 'background-color: transparent')
    // Convert dark/murky greens to luminous emerald (#34d399) with bold weight
    .replace(/color\s*:\s*(?:#008000|#166534|#15803d|#2e7d32|#27ae60|rgb\(\s*0\s*,\s*128\s*,\s*0\s*\)|rgb\(\s*22\s*,\s*101\s*,\s*52\s*\)|rgb\(\s*21\s*,\s*128\s*,\s*61\s*\)|rgb\(\s*39\s*,\s*174\s*,\s*96\s*\)|rgb\(\s*46\s*,\s*125\s*,\s*50\s*\)|rgb\(\s*24\s*,\s*128\s*,\s*56\s*\))/gi, 'color: #34d399; font-weight: 600');
};
