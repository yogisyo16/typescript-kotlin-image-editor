import React from "react";
import { HonchoEditor, Config, Listener, AdjustType } from "@/lib/HonchoEditor";
import cv from "@techstark/opencv-js";
import { useState, MouseEvent } from "react";
import { debounce } from "lodash"; // Not yet to be used

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

  setListener(listener: Listener) {
    this.listener = listener;
  }

  consume(serverConfig: Config[]): string {
    throw Error("Not implemented");
    // return "Configs consumed";
  }

  onImageUpdate(inputImage: cv.Mat): cv.Mat {
    return inputImage.clone(); // Clone to avoid modifying the input
  }

  adjust(type: AdjustType, value: number): void {
    if (type == AdjustType.Exposure) {
      this.modify_image_exposure()
    }
  }

  // -- From kotlin to use bitmap, is not used for web (SEMANGAT GES yang andro dan ios)
  // private async renderToCanvas(mat: cv.Mat): Promise<void> {
  //   cv.imshow(this.canvasElement, mat);
  //   const bitmap = await createImageBitmap(this.canvasElement);
  //   this.listener?.onImageRendered(bitmap);
  // }

  async modify_image_exposure(exposure: number): Promise<cv.Mat> {
    this.config.Exposure = exposure;
    const originalMat = this.inputImage.clone();
    
    // Ensure input is 3 channels (BGR) to avoid RGBA issues
    cv.cvtColor(originalMat, originalMat, cv.COLOR_BGRA2BGR);

    const originalHsvMat = new cv.Mat();
    cv.cvtColor(originalMat, originalHsvMat, cv.COLOR_BGR2HSV);

    const hsvChannels: cv.MatVector = new cv.MatVector();
    cv.split(originalHsvMat, hsvChannels);
    const hue = hsvChannels.get(0);

    let factor = 1.0;
    let beta = 0.0;
    if (this.config.Exposure > 0) {
      beta = 15 * this.config.Exposure;
      factor = Math.pow(2.0, this.config.Exposure / 2.2);
    } else {
      factor = Math.pow(2.0, this.config.Exposure / 1.5);
    }

    const imageFloat = new cv.Mat();
    originalMat.convertTo(imageFloat, cv.CV_64FC3);

    // Multiply by factor using a Mat
    const factorMat = new cv.Mat(imageFloat.rows, imageFloat.cols, cv.CV_64FC3, new cv.Scalar(factor, factor, factor));
    cv.multiply(imageFloat, factorMat, imageFloat);

    // Create a Mat for max value (255) instead of Scalar
    const maxMat = new cv.Mat(imageFloat.rows, imageFloat.cols, cv.CV_64FC3, new cv.Scalar(255, 255, 255));
    cv.min(imageFloat, maxMat, imageFloat);
    imageFloat.convertTo(originalMat, cv.CV_8UC3);

    const adjustedMat = new cv.Mat();
    cv.convertScaleAbs(originalMat, adjustedMat, 1.0, beta);

    const finalHSV = new cv.Mat();
    cv.cvtColor(adjustedMat, finalHSV, cv.COLOR_BGR2HSV);
    const finalHsvChannels = new cv.MatVector();
    cv.split(finalHSV, finalHsvChannels);

    const sTemp = finalHsvChannels.get(1);
    const vTemp = finalHsvChannels.get(2);

    const mergedHsv = new cv.MatVector();
    mergedHsv.push_back(hue);
    mergedHsv.push_back(sTemp);
    mergedHsv.push_back(vTemp);
    cv.merge(mergedHsv, finalHSV);

    cv.cvtColor(finalHSV, finalHSV, cv.COLOR_HSV2BGR);

    // Clean up
    originalHsvMat.delete();
    hsvChannels.delete();
    imageFloat.delete();
    factorMat.delete();
    maxMat.delete();
    adjustedMat.delete();
    finalHsvChannels.delete();
    mergedHsv.delete();

    // debugging for config value
    // console.log("Exposure Value: ", exposure);
    return finalHSV;
  }

  private sigmoid(input: cv.Mat, k: number, x0: number, numerator: number = 1.5): cv.Mat {
    const result = new cv.Mat(input.rows, input.cols, cv.CV_32F);
    let oneMat = new cv.Mat(input.rows, input.cols, cv.CV_32F, new cv.Scalar(1));

    if (input.channels() === 3) {
      oneMat = new cv.Mat(input.rows, input.cols, cv.CV_32FC3, new cv.Scalar(1, 1, 1));
      const x0Mat = new cv.Mat(input.rows, input.cols, cv.CV_32FC3, new cv.Scalar(x0, x0, x0));
      cv.subtract(input, x0Mat, result);
      const kMat = new cv.Mat(input.rows, input.cols, cv.CV_32FC3, new cv.Scalar(-k, -k, -k));
      cv.multiply(result, kMat, result);
      cv.exp(result, result);
      cv.add(result, oneMat, result);
      x0Mat.delete();
      kMat.delete();
    } else {
      const x0Mat = new cv.Mat(input.rows, input.cols, cv.CV_32F, new cv.Scalar(x0));
      cv.subtract(input, x0Mat, result);
      const kMat = new cv.Mat(input.rows, input.cols, cv.CV_32F, new cv.Scalar(-k));
      cv.multiply(result, kMat, result);
      cv.exp(result, result);
      cv.add(result, oneMat, result);
      x0Mat.delete();
      kMat.delete();
    }

    let scalarMat = new cv.Mat(input.rows, input.cols, cv.CV_32F, new cv.Scalar(1));
    if (input.channels() === 3) {
      scalarMat = new cv.Mat(input.rows, input.cols, cv.CV_32FC3, new cv.Scalar(numerator, numerator, numerator));
    } else {
      const numeratorMat = new cv.Mat(scalarMat.rows, scalarMat.cols, cv.CV_32F, new cv.Scalar(numerator));
      cv.multiply(scalarMat, numeratorMat, scalarMat);
      numeratorMat.delete();
    }

    cv.divide(scalarMat, result, result);

    oneMat.delete();
    scalarMat.delete();
    return result;
  }

  // -- coolTemperature for Temperature
  private async boostCoolTemperature(
  temperatureScore: number,
  originalMat: cv.Mat,
  lumScalingFactor: cv.Mat
): Promise<cv.Mat> {
  const adjustedTemp = temperatureScore * -1.0; // Reduced scaling factor from 1.684 to 1.0 for subtler effect

  // Initialize scale matrices
  const redScale = cv.Mat.ones(lumScalingFactor.rows, lumScalingFactor.cols, cv.CV_32F);
  const greenScale = cv.Mat.ones(lumScalingFactor.rows, lumScalingFactor.cols, cv.CV_32F);
  const blueScale = cv.Mat.ones(lumScalingFactor.rows, lumScalingFactor.cols, cv.CV_32F);

  const redAdjustment = cv.Mat.ones(redScale.size(), cv.CV_32F);
  const greenAdjustment = cv.Mat.ones(greenScale.size(), cv.CV_32F);
  const blueAdjustment = cv.Mat.ones(blueScale.size(), cv.CV_32F);

  // Apply adjustments to scales (cool: boost blue, reduce red/green)
  const redScalarMat = cv.Mat.ones(redAdjustment.size(), cv.CV_32F);
  redScalarMat.setTo(cv.Scalar.all(adjustedTemp * 0.005)); // Reduced from 0.01 to 0.005
  cv.multiply(redAdjustment, redScalarMat, redAdjustment);
  cv.multiply(redAdjustment, lumScalingFactor, redAdjustment);
  cv.subtract(redScale, redAdjustment, redScale);

  const greenScalarMat = cv.Mat.ones(greenAdjustment.size(), cv.CV_32F);
  greenScalarMat.setTo(cv.Scalar.all(adjustedTemp * 0.005)); // Reduced from 0.01 to 0.005
  cv.multiply(greenAdjustment, greenScalarMat, greenAdjustment);
  cv.multiply(greenAdjustment, lumScalingFactor, greenAdjustment);
  cv.subtract(greenScale, greenAdjustment, greenScale);

  const blueScalarMat = cv.Mat.ones(blueAdjustment.size(), cv.CV_32F);
  blueScalarMat.setTo(cv.Scalar.all(adjustedTemp * 0.02)); // Reduced from 0.04 to 0.02
  cv.multiply(blueAdjustment, blueScalarMat, blueAdjustment);
  cv.multiply(blueAdjustment, lumScalingFactor, blueAdjustment);
  cv.add(blueScale, blueAdjustment, blueScale);

  // Split and process channels
  const channels = new cv.MatVector();
  cv.split(originalMat, channels);

  const ch0 = channels.get(0).clone(); // Blue
  const ch1 = channels.get(1).clone(); // Green
  const ch2 = channels.get(2).clone(); // Red
  ch0.convertTo(ch0, cv.CV_32F);
  ch1.convertTo(ch1, cv.CV_32F);
  ch2.convertTo(ch2, cv.CV_32F);

  cv.multiply(ch2, redScale, ch2);
  cv.multiply(ch1, greenScale, ch1);
  cv.multiply(ch0, blueScale, ch0);

  // Clone channels for final merge
  const curRedChannels = ch2.clone();
  const curGreenChannels = ch1.clone();
  curRedChannels.convertTo(curRedChannels, cv.CV_8U);
  curGreenChannels.convertTo(curGreenChannels, cv.CV_8U);

  // Merge channels
  const matVector = new cv.MatVector();
  matVector.push_back(ch0);
  matVector.push_back(ch1);
  matVector.push_back(ch2);
  cv.merge(matVector, originalMat);
  originalMat.convertTo(originalMat, cv.CV_8U);

  // LAB color space adjustments for b channel
  const labMat = new cv.Mat();
  cv.cvtColor(originalMat, labMat, cv.COLOR_BGR2Lab);

  const labChannels = new cv.MatVector();
  cv.split(labMat, labChannels);

  const bChannel = labChannels.get(2).clone();
  bChannel.convertTo(bChannel, cv.CV_32F);
  const bNorm = new cv.Mat();
  const scalarMat255 = cv.Mat.ones(bChannel.size(), cv.CV_32F);
  scalarMat255.setTo(cv.Scalar.all(255.0));
  cv.divide(bChannel, scalarMat255, bNorm);

  const bLabScalingFactor = this.sigmoid(bNorm, 8.0, 0.6, 2.5);
  const bScale = cv.Mat.ones(bLabScalingFactor.rows, bLabScalingFactor.cols, cv.CV_32F);
  const bAdjustment = cv.Mat.ones(bScale.rows, bScale.cols, cv.CV_32F);

  const bScalarMat = cv.Mat.ones(bAdjustment.size(), cv.CV_32F);
  bScalarMat.setTo(cv.Scalar.all(adjustedTemp / 145.0));
  cv.multiply(bAdjustment, bScalarMat, bAdjustment);
  cv.multiply(bAdjustment, bLabScalingFactor, bAdjustment);
  cv.add(bScale, bAdjustment, bScale); // Increase b for cooler tones

  const labCh2 = labChannels.get(2);
  labCh2.convertTo(labCh2, cv.CV_32F);
  bScale.convertTo(bScale, cv.CV_32F);
  cv.multiply(labCh2, bScale, labCh2);
  labCh2.convertTo(labCh2, cv.CV_8U);

  cv.merge(labChannels, labMat);
  cv.cvtColor(labMat, originalMat, cv.COLOR_Lab2BGR);

  // Final channel adjustments
  const finalChannels = new cv.MatVector();
  cv.split(originalMat, finalChannels);
  finalChannels.set(2, curRedChannels.clone());
  finalChannels.set(1, curGreenChannels.clone());

  cv.merge(finalChannels, originalMat);
  originalMat.convertTo(originalMat, cv.CV_8U);

  // Cleanup
  redScale.delete();
  greenScale.delete();
  blueScale.delete();
  redAdjustment.delete();
  greenAdjustment.delete();
  blueAdjustment.delete();
  redScalarMat.delete();
  greenScalarMat.delete();
  blueScalarMat.delete();
  ch0.delete();
  ch1.delete();
  ch2.delete();
  curRedChannels.delete();
  curGreenChannels.delete();
  labMat.delete();
  bChannel.delete();
  bNorm.delete();
  bLabScalingFactor.delete();
  bScale.delete();
  bAdjustment.delete();
  bScalarMat.delete();
  scalarMat255.delete();
  matVector.delete();
  labChannels.delete();
  finalChannels.delete();
  channels.delete();

  return originalMat;
  }
  
  // -- warmTemparture for Temperature
  private async boostWarmTemperature(
    temperatureScore: number,
    originalMat: cv.Mat,
    lumScalingFactor: cv.Mat
  ): Promise<cv.Mat> {
    const adjustedTemp = temperatureScore * 1.684; // Match tint scaling
  
    // Initialize scale matrices
    const redScale = cv.Mat.ones(lumScalingFactor.rows, lumScalingFactor.cols, cv.CV_32F);
    const greenScale = cv.Mat.ones(lumScalingFactor.rows, lumScalingFactor.cols, cv.CV_32F);
    const blueScale = cv.Mat.ones(lumScalingFactor.rows, lumScalingFactor.cols, cv.CV_32F);
  
    const redAdjustment = cv.Mat.ones(redScale.size(), cv.CV_32F);
    const greenAdjustment = cv.Mat.ones(greenScale.size(), cv.CV_32F);
    const blueAdjustment = cv.Mat.ones(blueScale.size(), cv.CV_32F);
  
    // Apply adjustments to scales (warm: boost red/green, reduce blue)
    const redScalarMat = cv.Mat.ones(redAdjustment.size(), cv.CV_32F);
    redScalarMat.setTo(cv.Scalar.all(adjustedTemp * 0.018));
    cv.multiply(redAdjustment, redScalarMat, redAdjustment);
    cv.multiply(redAdjustment, lumScalingFactor, redAdjustment);
    cv.add(redScale, redAdjustment, redScale);
  
    const greenScalarMat = cv.Mat.ones(greenAdjustment.size(), cv.CV_32F);
    greenScalarMat.setTo(cv.Scalar.all(adjustedTemp * 0.006));
    cv.multiply(greenAdjustment, greenScalarMat, greenAdjustment);
    cv.multiply(greenAdjustment, lumScalingFactor, greenAdjustment);
    cv.add(greenScale, greenAdjustment, greenScale);
  
    const blueScalarMat = cv.Mat.ones(blueAdjustment.size(), cv.CV_32F);
    blueScalarMat.setTo(cv.Scalar.all(adjustedTemp * 0.04));
    cv.multiply(blueAdjustment, blueScalarMat, blueAdjustment);
    cv.multiply(blueAdjustment, lumScalingFactor, blueAdjustment);
    cv.subtract(blueScale, blueAdjustment, blueScale);
  
    // Split and process channels
    const channels = new cv.MatVector();
    cv.split(originalMat, channels);
  
    const ch0 = channels.get(0).clone(); // Blue
    const ch1 = channels.get(1).clone(); // Green
    const ch2 = channels.get(2).clone(); // Red
    ch0.convertTo(ch0, cv.CV_32F);
    ch1.convertTo(ch1, cv.CV_32F);
    ch2.convertTo(ch2, cv.CV_32F);
  
    cv.multiply(ch2, redScale, ch2);
    cv.multiply(ch1, greenScale, ch1);
    cv.multiply(ch0, blueScale, ch0);
  
    // Clone channels for final merge
    const curRedChannels = ch2.clone();
    const curGreenChannels = ch1.clone();
    curRedChannels.convertTo(curRedChannels, cv.CV_8U);
    curGreenChannels.convertTo(curGreenChannels, cv.CV_8U);
  
    // Merge channels
    const matVector = new cv.MatVector();
    matVector.push_back(ch0);
    matVector.push_back(ch1);
    matVector.push_back(ch2);
    cv.merge(matVector, originalMat);
    originalMat.convertTo(originalMat, cv.CV_8U);
  
    // LAB color space adjustments for a channel
    const labMat = new cv.Mat();
    cv.cvtColor(originalMat, labMat, cv.COLOR_BGR2Lab);
  
    const labChannels = new cv.MatVector();
    cv.split(labMat, labChannels);
  
    const aChannel = labChannels.get(1).clone();
    aChannel.convertTo(aChannel, cv.CV_32F);
    const aNorm = new cv.Mat();
    const scalarMat255 = cv.Mat.ones(aChannel.size(), cv.CV_32F);
    scalarMat255.setTo(cv.Scalar.all(255.0));
    cv.divide(aChannel, scalarMat255, aNorm);
  
    const aLabScalingFactor = this.sigmoid(aNorm, 8.0, 0.6, 2.5);
    const aScale = cv.Mat.ones(aLabScalingFactor.rows, aLabScalingFactor.cols, cv.CV_32F);
    const aAdjustment = cv.Mat.ones(aScale.rows, aScale.cols, cv.CV_32F);
  
    const aScalarMat = cv.Mat.ones(aAdjustment.size(), cv.CV_32F);
    aScalarMat.setTo(cv.Scalar.all(adjustedTemp / 145.0));
    cv.multiply(aAdjustment, aScalarMat, aAdjustment);
    cv.multiply(aAdjustment, aLabScalingFactor, aAdjustment);
    cv.add(aScale, aAdjustment, aScale); // Increase a for warmer tones
  
    const labCh1 = labChannels.get(1);
    labCh1.convertTo(labCh1, cv.CV_32F);
    aScale.convertTo(aScale, cv.CV_32F);
    cv.multiply(labCh1, aScale, labCh1);
    labCh1.convertTo(labCh1, cv.CV_8U);
  
    cv.merge(labChannels, labMat);
    cv.cvtColor(labMat, originalMat, cv.COLOR_Lab2BGR);
  
    // Final channel adjustments
    const finalChannels = new cv.MatVector();
    cv.split(originalMat, finalChannels);
    finalChannels.set(2, curRedChannels.clone());
    finalChannels.set(1, curGreenChannels.clone());
  
    cv.merge(finalChannels, originalMat);
    originalMat.convertTo(originalMat, cv.CV_8U);
  
    // Cleanup
    redScale.delete();
    greenScale.delete();
    blueScale.delete();
    redAdjustment.delete();
    greenAdjustment.delete();
    blueAdjustment.delete();
    redScalarMat.delete();
    greenScalarMat.delete();
    blueScalarMat.delete();
    ch0.delete();
    ch1.delete();
    ch2.delete();
    curRedChannels.delete();
    curGreenChannels.delete();
    labMat.delete();
    aChannel.delete();
    aNorm.delete();
    aLabScalingFactor.delete();
    aScale.delete();
    aAdjustment.delete();
    aScalarMat.delete();
    scalarMat255.delete();
    matVector.delete();
    labChannels.delete();
    finalChannels.delete();
    channels.delete();
  
    return originalMat;
  }
  
  // -- Implement adjustment Termperature
  async modify_image_temperature(colorTemperature: number, inputImage: cv.Mat): Promise<cv.Mat> {
    this.config.Temperature = colorTemperature;
    const labImage = new cv.Mat();
    const originalMat = inputImage.clone();
  
    // Convert to BGR color space
    cv.cvtColor(originalMat, originalMat, cv.COLOR_BGRA2BGR);
    cv.cvtColor(originalMat, labImage, cv.COLOR_BGR2Lab);
  
    // Split LAB channels
    const labChannels = new cv.MatVector();
    cv.split(labImage, labChannels);
  
    // Extract the L (lightness) channel
    const lum = labChannels.get(0).clone();
    lum.convertTo(lum, cv.CV_32F);
    const lumNorm = new cv.Mat();
    const scalarMat255 = cv.Mat.ones(lum.size(), cv.CV_32F);
    scalarMat255.setTo(cv.Scalar.all(255.0));
    cv.divide(lum, scalarMat255, lumNorm);
  
    const dummyOnes = cv.Mat.ones(lum.rows, lum.cols, cv.CV_32F);
    const lumSub = new cv.Mat();
    cv.subtract(dummyOnes, lumNorm, lumSub);
    const lumScalingFactor = this.sigmoid(lumSub, 5.0, 0.5);
  
    const adjustedMat = this.config.Temperature >= 0
      ? await this.boostWarmTemperature(this.config.Temperature, originalMat, lumScalingFactor)
      : await this.boostCoolTemperature(this.config.Temperature, originalMat, lumScalingFactor);
  
    // Convert for display
    cv.cvtColor(adjustedMat, adjustedMat, cv.COLOR_BGR2RGB);
    const result = adjustedMat.clone();
  
    // Cleanup
    labImage.delete();
    originalMat.delete();
    lum.delete();
    lumNorm.delete();
    dummyOnes.delete();
    lumSub.delete();
    lumScalingFactor.delete();
    scalarMat255.delete();
    labChannels.delete();
  
    return result;
  }

  // -- Magenta (purple lah ya) for Tint
  private boostMagenta(tintScale: number, originalMat: cv.Mat, lumScalingFactor: cv.Mat): cv.Mat {
    const adjustedTint = tintScale * 1.684;

    const redScale = cv.Mat.ones(lumScalingFactor.rows, lumScalingFactor.cols, cv.CV_32F);
    const greenScale = cv.Mat.ones(lumScalingFactor.rows, lumScalingFactor.cols, cv.CV_32F);
    const blueScale = cv.Mat.ones(lumScalingFactor.rows, lumScalingFactor.cols, cv.CV_32F);

    const redAdjustment = cv.Mat.ones(redScale.size(), redScale.type());
    const greenAdjustment = cv.Mat.ones(greenScale.size(), greenScale.type());
    const blueAdjustment = cv.Mat.ones(blueScale.size(), blueScale.type());

    const redScalarMat = cv.Mat.ones(redAdjustment.size(), cv.CV_32F);
    redScalarMat.setTo(cv.Scalar.all(adjustedTint * 0.018));
    cv.multiply(redAdjustment, redScalarMat, redAdjustment);
    cv.multiply(redAdjustment, lumScalingFactor, redAdjustment);
    cv.add(redScale, redAdjustment, redScale);

    const greenScalarMat = cv.Mat.ones(greenAdjustment.size(), cv.CV_32F);
    greenScalarMat.setTo(cv.Scalar.all(adjustedTint * 0.006));
    cv.multiply(greenAdjustment, greenScalarMat, greenAdjustment);
    cv.multiply(greenAdjustment, lumScalingFactor, greenAdjustment);
    cv.subtract(greenScale, greenAdjustment, greenScale);

    const blueScalarMat = cv.Mat.ones(blueAdjustment.size(), cv.CV_32F);
    blueScalarMat.setTo(cv.Scalar.all(adjustedTint * 0.04));
    cv.multiply(blueAdjustment, blueScalarMat, blueAdjustment);
    cv.multiply(blueAdjustment, lumScalingFactor, blueAdjustment);
    cv.add(blueScale, blueAdjustment, blueScale);

    const channels = new cv.MatVector();
    cv.split(originalMat, channels);

    const ch0 = channels.get(0);
    const ch1 = channels.get(1);
    const ch2 = channels.get(2);
    ch0.convertTo(ch0, cv.CV_32F);
    ch1.convertTo(ch1, cv.CV_32F);
    ch2.convertTo(ch2, cv.CV_32F);

    cv.multiply(ch2, redScale, ch2);
    cv.multiply(ch1, greenScale, ch1);
    cv.multiply(ch0, blueScale, ch0);

    const curRedChannels = ch2.clone();
    curRedChannels.convertTo(curRedChannels, cv.CV_8U);
    const curGreenChannels = ch1.clone();
    curGreenChannels.convertTo(curGreenChannels, cv.CV_8U);

    const matVector = new cv.MatVector();
    matVector.push_back(ch0);
    matVector.push_back(ch1);
    matVector.push_back(ch2);
    cv.merge(matVector, originalMat);
    originalMat.convertTo(originalMat, cv.CV_8U);

    const labMat = new cv.Mat();
    cv.cvtColor(originalMat, labMat, cv.COLOR_BGR2Lab);

    const labChannels = new cv.MatVector();
    cv.split(labMat, labChannels);

    const bChannel = labChannels.get(2).clone();
    bChannel.convertTo(bChannel, cv.CV_32F);
    const bNorm = new cv.Mat();
    const scalarMat255 = cv.Mat.ones(bChannel.size(), cv.CV_32F);
    scalarMat255.setTo(cv.Scalar.all(255.0));
    cv.divide(bChannel, scalarMat255, bNorm);

    const bLabScalingFactor = this.sigmoid(bNorm, 8.0, 0.6, 2.5);
    const bScale = cv.Mat.ones(bLabScalingFactor.rows, bLabScalingFactor.cols, cv.CV_32F);
    const bAdjustment = cv.Mat.ones(bScale.rows, bScale.cols, cv.CV_32F);

    const bScalarMat = cv.Mat.ones(bAdjustment.size(), cv.CV_32F);
    bScalarMat.setTo(cv.Scalar.all(adjustedTint / 145.0));
    cv.multiply(bAdjustment, bScalarMat, bAdjustment);
    cv.multiply(bAdjustment, bLabScalingFactor, bAdjustment);
    cv.subtract(bScale, bAdjustment, bScale);

    const labCh2 = labChannels.get(2);
    labCh2.convertTo(labCh2, cv.CV_32F);
    bScale.convertTo(bScale, cv.CV_32F);
    cv.multiply(labCh2, bScale, labCh2);
    labCh2.convertTo(labCh2, cv.CV_8U);

    cv.merge(labChannels, labMat);
    cv.cvtColor(labMat, originalMat, cv.COLOR_Lab2BGR);

    const finalChannels = new cv.MatVector();
    cv.split(originalMat, finalChannels);
    finalChannels.set(2, curRedChannels.clone());
    finalChannels.set(1, curGreenChannels.clone());

    cv.merge(finalChannels, originalMat);
    originalMat.convertTo(originalMat, cv.CV_8U);

    // Clean up
    redScale.delete();
    greenScale.delete();
    blueScale.delete();
    redAdjustment.delete();
    greenAdjustment.delete();
    blueAdjustment.delete();
    redScalarMat.delete();
    greenScalarMat.delete();
    blueScalarMat.delete();
    ch0.delete();
    ch1.delete();
    ch2.delete();
    curRedChannels.delete();
    curGreenChannels.delete();
    labMat.delete();
    bChannel.delete();
    bNorm.delete();
    bLabScalingFactor.delete();
    bScale.delete();
    bAdjustment.delete();
    bScalarMat.delete();
    scalarMat255.delete();
    matVector.delete();
    labChannels.delete();
    finalChannels.delete();

    return originalMat;
  }

  // -- Green Temperature for Tint
  private boostGreen(tintScale: number, originalMat: cv.Mat, lumScalingFactor: cv.Mat): cv.Mat {
    const adjustedTint = tintScale * -1.684;
    const tintAdj = tintScale * 3.7;

    const redScale = cv.Mat.ones(lumScalingFactor.rows, lumScalingFactor.cols, cv.CV_32F);
    const greenScale = cv.Mat.ones(lumScalingFactor.rows, lumScalingFactor.cols, cv.CV_32F);
    const blueScale = cv.Mat.ones(lumScalingFactor.rows, lumScalingFactor.cols, cv.CV_32F);

    const redAdjustment = cv.Mat.ones(redScale.size(), redScale.type());
    const greenAdjustment = cv.Mat.ones(greenScale.size(), greenScale.type());
    const blueAdjustment = cv.Mat.ones(blueScale.size(), blueScale.type());

    const redScalarMat = cv.Mat.ones(redAdjustment.size(), cv.CV_32F);
    redScalarMat.setTo(cv.Scalar.all(adjustedTint * 0.01));
    cv.multiply(redAdjustment, redScalarMat, redAdjustment);
    cv.multiply(redAdjustment, lumScalingFactor, redAdjustment);
    cv.add(redScale, redAdjustment, redScale);

    const greenScalarMat = cv.Mat.ones(greenAdjustment.size(), cv.CV_32F);
    greenScalarMat.setTo(cv.Scalar.all(adjustedTint * 0.05));
    cv.multiply(greenAdjustment, greenScalarMat, greenAdjustment);
    cv.multiply(greenAdjustment, lumScalingFactor, greenAdjustment);
    cv.add(greenScale, greenAdjustment, greenScale);

    const blueScalarMat = cv.Mat.ones(blueAdjustment.size(), cv.CV_32F);
    blueScalarMat.setTo(cv.Scalar.all(adjustedTint * 0.01));
    cv.multiply(blueAdjustment, blueScalarMat, blueAdjustment);
    cv.multiply(blueAdjustment, lumScalingFactor, blueAdjustment);
    cv.subtract(blueScale, blueAdjustment, blueScale);

    const channels = new cv.MatVector();
    cv.split(originalMat, channels);

    const ch0 = channels.get(0);
    const ch1 = channels.get(1);
    const ch2 = channels.get(2);
    ch0.convertTo(ch0, cv.CV_32F);
    ch1.convertTo(ch1, cv.CV_32F);
    ch2.convertTo(ch2, cv.CV_32F);

    cv.multiply(ch2, redScale, ch2);
    cv.multiply(ch1, greenScale, ch1);
    cv.multiply(ch0, blueScale, ch0);

    const curBlueChannels = ch0.clone();
    curBlueChannels.convertTo(curBlueChannels, cv.CV_8U);
    const curRedChannels = ch2.clone();
    curRedChannels.convertTo(curRedChannels, cv.CV_8U);

    const matVector = new cv.MatVector();
    matVector.push_back(ch0);
    matVector.push_back(ch1);
    matVector.push_back(ch2);
    cv.merge(matVector, originalMat);
    originalMat.convertTo(originalMat, cv.CV_8U);

    const labMat = new cv.Mat();
    cv.cvtColor(originalMat, labMat, cv.COLOR_BGR2Lab);

    const labChannels = new cv.MatVector();
    cv.split(labMat, labChannels);

    const aChannel = labChannels.get(2).clone();
    aChannel.convertTo(aChannel, cv.CV_32F);
    const aNorm = new cv.Mat();
    const scalarMat255 = cv.Mat.ones(aChannel.size(), cv.CV_32F);
    scalarMat255.setTo(cv.Scalar.all(255.0));
    cv.divide(aChannel, scalarMat255, aNorm);

    const aLabScalingFactor = this.sigmoid(aNorm, 8.0, 0.8, 8.0);
    const aScale = cv.Mat.ones(aLabScalingFactor.rows, aLabScalingFactor.cols, cv.CV_32F);
    const aAdjustment = cv.Mat.ones(aScale.rows, aScale.cols, cv.CV_32F);

    const aScalarMat = cv.Mat.ones(aAdjustment.size(), cv.CV_32F);
    aScalarMat.setTo(cv.Scalar.all(-tintAdj / 100.0));
    cv.multiply(aAdjustment, aScalarMat, aAdjustment);
    cv.multiply(aAdjustment, aLabScalingFactor, aAdjustment);
    cv.subtract(aScale, aAdjustment, aScale);

    const labCh2 = labChannels.get(2);
    labCh2.convertTo(labCh2, cv.CV_32F);
    aScale.convertTo(aScale, cv.CV_32F);
    cv.multiply(labCh2, aScale, labCh2);
    labCh2.convertTo(labCh2, cv.CV_8U);

    cv.merge(labChannels, labMat);
    cv.cvtColor(labMat, originalMat, cv.COLOR_Lab2BGR);

    const finalChannels = new cv.MatVector();
    cv.split(originalMat, finalChannels);
    finalChannels.set(2, curRedChannels.clone());
    finalChannels.set(0, curBlueChannels.clone());

    cv.merge(finalChannels, originalMat);
    originalMat.convertTo(originalMat, cv.CV_8U);

    // Clean up
    redScale.delete();
    greenScale.delete();
    blueScale.delete();
    redAdjustment.delete();
    greenAdjustment.delete();
    blueAdjustment.delete();
    redScalarMat.delete();
    greenScalarMat.delete();
    blueScalarMat.delete();
    ch0.delete();
    ch1.delete();
    ch2.delete();
    curBlueChannels.delete();
    curRedChannels.delete();
    labMat.delete();
    aChannel.delete();
    aNorm.delete();
    aLabScalingFactor.delete();
    aScale.delete();
    aAdjustment.delete();
    aScalarMat.delete();
    scalarMat255.delete();
    matVector.delete();
    labChannels.delete();
    finalChannels.delete();

    return originalMat;
  }

  // -- Implement adjustment Tint
  async modify_image_tint(tint: number, inputImage: cv.Mat): Promise<cv.Mat> {
    this.config.Tint = tint;
    const labImage = new cv.Mat();
    const originalMat = inputImage.clone();
    tint = this.config.Tint / 10;
    cv.cvtColor(originalMat, originalMat, cv.COLOR_BGRA2BGR);
    cv.cvtColor(originalMat, labImage, cv.COLOR_BGR2Lab);

    const labChannels = new cv.MatVector();
    cv.split(labImage, labChannels);

    const lum = labChannels.get(0).clone();
    lum.convertTo(lum, cv.CV_32F);
    const lumNorm = new cv.Mat();
    const scalarMat255 = cv.Mat.ones(lum.size(), cv.CV_32F);
    scalarMat255.setTo(cv.Scalar.all(255.0));
    cv.divide(lum, scalarMat255, lumNorm);

    const dummyOnes = cv.Mat.ones(lum.rows, lum.cols, cv.CV_32F);
    const lumSub = new cv.Mat();
    cv.subtract(dummyOnes, lumNorm, lumSub);
    const lumScalingFactor = this.sigmoid(lumSub, 5.0, 0.5);

    const bChannel = labChannels.get(2).clone();
    bChannel.convertTo(bChannel, cv.CV_32F);
    const bNorm = new cv.Mat();
    const bScalarMat255 = cv.Mat.ones(bChannel.size(), cv.CV_32F);
    bScalarMat255.setTo(cv.Scalar.all(255.0));
    cv.divide(bChannel, bScalarMat255, bNorm);
    const bLabBoostFactor = this.sigmoid(bNorm, 11.0, 0.625, 8.0);

    const adjustedMat = tint >= 0
      ? await this.boostMagenta(tint, originalMat, lumScalingFactor)
      : await this.boostGreen(tint, originalMat, lumScalingFactor);

    // Clean up
    labImage.delete();
    lum.delete();
    lumNorm.delete();
    dummyOnes.delete();
    lumSub.delete();
    lumScalingFactor.delete();
    bChannel.delete();
    bNorm.delete();
    bLabBoostFactor.delete();
    scalarMat255.delete();
    bScalarMat255.delete();
    labChannels.delete();

    return adjustedMat;
  }

  // -- Low Channel for highlight
  private boostLowChannel(scaleRatio: number, originalMat: cv.Mat): cv.Mat {
    try {
      const adjustedImage = originalMat.clone();
      const highlightFactor = scaleRatio;

      const hsvImage = new cv.Mat();
      cv.cvtColor(adjustedImage, hsvImage, cv.COLOR_BGR2HSV);

      const channels = new cv.MatVector();
      cv.split(hsvImage, channels);
      const hue = channels.get(0);
      const saturation = channels.get(1);
      const value = channels.get(2);

      const scaledValue = new cv.Mat();
      cv.convertScaleAbs(value, scaledValue, 0.6 + highlightFactor * 0.4, 0);

      channels.set(2, scaledValue);

      cv.merge(channels, hsvImage);

      cv.cvtColor(hsvImage, adjustedImage, cv.COLOR_HSV2BGR);

      hsvImage.delete();
      channels.delete();
      scaledValue.delete();

      return adjustedImage;
    } catch (error) {
      console.error("Highlight boost failed:", error);
      return originalMat;
    }
  }
  
  // -- Implement adjustment Highlights
  async modify_image_highlights(highlight: number, inputImage: cv.Mat): Promise<cv.Mat> {
    try {
      const src = inputImage.clone();
      if (!src || src.empty()) {
        throw new Error("Input image is empty");
      }

      this.config.Highlights = highlight;

      const originalImage = new cv.Mat();
      cv.cvtColor(src, originalImage, cv.COLOR_RGB2BGR);

      const highlightFactor = this.config.Highlights / 100;

      const hsvImage = new cv.Mat();
      cv.cvtColor(originalImage, hsvImage, cv.COLOR_BGR2HSV);

      const channels = new cv.MatVector();
      cv.split(hsvImage, channels);
      const hue = channels.get(0);
      const saturation = channels.get(1);
      const value = channels.get(2);

      const scaledValue = new cv.Mat();
      if (highlightFactor >= 0) {
        cv.convertScaleAbs(value, scaledValue, 1 + highlightFactor * 0.7, 0);
      } else {
        cv.convertScaleAbs(value, scaledValue, 1 + highlightFactor * 0.5, 0);
      }

      channels.set(2, scaledValue);

      cv.merge(channels, hsvImage);

      let adjustedImage = new cv.Mat();
      cv.cvtColor(hsvImage, adjustedImage, cv.COLOR_HSV2BGR);

      if (highlightFactor >= 0) {
        const boostedImage = this.boostLowChannel(highlightFactor, adjustedImage);
        adjustedImage.delete();
        adjustedImage = boostedImage;
      }

      const finalImage = new cv.Mat();
      cv.cvtColor(adjustedImage, finalImage, cv.COLOR_BGR2RGB);

      src.delete();
      originalImage.delete();
      hsvImage.delete();
      channels.delete();
      scaledValue.delete();
      adjustedImage.delete();

      return finalImage;
    } catch (error) {
      console.error("Error in modify_image_highlights:", error);
      throw error;
    }
  }

  // -- Implement adjustment Shadows
  async modify_image_shadows(shadows: number, inputImage: cv.Mat): Promise<cv.Mat> {
    try {
      const src = inputImage.clone();
      if (!src || src.empty()) {
        throw new Error("Input image is empty");
      }

      const originalImage = new cv.Mat();
      cv.cvtColor(src, originalImage, cv.COLOR_RGB2BGR);

      // Map shadows (0 to 100) to a darkening factor (1 to 0)
      this.config.Shadow = shadows;
      const shadowFactor = 1 - (this.config.Shadow / -100); // 1 (no change) to 0 (max darkening)

      const hsvImage = new cv.Mat();
      cv.cvtColor(originalImage, hsvImage, cv.COLOR_BGR2HSV);

      const channels = new cv.MatVector();
      cv.split(hsvImage, channels);
      const hue = channels.get(0);
      const saturation = channels.get(1);
      const value = channels.get(2);

      const scaledValue = new cv.Mat();
      // Scale the value channel to darken the image
      cv.convertScaleAbs(value, scaledValue, shadowFactor, 0);

      channels.set(2, scaledValue);
      cv.merge(channels, hsvImage);

      let adjustedImage = new cv.Mat();
      cv.cvtColor(hsvImage, adjustedImage, cv.COLOR_HSV2BGR);

      const finalImage = new cv.Mat();
      cv.cvtColor(adjustedImage, finalImage, cv.COLOR_BGR2RGB);

      // Clean up
      src.delete();
      originalImage.delete();
      hsvImage.delete();
      channels.delete();
      scaledValue.delete();
      adjustedImage.delete();

      return finalImage;
    } catch (error) {
      console.error("Error in modify_image_shadows:", error);
      throw error;
    }
}

  // -- Implement adjustment Blacks
  async modify_image_blacks(blacks: number, inputImage: cv.Mat): Promise<cv.Mat> {
    try {
      const src = inputImage.clone();
      if (!src || src.empty()) {
        throw new Error("Input image is empty");
      }
      this.config.Black = blacks;

      const originalImage = new cv.Mat();
      cv.cvtColor(src, originalImage, cv.COLOR_RGB2BGR);

      const blackFactor = this.config.Black / 100;

      const hsvImage = new cv.Mat();
      cv.cvtColor(originalImage, hsvImage, cv.COLOR_BGR2HSV);

      const channels = new cv.MatVector();
      cv.split(hsvImage, channels);
      const hue = channels.get(0);
      const saturation = channels.get(1);
      const value = channels.get(2);

      const scaledValue = new cv.Mat();
      let contrastFactor = 0;
      if (blackFactor >= 0) {
        cv.convertScaleAbs(value, scaledValue, 1 - blackFactor * 0.5, -blackFactor * 10);
      } else {
        contrastFactor = 0.1 * (1 - Math.exp(-Math.abs(blackFactor) / 0.4));
        cv.convertScaleAbs(value, scaledValue, 1 + contrastFactor, blackFactor * 15);
      }

      channels.set(2, scaledValue);

      cv.merge(channels, hsvImage);

      let adjustedImage = new cv.Mat();
      cv.cvtColor(hsvImage, adjustedImage, cv.COLOR_HSV2BGR);

      // if (blackFactor >= 0 && typeof cv.GaussianBlur === 'function') {
      //   const blurredImage = new cv.Mat();
      //   cv.GaussianBlur(adjustedImage, blurredImage, { width: 3, height: 3 }, 0);
      //   adjustedImage.delete();
      //   adjustedImage = blurredImage;
      // }

      const finalImage = new cv.Mat();
      cv.cvtColor(adjustedImage, finalImage, cv.COLOR_BGR2RGB);

      src.delete();
      originalImage.delete();
      hsvImage.delete();
      channels.delete();
      scaledValue.delete();
      adjustedImage.delete();

      return finalImage;
    } catch (error) {
      console.error("Error in modify_image_blacks:", error);
      throw error;
    }
  }

  // -- Scaling for white
  private boostScaleForWhite(stdVal: number): number {
    const minBoost = 12.0;
    const maxBoost = 250.0;
    const decayFactor = 0.048;
  
    return Math.min(minBoost + (maxBoost - minBoost) * Math.exp(-decayFactor * stdVal), 100.0);
  }

  // -- BoostColor on WHITE
  private boostColourFromWhite(scaleRatio: number, originalMat: cv.Mat): cv.Mat {
    const labImage = originalMat.clone();
    const sourceImg = originalMat.clone();

    // Convert to LAB color space
    cv.cvtColor(labImage, labImage, cv.COLOR_BGR2Lab);

    // Split LAB channels
    const labChannels = new cv.MatVector();
    cv.split(labImage, labChannels);

    // Extract the L (lightness) channel
    const lum = labChannels.get(0).clone();
    lum.convertTo(lum, cv.CV_32F);
    const lumNorm = new cv.Mat();
    const scalarMat255 = cv.Mat.ones(lum.size(), cv.CV_32F);
    scalarMat255.setTo(new cv.Scalar(255.0));
    cv.divide(lum, scalarMat255, lumNorm);

    const lumScalingFactor = this.sigmoid(lumNorm, 12.0, 0.1, 5.0);

    // Calculate scaling for each channel
    const redScale = cv.Mat.ones(lum.size(), cv.CV_32F);
    const greenScale = cv.Mat.ones(lum.size(), cv.CV_32F);
    const blueScale = cv.Mat.ones(lum.size(), cv.CV_32F);

    const oneMatTemp = cv.Mat.ones(lumScalingFactor.size(), cv.CV_32F);
    const scaleRatioMat = cv.Mat.ones(lumScalingFactor.size(), cv.CV_32F);
    scaleRatioMat.setTo(new cv.Scalar(scaleRatio));

    cv.multiply(lumScalingFactor, scaleRatioMat, redScale);
    cv.add(redScale, oneMatTemp, redScale);

    cv.multiply(lumScalingFactor, scaleRatioMat, greenScale);
    cv.add(greenScale, oneMatTemp, greenScale);

    cv.multiply(lumScalingFactor, scaleRatioMat, blueScale);
    cv.add(blueScale, oneMatTemp, blueScale);

    // Split source image into BGR channels
    const bgrChannels = new cv.MatVector();
    cv.split(sourceImg, bgrChannels);
    const b = bgrChannels.get(0);
    const g = bgrChannels.get(1);
    const r = bgrChannels.get(2);

    // Convert B, G, R to float
    const bFloat = new cv.Mat();
    const gFloat = new cv.Mat();
    const rFloat = new cv.Mat();
    b.convertTo(bFloat, cv.CV_32F);
    g.convertTo(gFloat, cv.CV_32F);
    r.convertTo(rFloat, cv.CV_32F);

    // Apply scaling
    cv.multiply(rFloat, redScale, rFloat);
    cv.multiply(gFloat, greenScale, gFloat);
    cv.multiply(bFloat, blueScale, bFloat);

    // Convert back to uint8
    rFloat.convertTo(rFloat, cv.CV_8U);
    gFloat.convertTo(gFloat, cv.CV_8U);
    bFloat.convertTo(bFloat, cv.CV_8U);

    // Merge channels
    const mergedChannels = new cv.MatVector();
    mergedChannels.push_back(bFloat);
    mergedChannels.push_back(gFloat);
    mergedChannels.push_back(rFloat);
    const adjustedImage = new cv.Mat();
    cv.merge(mergedChannels, adjustedImage);

    // Apply Gaussian Blur
    cv.GaussianBlur(adjustedImage, adjustedImage, new cv.Size(3, 3), 0);

    // Clean up
    labImage.delete();
    sourceImg.delete();
    lum.delete();
    lumNorm.delete();
    scalarMat255.delete();
    lumScalingFactor.delete();
    redScale.delete();
    greenScale.delete();
    blueScale.delete();
    oneMatTemp.delete();
    scaleRatioMat.delete();
    bgrChannels.delete();
    bFloat.delete();
    gFloat.delete();
    rFloat.delete();
    mergedChannels.delete();
    labChannels.delete();

    return adjustedImage;
  }

  // -- Implement adjustment Whites
  async modify_image_whites(whites: number, inputImage: cv.Mat): Promise<cv.Mat> {
    if (whites < 0) {
      const labImg = new cv.Mat();
      cv.cvtColor(inputImage, labImg, cv.COLOR_BGR2Lab);
      const labChannels = new cv.MatVector();
      cv.split(labImg, labChannels);

      const lum = labChannels.get(0).clone();
      lum.convertTo(lum, cv.CV_32F);
      const lumNorm = new cv.Mat();

      // Create a Mat with the scalar value 255.0
      const scalarMat255 = cv.Mat.ones(lum.size(), cv.CV_32F);
      scalarMat255.setTo(new cv.Scalar(255.0));
      cv.divide(lum, scalarMat255, lumNorm);

      const adjustedWhite = whites / 100.0;
      const contrastFactor = 0.1 * (1 - Math.exp(-Math.abs(adjustedWhite / 0.4)));

      // Create a Mat with the scalar value (1.0 - contrastFactor)
      const contrastMat = cv.Mat.ones(lumNorm.size(), cv.CV_32F);
      contrastMat.setTo(new cv.Scalar(1.0 - contrastFactor));
      cv.multiply(lumNorm, contrastMat, lumNorm);

      // Create a Mat with the scalar value (0.9 * contrastFactor)
      const offsetMat = cv.Mat.ones(lumNorm.size(), cv.CV_32F);
      offsetMat.setTo(new cv.Scalar(0.9 * contrastFactor));
      cv.add(lumNorm, offsetMat, lumNorm);

      const lumScalingFactor = this.sigmoid(lumNorm, 12.0, 0.5, 1.2);
      const scale = cv.Mat.ones(lum.size(), cv.CV_32F);

      // Create a Mat with the scalar value adjustedWhite
      const adjustedWhiteMat = cv.Mat.ones(lumScalingFactor.size(), cv.CV_32F);
      adjustedWhiteMat.setTo(new cv.Scalar(adjustedWhite));
      cv.multiply(lumScalingFactor, adjustedWhiteMat, scale);

      const oneMat = cv.Mat.ones(lum.size(), cv.CV_32F);
      cv.add(oneMat, scale, scale);

      const floatTypeMat = inputImage.clone();
      floatTypeMat.convertTo(floatTypeMat, cv.CV_32F);

      const finalChannels = new cv.MatVector();
      cv.split(floatTypeMat, finalChannels);
      cv.multiply(finalChannels.get(0), scale, finalChannels.get(0));
      cv.multiply(finalChannels.get(1), scale, finalChannels.get(1));
      cv.multiply(finalChannels.get(2), scale, finalChannels.get(2));

      const resultMat = new cv.Mat();
      cv.merge(finalChannels, resultMat);
      resultMat.convertTo(resultMat, cv.CV_8U);

      // Convert to RGB for display
      cv.cvtColor(resultMat, resultMat, cv.COLOR_BGR2RGB);

      // Clean up
      labImg.delete();
      labChannels.delete();
      lum.delete();
      lumNorm.delete();
      scalarMat255.delete();
      contrastMat.delete();
      offsetMat.delete();
      lumScalingFactor.delete();
      scale.delete();
      oneMat.delete();
      adjustedWhiteMat.delete();
      floatTypeMat.delete();
      finalChannels.delete();

      return resultMat;
    } else {
      const originalHsvMat = new cv.Mat();
      cv.cvtColor(inputImage, originalHsvMat, cv.COLOR_BGR2HSV);
      const originHsvChannels = new cv.MatVector();
      cv.split(originalHsvMat, originHsvChannels);
    
      const stdDev = new cv.Mat();
      const meanMat = new cv.Mat();
      cv.meanStdDev(originHsvChannels.get(2), meanMat, stdDev);
      const stdVal = stdDev.data64F[0];
    
      const whiteBoostRatio = (whites / 30.0) * (this.boostScaleForWhite(stdVal) / 100);
    
      const height = inputImage.rows;
      const width = inputImage.cols;
    
      const floatTypeImage = inputImage.clone();
      floatTypeImage.convertTo(floatTypeImage, cv.CV_32F);
    
      // Split BGR channels
      const bgrChannels = new cv.MatVector();
      cv.split(floatTypeImage, bgrChannels);
    
      // Manually reshape BGR channels to 1D vectors (height * width, 1)
      const imgB = new cv.Mat(height * width, 1, cv.CV_32F);
      const imgG = new cv.Mat(height * width, 1, cv.CV_32F);
      const imgR = new cv.Mat(height * width, 1, cv.CV_32F);
      const bChannel = bgrChannels.get(0);
      const gChannel = bgrChannels.get(1);
      const rChannel = bgrChannels.get(2);
      // Copy data by iterating over pixels (since reshape is unavailable)
      const bData = bChannel.data32F;
      const gData = gChannel.data32F;
      const rData = rChannel.data32F;
      const imgBData = imgB.data32F;
      const imgGData = imgG.data32F;
      const imgRData = imgR.data32F;
      for (let i = 0; i < height * width; i++) {
        imgBData[i] = bData[i];
        imgGData[i] = gData[i];
        imgRData[i] = rData[i];
      }
    
      // Convert to YUV space manually
      const imgY = new cv.Mat(height * width, 1, cv.CV_32F);
      const imgU = new cv.Mat(height * width, 1, cv.CV_32F);
      const imgV = new cv.Mat(height * width, 1, cv.CV_32F);
    
      cv.addWeighted(imgR, 0.3, imgG, 0.59, 0.0, imgY);
      cv.addWeighted(imgY, 1.0, imgB, 0.11, 0.0, imgY);
    
      cv.addWeighted(imgR, -0.168736, imgG, -0.331264, 0.0, imgU);
      cv.addWeighted(imgU, 1.0, imgB, 0.5, 0.0, imgU);
    
      cv.addWeighted(imgR, 0.5, imgG, -0.418688, 0.0, imgV);
      cv.addWeighted(imgV, 1.0, imgB, -0.081312, 0.0, imgV);
    
      // Configurable parameters
      const highlightsTonePercent = 0.75;
      const highlightsAmountPercent = whites / -1;
      const highlightsRadius = 10;
    
      const highlightsTone = 255.0 - highlightsTonePercent * 255.0;
      const highlightsGain = 1.0 + highlightsAmountPercent * 3.0;
    
      // Compute highlights map
      const highlightsMap = new cv.Mat(imgY.size(), cv.CV_32F);
      const temp255Val = cv.Mat.ones(imgY.size(), cv.CV_32F);
      temp255Val.setTo(cv.Scalar.all(255.0));
      cv.subtract(temp255Val, imgY, temp255Val);
      const scaleMat = cv.Mat.ones(imgY.size(), cv.CV_32F);
      scaleMat.setTo(cv.Scalar.all(255.0 / (255 - highlightsTone)));
      cv.multiply(temp255Val, scaleMat, highlightsMap);
      const temp255Val_v2 = cv.Mat.ones(imgY.size(), cv.CV_32F);
      temp255Val_v2.setTo(cv.Scalar.all(255.0));
      cv.subtract(temp255Val_v2, highlightsMap, highlightsMap);
      const mask = new cv.Mat();
      const highlightsToneMat = cv.Mat.ones(imgY.size(), cv.CV_32F);
      highlightsToneMat.setTo(cv.Scalar.all(highlightsTone));
      cv.compare(imgY, highlightsToneMat, mask, cv.CMP_LE);
      highlightsMap.setTo(cv.Scalar.all(0.0), mask);
    
      if (highlightsAmountPercent * highlightsRadius > 0.0) {
        cv.blur(
          highlightsMap.reshape(1, height),
          highlightsMap.reshape(1, width),
          new cv.Size(highlightsRadius, highlightsRadius)
        );
      }
    
      // Create LUT for shadow adjustment
      const t = new cv.Mat(256, 1, cv.CV_32F);
      const tData = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        tData[i] = Math.pow(i / 255.0, highlightsGain) * 255.0;
      }
      t.data32F.set(tData);
      const LUTHighlights = new cv.Mat();
      const zeroMatLUT = cv.Mat.ones(t.size(), cv.CV_32F);
      zeroMatLUT.setTo(cv.Scalar.all(0.0));
      cv.max(t, zeroMatLUT, t);
      const maxMatLUT = cv.Mat.ones(t.size(), cv.CV_32F);
      maxMatLUT.setTo(cv.Scalar.all(255.0));
      cv.min(t, maxMatLUT, t);
      t.convertTo(LUTHighlights, cv.CV_8U);
    
      let finalY = imgY.clone();
    
      if (highlightsAmountPercent !== 0.0) {
        const scaleFactorMat = cv.Mat.ones(highlightsMap.size(), cv.CV_32F);
        scaleFactorMat.setTo(cv.Scalar.all(1.0 / 255.0));
        cv.multiply(highlightsMap, scaleFactorMat, highlightsMap);
        const lookup = new cv.Mat();
        const tempY = finalY.clone();
        tempY.convertTo(tempY, cv.CV_8U);
        cv.LUT(tempY, LUTHighlights, lookup);
    
        const tempHighlights = cv.Mat.ones(highlightsMap.size(), cv.CV_32F);
        cv.subtract(tempHighlights, highlightsMap, tempHighlights);
    
        cv.multiply(finalY, tempHighlights, finalY);
        lookup.convertTo(lookup, cv.CV_32F);
        cv.multiply(lookup, highlightsMap, lookup);
        cv.add(finalY, lookup, finalY);
    
        scaleFactorMat.delete();
        tempY.delete();
        lookup.delete();
        tempHighlights.delete();
      }
    
      // Convert back to BGR
      const outputB = new cv.Mat();
      const outputG = new cv.Mat();
      const outputR = new cv.Mat();
    
      const vForRed = new cv.Mat(imgV.size(), cv.CV_32F);
      vForRed.setTo(cv.Scalar.all(1.402));
      cv.multiply(vForRed, imgV, vForRed);
      const vForRedOffset = cv.Mat.ones(imgV.size(), cv.CV_32F);
      vForRedOffset.setTo(cv.Scalar.all(0.5));
      cv.add(vForRed, vForRedOffset, vForRed);
    
      const uForGreen = new cv.Mat(imgU.size(), cv.CV_32F);
      uForGreen.setTo(cv.Scalar.all(0.34414));
      cv.multiply(uForGreen, imgU, uForGreen);
    
      const vForGreen = new cv.Mat(imgV.size(), cv.CV_32F);
      vForGreen.setTo(cv.Scalar.all(0.71414));
      cv.multiply(vForGreen, imgV, vForGreen);
      const vForGreenOffset = cv.Mat.ones(imgV.size(), cv.CV_32F);
      vForGreenOffset.setTo(cv.Scalar.all(0.5));
      cv.add(vForGreen, vForGreenOffset, vForGreen);
    
      const uForBlue = new cv.Mat(imgU.size(), cv.CV_32F);
      uForBlue.setTo(cv.Scalar.all(1.772));
      cv.multiply(uForBlue, imgU, uForBlue);
      const uForBlueOffset = cv.Mat.ones(imgU.size(), cv.CV_32F);
      uForBlueOffset.setTo(cv.Scalar.all(0.5));
      cv.add(uForBlue, uForBlueOffset, uForBlue);
    
      cv.add(finalY, vForRed, outputR);
      cv.subtract(finalY, uForGreen, outputG);
      cv.subtract(outputG, vForGreen, outputG);
      cv.add(finalY, uForBlue, outputB);
    
      // Stack channels and manually reshape to (height, width)
      const outputChannels = new cv.MatVector();
      outputB.convertTo(outputB, cv.CV_8U);
      const bReshape = new cv.Mat(height, width, cv.CV_8U);
      const bTemp = new cv.Mat(height, width, cv.CV_8U);
      cv.resize(outputB, bTemp, new cv.Size(width, height), 0, 0, cv.INTER_NEAREST);
      bTemp.copyTo(bReshape);

      outputG.convertTo(outputG, cv.CV_8U);
      const gReshape = new cv.Mat(height, width, cv.CV_8U);
      const gTemp = new cv.Mat(height, width, cv.CV_8U);
      cv.resize(outputG, gTemp, new cv.Size(width, height), 0, 0, cv.INTER_NEAREST);
      gTemp.copyTo(gReshape);

      outputR.convertTo(outputR, cv.CV_8U);
      const rReshape = new cv.Mat(height, width, cv.CV_8U);
      const rTemp = new cv.Mat(height, width, cv.CV_8U);
      cv.resize(outputR, rTemp, new cv.Size(width, height), 0, 0, cv.INTER_NEAREST);
      rTemp.copyTo(rReshape);

      outputChannels.push_back(bReshape);
      outputChannels.push_back(gReshape);
      outputChannels.push_back(rReshape);
    
      const outputMat = new cv.Mat();
      cv.merge(outputChannels, outputMat);
    
      let resultMat = inputImage.clone();
      if (whites !== 0.0) {
        resultMat = this.boostColourFromWhite(whiteBoostRatio, outputMat);
      }
      resultMat.convertTo(resultMat, cv.CV_8U);
    
      const adjustedHSV = resultMat.clone();
      cv.cvtColor(adjustedHSV, adjustedHSV, cv.COLOR_BGR2HSV);
    
      const adjustedHSVChannels = new cv.MatVector();
      cv.split(adjustedHSV, adjustedHSVChannels);
      const sTemp = adjustedHSVChannels.get(1);
      const vTemp = adjustedHSVChannels.get(2);
    
      const finalHsvChannels = new cv.MatVector();
      finalHsvChannels.push_back(originHsvChannels.get(0));
      finalHsvChannels.push_back(sTemp);
      finalHsvChannels.push_back(vTemp);
    
      cv.merge(finalHsvChannels, adjustedHSV);
      cv.cvtColor(adjustedHSV, adjustedHSV, cv.COLOR_HSV2BGR);
      cv.cvtColor(adjustedHSV, adjustedHSV, cv.COLOR_BGR2RGB);
    
      // Clean up
      originalHsvMat.delete();
      originHsvChannels.delete();
      stdDev.delete();
      meanMat.delete();
      floatTypeImage.delete();
      bgrChannels.delete();
      imgB.delete();
      imgG.delete();
      imgR.delete();
      imgY.delete();
      imgU.delete();
      imgV.delete();
      highlightsMap.delete();
      temp255Val.delete();
      temp255Val_v2.delete();
      mask.delete();
      highlightsToneMat.delete();
      scaleMat.delete();
      t.delete();
      LUTHighlights.delete();
      zeroMatLUT.delete();
      maxMatLUT.delete();
      finalY.delete();
      vForRed.delete();
      vForRedOffset.delete();
      uForGreen.delete();
      vForGreen.delete();
      vForGreenOffset.delete();
      uForBlue.delete();
      uForBlueOffset.delete();
      outputB.delete();
      outputG.delete();
      outputR.delete();
      bTemp.delete();
      gTemp.delete();
      rTemp.delete();
      bReshape.delete();
      gReshape.delete();
      rReshape.delete();
      outputChannels.delete();
      outputMat.delete();
      adjustedHSV.delete();
      adjustedHSVChannels.delete();
      finalHsvChannels.delete();
    
      return adjustedHSV;
    }
  }

  // -- For Midtones Contrast
  private interpMatAllMat(x: cv.Mat, xp: cv.Mat, fp: cv.Mat): cv.Mat {
    const xSize = x.total();
    const xpSize = xp.total();
    const xData = new Float32Array(xSize);
    const xpData = new Float32Array(xpSize);
    const fpData = new Float32Array(xpSize);

    xData.set(x.data32F);
    xpData.set(xp.data32F);
    fpData.set(fp.data32F);

    const output = new Float32Array(xSize);

    for (let i = 0; i < xData.length; i++) {
      const xi = xData[i];

      // Clamp left/right
      if (xi <= xpData[0]) {
        output[i] = fpData[0];
        continue;
      }
      if (xi >= xpData[xpData.length - 1]) {
        output[i] = fpData[fpData.length - 1];
        continue;
      }

      // Binary search for index: xp[idx - 1] <= xi < xp[idx]
      let low = 0;
      let high = xpSize - 1;
      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        if (xpData[mid] <= xi) {
          low = mid + 1;
        } else {
          high = mid;
        }
      }

      const idx = Math.max(low, 1);
      const x0 = xpData[idx - 1];
      const x1 = xpData[idx];
      const y0 = fpData[idx - 1];
      const y1 = fpData[idx];

      const t = (xi - x0) / (x1 - x0);
      output[i] = y0 + t * (y1 - y0);
    }

    const result = new cv.Mat(x.rows, x.cols, cv.CV_32F);
    result.data32F.set(output);

    return result;
  }

  // -- For Applying Contrast on Midtones
  private async applyMidtonesContrast(originalMat: cv.Mat, contrastFactor: number): Promise<cv.Mat> {
    const labImg = new cv.Mat();
    cv.cvtColor(originalMat, labImg, cv.COLOR_BGR2Lab);
    labImg.convertTo(labImg, cv.CV_32F);

    const labChannels = new cv.MatVector();
    cv.split(labImg, labChannels);

    const lum = labChannels.get(0).clone();
    const oriA = labChannels.get(1).clone();
    const oriB = labChannels.get(2).clone();

    const lNorm = new cv.Mat();
    const scalar255 = new cv.Mat(lum.rows, lum.cols, cv.CV_32F, new cv.Scalar(255));
    cv.divide(lum, scalar255, lNorm);

    const element = new cv.Mat(256, 1, cv.CV_32F);
    const elementData = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      elementData[i] = i / 255.0;
    }
    element.data32F.set(elementData);

    const midtoneBoost = 0.1 * (contrastFactor / 50);
    const curveValue = new cv.Mat(256, 1, cv.CV_32F);
    const curveData = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const curVal = elementData[i];
      const value = curVal + midtoneBoost * Math.sin((curVal - 0.5) * Math.PI);
      curveData[i] = value;
    }
    curveValue.data32F.set(curveData);

    const interpolationRes = await this.interpMatAllMat(lNorm, element, curveValue);
    const scalar255Mul = new cv.Mat(interpolationRes.rows, interpolationRes.cols, cv.CV_32F, new cv.Scalar(255));
    cv.multiply(interpolationRes, scalar255Mul, interpolationRes);

    const adjustedLab = new cv.Mat();
    const mergedChannels = new cv.MatVector();
    mergedChannels.push_back(interpolationRes);
    mergedChannels.push_back(oriA);
    mergedChannels.push_back(oriB);
    cv.merge(mergedChannels, adjustedLab);
    adjustedLab.convertTo(adjustedLab, cv.CV_8U);

    const result = new cv.Mat();
    cv.cvtColor(adjustedLab, result, cv.COLOR_Lab2BGR);

    // Clean up
    labImg.delete();
    labChannels.delete();
    lum.delete();
    oriA.delete();
    oriB.delete();
    lNorm.delete();
    scalar255.delete();
    element.delete();
    curveValue.delete();
    interpolationRes.delete();
    adjustedLab.delete();
    mergedChannels.delete();
    scalar255Mul.delete();

    return result;
  }

  // -- For Boosting Red on Contrast
  private async boostRedContrast(originalMat: cv.Mat, lum: cv.Mat, oriA: cv.Mat): Promise<cv.Mat> {
    const floatOriImg = originalMat.clone();
    floatOriImg.convertTo(floatOriImg, cv.CV_32F);

    const oriBgrChannels = new cv.MatVector();
    cv.split(floatOriImg, oriBgrChannels);

    const lNormalize = new cv.Mat();
    const scalar255 = new cv.Mat(lum.rows, lum.cols, cv.CV_32F, new cv.Scalar(255));
    cv.divide(lum, scalar255, lNormalize);

    const center = 0.5;
    const width = 0.25;
    const centerMat = new cv.Mat(lNormalize.rows, lNormalize.cols, cv.CV_32F, new cv.Scalar(center));
    cv.subtract(lNormalize, centerMat, lNormalize);
    cv.pow(lNormalize, 2.0, lNormalize);
    const negOneMat = new cv.Mat(lNormalize.rows, lNormalize.cols, cv.CV_32F, new cv.Scalar(-1));
    cv.multiply(lNormalize, negOneMat, lNormalize);
    const widthMat = new cv.Mat(lNormalize.rows, lNormalize.cols, cv.CV_32F, new cv.Scalar(width * width * 2));
    cv.divide(lNormalize, widthMat, lNormalize);
    cv.exp(lNormalize, lNormalize);

    const redMask = new cv.Mat();
    const scalar150 = new cv.Mat(oriA.rows, oriA.cols, cv.CV_32F, new cv.Scalar(150));
    cv.subtract(oriA, scalar150, redMask);
    const scalar40 = new cv.Mat(redMask.rows, redMask.cols, cv.CV_32F, new cv.Scalar(40));
    cv.divide(redMask, scalar40, redMask);
    const scalarOne = new cv.Mat(redMask.rows, redMask.cols, cv.CV_32F, new cv.Scalar(1));
    cv.min(redMask, scalarOne, redMask);
    const scalarZero = new cv.Mat(redMask.rows, redMask.cols, cv.CV_32F, new cv.Scalar(0));
    cv.max(redMask, scalarZero, redMask);

    const combinedMask = new cv.Mat();
    cv.multiply(lNormalize, redMask, combinedMask);

    const curLabImg = new cv.Mat();
    cv.cvtColor(originalMat, curLabImg, cv.COLOR_BGR2Lab);
    curLabImg.convertTo(curLabImg, cv.CV_32F);

    const labChannels = new cv.MatVector();
    cv.split(curLabImg, labChannels);

    const curLum = labChannels.get(0).clone();
    const curOriA = labChannels.get(1).clone();
    const curOriB = labChannels.get(2).clone();

    const normalizeCurLum = new cv.Mat();
    const scalar255Cur = new cv.Mat(curLum.rows, curLum.cols, cv.CV_32F, new cv.Scalar(255));
    cv.divide(curLum, scalar255Cur, normalizeCurLum);

    const redScale = await this.sigmoid(normalizeCurLum, 8.3, 0.5, 50.0);

    const lumScale = new cv.Mat();
    const scalarTwo = new cv.Mat(redScale.rows, redScale.cols, cv.CV_32F, new cv.Scalar(2));
    cv.divide(redScale, scalarTwo, lumScale);
    cv.multiply(combinedMask, lumScale, lumScale);
    cv.subtract(curLum, lumScale, curLum);

    const aScale = new cv.Mat();
    cv.multiply(combinedMask, redScale, aScale);
    cv.add(curOriA, aScale, curOriA);

    const newLab = new cv.Mat();
    const newLabChannels = new cv.MatVector();
    newLabChannels.push_back(curLum);
    newLabChannels.push_back(curOriA);
    newLabChannels.push_back(curOriB);
    cv.merge(newLabChannels, newLab);
    newLab.convertTo(newLab, cv.CV_8U);

    const bgrImage = new cv.Mat();
    cv.cvtColor(newLab, bgrImage, cv.COLOR_Lab2BGR);
    bgrImage.convertTo(bgrImage, cv.CV_32F);

    const bgrChannels = new cv.MatVector();
    cv.split(bgrImage, bgrChannels);

    const gCh = bgrChannels.get(1).clone();
    const rCh = bgrChannels.get(2).clone();

    const greenScale = new cv.Mat();
    const scalar10 = new cv.Mat(combinedMask.rows, combinedMask.cols, cv.CV_32F, new cv.Scalar(10));
    cv.multiply(combinedMask, scalar10, greenScale);
    cv.add(gCh, greenScale, gCh);

    const newBgr = new cv.Mat();
    const newBgrChannels = new cv.MatVector();
    newBgrChannels.push_back(oriBgrChannels.get(0));
    newBgrChannels.push_back(gCh);
    newBgrChannels.push_back(rCh);
    cv.merge(newBgrChannels, newBgr);
    newBgr.convertTo(newBgr, cv.CV_8U);

    // Clean up
    floatOriImg.delete();
    oriBgrChannels.delete();
    lNormalize.delete();
    scalar255.delete();
    centerMat.delete();
    negOneMat.delete();
    widthMat.delete();
    redMask.delete();
    scalar150.delete();
    scalar40.delete();
    scalarOne.delete();
    scalarZero.delete();
    combinedMask.delete();
    curLabImg.delete();
    labChannels.delete();
    curLum.delete();
    curOriA.delete();
    curOriB.delete();
    normalizeCurLum.delete();
    scalar255Cur.delete();
    redScale.delete();
    lumScale.delete();
    scalarTwo.delete();
    aScale.delete();
    newLab.delete();
    newLabChannels.delete();
    bgrImage.delete();
    bgrChannels.delete();
    gCh.delete();
    rCh.delete();
    greenScale.delete();
    scalar10.delete();
    newBgrChannels.delete();

    return newBgr;
  }

  // -- Implement adjustment Contrast
  async modify_image_contrast(contrastScore: number, inputImage: cv.Mat): Promise<cv.Mat> {
    const imageToProcess = inputImage.clone();
    cv.cvtColor(imageToProcess, imageToProcess, cv.COLOR_BGRA2BGR);
    this.config.Contrast = contrastScore
    const contrastFactor = contrastScore / 10;

    if (contrastFactor >= 0) {
      const lowVal = 4.0;
      const highVal = 9.0;
      const midpoint = 0.5;
      const contrastScale = lowVal + (highVal - lowVal) / (1 + Math.exp(-0.3 * (contrastFactor - 1)));

      const normalizeImg = imageToProcess.clone();
      normalizeImg.convertTo(normalizeImg, cv.CV_32F);
      const scalar255 = new cv.Mat(normalizeImg.rows, normalizeImg.cols, cv.CV_32FC3, new cv.Scalar(255, 255, 255));
      cv.divide(normalizeImg, scalar255, normalizeImg);

      const resultImg = await this.sigmoid(normalizeImg, contrastScale, midpoint, 0.9);
      cv.multiply(resultImg, scalar255, resultImg);
      resultImg.convertTo(resultImg, cv.CV_8U);

      // Clean up
      normalizeImg.delete();
      scalar255.delete();

      return resultImg;
    } else {
      const labImg = new cv.Mat();
      cv.cvtColor(imageToProcess, labImg, cv.COLOR_BGR2Lab);
      labImg.convertTo(labImg, cv.CV_32F);

      const labChannels = new cv.MatVector();
      cv.split(labImg, labChannels);

      const adjustedContrastScore = contrastFactor / 100;
      const lum = labChannels.get(0).clone();
      const oriA = labChannels.get(1).clone();
      const fScore = 131.0 * (adjustedContrastScore + 127) / (127 * (131 - adjustedContrastScore));
      const alphaC = fScore;
      const gammaC = 127 * (1 - fScore);

      const floatMat = imageToProcess.clone();
      floatMat.convertTo(floatMat, cv.CV_32F);

      const resultMat = new cv.Mat();
      cv.addWeighted(floatMat, alphaC, floatMat, 0.0, gammaC, resultMat);
      resultMat.convertTo(resultMat, cv.CV_8U);

      const boostScore = 60 * Math.pow(Math.abs(contrastFactor) / 10.0, 1.5);
      const afterMidtonesAdj = await this.applyMidtonesContrast(resultMat, boostScore);
      const afterRedBoostAdj = await this.boostRedContrast(afterMidtonesAdj, lum, oriA);

      // Clean up
      labImg.delete();
      labChannels.delete();
      lum.delete();
      oriA.delete();
      floatMat.delete();
      resultMat.delete();
      afterMidtonesAdj.delete();

      return afterRedBoostAdj;
    }
  }

  // -- Coloring for saturation when it's not black and white
  private hueShiftedProcess(imageToProcess: cv.Mat): cv.Mat {
    try {
      const hsvImage = new cv.Mat();
      cv.cvtColor(imageToProcess, hsvImage, cv.COLOR_BGR2HSV);

      const channels = new cv.MatVector();
      cv.split(hsvImage, channels);
      const h = channels.get(0);
      const s = channels.get(1);
      const v = channels.get(2);

      const redMask = new cv.Mat(h.rows, h.cols, cv.CV_32F);
      const mask1 = new cv.Mat();
      const mask2 = new cv.Mat();
      cv.threshold(h, mask1, 10, 1, cv.THRESH_BINARY_INV);
      cv.threshold(h, mask2, 170, 1, cv.THRESH_BINARY);
      cv.addWeighted(mask1, 1, mask2, 1, 0, redMask);
      cv.GaussianBlur(redMask, redMask, { width: 11, height: 11 }, 0);

      const hShifted = new cv.Mat();
      cv.convertScaleAbs(h, hShifted, 1, redMask.data[0] * -5);
      cv.threshold(hShifted, hShifted, 179, 179, cv.THRESH_TRUNC);

      const hsvShifted = new cv.Mat();
      const mergeChannels = new cv.MatVector();
      mergeChannels.push_back(hShifted);
      mergeChannels.push_back(s);
      mergeChannels.push_back(v);
      cv.merge(mergeChannels, hsvShifted);

      const bgrResult = new cv.Mat();
      cv.cvtColor(hsvShifted, bgrResult, cv.COLOR_HSV2BGR);

      hsvImage.delete();
      channels.delete();
      redMask.delete();
      mask1.delete();
      mask2.delete();
      hShifted.delete();
      hsvShifted.delete();
      mergeChannels.delete();

      return bgrResult;
    } catch (error) {
      console.error("Hue shift processing failed:", error);
      return imageToProcess;
    }
  }

  // -- Implement from for saturation
  async modify_image_saturation(saturation: number, inputImage: cv.Mat): Promise<cv.Mat> {
    try {
      const src = inputImage.clone();
      if (!src || src.empty()) {
        throw new Error("Input image is empty");
      }

      this.config.Saturation = saturation;

      const originalImage = new cv.Mat();
      cv.cvtColor(src, originalImage, cv.COLOR_RGB2BGR);

      const labImage = new cv.Mat();
      cv.cvtColor(originalImage, labImage, cv.COLOR_BGR2Lab);

      const labChannels = new cv.MatVector();
      cv.split(labImage, labChannels);
      const lum = labChannels.get(0);
      const oriA = labChannels.get(1);
      const oriB = labChannels.get(2);

      const satRatio = 1 + this.config.Saturation / 100.0;
      const aTemp = new cv.Mat();
      const bTemp = new cv.Mat();
      cv.convertScaleAbs(oriA, aTemp, satRatio, (1 - satRatio) * 128);
      cv.convertScaleAbs(oriB, bTemp, satRatio, (1 - satRatio) * 128);

      cv.threshold(aTemp, aTemp, 255, 255, cv.THRESH_TRUNC);
      cv.threshold(aTemp, aTemp, 0, 0, cv.THRESH_TOZERO);
      cv.threshold(bTemp, bTemp, 255, 255, cv.THRESH_TRUNC);
      cv.threshold(bTemp, bTemp, 0, 0, cv.THRESH_TOZERO);

      const labAdjusted = new cv.Mat();
      const mergeChannels = new cv.MatVector();
      mergeChannels.push_back(lum);
      mergeChannels.push_back(aTemp);
      mergeChannels.push_back(bTemp);
      cv.merge(mergeChannels, labAdjusted);

      let adjustedImage = new cv.Mat();
      cv.cvtColor(labAdjusted, adjustedImage, cv.COLOR_Lab2BGR);

      if (saturation < 0) {
        const hueShiftedImage = this.hueShiftedProcess(adjustedImage);
        adjustedImage.delete();
        adjustedImage = hueShiftedImage;
      }

      const finalImage = new cv.Mat();
      cv.cvtColor(adjustedImage, finalImage, cv.COLOR_BGR2RGB);

      src.delete();
      originalImage.delete();
      labImage.delete();
      labChannels.delete();
      aTemp.delete();
      bTemp.delete();
      labAdjusted.delete();
      mergeChannels.delete();
      adjustedImage.delete();

      return finalImage;
    } catch (error) {
      console.error("Error in modify_image_saturation:", error);
      throw error;
    }
  }

  private boostRedVibrance(aChannel: cv.Mat, oriA: cv.Mat, saturationFactor: number): cv.Mat {
    try {
        // Validate inputs
        if (aChannel.empty() || oriA.empty()) {
            throw new Error("Input matrices are empty");
        }
        if (aChannel.type() !== oriA.type()) {
            throw new Error("Type mismatch between aChannel and oriA");
        }

        // Convert aChannel to CV_32F
        const aChannel32F = new cv.Mat();
        aChannel.convertTo(aChannel32F, cv.CV_32F);

        // Create red mask based on oriA
        const redMask = new cv.Mat();
        cv.convertScaleAbs(oriA, redMask, 1 / 40.0, -128 / 40.0); // Map a to [0, 1] for red areas
        cv.threshold(redMask, redMask, 0.5, 1, cv.THRESH_BINARY); // Simplified binary threshold
        redMask.convertTo(redMask, cv.CV_32F);

        // Scale mask by vibrance factor
        const maskScale = cv.Mat.ones(redMask.size(), cv.CV_32F);
        maskScale.setTo(cv.Scalar.all(saturationFactor * 0.5));
        cv.multiply(redMask, maskScale, redMask);

        // Boost a channel in red areas
        const redScale = cv.Mat.ones(aChannel32F.size(), cv.CV_32F);
        redScale.setTo(cv.Scalar.all(20.0 * saturationFactor));
        const aBoost = new cv.Mat();
        cv.multiply(redMask, redScale, aBoost);
        const aAdjusted = new cv.Mat();
        cv.add(aChannel32F, aBoost, aAdjusted);

        // Clean up
        redMask.delete();
        maskScale.delete();
        redScale.delete();
        aBoost.delete();
        aChannel32F.delete();

        return aAdjusted;
    } catch (error) {
        console.error("Red vibrance boost failed:", error);
        return aChannel.clone();
    }
  }

  // -- Implement from python for vibrance
  async modify_image_vibrance(vibrance: number, inputImage: cv.Mat): Promise<cv.Mat> {
      try {
        // Clone input image
        const src = inputImage.clone();
        if (!src || src.empty()) {
            throw new Error("Input image is empty");
        }
        this.config.Vibrance = vibrance;

        // Convert to BGR and then to Lab
        const originalImage = new cv.Mat();
        cv.cvtColor(src, originalImage, cv.COLOR_RGB2BGR);

        const labImage = new cv.Mat();
        cv.cvtColor(originalImage, labImage, cv.COLOR_BGR2Lab);

        // Split Lab channels
        const labChannels = new cv.MatVector();
        cv.split(labImage, labChannels);
        const lum = labChannels.get(0); // L channel (luminance)
        const oriA = labChannels.get(1); // a channel (green-red)
        const oriB = labChannels.get(2); // b channel (blue-yellow)

        // Calculate vibrance factor (0 to 1 for vibrance 0 to 100)
        const saturationFactor = this.config.Vibrance / 100.0;

        // Adjust a and b channels for general vibrance
        const aTemp = new cv.Mat();
        const bTemp = new cv.Mat();
        oriA.convertTo(aTemp, cv.CV_32F);
        oriB.convertTo(bTemp, cv.CV_32F);

        const oriA32F = new cv.Mat();
        oriA.convertTo(oriA32F, cv.CV_32F);

        const neutralMat = cv.Mat.ones(aTemp.size(), cv.CV_32F);
        neutralMat.setTo(cv.Scalar.all(128.0)); // Neutral point for a and b
        const scaleMat = cv.Mat.ones(aTemp.size(), cv.CV_32F);
        scaleMat.setTo(cv.Scalar.all(1.0 + saturationFactor));

        // a' = 128 + (a - 128) * (1 + saturationFactor)
        const aDiff = new cv.Mat();
        cv.subtract(aTemp, neutralMat, aDiff);
        cv.multiply(aDiff, scaleMat, aDiff);
        cv.add(aDiff, neutralMat, aTemp);

        // b' = 128 + (b - 128) * (1 + saturationFactor)
        const bDiff = new cv.Mat();
        cv.subtract(bTemp, neutralMat, bDiff);
        cv.multiply(bDiff, scaleMat, bDiff);
        cv.add(bDiff, neutralMat, bTemp);

        // Apply red vibrance boost if vibrance > 0
        let finalA = aTemp;
        if (vibrance > 0) {
            finalA = this.boostRedVibrance(aTemp, oriA32F, saturationFactor);
        }

        // Convert channels to CV_8U and clamp
        finalA.convertTo(finalA, cv.CV_8U);
        cv.threshold(finalA, finalA, 255, 255, cv.THRESH_TRUNC);
        cv.threshold(finalA, finalA, 0, 0, cv.THRESH_TOZERO);

        bTemp.convertTo(bTemp, cv.CV_8U);
        cv.threshold(bTemp, bTemp, 255, 255, cv.THRESH_TRUNC);
        cv.threshold(bTemp, bTemp, 0, 0, cv.THRESH_TOZERO);

        // Merge channels
        const labAdjusted = new cv.Mat();
        const mergeChannels = new cv.MatVector();
        mergeChannels.push_back(lum);
        mergeChannels.push_back(finalA);
        mergeChannels.push_back(bTemp);
        cv.merge(mergeChannels, labAdjusted);

        // Convert back to BGR and then RGB
        const adjustedImage = new cv.Mat();
        cv.cvtColor(labAdjusted, adjustedImage, cv.COLOR_Lab2BGR);

        const finalImage = new cv.Mat();
        cv.cvtColor(adjustedImage, finalImage, cv.COLOR_BGR2RGB);

        // Clean up
        src.delete();
        originalImage.delete();
        labImage.delete();
        labChannels.delete();
        lum.delete();
        oriA.delete();
        oriB.delete();
        aTemp.delete();
        bTemp.delete();
        aDiff.delete();
        bDiff.delete();
        neutralMat.delete();
        scaleMat.delete();
        labAdjusted.delete();
        mergeChannels.delete();
        adjustedImage.delete();
        oriA32F.delete();
        if (vibrance > 0 && finalA !== aTemp) {
            finalA.delete();
        }

        return finalImage;
    } catch (error) {
        console.error("Error in modify_image_vibrance:", error);
        throw error;
    }
  }

  // -- new business logic
  async adjust_image_colors_merge(
    exposure: number,
    temperature: number,
    tint: number,
    highlights: number,
    shadow: number,
    black: number,
    white: number,
    contrast: number,
    saturation: number,
    vibrance: number,
    inputImage?: cv.Mat // Optional input, defaults to stored inputImage
  ): Promise<cv.Mat> {
    try {
      // Use provided inputImage or stored inputImage
      let src = inputImage ? inputImage.clone() : this.inputImage.clone();
      if (!src || src.empty()) {
        throw new Error("Input image is empty");
      }

      // Apply adjustments sequentially
      if (exposure !== 0) {
        this.config.Exposure = exposure;
        src = await this.modify_image_exposure(this.config.Exposure);
      }

      if (temperature !== 0) {
        this.config.Temperature = temperature;
        src = await this.modify_image_temperature(this.config.Temperature, src);
      }

      if (tint !== 0) {
        this.config.Tint = tint;
        src = await this.modify_image_tint(this.config.Tint, src);
      }

      if (highlights !== 0) {
        this.config.Highlights = highlights;
        src = await this.modify_image_highlights(this.config.Highlights, src);
      }

      if (shadow !== 0) {
        this.config.Shadow = shadow;
        src = await this.modify_image_shadows(this.config.Shadow, src);
      }

      if (black !== 0) {
        this.config.Black = black;
        src = await this.modify_image_blacks(this.config.Black, src);
      }

      if (white !== 0) {
        this.config.White = white;
        src = await this.modify_image_whites(this.config.White, src);
      }

      if (contrast !== 0) {
        this.config.Contrast = contrast;
        src = await this.modify_image_contrast(this.config.Contrast, src);
      }

      if (saturation !== 0) {
        this.config.Saturation = saturation;
        src = await this.modify_image_saturation(this.config.Saturation, src);
      }

      if (vibrance !== 0) {
        this.config.Vibrance = vibrance;
        src = await this.modify_image_vibrance(this.config.Vibrance, src);
      }

      // Save initial config to history if empty
      if (this.configHistory.length === 1) { // Length 1 includes initial config
        this.configHistory.push({
          Exposure: this.config.Exposure,
          Temperature: this.config.Temperature,
          Tint: this.config.Tint,
          Highlights: this.config.Highlights,
          Shadow: this.config.Shadow,
          Black: this.config.Black,
          White: this.config.White,
          Contrast: this.config.Contrast,
          Saturation: this.config.Saturation,
          Vibrance: this.config.Vibrance,
        });
        console.log("Config history updated:", this.configHistory);
      }

      // Notify listener of image update
      // if (this.listener?.onImageRendered) {
      //   this.listener.onImageRendered(src);
      // }

      // Clean up source if it’s not the output
      if (src !== src) {
        src.delete();
      }

      return src; // Return processed image as cv.Mat
    } catch (error) {
      console.error("Error in adjust_image_colors_merge:", error);
      throw error;
    }
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

    // mat.delete();
  }

  sendConfigServer(): void {
    if (this.listener) {
      // this.listener.onSyncConfigs("image1", "event1", this.configHistory);
    }
  }

  getFlattenConfig(configs: Config): Config {
    return configs;
  }

  applyOpenCV(config: Config): void {
    return ;
  }
}