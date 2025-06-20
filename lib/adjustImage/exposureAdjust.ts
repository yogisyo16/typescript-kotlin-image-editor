import cv, { rows } from "@techstark/opencv-js";
import { logImage } from "../utills/logImageAdjustment";

async function modifyImageExposure(src: cv.Mat, score: number): Promise<cv.Mat> {
  // Array to keep track of intermediate Mat objects for proper memory cleanup
  const cleanUp: cv.Mat[] = [];

  try {
      // Clone the source image to avoid modifying the original input Mat
      const srcClone = src.clone();
      cleanUp.push(srcClone); // Add to cleanup list

      // Ensure the image is in BGR format for consistent processing
      if (srcClone.channels() === 4) { // If it's BGRA, convert to BGR
          cv.cvtColor(srcClone, srcClone, cv.COLOR_BGRA2BGR);
      }

      // Convert the BGR image to HSV color space
      const originalHsvMat = new cv.Mat();
      cleanUp.push(originalHsvMat); // Add to cleanup list
      cv.cvtColor(srcClone, originalHsvMat, cv.COLOR_BGR2HSV);

      // Split the HSV matrix into its channels (Hue, Saturation, Value)
      const hsvChannels: cv.MatVector = new cv.MatVector();
      // cleanUp.push(hsvChannels); // Add MatVector to cleanup
      cv.split(originalHsvMat, hsvChannels);

      // Get the original Hue channel (to be preserved)
      const hue = hsvChannels.get(0);
      cleanUp.push(hue); // Add hue channel to cleanup (important as it's extracted)

      // Calculate the exposure compensation factor and beta
      let factor = 1.0;
      let beta = 0.0;
      if (score > 0) {
          beta = 15 * score;
          factor = Math.pow(2.0, score / 2.2);
      } else {
          factor = Math.pow(2.0, score / 1.5);
      }
      // console.debug(score);

      // Convert the BGR image (srcClone) to float type for precise calculations
      const imageFloat = new cv.Mat();
      cleanUp.push(imageFloat); // Add to cleanup list
      srcClone.convertTo(imageFloat, cv.CV_64FC3); // CV_64FC3 for 3-channel float64

      // Apply scalar multiplication with the exposure compensation factor
      const factorMat = new cv.Mat(imageFloat.rows, imageFloat.cols, cv.CV_64FC3, new cv.Scalar(factor, factor, factor));
      cleanUp.push(factorMat); // Add to cleanup list
      cv.multiply(imageFloat, factorMat, imageFloat); // Multiply each channel by the factor

      // Clamp / Clip the result values to stay within the 0-255 range (for 8-bit unsigned later)
      const maxMat = new cv.Mat(imageFloat.rows, imageFloat.cols, cv.CV_64FC3, new cv.Scalar(255, 255, 255));
      cleanUp.push(maxMat); // Add to cleanup list
      cv.min(imageFloat, maxMat, imageFloat); // Ensure values don't exceed 255

      // Convert the float image back to 8-bit unsigned integer
      imageFloat.convertTo(srcClone, cv.CV_8UC3); // Store back into srcClone, now 8-bit BGR

      // Apply brightness adjustment using convertScaleAbs
      const adjustedMat = new cv.Mat();
      cleanUp.push(adjustedMat); // Add to cleanup list
      cv.convertScaleAbs(srcClone, adjustedMat, 1.0, beta);

      // Convert the adjusted BGR image to HSV color space again
      let finalHSV = new cv.Mat(); // Declare with let as it's reassigned later by merge
      cleanUp.push(finalHSV); // Add to cleanup list
      cv.cvtColor(adjustedMat, finalHSV, cv.COLOR_BGR2HSV);

      // Split the new HSV channels
      const finalHsvChannels = new cv.MatVector();
      // cleanUp.push(finalHsvChannels); // Add to cleanup list
      cv.split(finalHSV, finalHsvChannels);

      // Get the new Saturation and Value channels
      const sTemp = finalHsvChannels.get(1);
      const vTemp = finalHsvChannels.get(2);
      cleanUp.push(sTemp, vTemp); // Add to cleanup list

      // Merge the original Hue with the new Saturation and Value
      // This preserves the original color hues, only adjusting brightness/saturation.
      const mergedHsv = new cv.MatVector();
      // cleanUp.push(mergedHsv); // Add MatVector to cleanup
      mergedHsv.push_back(hue); // Original Hue
      mergedHsv.push_back(sTemp); // New Saturation
      mergedHsv.push_back(vTemp); // New Value
      cv.merge(mergedHsv, finalHSV); // Merge into finalHSV

      // Convert the merged HSV image back to BGR
      cv.cvtColor(finalHSV, finalHSV, cv.COLOR_HSV2BGR);

      // Convert to BGRA if the original source was BGRA or if needed for web display
      cv.cvtColor(finalHSV, finalHSV, cv.COLOR_BGR2BGRA);

      // Optional: Log the image (if your logImage utility is defined)
      // logImage(finalHSV, 'Exposure Adjusted Image', score);

      logImage(finalHSV, 'Exposure Value', score);

      return finalHSV; // Return the final adjusted image
  } catch (error) {
      console.error("Error modifying image exposure:", error);
      // In case of error, return the original source or an empty Mat
      return src; // Or new cv.Mat(); if you prefer an empty result
  }
}

export default modifyImageExposure;