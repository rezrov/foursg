export interface FourSGPluginSettings {
	enableDebugLogging: boolean;
	fritzScaleUrl1: string;
	fritzScaleUrl2: string;
	fritzScaleUrl3: string;
	fritzScaleUrl4: string;
	fritzScaleUrl5: string;
}

export const DEFAULT_SETTINGS: FourSGPluginSettings = {
	enableDebugLogging: false,
	fritzScaleUrl1: '',
	fritzScaleUrl2: '',
	fritzScaleUrl3: '',
	fritzScaleUrl4: '',
	fritzScaleUrl5: '',
}

export const FOURSG_OUTPUT_DIR = "obsidian-foursg";