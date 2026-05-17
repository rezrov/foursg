import slugify from 'slugify';
import {join, dirname, basename, relative} from 'pathe';

export function sanitizeFilename(filename: string): string {
    return slugify(filename, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g
    });
}

export function sanitizeDirectoryPath(dirPath: string): string {
    return dirPath.split('/').map(d => sanitizeFilename(d)).join('/');
}

export function computeOutputPath(filePath: string, sitePath: string): string {
    const baseName = basename(filePath, '.md');
    const dirName = dirname(filePath);
    const isIndex = baseName.toLowerCase() === 'index';
    const outputName = isIndex ? 'index' : sanitizeFilename(baseName);
    if (dirName === '.') return join(sitePath, `${outputName}.html`);
    return join(sitePath, sanitizeDirectoryPath(dirName), `${outputName}.html`);
}

export function getImageOutputPath(imagePath: string, sitePath: string): string {
    const dirName = dirname(imagePath);
    const fileName = basename(imagePath);
    if (dirName === '.') return join(sitePath, fileName);
    return join(sitePath, sanitizeDirectoryPath(dirName), fileName);
}

export function getRelativeLinkPath(fromPath: string, toPath: string): string {
    return relative(dirname(fromPath), toPath);
}

export function getRelativePathToRoot(filePath: string, sitePath: string): string {
    const relativePath = relative(dirname(filePath), sitePath);
    if (relativePath === '' || relativePath === '.') return './';
    return relativePath + '/';
}
