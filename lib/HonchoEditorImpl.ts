import { HonchoEditor, Config, Listener, AdjustType } from "@/lib/HonchoEditor";
import cleanAndExecuteAdjustment from "@/lib/adjustExt/cleanAdjust";
import { computeDelta } from "@/lib/adjustExt/adjustmentProcessor"; 
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
  // const imgRef = React.createRef<HTMLImageElement>();
  // const canvasRef = React.createRef<HTMLCanvasElement>();
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
  
  private async applyAllAdjustments(): Promise<void> {
    // Start with a fresh clone of the original image for each full render pass
    let imageToProcess = this.inputImage.clone();
    
    try {
      // This defines a professional and logical order of operations.
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

      for (const adjustment of adjustmentPipeline) {
        if (adjustment.value !== 0) {
          console.log(`Applying: ${adjustment.name}`);
          // Apply the adjustment function to the current state of the image
          const resultOfThisStep = await adjustment.func(imageToProcess, adjustment.value);
          
          // IMPORTANT: Delete the previous image state to prevent memory leaks
          imageToProcess.delete(); 
          
          // The result of this step becomes the input for the next step
          imageToProcess = resultOfThisStep;
        }
      }

      // After all adjustments, update the main editable image
      this.currentImageEdit.delete();
      this.currentImageEdit = imageToProcess;

    } catch (err) {
      console.error("An error occurred during the adjustment pipeline:", err);
      // If any step fails, clean up the intermediate image and revert to the original.
      if (imageToProcess) imageToProcess.delete();
      this.currentImageEdit = this.inputImage.clone();
    }
  }

  async adjust(type: AdjustType, value: number): Promise<void> {
    const key = AdjustType[type] as keyof Config;
    if (this.config[key] === value) return;
    this.config[key] = value;
    await this.applyAllAdjustments();
    this.listener?.onImageRendered(this.currentImageEdit);
    this.listener?.onConfigChange(this.config);
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
    if (this.redoStack.length >= 0) {
      const newConfig = this.configHistory.pop();
      const undoConfig = this.configHistory.length > 0 ? this.configHistory[this.configHistory.length - 1] : null;

      if(newConfig){
        this.redoStack.push(newConfig);
        if (undoConfig) {
          this.config.Exposure = undoConfig.Exposure;
          this.config.Temperature = undoConfig.Temperature;
          this.config.Tint = undoConfig.Tint;
          this.config.Highlights = undoConfig.Highlights;
          this.config.Shadow = undoConfig.Shadow;
          this.config.Blacks = undoConfig.Blacks;
          this.config.Whites = undoConfig.Whites;
          this.config.Contrast = undoConfig.Contrast;
          this.config.Saturation = undoConfig.Saturation;
          this.config.Vibrance = undoConfig.Vibrance;  
        }
        // console.log("this is inside undo: ", undoConfig);
        // console.log("inside configHistory: ", this.configHistory);
      }
    } 
  }

  async redo(): Promise<void> {
    if (this.configHistory.length >= 0) {
      const redoConfig = this.redoStack.pop();
      const nowConfig = this.redoStack.length >= 0 ? this.redoStack[this.redoStack.length - 1] : null;
      if (redoConfig) {
        this.configHistory.push(redoConfig);
        this.config.Exposure = redoConfig.Exposure;
        this.config.Temperature = redoConfig.Temperature;
        this.config.Tint = redoConfig.Tint;
        this.config.Highlights = redoConfig.Highlights;
        this.config.Shadow = redoConfig.Shadow;
        this.config.Blacks = redoConfig.Blacks;
        this.config.Whites = redoConfig.Whites;
        this.config.Contrast = redoConfig.Contrast;
        this.config.Saturation = redoConfig.Saturation;
        this.config.Vibrance = redoConfig.Vibrance;
      }
    }
  }

  reset(): void {
    // const mat = cv.imread(this.imgElement);
    this.configHistory = [
      {
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
      },
    ];
    this.redoStack = [];
    this.config.Exposure = 0;
    this.config.Temperature = 0;
    this.config.Tint = 0;
    this.config.Highlights = 0;
    this.config.Shadow = 0;
    this.config.Blacks = 0;
    this.config.Whites = 0;
    this.config.Contrast = 0;
    this.config.Saturation = 0;
    this.config.Vibrance = 0;

    this.listener?.onImageRendered(this.inputImage);
    this.listener?.onConfigChange(this.config);

    // mat.delete();
  }
}