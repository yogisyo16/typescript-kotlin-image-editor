import { HonchoEditor, Config, Listener, AdjustType } from "@/lib/HonchoEditor";
import applyAllAdjustments from "@/lib/adjustExt/adjustmentProcessor"; 
import modifyImageExposure from "@/lib/adjustImage/exposureAdjust";
import modifyImageTemperature from "@/lib/adjustImage/temperatureAdjust";
import modifyImageTint from "@/lib/adjustImage/tintAdjust";
import modifyImageHighlights from "@/lib/adjustImage/highlightAdjust";
import modifyImageShadows from "@/lib/adjustImage/shadowsAdjust";
import modifyImageBlacks from "@/lib/adjustImage/blacksAdjust";
import modifyImageWhites from "@/lib/adjustImage/whiteAdjust";
import modifyImageContrast from "@/lib/adjustImage/contrastAdjust";
import modifyImageSaturation from "@/lib/adjustImage/saturationAdjust";
import modifyImageVibrance from "@/lib/adjustImage/vibranceAdjust";
import cv from "@techstark/opencv-js";
import { useState } from "react";

// Hook to manage and setup OpenCV
export function useOpenCV() {
  const [isCvLoaded, setIsCvLoaded] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const onOpenCVLoad = () => {
    setIsCvLoaded(true);
  };

  // const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const files = e.target.files;
  //   if (!files || files.length === 0) return;

  //   const file = files[0];
  //   const reader = new FileReader();
  //   reader.onload = (evt) => {
  //     if (evt.target?.readyState === FileReader.DONE && imgRef.current) {
  //       imgRef.current.src = evt.target.result as string;
  //       setImageLoaded(true);
  //     }
  //   };
  //   reader.readAsDataURL(file);
  // };

  return {
    isCvLoaded,
    imageLoaded,
    onOpenCVLoad
  };
}

export class HonchoEditorClass implements HonchoEditor {
  // For any Input convert into cv.Mat first
  private inputImage: cv.Mat;
  private currentImageEdit: cv.Mat = new cv.Mat();
  private listener: Listener | null = null;
  // Config variable Value
  private config: Config = {
    Exposure: 0,
    Temperature: 0,
    Tint: 0,
    Highlights: 0,
    Shadow: 0,
    Blacks: 0,
    Whites: 0,
    Contrast: 0,
    Saturation: 0,
    Vibrance: 0,
  };
  // For undo Redo
  private configHistory: Config[] = [];
  private redoStack: Config[] = [];
  // private currentHistoryIndex: number = -1;

  constructor(inputImage: cv.Mat, listener: Listener) {
    this.inputImage = inputImage.clone();
    this.configHistory.push({ ...this.config });
    this.listener = listener;
  }

  // Getter for config
  public getConfig(): Config {
    return { ...this.config };
  }

  // Setter for individual config values
  public setConfigValue(key: keyof Config, value: number): void {
    this.config = { ...this.config, [key]: value };
  }

  consume(serverConfig: Config[]): string {
    throw Error("Not implemented");
    // return "Configs consumed";
  }

  onImageUpdate(inputImage: cv.Mat): cv.Mat {
    return inputImage.clone(); // Clone to avoid modifying the input
  }

  async adjust(type: AdjustType, value: number): Promise<void> {
    const key = AdjustType[type] as keyof Config;
    if (this.config[key] === value) return;
    this.config[key] = value;
    const adjustmentPipeline = [
      // Basic tonal adjustments
      { value: this.config.Exposure, func: modifyImageExposure, name: "Exposure" },
      { value: this.config.Contrast, func: modifyImageContrast, name: "Contrast" },
      { value: this.config.Highlights, func: modifyImageHighlights, name: "Highlights" },
      { value: this.config.Shadow, func: modifyImageShadows, name: "Shadows" },
      { value: this.config.Whites, func: modifyImageWhites, name: "Whites" },
      { value: this.config.Blacks, func: modifyImageBlacks, name: "Blacks" },
      // Color adjustments
      { value: this.config.Temperature, func: modifyImageTemperature, name: "Temperature" },
      { value: this.config.Tint, func: modifyImageTint, name: "Tint" },
      { value: this.config.Vibrance, func: modifyImageVibrance, name: "Vibrance" },
      { value: this.config.Saturation, func: modifyImageSaturation, name: "Saturation" },
    ];
    const newImage = await applyAllAdjustments(this.inputImage, adjustmentPipeline);
    this.currentImageEdit = newImage;
    this.listener?.onImageRendered(this.currentImageEdit);
    this.listener?.onConfigChange(this.config);
    console.log("configHistory: ", this.configHistory);
  }

