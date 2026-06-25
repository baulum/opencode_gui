import React, { useMemo, useCallback } from 'react';
import markdownit from 'markdown-it';
import hljs from 'highlight.js';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const md = markdownit({
  html: false,
  linkify: true,
  typographer: true,
  highlight(str: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        const highlighted = hljs.highlight(str, {
          language: lang,
          ignoreIllegals: true,
        }).value;
        return `<pre class="code-block"><div class="code-header"><span class="code-lang">${lang}</span><button class="copy-btn" data-code="${encodeURIComponent(str)}">Copy</button></div><code class="hljs language-${lang}">${highlighted}</code></pre>`;
      } catch {
        // fallthrough
      }
    }
    const safe = escapeHtml(str);
    return `<pre class="code-block"><div class="code-header"><span class="code-lang">text</span><button class="copy-btn" data-code="${encodeURIComponent(str)}">Copy</button></div><code>${safe}</code></pre>`;
  },
});

interface Props {
  content: string;
}

export default function MarkdownRenderer({ content }: Props) {
  const html = useMemo(() => md.render(content), [content]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('copy-btn')) {
      const code = decodeURIComponent(target.dataset.code || '');
      navigator.clipboard.writeText(code).then(() => {
        target.textContent = 'Copied!';
        setTimeout(() => (target.textContent = 'Copy'), 2000);
      });
    }
  }, []);

  return (
    <div
      className="markdown-body"
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={handleClick}
    />
  );
}
