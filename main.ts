import {Notice, Plugin} from 'obsidian';
import {FourSGPluginSettings, DEFAULT_SETTINGS} from './src/settings';
import {SiteGenerator} from './src/SiteGenerator';

export default class FourSGPlugin extends Plugin {
    public settings: FourSGPluginSettings = DEFAULT_SETTINGS;

    async onload() {
        await this.loadSettings();

        // Add site generation command
        this.addCommand({
            id: 'generate-static-site',
            name: 'Generate static site',
            callback: async () => {
                const generator = new SiteGenerator(this);
                await generator.generateSite();
            }
        });

        // Add command to clear output directory
        this.addCommand({
            id: 'clear-output-directory',
            name: 'Clear output directory',
            callback: async () => {
                const generator = new SiteGenerator(this);
                try {
                    new Notice('Clearing output directory...');
                    await generator.clearOutputDirectory();
                    new Notice('Output directory cleared successfully!');
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    new Notice(`Error clearing output directory: ${errorMessage}`);
                }
            }
        });

        this.addCommand({
            id: 'enable-debug-logging',
            name: 'Enable debug logging',
            callback: async () => {
                this.settings.enableDebugLogging = true;
                await this.saveSettings();
                new Notice('Debug logging enabled');
            }
        });

        this.addCommand({
            id: 'disable-debug-logging',
            name: 'Disable debug logging',
            callback: async () => {
                this.settings.enableDebugLogging = false;
                await this.saveSettings();
                new Notice('Debug logging disabled');
            }
        });
    }

    onunload() {
        console.log('Unloading FourSG Plugin');
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}