  configHistotrypush() {
    // Here is to save configHistory after initial state
    if (this.configHistory.length > 0) {
      this.configHistory.push({
        Exposure: this.config.Exposure,
        Temperature: this.config.Temperature,
        Shadow: this.config.Shadow,
        Highlights: this.config.Highlights,
        Tint: this.config.Tint,
        Blacks: this.config.Blacks,
        Whites: this.config.Whites,
        Contrast: this.config.Contrast,
        Saturation: this.config.Saturation,
        Vibrance: this.config.Vibrance
      });
      console.log("After length > 0: ",this.configHistory);
    }
  }

  // Logic for undo
  async undo(): Promise<void> {
    // You must have more than one state to undo (the initial state and at least one change).
    if (this.configHistory.length > 1) {
      const currentState = this.configHistory.pop();
      if (currentState) {
        this.redoStack.push(currentState);
      }
      const previousState = this.configHistory[this.configHistory.length - 1];
      this.config = { ...previousState }; // Update the internal config

      const adjustmentPipeline = [
        { value: this.config.Exposure, func: modifyImageExposure, name: "Exposure" },
        { value: this.config.Contrast, func: modifyImageContrast, name: "Contrast" },
        { value: this.config.Highlights, func: modifyImageHighlights, name: "Highlights" },
        { value: this.config.Shadow, func: modifyImageShadows, name: "Shadows" },
        { value: this.config.Whites, func: modifyImageWhites, name: "Whites" },
        { value: this.config.Blacks, func: modifyImageBlacks, name: "Blacks" },
        { value: this.config.Temperature, func: modifyImageTemperature, name: "Temperature" },
        { value: this.config.Tint, func: modifyImageTint, name: "Tint" },
        { value: this.config.Vibrance, func: modifyImageVibrance, name: "Vibrance" },
        { value: this.config.Saturation, func: modifyImageSaturation, name: "Saturation" },
      ];
      
      const undoneImage = await applyAllAdjustments(this.inputImage, adjustmentPipeline);
      
      if (this.currentImageEdit) this.currentImageEdit.delete();
      this.currentImageEdit = undoneImage;

      this.listener?.onImageRendered(this.currentImageEdit);
      this.listener?.onConfigChange(this.config);

    } else {
      console.log("Cannot undo. At original state.");
    }
  }

  async redo(): Promise<void> {
    if (this.redoStack.length > 0) {
      const redoState = this.redoStack.pop();
      if (redoState) {
        this.configHistory.push(redoState);
        this.config = { ...redoState };

        const adjustmentPipeline = [
          { value: this.config.Exposure, func: modifyImageExposure, name: "Exposure" },
          { value: this.config.Contrast, func: modifyImageContrast, name: "Contrast" },
          { value: this.config.Highlights, func: modifyImageHighlights, name: "Highlights" },
          { value: this.config.Shadow, func: modifyImageShadows, name: "Shadows" },
          { value: this.config.Whites, func: modifyImageWhites, name: "Whites" },
          { value: this.config.Blacks, func: modifyImageBlacks, name: "Blacks" },
          { value: this.config.Temperature, func: modifyImageTemperature, name: "Temperature" },
          { value: this.config.Tint, func: modifyImageTint, name: "Tint" },
          { value: this.config.Vibrance, func: modifyImageVibrance, name: "Vibrance" },
          { value: this.config.Saturation, func: modifyImageSaturation, name: "Saturation" },
        ];

        const redoneImage = await applyAllAdjustments(this.inputImage, adjustmentPipeline);
        if (this.currentImageEdit) this.currentImageEdit.delete();
        this.currentImageEdit = redoneImage;

        this.listener?.onImageRendered(this.currentImageEdit);
        this.listener?.onConfigChange(this.config);
      }
    } else {
      console.log("Cannot redo. At latest state.");
    }
  }


  async reset(): Promise<void> { // Made async to match the pattern
    const initialConfig = {
      Exposure: 0, Temperature: 0, Tint: 0, Highlights: 0, Shadow: 0,
      Blacks: 0, Whites: 0, Contrast: 0, Saturation: 0, Vibrance: 0,
    };

    this.config = { ...initialConfig };
    this.configHistory = [initialConfig];
    this.redoStack = [];

    if (this.currentImageEdit) this.currentImageEdit.delete();
    this.currentImageEdit = this.inputImage.clone();

    this.listener?.onImageRendered(this.currentImageEdit);
    this.listener?.onConfigChange(this.config);

    // console.log("configHistory: ", this.configHistory);
    // console.log("redoStack: ", this.redoStack);
    // console.log("Looking at log: ", this.config);
  }
}