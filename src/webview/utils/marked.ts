import { marked } from 'marked';
import markedKatex from 'marked-katex-extension';
import 'katex/dist/katex.min.css';

// Configure marked options for better rendering
marked.use(markedKatex as any, {
  throwOnError: false,
  output: 'html', // 确保输出为 HTML，避免后续 DOM 修改
  delimiters: [
    { left: '$$', right: '$$', display: true },
    { left: '$', right: '$', display: false },
    { left: '\\(', right: '\\)', display: false },
    { left: '\\[', right: '\\]', display: true }
  ]
});

marked.setOptions({
  breaks: true, // Convert \n to <br>
  gfm: true,    // Enable GitHub Flavored Markdown
});

export { marked };
