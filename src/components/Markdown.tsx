import ReactMarkdown from 'react-markdown';

// LLM text is rendered as Markdown and never as HTML (spec §5.2, §14):
// react-markdown does not render raw HTML, skipHtml drops it entirely, and no
// plugins are used that could loosen that.
export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-2 [&_strong]:font-semibold [&_em]:italic [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_code]:font-mono [&_code]:text-[0.9em] [&_a]:text-accent [&_a]:underline">
      <ReactMarkdown skipHtml>{children}</ReactMarkdown>
    </div>
  );
}
