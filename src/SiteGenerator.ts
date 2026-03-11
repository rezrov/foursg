import {Notice, TFile, normalizePath, DataAdapter} from 'obsidian';
import {marked} from 'marked';
import slugify from 'slugify';
import Mustache from 'mustache';
import {join, dirname, basename, extname, relative} from 'pathe';
import FourSGPlugin from "../main";
import {FOURSG_OUTPUT_DIR} from "./settings";
import {SeoManager, generateBreadcrumbStructuredData} from "./SeoManager";
import {SitemapGenerator} from "./SitemapGenerator";

interface NavNode {
    name: string;
    path: string;
    outputPath: string;
    children: NavNode[];
    isIndex: boolean;
    navOrder: number;
    sortDate: number;
}

interface FrontmatterData {
    nav_order?: number;
    published_date?: string;
    [key: string]: any;
}

export class SiteGenerator {
    private plugin: FourSGPlugin;
    private dataAdapter: DataAdapter;
    private readonly sitePath: string;
    private readonly outputPath: string;
    private readonly cssPath: string;
    private readonly templatePath: string;
    private readonly miscPath: string;
    private readonly assetsPath: string;
    private processedFiles: Set<string> = new Set();
    private static readonly IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
    private static readonly FRITZ_SCALE_FILES = ['fritz-1.svg', 'fritz-2.svg', 'fritz-3.svg', 'fritz-4.svg', 'fritz-5.svg'];
    private static readonly VIDEO_EXTENSIONS = ['.mp4', '.webm'];
    private cachedMarkdownFiles: TFile[] | null = null;
    private cachedImageFiles: TFile[] | null = null;
    private cachedVideoFiles: TFile[] | null = null;
    private templateCache: Map<string, string> = new Map();
    private frontmatterCache: Map<string, FrontmatterData> = new Map();
    private siteName: string = 'My Site';
    private siteUrl: string = 'https://example.com';
    private sitemapGenerator: SitemapGenerator | null = null;

    // ==================== Logging Methods ====================

    private log(...args: any[]): void {
        if (this.plugin.settings.enableDebugLogging) console.log(...args);
    }

    private alwaysLog(...args: any[]): void {
        console.log(...args);
    }

    private error(...args: any[]): void {
        console.error(...args);
    }


// ==================== Constructor & Setup ====================

    constructor(plugin: FourSGPlugin) {
        this.plugin = plugin;
        this.dataAdapter = this.plugin.app.vault.adapter;
        this.outputPath = normalizePath(FOURSG_OUTPUT_DIR);
        this.sitePath = normalizePath(this.outputPath + "/site");
        this.cssPath = normalizePath(this.outputPath + "/css");
        this.templatePath = normalizePath(this.outputPath + "/templates");
        this.miscPath = normalizePath(this.outputPath + "/misc");
        this.assetsPath = normalizePath(this.outputPath + "/assets");

        marked.setOptions({
            breaks: true,
            gfm: true,
        });
    }

    // ==================== Public API ====================

