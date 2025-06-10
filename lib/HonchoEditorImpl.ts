import { HonchoEditor, Config, Listener, AdjustType } from "@/lib/HonchoEditor";
import applyAllAdjustments from "@/lib/adjustExt/deltaLogic"; 
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
import openCVAdjustments from "@/lib/openCVAdjustment";
import cleanAndExecuteAdjustment from "@/lib/adjustExt/adjustExt";
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
  private currentImageEdit: cv.Mat;
  private listener: Listener | null = null;
  // Config variable score
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
    this.currentImageEdit = this.inputImage.clone();
    this.configHistory.push({ ...this.config });
    this.listener = listener;
  }

  // Getter for config
  public getConfig(): Config {
    return { ...this.config };
  }

  // Setter for individual config scores
  public setConfigscore(key: keyof Config, score: number): void {
    this.config = { ...this.config, [key]: score };
  }

  consume(serverConfig: Config[]): string {
    throw Error("Not implemented");
  }

  onImageUpdate(inputImage: cv.Mat): cv.Mat {
    return inputImage.clone();
  }

  async adjust(type: AdjustType, score: number): Promise<void> {
    if (type == AdjustType.Exposure) {
      this.currentImageEdit = await cleanAndExecuteAdjustment(this.config.Exposure, score, this.inputImage, this.currentImageEdit, openCVAdjustments.modifyImageExposure);
      
      // Update score exposure publish to UI
      this.config.Exposure = score;
  } else if (type == AdjustType.Temperature) {
    this.currentImageEdit = await cleanAndExecuteAdjustment(this.config.Temperature, score, this.inputImage, this.currentImageEdit, openCVAdjustments.modifyImageTemperature);

      this.config.Temperature = score;
  } else if (type == AdjustType.Tint) {
      this.currentImageEdit = await cleanAndExecuteAdjustment(this.config.Tint, score, this.inputImage, this.currentImageEdit, openCVAdjustments.modifyImageTint);

      this.config.Tint = score;
  } else if (type == AdjustType.Contrast) {
      this.currentImageEdit = await cleanAndExecuteAdjustment(this.config.Contrast, score, this.inputImage, this.currentImageEdit, openCVAdjustments.modifyImageContrast);

      this.config.Contrast = score;
  } else if (type == AdjustType.Highlights) {
      this.currentImageEdit = await cleanAndExecuteAdjustment(this.config.Highlights, score, this.inputImage, this.currentImageEdit, openCVAdjustments.modifyImageHighlights);

      this.config.Highlights = score;
  } else if (type == AdjustType.Shadow) {
      this.currentImageEdit = await cleanAndExecuteAdjustment(this.config.Shadow, score, this.inputImage, this.currentImageEdit, openCVAdjustments.modifyImageShadows);

      this.config.Shadow = score;
  } else if (type == AdjustType.Blacks) {
      this.currentImageEdit = await cleanAndExecuteAdjustment(this.config.Blacks, score, this.inputImage, this.currentImageEdit, openCVAdjustments.modifyImageBlacks);

      this.config.Blacks = score;
  } else if (type == AdjustType.Whites) {
      this.currentImageEdit = await cleanAndExecuteAdjustment(this.config.Whites, score, this.inputImage, this.currentImageEdit, openCVAdjustments.modifyImageWhites);

      this.config.Whites = score;
  } else if (type == AdjustType.Saturation) {
      this.currentImageEdit = await cleanAndExecuteAdjustment(this.config.Saturation, score, this.inputImage, this.currentImageEdit, openCVAdjustments.modifyImageSaturation);

      this.config.Saturation = score;
  } else if (type == AdjustType.Vibrance) {
      this.currentImageEdit = await cleanAndExecuteAdjustment(this.config.Vibrance, score, this.inputImage, this.currentImageEdit, openCVAdjustments.modifyImageVibrance);

      this.config.Vibrance = score;
  }
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
        { score: this.config.Exposure, func: modifyImageExposure, name: "Exposure" },
        { score: this.config.Contrast, func: modifyImageContrast, name: "Contrast" },
        { score: this.config.Highlights, func: modifyImageHighlights, name: "Highlights" },
        { score: this.config.Shadow, func: modifyImageShadows, name: "Shadows" },
        { score: this.config.Whites, func: modifyImageWhites, name: "Whites" },
        { score: this.config.Blacks, func: modifyImageBlacks, name: "Blacks" },
        { score: this.config.Temperature, func: modifyImageTemperature, name: "Temperature" },
        { score: this.config.Tint, func: modifyImageTint, name: "Tint" },
        { score: this.config.Vibrance, func: modifyImageVibrance, name: "Vibrance" },
        { score: this.config.Saturation, func: modifyImageSaturation, name: "Saturation" },
      ];
      
      const undoneImage = await applyAllAdjustments(this.inputImage, adjustmentPipeline);
      
      if (this.currentImageEdit) this.currentImageEdit.delete();
      this.currentImageEdit = undoneImage;

      this.listener?.onImageRendered(this.currentImageEdit);
      this.listener?.onConfigChange(this.config);

    } else {
      console.error("Cannot undo. At original state.");
    }
  }

  async redo(): Promise<void> {
    if (this.redoStack.length > 0) {
      const redoState = this.redoStack.pop();
      if (redoState) {
        this.configHistory.push(redoState);
        this.config = { ...redoState };

        const adjustmentPipeline = [
          { score: this.config.Exposure, func: modifyImageExposure, name: "Exposure" },
          { score: this.config.Contrast, func: modifyImageContrast, name: "Contrast" },
          { score: this.config.Highlights, func: modifyImageHighlights, name: "Highlights" },
          { score: this.config.Shadow, func: modifyImageShadows, name: "Shadows" },
          { score: this.config.Whites, func: modifyImageWhites, name: "Whites" },
          { score: this.config.Blacks, func: modifyImageBlacks, name: "Blacks" },
          { score: this.config.Temperature, func: modifyImageTemperature, name: "Temperature" },
          { score: this.config.Tint, func: modifyImageTint, name: "Tint" },
          { score: this.config.Vibrance, func: modifyImageVibrance, name: "Vibrance" },
          { score: this.config.Saturation, func: modifyImageSaturation, name: "Saturation" },
        ];

        const redoneImage = await applyAllAdjustments(this.inputImage, adjustmentPipeline);
        if (this.currentImageEdit) this.currentImageEdit.delete();
        this.currentImageEdit = redoneImage;

        this.listener?.onImageRendered(this.currentImageEdit);
        this.listener?.onConfigChange(this.config);
      }
    } else {
      console.error("Cannot redo. At latest state.");
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
  }
}