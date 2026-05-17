import {TFile} from 'obsidian';
import {escapeHtml} from './SeoManager';
import {FileResolver} from './FileResolver';
import {computeOutputPath, getRelativeLinkPath} from './paths';

export interface NavNode {
    name: string;
    path: string;
    outputPath: string;
    children: NavNode[];
    isIndex: boolean;
    navOrder: number;
    sortDate: number;
}

export class NavigationBuilder {
    private cachedTree: NavNode[] | null = null;

    constructor(
        private fileResolver: FileResolver,
        private sitePath: string,
        private outputPathMap: Map<string, string>,
        private frontmatterCache: Map<string, Record<string, any>>
    ) {}

    build(): void {
        const files = [...this.fileResolver.getMarkdownFiles()];
        const rootNodes: NavNode[] = [];
        const dirMap = new Map<string, NavNode>();

        files.sort((a, b) => a.path.localeCompare(b.path));

        for (const file of files) {
            const parts = file.path.split('/');
            const isIndex = file.basename.toLowerCase() === 'index';
            const {navOrder, sortDate} = this.getNavSortData(file.path, file);
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
        this.cachedTree = this.pruneEmptyNavNodes(rootNodes);
    }

    render(currentPath: string, omitCurrent: boolean): string {
        if (!this.cachedTree) return '';
        return this.renderNavTree(this.cachedTree, omitCurrent ? '' : currentPath);
    }

    private getOutputPath(filePath: string): string {
        return this.outputPathMap.get(filePath) ?? computeOutputPath(filePath, this.sitePath);
    }

    private getFrontmatter(filePath: string): Record<string, any> {
        return this.frontmatterCache.get(filePath) || {};
    }

    private getNavSortData(filePath: string, file?: TFile): {navOrder: number, sortDate: number} {
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
        return {navOrder, sortDate};
    }

    private sortNavNodes(nodes: NavNode[]): void {
        nodes.sort((a, b) => {
            if (a.navOrder !== b.navOrder) return a.navOrder - b.navOrder;
            return b.sortDate - a.sortDate;
        });
        for (const node of nodes) {
            if (node.children.length > 0) this.sortNavNodes(node.children);
        }
    }

    private pruneEmptyNavNodes(nodes: NavNode[]): NavNode[] {
        const result: NavNode[] = [];
        for (const node of nodes) {
            node.children = this.pruneEmptyNavNodes(node.children);
            if (node.outputPath !== '' || node.children.length > 0) result.push(node);
        }
        return result;
    }

    private renderNavTree(nodes: NavNode[], currentPath: string): string {
        if (nodes.length === 0) return '';

        let html = '<ul>';

        for (const node of nodes) {
            const isCurrent = node.outputPath === currentPath;
            const hasChildren = node.children.length > 0;
            const safeName = escapeHtml(node.name);
            const isOnCurrentPath = this.isNodeOnPathToFile(node, currentPath);

            html += '<li>';

            if (hasChildren) {
                const folderId = `nav-${node.path.replace(/[^a-zA-Z0-9]/g, c => '_' + c.charCodeAt(0).toString(16) + '_')}`;
                const openAttr = isOnCurrentPath ? ' open' : '';
                html += `<details id="${escapeHtml(folderId)}" class="nav-folder"${openAttr}>`;
                html += `<summary>`;

                if (node.outputPath) {
                    const relativePath = escapeHtml(getRelativeLinkPath(currentPath, node.outputPath));
                    html += `<a href="${relativePath}" title="${safeName}"${isCurrent ? ' class="active"' : ''}>${safeName}</a>`;
                } else {
                    html += `<span title="${safeName}">${safeName}</span>`;
                }

                html += `</summary>`;
                html += this.renderNavTree(node.children, currentPath);
                html += `</details>`;
            } else {
                if (node.outputPath) {
                    const relativePath = escapeHtml(getRelativeLinkPath(currentPath, node.outputPath));
                    html += `<a href="${relativePath}" title="${safeName}"${isCurrent ? ' class="active"' : ''}>${safeName}</a>`;
                } else {
                    html += `<span title="${safeName}">${safeName}</span>`;
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
}
