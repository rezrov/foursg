export interface SeoConfig {
    title: string;
    description?: string;
    keywords?: string;
    author?: string;
    ogImage?: string;
    siteName?: string;
    url?: string;
    type?: string;
    publishedTime?: string;
    modifiedTime?: string;
    section?: string;
}

export interface MetaTag {
    name?: string;
    property?: string;
    content: string;
}

export class SeoManager {
    private config: SeoConfig;

    constructor(config: SeoConfig) {
        this.config = config;
    }

    generateMetaTags(): MetaTag[] {
        const tags: MetaTag[] = [];

        if (this.config.description) {
            tags.push({ name: 'description', content: this.config.description });
        }

        if (this.config.keywords) {
            tags.push({ name: 'keywords', content: this.config.keywords });
        }

        if (this.config.author) {
            tags.push({ name: 'author', content: this.config.author });
        }

        tags.push({ name: 'generator', content: 'FourSG' });

        return tags;
    }

    generateOpenGraphTags(): MetaTag[] {
        const tags: MetaTag[] = [];

        tags.push({ property: 'og:title', content: this.config.title });

        if (this.config.description) {
            tags.push({ property: 'og:description', content: this.config.description });
        }

        if (this.config.siteName) {
            tags.push({ property: 'og:site_name', content: this.config.siteName });
        }

        if (this.config.url) {
            tags.push({ property: 'og:url', content: this.config.url });
        }

        tags.push({ property: 'og:type', content: this.config.type || 'website' });

        if (this.config.ogImage) {
            tags.push({ property: 'og:image', content: this.config.ogImage });
        }

        if (this.config.publishedTime) {
            tags.push({ property: 'article:published_time', content: this.config.publishedTime });
        }

        if (this.config.modifiedTime) {
            tags.push({ property: 'article:modified_time', content: this.config.modifiedTime });
        }

        if (this.config.author) {
            tags.push({ property: 'article:author', content: this.config.author });
        }

        if (this.config.section) {
            tags.push({ property: 'article:section', content: this.config.section });
        }

        return tags;
    }

    generateTwitterCardTags(): MetaTag[] {
        const tags: MetaTag[] = [];

        tags.push({ name: 'twitter:card', content: 'summary_large_image' });
        tags.push({ name: 'twitter:title', content: this.config.title });

        if (this.config.description) {
            tags.push({ name: 'twitter:description', content: this.config.description });
        }

        if (this.config.ogImage) {
            tags.push({ name: 'twitter:image', content: this.config.ogImage });
        }

        return tags;
    }

    generateAllTags(): MetaTag[] {
        return [
            ...this.generateMetaTags(),
            ...this.generateOpenGraphTags(),
            ...this.generateTwitterCardTags()
        ];
    }

    toHtmlString(): string {
        const allTags = this.generateAllTags();
        return allTags.map(tag => {
            if (tag.property) {
                return `    <meta property="${this.escapeHtml(tag.property)}" content="${this.escapeHtml(tag.content)}">`;
            } else {
                return `    <meta name="${this.escapeHtml(tag.name!)}" content="${this.escapeHtml(tag.content)}">`;
            }
        }).join('\n');
    }

    generateStructuredData(): any {
        const schemaData: any = {
            '@context': 'https://schema.org',
            '@type': this.config.type === 'article' ? 'Article' : 'WebPage',
            'headline': this.config.title,
        };

        if (this.config.description) {
            schemaData.description = this.config.description;
        }

        if (this.config.author) {
            schemaData.author = {
                '@type': 'Person',
                'name': this.config.author
            };
        }

        if (this.config.publishedTime) {
            schemaData.datePublished = this.config.publishedTime;
        }

        if (this.config.modifiedTime) {
            schemaData.dateModified = this.config.modifiedTime;
        }

        if (this.config.ogImage) {
            schemaData.image = this.config.ogImage;
        }

        if (this.config.url) {
            schemaData.url = this.config.url;
        }

        return schemaData;
    }

    generateStructuredDataScript(): string {
        const data = this.generateStructuredData();
        return `    <script type="application/ld+json">\n${JSON.stringify(data, null, 2).split('\n').map(line => '    ' + line).join('\n')}\n    </script>`;
    }

    private escapeHtml(text: string): string {
        const map: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
}

export function generateBreadcrumbStructuredData(breadcrumbs: Array<{name: string, url: string}>): string {
    const schema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': breadcrumbs.map((crumb, index) => ({
            '@type': 'ListItem',
            'position': index + 1,
            'name': crumb.name,
            'item': crumb.url
        }))
    };

    return `    <script type="application/ld+json">\n${JSON.stringify(schema, null, 2).split('\n').map(line => '    ' + line).join('\n')}\n    </script>`;
}
