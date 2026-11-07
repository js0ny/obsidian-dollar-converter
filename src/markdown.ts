import { ensureSyntaxTree } from '@codemirror/language';
import type { EditorState, Extension } from '@codemirror/state';
import { ViewPlugin } from '@codemirror/view';
import type { EditorView, ViewUpdate } from '@codemirror/view';
import { editorInfoField } from 'obsidian';
import type { Editor } from 'obsidian';
import type { FormulaRange } from './converter';

interface LinePrefix {
	text: string;
	continuation: string;
}

export interface MarkdownSyntax {
	protectedRanges: FormulaRange[];
	prefixes: Map<number, LinePrefix>;
}

export class EditorSyntax {
	private readonly views = new WeakMap<Editor, EditorView>();
	readonly extension: Extension;

	constructor() {
		const views = this.views;
		this.extension = ViewPlugin.fromClass(class {
			private editor: Editor | undefined;

			constructor(private readonly view: EditorView) {
				this.bind();
			}

			update(_update: ViewUpdate): void {
				this.bind();
			}

			destroy(): void {
				if (this.editor && views.get(this.editor) === this.view) views.delete(this.editor);
			}

			private bind(): void {
				const editor = this.view.state.field(editorInfoField, false)?.editor;
				if (this.editor && this.editor !== editor && views.get(this.editor) === this.view) {
					views.delete(this.editor);
				}
				this.editor = editor;
				if (editor) views.set(editor, this.view);
			}
		});
	}

	state(editor: Editor): EditorState {
		const view = this.views.get(editor);
		if (!view) throw new Error('The Obsidian editor syntax is unavailable.');
		return view.state;
	}
}

const protectedToken = /(?:^|_)(?:inline-code|hmd-codeblock|HyperMD-codeblock(?:-[^_]*)?|math(?:-[^_]*)?|hmd-frontmatter|comment(?:-[^_]*)?|url|hmd-internal-link|hmd-callout|hmd-footnote-url-title|tag|attribute|string|image|hmd-table-sep(?:-[^_]*)?)(?:_|$)/;
const prefixToken = /(?:^|_)(?:formatting-quote|formatting-list|formatting-task|hmd-list-indent|hmd-indent-in-quote)(?:_|$)/;
const listMarkerToken = /(?:^|_)(?:formatting-list|formatting-task)(?:_|$)/;

export function parseMarkdown(state: EditorState): MarkdownSyntax {
	// Obsidian's parser needs its ParseContext; calling language.parser.parse directly is not supported.
	const tree = ensureSyntaxTree(state, state.doc.length, 100);
	if (!tree) throw new Error('Markdown parsing has not completed. Try the conversion again.');
	const protectedRanges: FormulaRange[] = [];
	const prefixes = new Map<number, LinePrefix>();
	let htmlFrom: number | undefined;
	tree.iterate({
		enter(node): boolean | void {
			if (/(?:^|_)hmd-html-begin(?:_|$)/.test(node.name) && htmlFrom === undefined) htmlFrom = node.from;
			if (htmlFrom !== undefined) {
				if (/(?:^|_)hmd-html-end(?:_|$)/.test(node.name)) {
					protectedRanges.push({ from: htmlFrom, to: node.to });
					htmlFrom = undefined;
				}
				return;
			}
			if (protectedToken.test(node.name)) {
				const previous = protectedRanges[protectedRanges.length - 1];
				if (previous && previous.to >= node.from) previous.to = Math.max(previous.to, node.to);
				else protectedRanges.push({ from: node.from, to: node.to });
				return false;
			}
			if (!prefixToken.test(node.name)) return;
			const line = state.doc.lineAt(node.from);
			const previous = prefixes.get(line.from) ?? { text: '', continuation: '' };
			const gap = state.sliceDoc(line.from + previous.text.length, node.from);
			if (gap.trim()) return;
			const token = state.sliceDoc(node.from, node.to);
			prefixes.set(line.from, {
				text: previous.text + gap + token,
				continuation: previous.continuation + gap + (listMarkerToken.test(node.name) ? token.replace(/[^\t]/g, ' ') : token),
			});
		},
	});
	if (htmlFrom !== undefined) protectedRanges.push({ from: htmlFrom, to: state.doc.length });
	return { protectedRanges, prefixes };
}
