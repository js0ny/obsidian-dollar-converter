import { PluginSettingTab, Setting } from 'obsidian';
import type { App } from 'obsidian';
import type DollarConverterPlugin from './main';

export interface DollarConverterSettings {
	paste: boolean;
	commandIds: string;
	selection: 'formula' | 'body';
}

export const DEFAULT_SETTINGS: DollarConverterSettings = {
	paste: true,
	commandIds: '',
	selection: 'formula',
};

export class DollarConverterSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly converter: DollarConverterPlugin) {
		super(app, converter);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		new Setting(containerEl)
			.setName('Convert on paste')
			.setDesc('Convert bracket maths from plain-text clipboard content.')
			.addToggle(toggle => toggle.setValue(this.converter.settings.paste).onChange(async value => {
				this.converter.settings.paste = value;
				await this.converter.saveSettings();
			}));
		new Setting(containerEl)
			.setName('Commands after conversion')
			.setDesc('One full command ID per line. Leave empty to disable. Commands run in order for each newly converted formula.')
			.addTextArea(input => input.setPlaceholder('typst-mate:tex2typ')
				.setValue(this.converter.settings.commandIds).onChange(async value => {
					this.converter.settings.commandIds = value;
					await this.converter.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Command selection')
			.setDesc('Some commands expects the formula including dollar delimiters. Other commands may expect the body only.')
			.addDropdown(input => input.addOption('formula', 'Include dollar delimiters')
				.addOption('body', 'Formula body only').setValue(this.converter.settings.selection)
				.onChange(async value => {
					this.converter.settings.selection = value as DollarConverterSettings['selection'];
					await this.converter.saveSettings();
				}));
	}
}