    async generateSite(): Promise<void> {
        try {
            this.alwaysLog('=== FourSG Site Generator Start ===');
            this.log('Settings:', {
                outputPath: this.outputPath,
            });

            new Notice('Starting FourSG site generation');

            await this.initializeSite();
            await this.loadSiteName();

            this.sitemapGenerator = new SitemapGenerator(this.siteUrl);

            this.cacheClearAll();
            const markdownFiles = this.getFilteredMarkdownFiles();
            this.buildFrontmatterCache();

            this.alwaysLog(`Found ${markdownFiles.length} markdown files to process.`);
            markdownFiles.forEach(file => this.log(`  - ${file.path}`));

            const batchSize = 5;
            for (let i = 0; i < markdownFiles.length; i += batchSize) {
                const batch = markdownFiles.slice(i, Math.min(i + batchSize, markdownFiles.length));
                await Promise.all(batch.map(file => this.processMarkdownFile(file)));
            }

            this.log('Copying images');
            await this.copyImages();

            this.log('Copying videos');
            await this.copyVideos();

            this.log('Copying misc files');
            await this.copyMiscFiles();

            await this.copyFritzScaleAssets();

            this.log('Generating sitemap.xml');
            await this.generateSitemap();

            this.log('Generating robots.txt');
            await this.generateRobotsTxt();

            this.alwaysLog('=== FourSG Site Generation Complete ===');

            new Notice(`FourSG site generated successfully!`);
        }
        catch (error) {
            this.error('=== Site Generation Error ===');
            this.error('Error details:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            new Notice(`FourSG error generating site: ${errorMessage}`);
        }
        finally {
            this.cacheClearAll();
        }
    }

    async clearOutputDirectory(): Promise<void> {
        this.log(`Clearing generated site directory: ${this.sitePath}`);
        await this.removeDirectoryRecursive(this.sitePath);
    }

    // ==================== Initialization ====================

    private async initializeSite(): Promise<void> {
        this.log('Initializing FourSG working directory');

        await this.ensureDirectory(this.sitePath);
        await this.clearOutputDirectory();

        await this.ensureDirectory(this.templatePath);
        const defaultTemplatePath = join(this.templatePath, 'default.html');
        await this.copyUnlessExists('templates/default.html', defaultTemplatePath);

        await this.ensureDirectory(this.cssPath);
        await this.copyCSS();

        await this.ensureDirectory(this.miscPath);

        await this.ensureDirectory(this.assetsPath);
        for (const svgFile of SiteGenerator.FRITZ_SCALE_FILES) {
            await this.copyUnlessExists(`assets/${svgFile}`, join(this.assetsPath, svgFile));
        }

        const readmePath = join(this.outputPath, 'README.md');
        await this.copyUnlessExists('README.md', readmePath);
    }

    private async loadSiteName(): Promise<void> {
        const markdownFiles = this.plugin.app.vault.getMarkdownFiles();
        const indexFile = markdownFiles.find(file => 
            file.parent?.path === '/' && file.basename.toLowerCase() === 'index'
        );
        
        if (indexFile) {
            const fileCache = this.plugin.app.metadataCache.getFileCache(indexFile);
            const frontMatter = fileCache?.frontmatter || {};
            this.siteName = frontMatter.site_name || 'My Site';
            this.log(`Site name loaded from ${indexFile.path}: ${this.siteName}`);
            
            if (frontMatter.site_url) {
                this.siteUrl = frontMatter.site_url;
                this.log(`Site URL loaded from ${indexFile.path}: ${this.siteUrl}`);
            } else {
                this.alwaysLog('WARNING: site_url not defined in index.md frontmatter. Using default placeholder: https://example.com');
                this.siteUrl = 'https://example.com';
            }
        } else {
            this.log('No index.md found at vault root, using default site name');
            this.siteName = 'My Site';
            this.alwaysLog('WARNING: No index.md found at vault root. Site URL defaulting to: https://example.com');
            this.siteUrl = 'https://example.com';
        }
    }

    // ==================== Cache Management ====================

    private cacheClearAll(): void {
        this.cachedMarkdownFiles = null;
        this.cachedImageFiles = null;
        this.cachedVideoFiles = null;
        this.templateCache.clear();
        this.frontmatterCache.clear();
        this.processedFiles.clear();
    }

    private buildFrontmatterCache(): void {
        const files = this.getFilteredMarkdownFiles();
        for (const file of files) {
            const fileCache = this.plugin.app.metadataCache.getFileCache(file);
            const frontmatter = fileCache?.frontmatter || {};
            this.frontmatterCache.set(file.path, {
                nav_order: frontmatter.nav_order,
                published_date: frontmatter.published_date,
                ...frontmatter
            });
        }
        this.log(`Built frontmatter cache for ${this.frontmatterCache.size} files`);
    }

    private getFrontmatter(filePath: string): FrontmatterData {
        return this.frontmatterCache.get(filePath) || {};
    }

    private getFilteredMarkdownFiles(): TFile[] {
        if (!this.cachedMarkdownFiles) {
            const allMarkdownFiles = this.plugin.app.vault.getMarkdownFiles();
            this.cachedMarkdownFiles = allMarkdownFiles.filter(file => !this.isInOutputPath(file.path));
        }
        return this.cachedMarkdownFiles;
    }

    private getFilteredImageFiles(): TFile[] {
        if (!this.cachedImageFiles) {
            const allFiles = this.plugin.app.vault.getFiles();
            this.cachedImageFiles = allFiles.filter(file => {
                if (this.isInOutputPath(file.path)) return false;
                const ext = extname(file.path).toLowerCase();
                return SiteGenerator.IMAGE_EXTENSIONS.includes(ext);
            });
        }
        return this.cachedImageFiles;
    }

    private getFilteredVideoFiles(): TFile[] {
        if (!this.cachedVideoFiles) {
            const allFiles = this.plugin.app.vault.getFiles();
            this.cachedVideoFiles = allFiles.filter(file => {
                if (this.isInOutputPath(file.path)) return false;
                const ext = extname(file.path).toLowerCase();
                return SiteGenerator.VIDEO_EXTENSIONS.includes(ext);
            });
        }
        return this.cachedVideoFiles;
    }

    // ==================== File System Operations ====================

    private async removeDirectoryRecursive(dirPath: string): Promise<void> {
        const exists = await this.dataAdapter.exists(dirPath);
        if (!exists) return;
        try {
            const items = await this.dataAdapter.list(dirPath);
            for (const file of items.files) await this.dataAdapter.remove(file);
            for (const folder of items.folders) await this.removeDirectoryRecursive(folder);
            await this.dataAdapter.rmdir(dirPath, false);
        }
        catch (error) {
            try {
                await this.dataAdapter.remove(dirPath);
            }
            catch {
                throw error;
            }
        }
    }

    private async ensureDirectory(dirPath: string): Promise<void> {
        const exists = await this.dataAdapter.exists(dirPath);
        if (!exists) await this.dataAdapter.mkdir(normalizePath(dirPath));
    }

    private async copyUnlessExists(sourceRelativePath: string, destinationPath: string): Promise<void> {
        const destinationExists = await this.dataAdapter.exists(destinationPath);
        if (!destinationExists) {
            const pluginDir = this.plugin.manifest.dir || 'foursg';
            const sourcePath = join(pluginDir, sourceRelativePath);
            const sourceExists = await this.dataAdapter.exists(sourcePath);
            if (sourceExists) {
                const content = await this.dataAdapter.read(sourcePath);
                await this.dataAdapter.write(normalizePath(destinationPath), content);
                this.log(`Copied ${basename(sourceRelativePath)} from plugin`);
            }
        }
    }

    private isInOutputPath(filePath: string): boolean {
        const normalizedFilePath = normalizePath(filePath);
        const normalizedOutputPath = normalizePath(this.outputPath);

        return normalizedFilePath.startsWith(normalizedOutputPath + '/') ||
               normalizedFilePath === normalizedOutputPath
    }

    // ==================== Markdown Processing ====================

    private async processMarkdownFile(file: TFile): Promise<void> {
        if (this.processedFiles.has(file.path)) {
            this.log(`Skipping (already processed): ${file.path}`);
            return;
        }
        this.processedFiles.add(file.path);

        try {
            this.log(`Processing markdown: ${file.path}`);

            const frontMatter = this.getFrontmatter(file.path);
            if (Object.keys(frontMatter).length > 0) this.log('Frontmatter:', frontMatter);

            let content = await this.plugin.app.vault.read(file);

            const fileCache = this.plugin.app.metadataCache.getFileCache(file);
            if (fileCache?.frontmatterPosition) {
                const frontmatterEnd = fileCache.frontmatterPosition.end.offset;
                content = content.substring(frontmatterEnd).trim();
            }

            const html = await this.markdownToHTML(content, file);
            const outputFilePath = this.getOutputPath(file.path);
            const fullHTML = await this.wrapInTemplate(html, file.basename, outputFilePath, frontMatter, file);
            this.log(`Converted to HTML ${outputFilePath} (${fullHTML.length} characters)`);

            const outputDir = dirname(outputFilePath);
            await this.ensureDirectory(outputDir);

            await this.dataAdapter.write(normalizePath(outputFilePath), fullHTML);

        }
        catch (error) {
            this.error(`Error processing ${file.path}:`, error);
            this.error(`Stack trace:`, error instanceof Error ? error.stack : 'No stack trace');
        }
    }

    private async markdownToHTML(content: string, file: TFile): Promise<string> {
        let processedContent = this.convertWikiLinks(content, file);
        processedContent = this.convertImageEmbeds(processedContent, file);
        const html = marked(processedContent);
        return html;
    }

    private convertWikiLinks(content: string, file: TFile): string {
        return content.replace(/(?<!!)\[\[([^\]]+)\]\]/g, (match, linkText) => {
            const parts = linkText.split('|');
            const link = parts[0].trim();
            const displayText = parts[1] ? parts[1].trim() : link;

            const targetFile = this.findTargetFile(link);
            if (!targetFile) return `[${displayText}](#broken-link)`;

            const targetOutputPath = this.getOutputPath(targetFile.path);
            const currentOutputPath = this.getOutputPath(file.path);

            const relativePath = this.getRelativePath(currentOutputPath, targetOutputPath);
            return `[${displayText}](${relativePath})`;
        });
    }

