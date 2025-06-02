import cv from "@techstark/opencv-js";
export interface Config {
  // Declaration for adjustments
  Exposure: number; // For ServerConfig Exposure
  Temperature: number; // For ServerConfig Temperature
  Shadow: number; // For ServerConfig Shadow
  Highlights: number; // For ServerConfig Highlights
  Tint: number; // For ServerConfig Tint
  Black: number; // For ServerConfig Black
  White: number; // For ServerConfig White
  Contrast: number; // For ServerConfig Contrast
  Saturation: number; // For ServerConfig Saturation
  Vibrance: number; // For ServerConfig Vibrance
}

export enum AdjustType {
  Exposure, Temperature, Tint, Highlights, 
  Shadow, Blacks, Whites, Contrast, Vibrance, Saturation
}

export interface HonchoEditor {
  consume(serverConfig: Config[]): string;
  // Image getter
  onImageUpdate(inputImage: cv.Mat): cv.Mat;

  adjust(type: AdjustType, value: number): void;
  
  // Config History for undo and redo
  configHistotrypush(config: Config): void;
  
  // // Config setter
  // setShadow(shadow: number): void;
  // setTemp(temp: number): void;
  // setTint(tint: number): void;

  // Config undo - redo - reset
  undo(): Promise<void>;
  redo(): Promise<void>;
  reset(): void;

  // // Config applier
  // applyShadow(shadow: number): void;
  // applyTemp(temp: number): void;
  // applyTint(tint: number): void;
  // sendConfigServer(): void;
  // getFlattenConfig(configs: Config[]): Config;
  // applyOpenCV(config: Config): void;
}

export interface Listener {
  onImageRendered(image: cv.Mat): void;
  onSyncConfigs(imageId: string, eventId: string, configs: Config[]): void;
  onConfigChange(config: Config): void;
}