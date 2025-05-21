import cv from "@techstark/opencv-js";
export interface Config {
  // Declaration for adjustments
  Exposure: number; // For ServerConfig Exposure
  Temp: number; // For ServerConfig Temperature
  Shadow: number; // For ServerConfig Shadow
  Highlights: number; // For ServerConfig Highlights
  Tint: number; // For ServerConfig Tint
  Black: number; // For ServerConfig Black
  Whites: number; // For ServerConfig Whites
  Contrast: number; // For ServerConfig Contrast
  Saturation: number; // For ServerConfig Saturation
  Vibrance: number; // For ServerConfig Vibrance
}

export interface HonchoEditor {
  consume(serverConfig: Config[]): string;
  // Modify image function
  modify_image_exposure(exposure: number, inputImage: cv.Mat): Promise<cv.Mat>;
  modify_image_temperature(colorTemperature: number, inputImage: cv.Mat): Promise<cv.Mat>;
  modify_image_tint(tint: number, inputImage: cv.Mat): Promise<cv.Mat>;
  modify_image_highlights(highlights: number, inputImage: cv.Mat): Promise<cv.Mat>;
  modify_image_shadows(shadows: number, inputImage: cv.Mat): Promise<cv.Mat>;
  modify_image_blacks(blacks: number, inputImage: cv.Mat): Promise<cv.Mat>;
  modify_image_whites(whites: number, inputImage: cv.Mat): Promise<cv.Mat>;
  modify_image_contrast(contrast: number, inputImage: cv.Mat): Promise<cv.Mat>;
  modify_image_vibrance(vibrance: number, inputImage: cv.Mat): Promise<cv.Mat>;
  modify_image_saturation(saturation: number, inputImage: cv.Mat): Promise<cv.Mat>;
  
  // Merger console
  adjust_image_colors_merge(
    exposure: number,
    temperature: number,
    tint: number,
    highlights: number,
    shadows: number,
    blacks: number,
    whites: number,
    contrast: number,
    saturation: number,
    vibrance: number
  ): Promise<void>;
  
  // setShadow(shadow: number): void;
  // setTemp(temp: number): void;
  // setTint(tint: number): void;

  // // Config undo - redo - reset
  // undo(): Promise<void>;
  // redo(): Promise<void>;
  // reset(): void;

  // // Config applier
  // applyShadow(shadow: number): void;
  // applyTemp(temp: number): void;
  // applyTint(tint: number): void;
  // sendConfigServer(): void;
  // getFlattenConfig(configs: Config[]): Config;
  // applyOpenCV(config: Config): Promise<void>;
}

export interface Listener {
  // onImageRendered(image: ImageBitmap): void;
  // onGetRawImage(imageId: string, eventId: string): void;
  // onSyncConfigs(imageId: string, eventId: string): Config[];
}