import cv from "@techstark/opencv-js";

async function modifyImageExposure(src: cv.Mat, value: number): Promise<cv.Mat> {
  const originalMat = src.clone();

  // Ensure input is 3 channels (BGR) to avoid RGBA issues
  cv.cvtColor(originalMat, originalMat, cv.COLOR_BGRA2BGR);

  const originalHsvMat = new cv.Mat();
  cv.cvtColor(originalMat, originalHsvMat, cv.COLOR_BGR2HSV);

  const hsvChannels: cv.MatVector = new cv.MatVector();
  cv.split(originalHsvMat, hsvChannels);
  const hue = hsvChannels.get(0);
  originalHsvMat.delete();
  hsvChannels.delete();

  let factor = 1.0;
  let beta = 0.0;
  if (value > 0) {
      beta = 15 * value;
      factor = Math.pow(2.0, value / 2.2);
  } else {
      factor = Math.pow(2.0, value / 1.5);
  }

  const imageFloat = new cv.Mat();
  originalMat.convertTo(imageFloat, cv.CV_64FC3);

  // Multiply by factor using a Mat
  const factorMat = new cv.Mat(imageFloat.rows, imageFloat.cols, cv.CV_64FC3, new cv.Scalar(factor, factor, factor));
  cv.multiply(imageFloat, factorMat, imageFloat);
  factorMat.delete();

  // Create a Mat for max value (255) instead of Scalar
  const maxMat = new cv.Mat(imageFloat.rows, imageFloat.cols, cv.CV_64FC3, new cv.Scalar(255, 255, 255));
  cv.min(imageFloat, maxMat, imageFloat);
  imageFloat.convertTo(originalMat, cv.CV_8UC3);
  imageFloat.delete();
  maxMat.delete();

  const adjustedMat = new cv.Mat();
  cv.convertScaleAbs(originalMat, adjustedMat, 1.0, beta);

  const finalHSV = new cv.Mat();
  cv.cvtColor(adjustedMat, finalHSV, cv.COLOR_BGR2HSV);
  adjustedMat.delete();

  const finalHsvChannels = new cv.MatVector();
  cv.split(finalHSV, finalHsvChannels);

  const sTemp = finalHsvChannels.get(1);
  const vTemp = finalHsvChannels.get(2);
  finalHsvChannels.delete();


  const mergedHsv = new cv.MatVector();
  mergedHsv.push_back(hue);
  mergedHsv.push_back(sTemp);
  mergedHsv.push_back(vTemp);
  cv.merge(mergedHsv, finalHSV);
  
  mergedHsv.delete();

  cv.cvtColor(finalHSV, finalHSV, cv.COLOR_HSV2BGR);
  return finalHSV;
}

export default modifyImageExposure;