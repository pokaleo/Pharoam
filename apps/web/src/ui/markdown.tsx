/**
 * Safe Markdown: the person's text and content packs, rendered without ever running anything in them.
 *
 * @packageDocumentation
 */
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeSanitize from "rehype-sanitize";

/** The part of a Markdown syntax tree node the HTML plugin reads. */
interface TreeNode {
  type: string;
  value?: string;
  children?: TreeNode[];
}

/**
 * Renders Markdown with raw HTML shown as text, sanitised output, and remote images blocked.
 *
 * @remarks AGENTS.md hard rule 10 and security §2. HTML typed into a record is turned into plain text before
 * rendering, so it is shown as written and never becomes an element (MVP S4.5); the sanitiser then removes anything
 * unsafe that Markdown itself can produce, such as a `javascript:` link. Images are never loaded: a remote image
 * would tell its server the person's address, so each one is replaced by its description.
 * @param props - The Markdown text.
 * @returns The rendered text, in the reading typeface.
 */
export function Markdown({ text }: { readonly text: string }): ReactElement {
  const { t } = useTranslation();
  const components: Components = {
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-channel underline">
        {children}
      </a>
    ),
    img: ({ alt }) => (
      <span className="rounded-sm bg-panel px-1 font-sans text-meta text-ink-2">
        {alt === undefined || alt === ""
          ? t("markdown.imageBlocked")
          : t("markdown.imageBlockedNamed", { alt })}
      </span>
    ),
  };
  return (
    <div className="prose-pharoam max-w-(--reading-measure) font-serif">
      <ReactMarkdown remarkPlugins={[htmlAsText]} rehypePlugins={[rehypeSanitize]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

// A remark plugin that turns every piece of raw HTML into text, so it is shown as typed.
function htmlAsText() {
  return (tree: TreeNode): void => {
    const visit = (node: TreeNode): void => {
      if (node.type === "html") {
        node.type = "text";
        return;
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}
