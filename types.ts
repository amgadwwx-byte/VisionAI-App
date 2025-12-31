
export enum DesignType {
  LOGO = 'logo',
  ART = 'art',
  AD = 'advertisement',
  BACKGROUND = 'background',
  SOCIAL_POST = 'social_post'
}

export enum DesignStyle {
  MINIMAL = 'minimal',
  THREE_D = '3d',
  FLAT = 'flat',
  REALISTIC = 'realistic',
  CARTOON = 'cartoon',
  MODERN = 'modern',
  LUXURY = 'luxury',
  TECH = 'tech',
  ISLAMIC = 'islamic'
}

export interface DesignConfig {
  prompt: string;
  type: DesignType;
  style: DesignStyle;
  colorPalette?: string;
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3';
}

export interface Layer {
  id: string;
  type: 'image' | 'text';
  content: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation: number;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
  opacity: number;
  isLocked: boolean;
  effect?: 'neon' | 'gradient' | 'shadow' | 'glow' | 'none';
}

export type ScreenState = 'splash' | 'login' | 'home' | 'editor' | 'profile';

export interface AppState {
  screen: ScreenState;
  isGenerating: boolean;
  results: string[];
  layers: Layer[];
  selectedLayerId: string | null;
  isPro: boolean;
  credits: number;
  savedProjects: { id: string; name: string; thumbnail: string; date: string }[];
}
