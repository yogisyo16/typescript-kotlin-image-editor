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
      // Kotlin: Imgproc.cvtColor(originalMat, originalMat, Imgproc.COLOR_BGRA2BGR)
      if (srcClone.channels() === 4) { // If it's BGRA, convert to BGR
          cv.cvtColor(srcClone, srcClone, cv.COLOR_BGRA2BGR);
      }

      // Convert the BGR image to HSV color space
      // Kotlin: Imgproc.cvtColor(originalMat, originalHsvMat, Imgproc.COLOR_BGR2HSV)
      const originalHsvMat = new cv.Mat();
      cleanUp.push(originalHsvMat); // Add to cleanup list
      cv.cvtColor(srcClone, originalHsvMat, cv.COLOR_BGR2HSV);

      // Split the HSV matrix into its channels (Hue, Saturation, Value)
      // Kotlin: Core.split(originalHsvMat, hsvChannels)
      const hsvChannels: cv.MatVector = new cv.MatVector();
      // cleanUp.push(hsvChannels); // Add MatVector to cleanup
      cv.split(originalHsvMat, hsvChannels);

      // Get the original Hue channel (to be preserved)
      // Kotlin: val hue = hsvChannels[0]
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
      // Kotlin: originalMat.convertTo(imageFloat, CvType.CV_64F)
      const imageFloat = new cv.Mat();
      cleanUp.push(imageFloat); // Add to cleanup list
      srcClone.convertTo(imageFloat, cv.CV_64FC3); // CV_64FC3 for 3-channel float64

      // Apply scalar multiplication with the exposure compensation factor
      // Kotlin: Core.multiply(imageFloat, Scalar.all(factor), imageFloat)
      const factorMat = new cv.Mat(imageFloat.rows, imageFloat.cols, cv.CV_64FC3, new cv.Scalar(factor, factor, factor));
      cleanUp.push(factorMat); // Add to cleanup list
      cv.multiply(imageFloat, factorMat, imageFloat); // Multiply each channel by the factor

      // Clamp / Clip the result values to stay within the 0-255 range (for 8-bit unsigned later)
      // Kotlin: Core.min(imageFloat, Scalar.all(255.0), imageFloat)
      const maxMat = new cv.Mat(imageFloat.rows, imageFloat.cols, cv.CV_64FC3, new cv.Scalar(255, 255, 255));
      cleanUp.push(maxMat); // Add to cleanup list
      cv.min(imageFloat, maxMat, imageFloat); // Ensure values don't exceed 255

      // Convert the float image back to 8-bit unsigned integer
      // Kotlin: imageFloat.convertTo(originalMat, CvType.CV_8U)
      imageFloat.convertTo(srcClone, cv.CV_8UC3); // Store back into srcClone, now 8-bit BGR

      // Apply brightness adjustment using convertScaleAbs
      // Kotlin: Core.convertScaleAbs(originalMat, adjustedMat, 1.0, beta)
      const adjustedMat = new cv.Mat();
      cleanUp.push(adjustedMat); // Add to cleanup list
      cv.convertScaleAbs(srcClone, adjustedMat, 1.0, beta);

      // Convert the adjusted BGR image to HSV color space again
      // Kotlin: Imgproc.cvtColor(adjustedMat, finalHSV, Imgproc.COLOR_BGR2HSV)
      let finalHSV = new cv.Mat(); // Declare with let as it's reassigned later by merge
      cleanUp.push(finalHSV); // Add to cleanup list
      cv.cvtColor(adjustedMat, finalHSV, cv.COLOR_BGR2HSV);

      // Split the new HSV channels
      // Kotlin: Core.split(finalHSV, hsvChannels) (Kotlin reuses, TS needs new MatVector if you want to avoid confusion)
      const finalHsvChannels = new cv.MatVector();
      // cleanUp.push(finalHsvChannels); // Add to cleanup list
      cv.split(finalHSV, finalHsvChannels);

      // Get the new Saturation and Value channels
      // Kotlin: val sTemp = hsvChannels[1], val vTemp = hsvChannels[2]
      const sTemp = finalHsvChannels.get(1);
      const vTemp = finalHsvChannels.get(2);
      cleanUp.push(sTemp, vTemp); // Add to cleanup list

      // Merge the original Hue with the new Saturation and Value
      // This preserves the original color hues, only adjusting brightness/saturation.
      // Kotlin: Core.merge(listOf(hue, sTemp, vTemp), finalHSV)
      const mergedHsv = new cv.MatVector();
      // cleanUp.push(mergedHsv); // Add MatVector to cleanup
      mergedHsv.push_back(hue); // Original Hue
      mergedHsv.push_back(sTemp); // New Saturation
      mergedHsv.push_back(vTemp); // New Value
      cv.merge(mergedHsv, finalHSV); // Merge into finalHSV

      // Convert the merged HSV image back to BGR
      // Kotlin: Imgproc.cvtColor(finalHSV, finalHSV, Imgproc.COLOR_HSV2BGR)
      cv.cvtColor(finalHSV, finalHSV, cv.COLOR_HSV2BGR);

      // Convert to BGRA if the original source was BGRA or if needed for web display
      // Kotlin's Bitmap.Config.ARGB_8888 implies BGRA/RGBA for web compatibility
      cv.cvtColor(finalHSV, finalHSV, cv.COLOR_BGR2BGRA);

      // Optional: Log the image (if your logImage utility is defined)
      // logImage(finalHSV, 'Exposure Adjusted Image', score);

      logImage(finalHSV, 'Exposure Adjusted Image', score);

      return finalHSV; // Return the final adjusted image
  } catch (error) {
      console.error("Error modifying image exposure:", error);
      // In case of error, return the original source or an empty Mat
      return src; // Or new cv.Mat(); if you prefer an empty result
  } finally {
      // // Clean up all intermediate Mat objects to prevent memory leaks
      // cleanUp.forEach((mat) => {
      //     if (mat && mat.delete) { // Check if it's a valid Mat and has delete method
      //         mat.delete();
      //     }
      // });
  }
}

export default modifyImageExposure;