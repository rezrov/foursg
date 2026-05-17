export interface FourSGPluginSettings {
    enableDebugLogging: boolean;
    fritzScaleUrl1: string;
    fritzScaleUrl2: string;
    fritzScaleUrl3: string;
    fritzScaleUrl4: string;
    fritzScaleUrl5: string;
}

// TODO(before next release): replace the shared placeholder with per-level explainer
// URLs once the Fritz Scale documentation has been split per level. Currently all
// five point at the same introduction page. See fritz-scale-design.md for level
// definitions.
export const DEFAULT_SETTINGS: FourSGPluginSettings = {
    enableDebugLogging: false,
    fritzScaleUrl1: 'https://iron.blue/articles/introducing-the-fritz-scale',
    fritzScaleUrl2: 'https://iron.blue/articles/introducing-the-fritz-scale',
    fritzScaleUrl3: 'https://iron.blue/articles/introducing-the-fritz-scale',
    fritzScaleUrl4: 'https://iron.blue/articles/introducing-the-fritz-scale',
    fritzScaleUrl5: 'https://iron.blue/articles/introducing-the-fritz-scale'
}

export const FOURSG_OUTPUT_DIR = "obsidian-foursg";