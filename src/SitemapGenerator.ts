export interface SitemapUrl {
    loc: string;
    lastmod?: string;
    changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
    priority?: number;
}

export class SitemapGenerator {
    private urls: SitemapUrl[] = [];
    private hostname: string;

    constructor(hostname: string) {
        this.hostname = hostname.replace(/\/$/, '');
    }

    addUrl(url: SitemapUrl): void {
        this.urls.push(url);
    }

    clear(): void {
        this.urls = [];
    }

    toXml(): string {
        const urlEntries = this.urls.map(url => this.generateUrlEntry(url)).join('\n');
        
        return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;
    }

    private generateUrlEntry(url: SitemapUrl): string {
        const loc = this.hostname + (url.loc.startsWith('/') ? '' : '/') + url.loc;
        let entry = `  <url>\n    <loc>${this.escapeXml(loc)}</loc>`;

        if (url.lastmod) {
            entry += `\n    <lastmod>${url.lastmod}</lastmod>`;
        }

        if (url.changefreq) {
            entry += `\n    <changefreq>${url.changefreq}</changefreq>`;
        }

        if (url.priority !== undefined) {
            entry += `\n    <priority>${url.priority.toFixed(1)}</priority>`;
        }

        entry += '\n  </url>';
        return entry;
    }

    private escapeXml(text: string): string {
        const map: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&apos;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    getUrlCount(): number {
        return this.urls.length;
    }
}
