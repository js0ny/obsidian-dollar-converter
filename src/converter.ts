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
	formulaFrom: number;
	formulaTo: number;
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

function findClosing(text: string, token: string, start: number): number {
	let index = text.indexOf(token, start);
	while (index !== -1 && isEscaped(text, index)) {
		index = text.indexOf(token, index + token.length);
	}
	return index;
}

function fenceEnd(text: string, start: number, marker: string, length: number): number {
	let lineStart = text.indexOf('\n', start);
	while (lineStart !== -1) {
		lineStart++;
		const lineEnd = text.indexOf('\n', lineStart);
		const line = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd);
		const run = /^ {0,3}(`{3,}|~{3,})[ \t]*\r?$/.exec(line)?.[1];
		if (run && run.startsWith(marker) && run.length >= length) {
			return lineEnd === -1 ? text.length : lineEnd + 1;
		}
		if (lineEnd === -1) break;
		lineStart = lineEnd;
	}
	return text.length;
}

function backtickRun(text: string, start: number): number {
	let end = start;
	while (text[end] === '`') end++;
	return end - start;
}

function inlineCodeEnd(text: string, start: number, length: number): number {
	let index = start + length;
	while (index < text.length) {
		index = text.indexOf('`', index);
		if (index === -1) return text.length;
		const run = backtickRun(text, index);
		if (run === length) return index + run;
		index += run;
	}
	return text.length;
}

export function convertRange(
	text: string,
	from: number,
	to: number,
	source: Source,
	transforms: Iterable<MathTransform>,
): ConversionResult {
	const edits: Edit[] = [];
	let index = 0;
	if (/^---\r?\n/.test(text)) {
		const closing = /\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/g;
		closing.lastIndex = text.indexOf('\n');
		index = closing.exec(text) ? closing.lastIndex : text.length;
	}
	while (index < to) {
		if (index === 0 || text[index - 1] === '\n') {
			const fence = /^ {0,3}(`{3,}|~{3,})[^\n]*(?:\n|$)/.exec(text.slice(index))?.[1];
			if (fence) {
				index = fenceEnd(text, index, fence.charAt(0), fence.length);
				continue;
			}
			const indented = /^(?: {4}|\t)[^\n]*(?:\n|$)/.exec(text.slice(index));
			if (indented) {
				index += indented[0].length;
				continue;
			}
		}
		if (isEscaped(text, index)) {
			index++;
			continue;
		}
		if (text[index] === '`') {
			index = inlineCodeEnd(text, index, backtickRun(text, index));
			continue;
		}
		if (text[index] === '$') {
			const token = text[index + 1] === '$' ? '$$' : '$';
			const end = findClosing(text, token, index + token.length);
			index = end === -1 ? text.length : end + token.length;
			continue;
		}
		const opener = text.slice(index, index + 2);
		if (opener !== '\\(' && opener !== '\\[') {
			index++;
			continue;
		}
		const display = opener === '\\[';
		const closing = findClosing(text, display ? '\\]' : '\\)', index + 2);
		if (closing === -1) {
			index += 2;
			continue;
		}
		const end = closing + 2;
		if (index >= from && end <= to) {
			let body = text.slice(index + 2, closing).trim();
			if (!body || (!display && /[\r\n]/.test(body))) {
				index = end;
				continue;
			}
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
			const prefix = index > 0 && text[index - 1] !== '\n' ? '\n' : '';
			const suffix = end < text.length && text[end] !== '\n' ? '\n' : '';
			const replacement = display ? `${prefix}$$\n${body}\n$$${suffix}` : `$${body}$`;
			edits.push({
				from: index - from,
				to: end - from,
				replacement,
				formulaFrom: display ? prefix.length : 0,
				formulaTo: replacement.length - (display ? suffix.length : 0),
			});
		}
		index = end;
	}
	const parts: string[] = [];
	const formulas: FormulaRange[] = [];
	let cursor = from;
	let length = 0;
	for (const edit of edits) {
		const preceding = text.slice(cursor, from + edit.from);
		parts.push(preceding, edit.replacement);
		length += preceding.length;
		formulas.push({ from: length + edit.formulaFrom, to: length + edit.formulaTo });
		length += edit.replacement.length;
		cursor = from + edit.to;
	}
	parts.push(text.slice(cursor, to));
	return { text: parts.join(''), count: edits.length, formulas };
}
