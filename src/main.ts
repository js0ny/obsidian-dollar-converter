import { Events, Plugin } from 'obsidian';
import { ConversionCommands } from './commands';
import { convertRange } from './converter';
import type { MathTransform, Source } from './converter';
import { DEFAULT_SETTINGS, DollarConverterSettingTab } from './settings';
import type { DollarConverterSettings } from './settings';

export default class DollarConverterPlugin extends Plugin {
	settings: DollarConverterSettings = { ...DEFAULT_SETTINGS };
	transforms = new Set<MathTransform>();
	events = new Events();

	async onload(): Promise<void> {
		await this.loadSettings();
		const commands = new ConversionCommands(this);
		this.register(() => this.transforms.clear());
		this.addSettingTab(new DollarConverterSettingTab(this.app, this));
		this.registerEvent(this.app.workspace.on('editor-paste', (event, editor) => {
			if (!this.settings.paste || event.defaultPrevented) return;
			const text = event.clipboardData?.getData('text/plain');
			if (text) void commands.insertConverted(event, editor, text, 'paste');
		}));
		this.registerEvent(this.app.workspace.on('editor-menu', (menu, editor) => {
			if (!editor.somethingSelected()) return;
			menu.addItem(item => item.setTitle('Convert bracket maths in selection')
				.onClick(() => commands.convertEditor(editor, false)));
		}));
		this.addCommand({
			id: 'convert-selection',
			name: 'Convert bracket maths in selection',
			editorCallback: editor => commands.convertEditor(editor, false),
		});
		this.addCommand({
			id: 'convert-document',
			name: 'Convert bracket maths in current note',
			editorCallback: editor => commands.convertEditor(editor, true),
		});
	}

	registerMathTransform(transform: MathTransform): () => boolean {
		this.transforms.add(transform);
		return () => this.transforms.delete(transform);
	}

	transformText(text: string, source: Source = 'api') {
		return convertRange(text, 0, text.length, source, this.transforms);
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<DollarConverterSettings>,
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
