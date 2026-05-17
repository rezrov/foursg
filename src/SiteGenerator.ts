import {Notice, TFile, normalizePath, DataAdapter} from 'obsidian';
import Mustache from 'mustache';
import {join, dirname, basename, normalize, relative} from 'pathe';
import FourSGPlugin from "../main";
import {FOURSG_OUTPUT_DIR} from "./settings";
import {SeoManager, escapeHtml} from "./SeoManager";
import {SitemapGenerator} from "./SitemapGenerator";
import {FileResolver} from "./FileResolver";
import {NavigationBuilder} from "./NavigationBuilder";
import {MarkdownRenderer} from "./MarkdownRenderer";
import {computeOutputPath, getRelativePathToRoot, getImageOutputPath} from "./paths";

export class SiteGenerator {
    private plugin: FourSGPlugin;
    private dataAdapter: DataAdapter;
    private readonly sitePath: string;
    private readonly outputPath: string;
    private readonly cssPath: string;
    private readonly templatePath: string;
    private readonly miscPath: string;
    private readonly assetsPath: string;

    private static readonly FRITZ_SCALE_FILES = ['fritz-1.svg', 'fritz-2.svg', 'fritz-3.svg', 'fritz-4.svg', 'fritz-5.svg'];

    private templateCache: Map<string, string> = new Map();
    private frontmatterCache: Map<string, Record<string, any>> = new Map();
    private outputPathMap: Map<string, string> = new Map();
    private failedFiles: string[] = [];
    private siteName: string = 'My Site';
    private siteUrl: string = '';

    private fileResolver: FileResolver;
    private navBuilder: NavigationBuilder | null = null;
    private mdRenderer: MarkdownRenderer | null = null;
    private sitemapGenerator: SitemapGenerator | null = null;

    // ==================== Logging Methods ====================

    private log(...args: any[]): void {
        if (this.plugin.settings.enableDebugLogging) console.log(...args);
    }

    private warn(...args: any[]): void {
        console.warn(...args);
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
        this.fileResolver = new FileResolver(this.plugin.app, this.outputPath);
    }

    // ==================== Public API ====================

