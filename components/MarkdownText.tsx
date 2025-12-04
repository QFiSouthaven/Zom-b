/**
 * @file MarkdownText.tsx
 * @description Text Rendering Component.
 * 
 * A simplified Markdown parser to handle the AI's response text.
 * Currently supports:
 * - Paragraphs (double newline splitting)
 * - Bold text (double asterisk wrapping)
 */

import React from 'react';

interface MarkdownTextProps {
  content: string;
}

const MarkdownText: React.FC<MarkdownTextProps> = ({ content }) => {
  // Simple paragraph splitter
  const paragraphs = content.split('\n').filter(p => p.trim() !== '');

  return (
    <div className="space-y-4 text-zinc-200 leading-relaxed">
      {paragraphs.map((para, idx) => {
        // Very basic bold parsing (**text**)
        const parts = para.split(/(\*\*.*?\*\*)/g);
        return (
          <p key={idx}>
            {parts.map((part, i) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
              }
              return <span key={i}>{part}</span>;
            })}
          </p>
        );
      })}
    </div>
  );
};

export default MarkdownText;