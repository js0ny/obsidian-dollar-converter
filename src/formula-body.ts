import type { EditorState } from '@codemirror/state';
import type { MathTransform, Source } from './converter';
import type { MarkdownSyntax } from './markdown';

export function transformBody(
	state: EditorState,
	syntax: MarkdownSyntax,
	from: number,
	to: number,
	display: boolean,
	source: Source,
	transforms: Iterable<MathTransform>,
): string | null {
	const raw = state.sliceDoc(from, to);
	const prefixes: string[] = [];
	let logical = raw;
	if (display) {
		let offset = from;
		logical = raw.split('\n').map((line, index) => {
			const prefix = index ? syntax.prefixes.get(offset)?.text ?? '' : '';
			prefixes.push(prefix);
			offset += line.length + 1;
			return line.slice(prefix.length);
		}).join('\n');
	}
	const original = logical.trim();
	if (!original || (!display && /[\r\n]/.test(original))) return null;
	let body = original;
	const context = Object.freeze({ kind: display ? 'display' as const : 'inline' as const, source });
	for (const transform of transforms) {
		body = transform(body, context);
		if (typeof body !== 'string') {
			throw new TypeError('Formula transforms must return a string synchronously.');
		}
	}
	if (!body.trim() || (!display && /[\r\n]/.test(body))) {
		throw new Error('The formula transform returned an empty or multiline inline formula.');
	}
	if (!display) return body;
	if (body === original) return raw;
	const start = logical.indexOf(original);
	const replacement = logical.slice(0, start) + body + logical.slice(start + original.length);
	const continuation = syntax.prefixes.get(state.doc.lineAt(from).from)?.continuation ?? '';
	return replacement.split('\n').map((line, index) =>
		(index ? prefixes[index] ?? continuation : '') + line,
	).join('\n');
}
