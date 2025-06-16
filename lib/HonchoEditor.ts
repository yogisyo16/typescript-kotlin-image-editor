import cv from "@techstark/opencv-js";

export interface Config {
  // Declaration for adjustments
  Exposure: number; // For ServerConfig Exposure
  Temperature: number; // For ServerConfig Temperature
  Shadow: number; // For ServerConfig Shadow
  Highlights: number; // For ServerConfig Highlights
  Tint: number; // For ServerConfig Tint
  Blacks: number; // For ServerConfig Black
  Whites: number; // For ServerConfig White
  Contrast: number; // For ServerConfig Contrast
  Saturation: number; // For ServerConfig Saturation
  Vibrance: number; // For ServerConfig Vibrance
}

export enum AdjustType {
  Exposure, Temperature, Tint, Highlights, 
  Shadow, Blacks, Whites, Contrast, Vibrance, Saturation
}

export interface Adjustment {
    score: number;
    func: any;
    name: AdjustType;
}

export interface HonchoEditor {
  // Sync Socket
  syncConfig(serverConfig: Config[]): Promise<void>;
  adjust(type: AdjustType, score: number): Promise<void>;
  // Config undo - redo - reset
  undo(config: Config): Promise<void>;
  redo(config: Config): Promise<void>;
  reset(config: Config): void;
}

export interface Listener {
  onImageRendered(image: cv.Mat): void;
  onSyncConfigs(imageId: string, eventId: string, configs: Config[]): void;
  onConfigChange(config: Config): void;
}