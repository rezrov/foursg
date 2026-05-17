import {App, TFile} from 'obsidian';
import {extname} from 'pathe';

export const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
export const VIDEO_EXTENSIONS = ['.mp4', '.webm'];

function isInOutputPath(filePath: string, outputPath: string): boolean {
    return filePath.startsWith(outputPath + '/') || filePath === outputPath;
}

export class FileResolver {
    private markdownFiles: TFile[] = [];
    private imageFiles: TFile[] = [];
    private videoFiles: TFile[] = [];

    private markdownByPath: Map<string, TFile> = new Map();
    private markdownByBasename: Map<string, TFile> = new Map();
    private imageByPath: Map<string, TFile> = new Map();
    private imageByName: Map<string, TFile> = new Map();
    private imageByBasename: Map<string, TFile> = new Map();
    private videoByPath: Map<string, TFile> = new Map();
    private videoByName: Map<string, TFile> = new Map();
    private videoByBasename: Map<string, TFile> = new Map();

    constructor(private app: App, private outputPath: string) {}

    build(): void {
        this.markdownFiles = [];
        this.imageFiles = [];
        this.videoFiles = [];
        this.markdownByPath.clear();
        this.markdownByBasename.clear();
        this.imageByPath.clear();
        this.imageByName.clear();
        this.imageByBasename.clear();
        this.videoByPath.clear();
        this.videoByName.clear();
        this.videoByBasename.clear();

        for (const f of this.app.vault.getMarkdownFiles()) {
            if (isInOutputPath(f.path, this.outputPath)) continue;
            this.markdownFiles.push(f);
            this.markdownByPath.set(f.path, f);
            if (!this.markdownByBasename.has(f.basename)) {
                this.markdownByBasename.set(f.basename, f);
            }
        }

        for (const f of this.app.vault.getFiles()) {
            if (isInOutputPath(f.path, this.outputPath)) continue;
            const ext = extname(f.path).toLowerCase();
            if (IMAGE_EXTENSIONS.includes(ext)) {
                this.imageFiles.push(f);
                this.imageByPath.set(f.path, f);
                if (!this.imageByName.has(f.name)) this.imageByName.set(f.name, f);
                if (!this.imageByBasename.has(f.basename)) this.imageByBasename.set(f.basename, f);
            } else if (VIDEO_EXTENSIONS.includes(ext)) {
                this.videoFiles.push(f);
                this.videoByPath.set(f.path, f);
                if (!this.videoByName.has(f.name)) this.videoByName.set(f.name, f);
                if (!this.videoByBasename.has(f.basename)) this.videoByBasename.set(f.basename, f);
            }
        }
    }

    getMarkdownFiles(): TFile[] { return this.markdownFiles; }
    getImageFiles(): TFile[] { return this.imageFiles; }
    getVideoFiles(): TFile[] { return this.videoFiles; }

    findTarget(linkName: string): TFile | null {
        const clean = linkName.replace(/\.md$/, '');
        return this.markdownByPath.get(clean + '.md')
            ?? this.markdownByPath.get(clean)
            ?? this.markdownByBasename.get(clean)
            ?? null;
    }

    findImage(imageName: string): TFile | null {
        return this.imageByPath.get(imageName)
            ?? this.imageByName.get(imageName)
            ?? this.imageByBasename.get(imageName)
            ?? null;
    }

    findVideo(videoName: string): TFile | null {
        return this.videoByPath.get(videoName)
            ?? this.videoByName.get(videoName)
            ?? this.videoByBasename.get(videoName)
            ?? null;
    }
}
