import { HonchoEditor, Config, Listener, AdjustType } from "@/lib/HonchoEditor";
import cleanAndExecuteAdjustment from "@/lib/adjustExt/cleanAdjust";
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
    Black: 0,
    White: 0,
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
    console.log("type: ", type, "value: ", value);
    if (type == AdjustType.Exposure) {
        const currentExposure = this.config.Exposure;

        if (currentExposure !== value) {
          this.currentImageEdit = await cleanAndExecuteAdjustment(currentExposure, value, this.inputImage, this.currentImageEdit, modifyImageExposure);
        }
        // Update value exposure publish to UI
        this.config.Exposure = value;
    } else if (type == AdjustType.Temperature) {
        const currentTemperature = this.config.Temperature;

        if (currentTemperature !== value) {
          this.currentImageEdit = await cleanAndExecuteAdjustment(currentTemperature, value, this.inputImage, this.currentImageEdit, modifyImageTemperature);
        }
        this.config.Temperature = value;
    } else if (type == AdjustType.Tint) {
        const currentTint = this.config.Tint;

        if (currentTint !== value) {
          this.currentImageEdit = await cleanAndExecuteAdjustment(currentTint, value, this.inputImage, this.currentImageEdit, modifyImageTint);
        }

        this.config.Tint = value;
    } else if (type == AdjustType.Highlights) {
        const currentHighlights = this.config.Highlights;

        if (currentHighlights !== value) {
          this.currentImageEdit = await cleanAndExecuteAdjustment(this.config.Highlights, value, this.inputImage, this.currentImageEdit, modifyImageHighlights);
        }

        this.config.Highlights = value;
    } else if (type == AdjustType.Shadow) {
        const currentShadow = this.config.Shadow;

        if (currentShadow !== value) {
          this.currentImageEdit = await cleanAndExecuteAdjustment(this.config.Shadow, value, this.inputImage, this.currentImageEdit, modifyImageShadows);
        }

        this.config.Shadow = value;
    } else if (type == AdjustType.Blacks) {
        const currentBlack = this.config.Black;

        if (currentBlack !== value) {
          this.currentImageEdit = await cleanAndExecuteAdjustment(this.config.Black, value, this.inputImage, this.currentImageEdit, modifyImageBlacks);
        }

        this.config.Black = value;
    } else if (type == AdjustType.Whites) {
        const currentWhite = this.config.White;

        if (currentWhite !== value) {
          this.currentImageEdit = await cleanAndExecuteAdjustment(this.config.White, value, this.inputImage, this.currentImageEdit, modifyImageWhites);
        }

        this.config.White = value;
    } else if (type == AdjustType.Contrast) {
        const currentContrast = this.config.Contrast;

        if (currentContrast !== value) {
          this.currentImageEdit = await cleanAndExecuteAdjustment(this.config.Contrast, value, this.inputImage, this.currentImageEdit, modifyImageContrast);
        }

        this.config.Contrast = value;
    } else if (type == AdjustType.Vibrance) {
        const currentVibrance = this.config.Vibrance;

        if (currentVibrance !== value) {
          this.currentImageEdit = await cleanAndExecuteAdjustment(this.config.Vibrance, value, this.inputImage, this.currentImageEdit, modifyImageVibrance);
        }

        this.config.Vibrance = value;
    } else if (type == AdjustType.Saturation) {
        const currentSaturation = this.config.Saturation;

        if (currentSaturation !== value) {
          this.currentImageEdit = await cleanAndExecuteAdjustment(this.config.Saturation, value, this.inputImage, this.currentImageEdit, modifyImageSaturation);
        }
        this.config.Saturation = value;
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
        Black: this.config.Black,
        White: this.config.White,
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
          this.config.Black = undoConfig.Black;
          this.config.White = undoConfig.White;
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
        this.config.Black = redoConfig.Black;
        this.config.White = redoConfig.White;
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
        Black: 0,
        White: 0,
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
    this.config.Black = 0;
    this.config.White = 0;
    this.config.Contrast = 0;
    this.config.Saturation = 0;
    this.config.Vibrance = 0;

    this.listener?.onImageRendered(this.inputImage);
    this.listener?.onConfigChange(this.config);

    // mat.delete();
  }
}