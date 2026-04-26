"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownPreview({
  content,
  onWikiLink
}: {
  content: string;
  onWikiLink?: (title: string) => void;
}) {
  const transformed = content.replace(/\[\[([^\]\n]+)\]\]/g, "[$1](wiki:$1)");
  return (
    <div className="prose-note">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children }) {
            if (href?.startsWith("wiki:")) {
              const title = decodeURIComponent(href.replace("wiki:", ""));
              return (
                <button className="text-clay underline underline-offset-4 dark:text-amber-300" onClick={() => onWikiLink?.(title)}>
                  {children}
                </button>
              );
            }
            return (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            );
          }
        }}
      >
        {transformed || "_Nothing written yet._"}
      </ReactMarkdown>
    </div>
  );
}
