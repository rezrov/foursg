import {TFile} from 'obsidian';
import {marked} from 'marked';
import slugify from 'slugify';
import {extname} from 'pathe';
import {FileResolver, VIDEO_EXTENSIONS} from './FileResolver';
import {escapeHtml} from './SeoManager';
import {computeOutputPath, getImageOutputPath, getRelativeLinkPath} from './paths';

marked.setOptions({
    breaks: true,
    gfm: true
});

marked.use({
    renderer: {
        html(token: any) {
            const raw = typeof token === 'string' ? token : token.text;
            return escapeHtml(raw);
        }
    }
});

function escapeMarkdownText(text: string): string {
    return text.replace(/([\\\[\]()`])/g, '\\$1');
}

export class MarkdownRenderer {
    constructor(
        private fileResolver: FileResolver,
        private sitePath: string,
        private outputPathMap: Map<string, string>
    ) {}

    render(content: string, file: TFile): string {
        const placeholders = new Map<string, string>();
        let processed = this.convertWikiLinks(content, file);
        processed = this.convertImageEmbeds(processed, file, placeholders);
        let html = marked.parse(processed) as string;
        for (const [key, value] of placeholders) {
            html = html.split(key).join(value);
        }
        return html;
    }

    private getOutputPath(filePath: string): string {
        return this.outputPathMap.get(filePath) ?? computeOutputPath(filePath, this.sitePath);
    }

    private convertWikiLinks(content: string, file: TFile): string {
        return content.replace(/(?<!!)\[\[([^\]]+)\]\]/g, (match, linkText) => {
            const parts = linkText.split('|');
            const linkRaw = parts[0].trim();
            const displayText = parts[1] ? parts[1].trim() : linkRaw;

            const anchorIdx = linkRaw.search(/[#^]/);
            const linkTarget = anchorIdx >= 0 ? linkRaw.substring(0, anchorIdx) : linkRaw;
            const anchorMark = anchorIdx >= 0 ? linkRaw.substring(anchorIdx) : '';
            const urlFragment = anchorMark
                ? '#' + slugify(anchorMark.slice(1), {lower: true, strict: true})
                : '';

            const safeDisplay = escapeMarkdownText(displayText);

            if (!linkTarget) return `[${safeDisplay}](#broken-link)`;

            const targetFile = this.fileResolver.findTarget(linkTarget);
            if (!targetFile) return `[${safeDisplay}](#broken-link)`;

            const targetOutputPath = this.getOutputPath(targetFile.path);
            const currentOutputPath = this.getOutputPath(file.path);

            const relativePath = getRelativeLinkPath(currentOutputPath, targetOutputPath);
            return `[${safeDisplay}](${relativePath}${urlFragment})`;
        });
    }

    private convertImageEmbeds(content: string, file: TFile, placeholders: Map<string, string>): string {
        return content.replace(/!\[\[([^\]]+)\]\]/g, (match, embedRaw) => {
            const parts = embedRaw.split('|');
            const embedPath = parts[0].trim();
            const modifier = parts[1] ? parts[1].trim() : '';
            const ext = extname(embedPath).toLowerCase();
            const safeEmbedPath = escapeMarkdownText(embedPath);

            if (VIDEO_EXTENSIONS.includes(ext)) {
                const videoFile = this.fileResolver.findVideo(embedPath);
                if (!videoFile) return `**broken video:** ${safeEmbedPath}`;

                const currentOutputPath = this.getOutputPath(file.path);
                const videoOutputPath = getImageOutputPath(videoFile.path, this.sitePath);
                const relativePath = getRelativeLinkPath(currentOutputPath, videoOutputPath);
                const encodedPath = relativePath.split('/').map(s => encodeURIComponent(s)).join('/');
                const mimeType = ext === '.webm' ? 'video/webm' : 'video/mp4';
                const videoHtml = `<video controls><source src="${encodedPath}" type="${mimeType}"></video>`;
                const key = `V${placeholders.size}`;
                placeholders.set(key, videoHtml);
                return key;
            }

            const imageFile = this.fileResolver.findImage(embedPath);
            if (!imageFile) return `![${safeEmbedPath}](#broken-image)`;

            const currentOutputPath = this.getOutputPath(file.path);
            const imageOutputPath = getImageOutputPath(imageFile.path, this.sitePath);

            const relativePath = getRelativeLinkPath(currentOutputPath, imageOutputPath);
            const encodedPath = relativePath.split('/').map(s => encodeURIComponent(s)).join('/');
            const altText = (modifier && !/^\d+(x\d+)?$/.test(modifier)) ? escapeMarkdownText(modifier) : '';
            return `![${altText}](${encodedPath})`;
        });
    }
}