    async generateSite(): Promise<void> {
        try {
            this.log('=== FourSG Site Generator Start ===');
            this.log('Settings:', {outputPath: this.outputPath});

            new Notice('Starting FourSG site generation');

            await this.initializeSite();
            await this.loadSiteName();

            this.sitemapGenerator = this.siteUrl ? new SitemapGenerator(this.siteUrl) : null;

            this.cacheClearAll();
            this.fileResolver.build();
            const markdownFiles = this.fileResolver.getMarkdownFiles();
            this.buildFrontmatterCache();
            this.buildOutputPathMap();

            this.navBuilder = new NavigationBuilder(this.fileResolver, this.sitePath, this.outputPathMap, this.frontmatterCache);
            this.navBuilder.build();

            this.mdRenderer = new MarkdownRenderer(this.fileResolver, this.sitePath, this.outputPathMap);

            this.log(`Found ${markdownFiles.length} markdown files to process.`);
            markdownFiles.forEach(file => this.log(`  - ${file.path}`));

            await Promise.all(markdownFiles.map(file => this.processMarkdownFile(file)));

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

            this.log('=== FourSG Site Generation Complete ===');

            if (this.failedFiles.length > 0) {
                this.warn(`${this.failedFiles.length} file(s) failed to process:`);
                this.failedFiles.forEach(p => this.warn(`  - ${p}`));
                new Notice(`FourSG: ${markdownFiles.length - this.failedFiles.length}/${markdownFiles.length} pages generated — ${this.failedFiles.length} failed (see console)`, 10000);
            }
            else {
                new Notice(`FourSG site generated successfully! (${markdownFiles.length} pages)`);
            }
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
        await this.copyUnlessExists('templates/default.html', join(this.templatePath, 'default.html'));

        await this.ensureDirectory(this.cssPath);
        await this.copyCSS();

        await this.ensureDirectory(this.miscPath);

        await this.ensureDirectory(this.assetsPath);
        for (const svgFile of SiteGenerator.FRITZ_SCALE_FILES) {
            await this.copyUnlessExists(`assets/${svgFile}`, join(this.assetsPath, svgFile));
        }

        await this.copyUnlessExists('README.md', join(this.outputPath, 'README.md'));
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
                this.siteUrl = String(frontMatter.site_url).replace(/\/+$/, '');
                this.log(`Site URL loaded from ${indexFile.path}: ${this.siteUrl}`);
            } else {
                this.warn(`site_url not set in ${indexFile.path} frontmatter — sitemap.xml and SEO URLs will be omitted`);
                new Notice('FourSG: site_url not set in index.md frontmatter — sitemap.xml and SEO URLs omitted from output');
                this.siteUrl = '';
            }
        } else {
            this.log('No index.md found at vault root, using default site name');
            this.siteName = 'My Site';
            this.warn('no index.md at vault root — sitemap.xml and SEO URLs will be omitted');
            new Notice('FourSG: no index.md at vault root — sitemap.xml and SEO URLs omitted from output');
            this.siteUrl = '';
        }
    }

    // ==================== Cache Management ====================

    private cacheClearAll(): void {
        this.templateCache.clear();
        this.frontmatterCache.clear();
        this.outputPathMap.clear();
        this.failedFiles = [];
    }

    private buildFrontmatterCache(): void {
        const files = this.fileResolver.getMarkdownFiles();
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

    private getFrontmatter(filePath: string): Record<string, any> {
        return this.frontmatterCache.get(filePath) || {};
    }

    private buildOutputPathMap(): void {
        this.outputPathMap.clear();
        const used = new Set<string>();
        const files = this.fileResolver.getMarkdownFiles();
        for (const file of files) {
            const desired = computeOutputPath(file.path, this.sitePath);
            let final = desired;
            let counter = 2;
            while (used.has(final)) {
                const dir = dirname(desired);
                const base = basename(desired, '.html');
                final = join(dir, `${base}-${counter}.html`);
                counter++;
            }
            if (final !== desired) {
                const msg = `FourSG: filename collision — "${file.path}" renamed to "${basename(final)}"`;
                this.warn(msg);
                new Notice(msg);
            }
            used.add(final);
            this.outputPathMap.set(file.path, final);
        }
        this.log(`Built output path map for ${this.outputPathMap.size} files`);
    }

    private getOutputPath(filePath: string): string {
        return this.outputPathMap.get(filePath) ?? computeOutputPath(filePath, this.sitePath);
    }

    // ==================== File System Operations ====================

    private async removeDirectoryRecursive(dirPath: string): Promise<void> {
        const normalized = normalizePath(normalize(dirPath));
        if (normalized !== this.outputPath && !normalized.startsWith(this.outputPath + '/')) {
            throw new Error(`FourSG: refusing to remove path outside output directory: ${normalized}`);
        }
        const stat = await this.dataAdapter.stat(normalized);
        if (!stat) return;
        if (stat.type === 'file') {
            await this.dataAdapter.remove(normalized);
            return;
        }
        const items = await this.dataAdapter.list(normalized);
        for (const file of items.files) await this.dataAdapter.remove(file);
        for (const folder of items.folders) await this.removeDirectoryRecursive(folder);
        await this.dataAdapter.rmdir(normalized, false);
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
                const content = await this.dataAdapter.readBinary(sourcePath);
                await this.dataAdapter.writeBinary(normalizePath(destinationPath), content);
                this.log(`Copied ${basename(sourceRelativePath)} from plugin`);
            }
        }
    }

    // ==================== Markdown Processing ====================

    private async processMarkdownFile(file: TFile): Promise<void> {
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

            const html = this.mdRenderer!.render(content, file);
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
            this.failedFiles.push(file.path);
        }
    }

    private formatDates(frontMatter: Record<string, any>): string {
        const parts: string[] = [];
        if (frontMatter.published_date) parts.push(`Published: ${frontMatter.published_date}`);
        if (frontMatter.last_modified_date) parts.push(`Updated: ${frontMatter.last_modified_date}`);
        return parts.join(' · ');
    }

    // ==================== Template & Asset Handling ====================

    private async wrapInTemplate(content: string, filename: string, outputFilePath: string, frontMatter: Record<string, any>, file: TFile): Promise<string> {
        const rootPath = getRelativePathToRoot(outputFilePath, this.sitePath) || './';
        const templateName = frontMatter.page_template || 'default.html';
        const templatePath = join(this.templatePath, templateName);

        let template = this.templateCache.get(templatePath);
        if (!template) {
            template = await this.dataAdapter.read(templatePath);
            this.templateCache.set(templatePath, template);
        }

        const navigation = this.navBuilder!.render(outputFilePath, !!frontMatter.omit_from_nav);
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
        this.log(`Found ${items.files.length} files in ${sourceDir}`);
        const cssFiles = items.files.filter(file => file.endsWith('.css'));

        for (const cssFile of cssFiles) {
            const fileName = basename(cssFile);
            const outputPath = join(outputDir, fileName);

            const content = await this.dataAdapter.readBinary(cssFile);
            await this.dataAdapter.writeBinary(normalizePath(outputPath), content);
            this.log(`Copied ${fileName}`);
        }

        this.log(`Total CSS files copied: ${cssFiles.length}`);
    }

    private async copyImages(): Promise<void> {
        const imageFiles = this.fileResolver.getImageFiles();
        let imageCount = 0;
        this.log(`Scanning ${imageFiles.length} image files.`);

        for (const file of imageFiles) {
            try {
                this.log(`Copying image: ${file.path}`);
                const arrayBuffer = await this.plugin.app.vault.readBinary(file);
                const outputPath = getImageOutputPath(file.path, this.sitePath);
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
        const videoFiles = this.fileResolver.getVideoFiles();
        let videoCount = 0;
        this.log(`Scanning ${videoFiles.length} video files.`);

        for (const file of videoFiles) {
            try {
                this.log(`Copying video: ${file.path}`);
                const arrayBuffer = await this.plugin.app.vault.readBinary(file);
                const outputPath = getImageOutputPath(file.path, this.sitePath);
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
                const relativeDest = relative(this.sitePath, destFilePath);
                const msg = `FourSG: Skipping misc file "${fileName}" — conflict with existing "${relativeDest}" in generated site`;
                this.warn(msg);
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
                const relativeDest = relative(this.sitePath, destFolderPath);
                const msg = `FourSG: Skipping misc directory "${folderName}" — conflict with existing "${relativeDest}" in generated site`;
                this.warn(msg);
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
            this.log('FourSG: Created assets directory for Fritz Scale icons');
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
        const imgTag = `<img src="${escapeHtml(rootPath)}assets/${svgFile}" alt="Fritz Scale Level ${level}" class="fritz-scale-icon" width="100" height="100">`;

        const urls: Record<number, string> = {
            1: this.plugin.settings.fritzScaleUrl1,
            2: this.plugin.settings.fritzScaleUrl2,
            3: this.plugin.settings.fritzScaleUrl3,
            4: this.plugin.settings.fritzScaleUrl4,
            5: this.plugin.settings.fritzScaleUrl5
        };
        const url = (urls[level] || '').trim();
        const safeUrl = /^(https?:\/\/|\/|\.|#)/i.test(url) ? url : '';

        if (safeUrl) {
            return `<div class="fritz-scale"><a href="${escapeHtml(safeUrl)}" title="Fritz Scale: Level ${level}">${imgTag}</a></div>`;
        }
        return `<div class="fritz-scale">${imgTag}</div>`;
    }

    // ==================== SEO Methods ====================

    private generateSeoData(title: string, outputFilePath: string, frontMatter: Record<string, any>, file: TFile, rootPath: string): {metaTags: string, structuredData: string, canonicalUrl: string} {
        const pageUrl = this.siteUrl ? this.siteUrl + '/' + this.getPageUrl(outputFilePath) : '';

        let ogImage = frontMatter.og_image;
        if (ogImage && !ogImage.startsWith('http')) {
            ogImage = this.siteUrl ? this.siteUrl + '/' + rootPath + ogImage : undefined;
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

        return {metaTags, structuredData, canonicalUrl};
    }

    private getPageUrl(outputFilePath: string): string {
        return relative(this.sitePath, outputFilePath);
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
        this.log(`Generated sitemap.xml with ${this.sitemapGenerator.getUrlCount()} URLs`);
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
            const defaultRobots = this.siteUrl
                ? `User-agent: *\nAllow: /\n\nSitemap: ${this.siteUrl}/sitemap.xml`
                : `User-agent: *\nAllow: /`;
            await this.dataAdapter.write(normalizePath(outputRobotsPath), defaultRobots);
            this.log('Generated default robots.txt');
        }
    }
}
