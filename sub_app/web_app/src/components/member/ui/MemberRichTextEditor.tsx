import { useEffect, useMemo } from "react";
import type { ComponentType } from "react";
import type { JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import { Bold, Code2, Heading1, Heading2, Italic, List, ListOrdered, Minus, Pilcrow, Quote, Redo2, Strikethrough, Undo2 } from "lucide-react";

export type RichTextValue = {
  html: string;
  plain: string;
  blocks: JSONContent;
};

type ToolbarItem = {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  action: () => boolean | undefined;
  active?: () => boolean;
  disabled?: () => boolean;
};

type Props = {
  value?: string;
  placeholder?: string;
  title?: string;
  helperText?: string;
  onChange: (value: RichTextValue) => void;
};

export default function MemberRichTextEditor({ value, placeholder, title = "Story", helperText = "Buat area editor yang terasa seperti workspace, bukan textarea biasa.", onChange }: Props) {
  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder: placeholder || "Write something..." })],
    content: value || "",
    editorProps: {
      attributes: {
        class: "min-h-[320px] focus:outline-none",
      },
    },
    onUpdate: ({ editor: activeEditor }) => {
      onChange({
        html: activeEditor.getHTML(),
        plain: activeEditor.getText().trim(),
        blocks: activeEditor.getJSON() as JSONContent,
      });
    },
  });

  useEffect(() => {
    if (!editor) return;
    const next = value || "";
    if (next !== editor.getHTML()) {
      if (next) {
        editor.commands.setContent(next, false);
      } else {
        editor.commands.clearContent();
      }
    }
  }, [editor, value]);

  useEffect(() => {
    if (!editor) return;
    onChange({
      html: editor.getHTML(),
      plain: editor.getText().trim(),
      blocks: editor.getJSON() as JSONContent,
    });
  }, [editor, onChange]);

  const toolbarGroups = useMemo<ToolbarItem[][]>(
    () => [
      [
        {
          key: "undo",
          label: "Undo",
          icon: Undo2,
          action: () => editor?.chain().focus().undo().run(),
          disabled: () => !(editor?.can().undo()),
        },
        {
          key: "redo",
          label: "Redo",
          icon: Redo2,
          action: () => editor?.chain().focus().redo().run(),
          disabled: () => !(editor?.can().redo()),
        },
      ],
      [
        {
          key: "paragraph",
          label: "Paragraph",
          icon: Pilcrow,
          action: () => editor?.chain().focus().setParagraph().run(),
          active: () => Boolean(editor?.isActive("paragraph")),
        },
        {
          key: "heading-1",
          label: "Heading 1",
          icon: Heading1,
          action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run(),
          active: () => Boolean(editor?.isActive("heading", { level: 1 })),
        },
        {
          key: "heading-2",
          label: "Heading 2",
          icon: Heading2,
          action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
          active: () => Boolean(editor?.isActive("heading", { level: 2 })),
        },
      ],
      [
        {
          key: "bold",
          label: "Bold",
          icon: Bold,
          action: () => editor?.chain().focus().toggleBold().run(),
          active: () => Boolean(editor?.isActive("bold")),
        },
        {
          key: "italic",
          label: "Italic",
          icon: Italic,
          action: () => editor?.chain().focus().toggleItalic().run(),
          active: () => Boolean(editor?.isActive("italic")),
        },
        {
          key: "strike",
          label: "Strike",
          icon: Strikethrough,
          action: () => editor?.chain().focus().toggleStrike().run(),
          active: () => Boolean(editor?.isActive("strike")),
        },
        {
          key: "inline-code",
          label: "Inline Code",
          icon: Code2,
          action: () => editor?.chain().focus().toggleCode().run(),
          active: () => Boolean(editor?.isActive("code")),
        },
      ],
      [
        {
          key: "bullet-list",
          label: "Bullet List",
          icon: List,
          action: () => editor?.chain().focus().toggleBulletList().run(),
          active: () => Boolean(editor?.isActive("bulletList")),
        },
        {
          key: "ordered-list",
          label: "Ordered List",
          icon: ListOrdered,
          action: () => editor?.chain().focus().toggleOrderedList().run(),
          active: () => Boolean(editor?.isActive("orderedList")),
        },
        {
          key: "blockquote",
          label: "Quote",
          icon: Quote,
          action: () => editor?.chain().focus().toggleBlockquote().run(),
          active: () => Boolean(editor?.isActive("blockquote")),
        },
        {
          key: "code-block",
          label: "Code Block",
          icon: Code2,
          action: () => editor?.chain().focus().toggleCodeBlock().run(),
          active: () => Boolean(editor?.isActive("codeBlock")),
        },
        {
          key: "divider",
          label: "Divider",
          icon: Minus,
          action: () => editor?.chain().focus().setHorizontalRule().run(),
        },
      ],
    ],
    [editor]
  );

  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50/60 shadow-sm">
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{title}</p>
            <p className="mt-1 text-sm text-slate-600">{helperText}</p>
          </div>
        </div>
      </div>

      <div className="border-b border-slate-200 bg-white/80 px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {toolbarGroups.map((group, groupIndex) => (
            <div key={`group-${groupIndex}`} className="flex items-center gap-1">
              {group.map((tool) => {
                const Icon = tool.icon;
                const active = tool.active?.() ?? false;
                const disabled = tool.disabled?.() ?? false;

                return (
                  <button
                    key={tool.key}
                    type="button"
                    onClick={tool.action}
                    title={tool.label}
                    disabled={disabled}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border text-sm transition ${active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-transparent bg-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-800"} ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
              {groupIndex < toolbarGroups.length - 1 ? <span className="mx-1 h-6 w-px bg-slate-200" aria-hidden="true" /> : null}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-50/40 px-4 py-5">
        <div className="mx-auto min-h-[360px] max-w-3xl rounded-2xl border border-slate-200 bg-white px-6 py-7 text-slate-800 shadow-inner">
          <EditorContent
            editor={editor}
            className="text-sm leading-7 [&_.ProseMirror]:min-h-[300px] [&_.ProseMirror]:outline-none [&_.ProseMirror_h1]:mb-4 [&_.ProseMirror_h1]:text-3xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h2]:mb-3 [&_.ProseMirror_h2]:text-2xl [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_p]:mb-4 [&_.ProseMirror_ul]:mb-4 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6 [&_.ProseMirror_ol]:mb-4 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6 [&_.ProseMirror_blockquote]:mb-4 [&_.ProseMirror_blockquote]:border-l-2 [&_.ProseMirror_blockquote]:border-slate-300 [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:bg-slate-100 [&_.ProseMirror_code]:px-1.5 [&_.ProseMirror_code]:py-0.5 [&_.ProseMirror_pre]:mb-4 [&_.ProseMirror_pre]:overflow-x-auto [&_.ProseMirror_pre]:rounded-xl [&_.ProseMirror_pre]:border [&_.ProseMirror_pre]:border-slate-200 [&_.ProseMirror_pre]:bg-slate-50 [&_.ProseMirror_pre]:p-4 [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-slate-400 [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]"
          />
        </div>
      </div>
    </section>
  );
}