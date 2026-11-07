import type { EditorState } from '@codemirror/state';
import { transformBody } from './formula-body';
import { parseMarkdown } from './markdown';

export type Source = string;
export type MathTransform = (
	body: string,
	context: Readonly<{ kind: 'inline' | 'display'; source: Source }>,
) => string;

export interface FormulaRange {
	from: number;
	to: number;
}

interface Edit extends FormulaRange {
	replacement: string;
}

export interface ConversionResult {
	text: string;
	count: number;
	formulas: FormulaRange[];
}

function isEscaped(text: string, index: number): boolean {
	let count = 0;
	while (index > 0 && text[--index] === '\\') count++;
	return count % 2 === 1;
}

export function convertRange(
	state: EditorState,
	from: number,
	to: number,
	source: Source,
	transforms: Iterable<MathTransform>,
): ConversionResult {
	const text = state.doc.toString();
	const syntax = parseMarkdown(state);
	const edits: Edit[] = [];
	const delimiters = /\\[()[\]]/g;
	let opener: { from: number; display: boolean } | undefined;
	let protectedIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = delimiters.exec(text)) && match.index < to) {
		const index = match.index;
		let protectedRange = syntax.protectedRanges[protectedIndex];
		while (protectedRange && protectedRange.to <= index) {
			if (opener && protectedRange.to > opener.from) opener = undefined;
			protectedRange = syntax.protectedRanges[++protectedIndex];
		}
		if (protectedRange && protectedRange.from < index + 2) {
			opener = undefined;
			continue;
		}
		if (isEscaped(text, index)) continue;
		const marker = match[0].charAt(1);
		if (!opener) {
			if (marker === '(' || marker === '[') opener = { from: index, display: marker === '[' };
			continue;
		}
		if (marker !== (opener.display ? ']' : ')')) continue;
		const end = index + 2;
		if (opener.from >= from && end <= to) {
			const body = transformBody(state, syntax, opener.from + 2, index, opener.display, source, transforms);
			if (body !== null) {
				const delimiter = opener.display ? '$$' : '$';
				edits.push({ from: opener.from, to: end, replacement: delimiter + body + delimiter });
			}
		}
		opener = undefined;
	}
	if (!edits.length) return { text: text.slice(from, to), count: 0, formulas: [] };
	const parts: string[] = [];
	const formulas: FormulaRange[] = [];
	let cursor = from;
	let length = 0;
	for (const edit of edits) {
		const preceding = text.slice(cursor, edit.from);
		parts.push(preceding, edit.replacement);
		length += preceding.length;
		formulas.push({ from: length, to: length + edit.replacement.length });
		length += edit.replacement.length;
		cursor = edit.to;
	}
	parts.push(text.slice(cursor, to));
	return { text: parts.join(''), count: edits.length, formulas };
}
