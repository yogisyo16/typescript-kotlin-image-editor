import { HonchoEditor, Config, Listener, AdjustType } from "@/lib/HonchoEditor";
import openCVAdjustments from "@/lib/openCVAdjustment";
import cleanAndExecuteAdjustment from "@/lib/adjustExt/adjustExt";
import cv from "@techstark/opencv-js";
import { useState } from "react";
import { applyAllAdjustments } from "./adjustExt/deltaLogic";

// Hook to manage and setup OpenCV
export function useOpenCV() {
  const [isCvLoaded, setIsCvLoaded] = useState(false);
  const [imageLoaded] = useState(false);

  const onOpenCVLoad = () => {
    setIsCvLoaded(true);
  };

  return {
    isCvLoaded,
    imageLoaded,
    onOpenCVLoad
  };
}

export class HonchoEditorClass implements HonchoEditor {
  // CV.Mat for inputImage
  private inputImage: cv.Mat;
  // CV.Mat for currentImageEdit
  private currentImageEdit: cv.Mat;
  //Listener
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
  // Stack to save the previous state
  private configHistory: Config[] = [];
  // Stack for redo
  private redoStack: Config[] = [];

  // Constructor to setup the editor
  constructor(inputImage: cv.Mat, listener: Listener) {
    this.inputImage = inputImage.clone();
    this.currentImageEdit = this.inputImage.clone();
    this.configHistory.push({ ...this.config });
    this.listener = listener;
  }

  // Sync Socket (Later be use on)
  async syncConfig(serverConfig: Config[]): Promise<void> {
    // configHistory get from server
    this.configHistory = serverConfig;

    this.config = serverConfig[serverConfig.length - 1];

    await this.applyConfig();
  }

  // Function for first adjustment image
  async adjust(type: AdjustType, score: number): Promise<void> {
      // AdjustType Checking
    if (type == AdjustType.Exposure) {

      // Applying adjustment, that taking from adjustment type
      this.currentImageEdit = await cleanAndExecuteAdjustment(this.config.Exposure, score, this.inputImage, this.currentImageEdit, openCVAdjustments.modifyImageExposure);
      
      // Update for adjustment in UI
      this.config.Exposure = score;

      // AdjustType Checking
    } else if (type == AdjustType.Temperature) {

      // Applying adjustment, that taking from adjustment type
      this.currentImageEdit = await cleanAndExecuteAdjustment(this.config.Temperature, score, this.inputImage, this.currentImageEdit, openCVAdjustments.modifyImageTemperature);

      // Update for adjustment in UI
      this.config.Temperature = score;

      // AdjustType Checking
    } else if (type == AdjustType.Tint) {

      // Applying adjustment, that taking from adjustment type
      this.currentImageEdit = await cleanAndExecuteAdjustment(this.config.Tint, score, this.inputImage, this.currentImageEdit, openCVAdjustments.modifyImageTint);

      // Update for adjustment in UI
      this.config.Tint = score;

      // AdjustType Checking
    } else if (type == AdjustType.Contrast) {

      // Applying adjustment, that taking from adjustment type
      this.currentImageEdit = await cleanAndExecuteAdjustment(this.config.Contrast, score, this.inputImage, this.currentImageEdit, openCVAdjustments.modifyImageContrast);

      // Update for adjustment in UI
      this.config.Contrast = score;

      // AdjustType Checking
    } else if (type == AdjustType.Highlights) {

      // Applying adjustment, that taking from adjustment type
      this.currentImageEdit = await cleanAndExecuteAdjustment(this.config.Highlights, score, this.inputImage, this.currentImageEdit, openCVAdjustments.modifyImageHighlights);

      // Update for adjustment in UI
      this.config.Highlights = score;

      // AdjustType Checking
    } else if (type == AdjustType.Shadow) {

      // Applying adjustment, that taking from adjustment type
      this.currentImageEdit = await cleanAndExecuteAdjustment(this.config.Shadow, score, this.inputImage, this.currentImageEdit, openCVAdjustments.modifyImageShadows);

      // Update for adjustment in UI
      this.config.Shadow = score;

      // AdjustType Checking
    } else if (type == AdjustType.Blacks) {

      // Applying adjustment, that taking from adjustment type
      this.currentImageEdit = await cleanAndExecuteAdjustment(this.config.Blacks, score, this.inputImage, this.currentImageEdit, openCVAdjustments.modifyImageBlacks);

      // Update for adjustment in UI
      this.config.Blacks = score;

      // AdjustType Checking
    } else if (type == AdjustType.Whites) {

      // Applying adjustment, that taking from adjustment type
      this.currentImageEdit = await cleanAndExecuteAdjustment(this.config.Whites, score, this.inputImage, this.currentImageEdit, openCVAdjustments.modifyImageWhites);

      // Update for adjustment in UI
      this.config.Whites = score;

      // AdjustType Checking
    } else if (type == AdjustType.Saturation) {

      // Applying adjustment, that taking from adjustment type
      this.currentImageEdit = await cleanAndExecuteAdjustment(this.config.Saturation, score, this.inputImage, this.currentImageEdit, openCVAdjustments.modifyImageSaturation);

      // Update for adjustment in UI
      this.config.Saturation = score;

      // AdjustType Checking
    } else if (type == AdjustType.Vibrance) {

      // Applying adjustment, that taking from adjustment type
      this.currentImageEdit = await cleanAndExecuteAdjustment(this.config.Vibrance, score, this.inputImage, this.currentImageEdit, openCVAdjustments.modifyImageVibrance);

      // Update for adjustment in UI
      this.config.Vibrance = score;
    }
    
    this.listener?.onImageRendered(this.currentImageEdit);
    this.listener?.onConfigChange(this.config);
    this.configHistotrypush();

    console.debug("Config History: ", this.configHistory);
    console.debug("Config Now: ", this.config);
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
    if (this.configHistory.length > 1) {
        const currentState = this.configHistory.pop();
        if (currentState) {
            this.redoStack.push(currentState);
        }

        const previousState = this.configHistory[this.configHistory.length - 1];
        this.config = { ...previousState };

        await this.applyConfig();
        
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

            await this.applyConfig();
        }
    } else {
        console.error("Cannot redo. At latest state.");
    }
  }

  async reset(): Promise<void> {
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

  private async applyConfig(): Promise<void> {
      // Re-apply all adjustments from the previous state
      const undoneImage = await applyAllAdjustments(this.inputImage, this.config);

      // Clean up the old image matrix and assign the new one
      if (this.currentImageEdit) this.currentImageEdit.delete();
      this.currentImageEdit = undoneImage;

      // Notify listeners to update the UI
      this.listener?.onImageRendered(this.currentImageEdit);
      this.listener?.onConfigChange(this.config);
  }
}