    private convertImageEmbeds(content: string, file: TFile): string {
        return content.replace(/!\[\[([^\]]+)\]\]/g, (match, embedPath) => {
            const ext = extname(embedPath).toLowerCase();

            if (SiteGenerator.VIDEO_EXTENSIONS.includes(ext)) {
                const videoFile = this.findVideoFile(embedPath);
                if (!videoFile) return `<!-- broken video: ${embedPath} -->`;

                const currentOutputPath = this.getOutputPath(file.path);
                const videoOutputPath = this.getImageOutputPath(videoFile.path);
                const relativePath = this.getRelativePath(currentOutputPath, videoOutputPath);
                const encodedPath = relativePath.split('/').map(segment => encodeURIComponent(segment)).join('/');
                const mimeType = ext === '.webm' ? 'video/webm' : 'video/mp4';
                return `<video controls><source src="${encodedPath}" type="${mimeType}"></video>`;
            }

            const imageFile = this.findImageFile(embedPath);
            if (!imageFile) return `![${embedPath}](#broken-image)`;

            const currentOutputPath = this.getOutputPath(file.path);
            const imageOutputPath = this.getImageOutputPath(imageFile.path);

            const relativePath = this.getRelativePath(currentOutputPath, imageOutputPath);
            const encodedPath = relativePath.split('/').map(segment => encodeURIComponent(segment)).join('/');
            return `![](${encodedPath})`;
        });
    }

    // ==================== File Resolution ====================

    private findTargetFile(linkName: string): TFile | null {
        const cleanLink = linkName.replace(/\.md$/, '');
        const files = this.getFilteredMarkdownFiles();

        for (const file of files) {
            if (file.path === cleanLink + '.md' || file.path === cleanLink) return file;
        }

        for (const file of files) {
            if (file.basename === cleanLink) return file;
        }
        return null;
    }

    private findImageFile(imageName: string): TFile | null {
        const imageFiles = this.getFilteredImageFiles();
        for (const file of imageFiles) {
            if (file.path === imageName || file.name === imageName || file.basename === imageName) return file;
        }
        return null;
    }

    private findVideoFile(videoName: string): TFile | null {
        const videoFiles = this.getFilteredVideoFiles();
        for (const file of videoFiles) {
            if (file.path === videoName || file.name === videoName || file.basename === videoName) return file;
        }
        return null;
    }

    // ==================== Path Utilities ====================

    private getOutputPath(filePath: string): string {
        const baseName = basename(filePath, '.md');
        const dirName = dirname(filePath);
        const isIndex = baseName.toLowerCase() === 'index';

        const outputName = isIndex ? 'index' : this.sanitizeFilename(baseName);

        if (dirName === '.') {
            return join(this.sitePath, `${outputName}.html`);
        }
        else {
            const sanitizedDirs = this.sanitizeDirectoryPath(dirName);
            return join(this.sitePath, sanitizedDirs, `${outputName}.html`);
        }
    }

    private getImageOutputPath(imagePath: string): string {
        const dirName = dirname(imagePath);
        const fileName = basename(imagePath);
        if (dirName === '.') {
            return join(this.sitePath, fileName);
        }
        else {
            const sanitizedDirs = this.sanitizeDirectoryPath(dirName);
            return join(this.sitePath, sanitizedDirs, fileName);
        }
    }

    private getRelativePath(fromPath: string, toPath: string): string {
        const fromDir = dirname(fromPath);
        const relativePath = relative(fromDir, toPath);
        return relativePath.replace(/\\/g, '/');
    }

    private getRelativePathToRoot(filePath: string): string {
        const relativePath = relative(dirname(filePath), this.sitePath);
        if (relativePath === '' || relativePath === '.') return './';
        return relativePath.replace(/\\/g, '/') + '/';
    }

    private sanitizeDirectoryPath(dirPath: string): string {
        return dirPath.split('/').map(dir => this.sanitizeFilename(dir)).join('/');
    }

    private sanitizeFilename(filename: string): string {
        return slugify(filename, {
            lower: true,
            strict: true,
            remove: /[*+~.()'"​!:@]/g
        });
    }

    // ==================== Navigation Generation ====================

    private getNavSortData(filePath: string, file?: TFile): { navOrder: number, sortDate: number } {
        const frontmatter = this.getFrontmatter(filePath);
        const navOrder = frontmatter.nav_order ?? 0;
        
        let sortDate: number;
        if (frontmatter.published_date) {
            sortDate = new Date(frontmatter.published_date).getTime();
        } else if (file) {
            sortDate = file.stat.mtime;
        } else {
            sortDate = 0;
        }
        
        return { navOrder, sortDate };
    }

    private sortNavNodes(nodes: NavNode[]): void {
        nodes.sort((a, b) => {
            if (a.navOrder !== b.navOrder) {
                return a.navOrder - b.navOrder;
            }
            return b.sortDate - a.sortDate;
        });
        
        for (const node of nodes) {
            if (node.children.length > 0) {
                this.sortNavNodes(node.children);
            }
        }
    }

    private buildNavigationTree(): NavNode[] {
        const files = [...this.getFilteredMarkdownFiles()];
        const rootNodes: NavNode[] = [];
        const dirMap = new Map<string, NavNode>();

        files.sort((a, b) => a.path.localeCompare(b.path));

        for (const file of files) {
            const parts = file.path.split('/');
            const isIndex = file.basename.toLowerCase() === 'index';
            const { navOrder, sortDate } = this.getNavSortData(file.path, file);
            const frontmatter = this.getFrontmatter(file.path);
            const displayName = frontmatter.title || file.basename;
            const omitFromNav = !!frontmatter.omit_from_nav;
            
            if (parts.length === 1) {
                if (!omitFromNav) {
                    rootNodes.push({
                        name: displayName,
                        path: file.path,
                        outputPath: this.getOutputPath(file.path),
                        children: [],
                        isIndex,
                        navOrder,
                        sortDate
                    });
                }
            } else {
                let currentPath = '';
                for (let i = 0; i < parts.length - 1; i++) {
                    const part = parts[i];
                    const parentPath = currentPath;
                    currentPath = currentPath ? `${currentPath}/${part}` : part;

                    if (!dirMap.has(currentPath)) {
                        const dirNode: NavNode = {
                            name: part,
                            path: currentPath,
                            outputPath: '',
                            children: [],
                            isIndex: false,
                            navOrder: 0,
                            sortDate: 0
                        };
                        dirMap.set(currentPath, dirNode);

                        if (parentPath) {
                            const parent = dirMap.get(parentPath);
                            if (parent) parent.children.push(dirNode);
                        } else {
                            rootNodes.push(dirNode);
                        }
                    }
                }

                const dirNode = dirMap.get(currentPath);
                if (dirNode) {
                    if (isIndex) {
                        if (!omitFromNav) {
                            dirNode.outputPath = this.getOutputPath(file.path);
                            dirNode.isIndex = true;
                            dirNode.navOrder = navOrder;
                            dirNode.sortDate = sortDate;
                            dirNode.name = displayName;
                        }
                    } else if (!omitFromNav) {
                        dirNode.children.push({
                            name: displayName,
                            path: file.path,
                            outputPath: this.getOutputPath(file.path),
                            children: [],
                            isIndex: false,
                            navOrder,
                            sortDate
                        });
                    }
                }
            }
        }

        this.sortNavNodes(rootNodes);
        return rootNodes;
    }

    private renderNavTree(nodes: NavNode[], currentPath: string): string {
        if (nodes.length === 0) return '';

        let html = '<ul>';
        
        for (const node of nodes) {
            const isCurrent = node.outputPath === currentPath;
            const hasChildren = node.children.length > 0;
            const displayName = node.name;
            const isOnCurrentPath = this.isNodeOnPathToFile(node, currentPath);
            
            html += '<li>';
            
            if (hasChildren) {
                const folderId = `nav-${node.path.replace(/[^a-z0-9]/gi, '-')}`;
                const openAttr = isOnCurrentPath ? ' open' : '';
                html += `<details id="${folderId}" class="nav-folder"${openAttr}>`;
                html += `<summary>`;
                
                if (node.outputPath) {
                    const relativePath = this.getRelativePath(currentPath, node.outputPath);
                    html += `<a href="${relativePath}" title="${displayName}"${isCurrent ? ' class="active"' : ''}>${displayName}</a>`;
                } else {
                    html += `<span title="${displayName}">${displayName}</span>`;
                }
                
                html += `</summary>`;
                html += this.renderNavTree(node.children, currentPath);
                html += `</details>`;
            } else {
                if (node.outputPath) {
                    const relativePath = this.getRelativePath(currentPath, node.outputPath);
                    html += `<a href="${relativePath}" title="${displayName}"${isCurrent ? ' class="active"' : ''}>${displayName}</a>`;
                } else {
                    html += `<span title="${displayName}">${displayName}</span>`;
                }
            }
            
            html += '</li>';
        }
        
        html += '</ul>';
        return html;
    }

    private isNodeOnPathToFile(node: NavNode, currentPath: string): boolean {
        if (node.outputPath === currentPath) return true;
        
        for (const child of node.children) {
            if (this.isNodeOnPathToFile(child, currentPath)) return true;
        }
        
        return false;
    }

    private generateNavigation(currentPath: string, omitFromNav: boolean): string {
        const tree = this.buildNavigationTree();
        const html = this.renderNavTree(tree, omitFromNav ? '' : currentPath);
        return html;
    }

    private formatDates(frontMatter: Record<string, any>): string {
        const parts: string[] = [];
        
        if (frontMatter.published_date) {
            parts.push(`Published: ${frontMatter.published_date}`);
        }
        if (frontMatter.last_modified_date) {
            parts.push(`Updated: ${frontMatter.last_modified_date}`);
        }
        
        return parts.join(' · ');
    }

    // ==================== Template & Asset Handling ====================

    private async wrapInTemplate(content: string, filename: string, outputFilePath: string, frontMatter: Record<string, any>, file: TFile): Promise<string> {
        const rootPath = this.getRelativePathToRoot(outputFilePath) || './';
        const templateName = frontMatter.page_template || 'default.html';
        const templatePath = join(this.templatePath, templateName);

        let template = this.templateCache.get(templatePath);
        if (!template) {
            template = await this.dataAdapter.read(templatePath);
            this.templateCache.set(templatePath, template);
        }

        const navigation = this.generateNavigation(outputFilePath, !!frontMatter.omit_from_nav);
        const seoData = this.generateSeoData(filename, outputFilePath, frontMatter, file, rootPath);

        const pageUrl = this.getPageUrl(outputFilePath);
        if (this.sitemapGenerator) {
            this.sitemapGenerator.addUrl({
                loc: pageUrl,
                lastmod: new Date(file.stat.mtime).toISOString().split('T')[0],
                changefreq: frontMatter.changefreq || this.getChangeFreq(file.path),
                priority: frontMatter.priority !== undefined ? frontMatter.priority : this.getPriority(file.path)
            });
        }

        const dates = this.formatDates(frontMatter);
        const fritzScaleHtml = this.generateFritzScaleHtml(frontMatter.fritz_scale, rootPath);

        return Mustache.render(template, {
            title: frontMatter.title || filename,
            siteName: this.siteName,
            rootPath,
            content,
            navigation,
            dates,
            fritzScaleHtml,
            styleSheet: frontMatter.page_css || 'default.css',
            seoMetaTags: seoData.metaTags,
            seoStructuredData: seoData.structuredData,
            canonicalUrl: seoData.canonicalUrl
        });
    }

    private async copyCSS(): Promise<void> {
        const sourceDir = join(this.outputPath, 'css');
        const outputDir = join(this.sitePath, 'css');

        await this.ensureDirectory(outputDir);

        const pluginDir = this.plugin.manifest.dir || 'foursg';
        const pluginCssDir = join(pluginDir, 'css');
        const pluginCssItems = await this.dataAdapter.list(pluginCssDir);
        const pluginCssFiles = pluginCssItems.files.filter(file => file.endsWith('.css'));

        for (const pluginCssFile of pluginCssFiles) {
            const fileName = basename(pluginCssFile);
            const destinationPath = join(sourceDir, fileName);
            await this.copyUnlessExists(`css/${fileName}`, destinationPath);
        }

        const items = await this.dataAdapter.list(sourceDir);
        this.alwaysLog(`Found ${items.files.length} CSS files in ${sourceDir}`, items);
        const cssFiles = items.files.filter(file => file.endsWith('.css'));

        for (const cssFile of cssFiles) {
            const fileName = basename(cssFile);
            const outputPath = join(outputDir, fileName);

            const content = await this.dataAdapter.read(cssFile);
            await this.dataAdapter.write(normalizePath(outputPath), content);
            this.log(`Copied ${fileName}`);
        }

        this.log(`Total CSS files copied: ${cssFiles.length}`);
    }

    private async copyImages(): Promise<void> {
        const imageFiles = this.getFilteredImageFiles();
        let imageCount = 0;
        this.log(`Scanning ${imageFiles.length} image files.`);

        for (const file of imageFiles) {
            try {
                this.log(`Copying image: ${file.path}`);

                const arrayBuffer = await this.plugin.app.vault.readBinary(file);
                const outputPath = this.getImageOutputPath(file.path);
                const outputDir = dirname(outputPath);

                await this.ensureDirectory(outputDir);
                await this.dataAdapter.writeBinary(normalizePath(outputPath), arrayBuffer);

                imageCount++;
            }
            catch (error) {
                this.error(`Error copying image ${file.path}:`, error);
            }
        }
        this.log(`Total images copied: ${imageCount}`);
    }

    private async copyVideos(): Promise<void> {
        const videoFiles = this.getFilteredVideoFiles();
        let videoCount = 0;
        this.log(`Scanning ${videoFiles.length} video files.`);

        for (const file of videoFiles) {
            try {
                this.log(`Copying video: ${file.path}`);

                const arrayBuffer = await this.plugin.app.vault.readBinary(file);
                const outputPath = this.getImageOutputPath(file.path);
                const outputDir = dirname(outputPath);

                await this.ensureDirectory(outputDir);
                await this.dataAdapter.writeBinary(normalizePath(outputPath), arrayBuffer);

                videoCount++;
            }
            catch (error) {
                this.error(`Error copying video ${file.path}:`, error);
            }
        }
        this.log(`Total videos copied: ${videoCount}`);
    }

    // ==================== Misc File Copying ====================

    private async copyMiscFiles(): Promise<void> {
        const miscExists = await this.dataAdapter.exists(this.miscPath);
        if (!miscExists) return;

        await this.copyMiscRecursive(this.miscPath, this.sitePath);
    }

    private async copyMiscRecursive(sourceDirPath: string, destDirPath: string): Promise<void> {
        const items = await this.dataAdapter.list(sourceDirPath);

        for (const filePath of items.files) {
            const fileName = basename(filePath);
            const destFilePath = join(destDirPath, fileName);
            const destExists = await this.dataAdapter.exists(destFilePath);

            if (destExists) {
                const relativeDest = destFilePath.replace(this.sitePath + '/', '');
                const msg = `FourSG: Skipping misc file "${fileName}" — conflict with existing "${relativeDest}" in generated site`;
                this.alwaysLog(`WARNING: ${msg}`);
                new Notice(msg);
                continue;
            }

            const content = await this.dataAdapter.readBinary(filePath);
            await this.dataAdapter.writeBinary(normalizePath(destFilePath), content);
            this.log(`Copied misc file: ${fileName}`);
        }

        for (const folderPath of items.folders) {
            const folderName = basename(folderPath);
            const destFolderPath = join(destDirPath, folderName);
            const destExists = await this.dataAdapter.exists(destFolderPath);

            if (destExists) {
                const relativeDest = destFolderPath.replace(this.sitePath + '/', '');
                const msg = `FourSG: Skipping misc directory "${folderName}" — conflict with existing "${relativeDest}" in generated site`;
                this.alwaysLog(`WARNING: ${msg}`);
                new Notice(msg);
                continue;
            }

            await this.ensureDirectory(destFolderPath);
            await this.copyMiscRecursive(folderPath, destFolderPath);
        }
    }

    // ==================== Fritz Scale ====================

    private hasFritzScaleUsage(): boolean {
        for (const [, frontmatter] of this.frontmatterCache) {
            const value = frontmatter.fritz_scale;
            if (typeof value === 'number' && value >= 1 && value <= 5) return true;
        }
        return false;
    }

    private async copyFritzScaleAssets(): Promise<void> {
        if (!this.hasFritzScaleUsage()) return;

        const siteAssetsPath = join(this.sitePath, 'assets');
        const dirExists = await this.dataAdapter.exists(siteAssetsPath);
        if (!dirExists) {
            await this.ensureDirectory(siteAssetsPath);
            this.alwaysLog('FourSG: Created assets directory for Fritz Scale icons');
        }

        for (const svgFile of SiteGenerator.FRITZ_SCALE_FILES) {
            const destPath = normalizePath(join(siteAssetsPath, svgFile));
            const destExists = await this.dataAdapter.exists(destPath);
            if (destExists) continue;

            const sourcePath = join(this.assetsPath, svgFile);
            const sourceExists = await this.dataAdapter.exists(sourcePath);
            if (sourceExists) {
                const content = await this.dataAdapter.readBinary(sourcePath);
                await this.dataAdapter.writeBinary(destPath, content);
                this.log(`Copied fritz scale asset: ${svgFile}`);
            }
        }
    }

    private generateFritzScaleHtml(fritzScale: number, rootPath: string): string {
        if (typeof fritzScale !== 'number' || fritzScale < 1 || fritzScale > 5) return '';

        const level = Math.floor(fritzScale);
        const svgFile = `fritz-${level}.svg`;
        const urls: Record<number, string> = {
            1: this.plugin.settings.fritzScaleUrl1,
            2: this.plugin.settings.fritzScaleUrl2,
            3: this.plugin.settings.fritzScaleUrl3,
            4: this.plugin.settings.fritzScaleUrl4,
            5: this.plugin.settings.fritzScaleUrl5,
        };
        const url = urls[level] || '#';
        const imgTag = `<img src="${rootPath}assets/${svgFile}" alt="Fritz Scale Level ${level}" class="fritz-scale-icon" width="100" height="100">`;

        if (url) {
            return `<div class="fritz-scale"><a href="${url}" title="Fritz Scale: Level ${level}">${imgTag}</a></div>`;
        }
        return `<div class="fritz-scale">${imgTag}</div>`;
    }

    // ==================== SEO Methods ====================

    private generateSeoData(title: string, outputFilePath: string, frontMatter: Record<string, any>, file: TFile, rootPath: string): { metaTags: string, structuredData: string, canonicalUrl: string } {
        const pageUrl = this.siteUrl + '/' + this.getPageUrl(outputFilePath);
        
        let ogImage = frontMatter.og_image;
        if (ogImage && !ogImage.startsWith('http')) {
            ogImage = this.siteUrl + '/' + rootPath + ogImage;
        }

        const keywords = frontMatter.keywords 
            ? (Array.isArray(frontMatter.keywords) ? frontMatter.keywords.join(', ') : String(frontMatter.keywords))
            : undefined;

        const seoManager = new SeoManager({
            title: frontMatter.title || title,
            description: frontMatter.description,
            keywords: keywords,
            author: frontMatter.author,
            ogImage: ogImage,
            siteName: this.siteName,
            url: pageUrl,
            type: frontMatter.type || (file.parent?.path !== '/' ? 'article' : 'website'),
            publishedTime: frontMatter.published_date ? new Date(frontMatter.published_date).toISOString() : undefined,
            modifiedTime: frontMatter.last_modified_date ? new Date(frontMatter.last_modified_date).toISOString() : (frontMatter.published_date ? new Date(frontMatter.published_date).toISOString() : undefined),
            section: frontMatter.section || file.parent?.name
        });

        const metaTags = seoManager.toHtmlString();
        const structuredData = seoManager.generateStructuredDataScript();
        const canonicalUrl = frontMatter.canonical || pageUrl;

        return { metaTags, structuredData, canonicalUrl };
    }

    private getPageUrl(outputFilePath: string): string {
        const relativePath = outputFilePath.replace(this.sitePath + '/', '');
        return relativePath.replace(/\\/g, '/');
    }

    private getChangeFreq(filePath: string): 'weekly' | 'monthly' {
        const baseName = basename(filePath, '.md').toLowerCase();
        return baseName === 'index' ? 'weekly' : 'monthly';
    }

    private getPriority(filePath: string): number {
        const baseName = basename(filePath, '.md').toLowerCase();
        if (baseName === 'index') {
            const depth = filePath.split('/').length;
            return depth === 1 ? 1.0 : 0.8;
        }
        return 0.6;
    }

    private async generateSitemap(): Promise<void> {
        if (!this.sitemapGenerator) return;

        const sitemapXml = this.sitemapGenerator.toXml();
        const sitemapPath = join(this.sitePath, 'sitemap.xml');
        await this.dataAdapter.write(normalizePath(sitemapPath), sitemapXml);
        this.alwaysLog(`Generated sitemap.xml with ${this.sitemapGenerator.getUrlCount()} URLs`);
    }

    private async generateRobotsTxt(): Promise<void> {
        const customRobotsPath = join(this.outputPath, 'robots.txt');
        const outputRobotsPath = join(this.sitePath, 'robots.txt');

        const customExists = await this.dataAdapter.exists(customRobotsPath);
        if (customExists) {
            const content = await this.dataAdapter.read(customRobotsPath);
            await this.dataAdapter.write(normalizePath(outputRobotsPath), content);
            this.log('Used custom robots.txt');
        } else {
            const defaultRobots = `User-agent: *\nAllow: /\n\nSitemap: ${this.siteUrl}/sitemap.xml`;
            await this.dataAdapter.write(normalizePath(outputRobotsPath), defaultRobots);
            this.log('Generated default robots.txt');
        }
    }
}