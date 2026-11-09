import { Notice } from 'obsidian';
import type { App, Command, Editor, MarkdownFileInfo, MarkdownView } from 'obsidian';
import { convertRange } from './converter';
import type { FormulaRange, Source } from './converter';
import type DollarConverterPlugin from './main';

interface CommandRegistry {
	commands: Record<string, Command | undefined>;
}

export class ConversionCommands {
	constructor(private readonly plugin: DollarConverterPlugin) { }

	async insertConverted(event: ClipboardEvent, editor: Editor, text: string, source: Source): Promise<void> {
		let inserted = false;
		if (editor.listSelections().length !== 1) return;
		try {
			const from = editor.getCursor('from');
			const to = editor.getCursor('to');
			const start = editor.posToOffset(from);
			const end = editor.posToOffset(to);
			const state = this.plugin.syntax.state(editor);
			const candidate = state.update({ changes: { from: start, to: end, insert: text }, filter: false }).state;
			const insertedLength = candidate.doc.length - (state.doc.length - (end - start));
			const result = convertRange(candidate, start, start + insertedLength, source, this.plugin.transforms);
			if (result.count === 0) return;
			event.preventDefault();
			editor.replaceRange(result.text, from, to);
			inserted = true;
			const cursor = editor.offsetToPos(start + result.text.length);
			editor.setSelection(cursor, cursor);
			this.plugin.events.trigger('converted', { source, count: result.count });
			await this.runCommandHooks(editor, start, result.formulas);
		} catch (error) {
			console.error('Math Dollar Converter:', error);
			new Notice(inserted
				? 'Command hook failed; converted text and completed command edits are retained.'
				: 'Math conversion failed; the original paste is preserved.');
		}
	}

	async convertEditor(editor: Editor, wholeDocument: boolean): Promise<void> {
		let inserted = false;
		if (editor.listSelections().length !== 1) {
			new Notice('Use a single selection for maths conversion.');
			return;
		}
		const value = editor.getValue();
		const from = wholeDocument ? 0 : editor.posToOffset(editor.getCursor('from'));
		const to = wholeDocument ? value.length : editor.posToOffset(editor.getCursor('to'));
		if (from === to) {
			new Notice('Select text to convert first.');
			return;
		}
		try {
			const source = wholeDocument ? 'document-command' : 'selection-command';
			const result = convertRange(this.plugin.syntax.state(editor), from, to, source, this.plugin.transforms);
			if (result.count) {
				editor.replaceRange(result.text, editor.offsetToPos(from), editor.offsetToPos(to));
				inserted = true;
				this.plugin.events.trigger('converted', { source, count: result.count });
				await this.runCommandHooks(editor, from, result.formulas);
			}
			new Notice(`Converted ${result.count} formula(s).`);
		} catch (error) {
			console.error('Math Dollar Converter:', error);
			new Notice(inserted
				? 'Command hook failed; converted text and completed command edits are retained.'
				: 'Math conversion failed; the note is unchanged.');
		}
	}

	private async runCommandHooks(editor: Editor, offset: number, formulas: FormulaRange[]): Promise<void> {
		const ids = this.plugin.settings.commandIds.split(/\r?\n/).map(id => id.trim()).filter(Boolean);
		if (!ids.length) return;
		// The public API has no awaitable command dispatcher; retain async callback results.
		const registry = (this.plugin.app as App & { commands?: CommandRegistry }).commands;
		const commands = ids.map(id => {
			if (id.startsWith(`${this.plugin.manifest.id}:`)) {
				throw new Error('Self-referencing command hooks are not supported.');
			}
			const command = registry?.commands[id];
			if (!command) throw new Error(`Command not found: ${id}`);
			return command;
		});
		const info = this.plugin.app.workspace.activeEditor;
		if (!info || info.editor !== editor) throw new Error('The target editor is no longer active.');
		const selectBody = this.plugin.settings.selection === 'body';
		// Process from the end so replacements cannot shift earlier formula offsets.
		for (let index = formulas.length - 1; index >= 0; index--) {
			const formula = formulas[index];
			if (!formula) continue;
			const start = offset + formula.from;
			let end = offset + formula.to;
			const delimiterLength = editor.getValue().slice(start, start + 2) === '$$' ? 2 : 1;
			for (const command of commands) {
				if (this.plugin.app.workspace.activeEditor?.editor !== editor) {
					throw new Error('The command changed the active editor.');
				}
				editor.setSelection(editor.offsetToPos(start + (selectBody ? delimiterLength : 0)),
					editor.offsetToPos(end - (selectBody ? delimiterLength : 0)));
				const beforeLength = editor.getValue().length;
				await this.invokeCommand(command, editor, info);
				end += editor.getValue().length - beforeLength;
			}
		}
		this.plugin.events.trigger('commands-completed', { count: formulas.length, commandIds: ids });
	}

	private async invokeCommand(command: Command, editor: Editor, info: MarkdownView | MarkdownFileInfo): Promise<void> {
		if (command.editorCheckCallback) {
			if (!await Promise.resolve(command.editorCheckCallback(true, editor, info))) {
				throw new Error(`Command is unavailable: ${command.id}`);
			}
			await Promise.resolve(command.editorCheckCallback(false, editor, info));
		} else if (command.editorCallback) {
			await command.editorCallback(editor, info);
		} else if (command.checkCallback) {
			if (!await Promise.resolve(command.checkCallback(true))) throw new Error(`Command is unavailable: ${command.id}`);
			await Promise.resolve(command.checkCallback(false));
		} else if (command.callback) {
			await command.callback();
		} else {
			throw new Error(`Command has no supported callback: ${command.id}`);
		}
	}
}
