import cv from "@techstark/opencv-js";

function boostRedVibrance(aChannel: cv.Mat, oriA: cv.Mat, saturationFactor: number): cv.Mat {
    const cleanUp: cv.Mat[] = [];

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
      cleanUp.push(redMask, maskScale, redScale, aBoost, aChannel32F);

      return aAdjusted;
    } catch (error) {
      console.error("Red vibrance boost failed:", error);
      return aChannel.clone();
    } finally {
      cleanUp.forEach((mat) => mat.delete());
    }
}

// -- Implement from python for vibrance
async function modifyImageVibrance(src: cv.Mat, vibrance: number): Promise<cv.Mat> {
    const cleanUp: cv.Mat[] = [];

    try {
      // Clone input image
      const srcClone = src.clone();
      if (!srcClone || srcClone.empty()) {
        throw new Error("Input image is empty");
      }

      srcClone.convertTo(srcClone, src.channels() === 4 ? cv.CV_16SC4 : cv.CV_16SC3);
      srcClone.convertTo(srcClone, src.channels() === 4 ? cv.CV_8UC4 : cv.CV_8UC3);

      // Convert to BGR and then to Lab
      const originalImage = new cv.Mat();
      cv.cvtColor(srcClone, originalImage, cv.COLOR_RGB2BGR);
      cleanUp.push(srcClone);

      const labImage = new cv.Mat();
      cv.cvtColor(originalImage, labImage, cv.COLOR_BGR2Lab);
      cleanUp.push(originalImage);

      // Split Lab channels
      const labChannels = new cv.MatVector();
      cv.split(labImage, labChannels);
      const lum = labChannels.get(0); // L channel (luminance)
      const oriA = labChannels.get(1); // a channel (green-red)
      const oriB = labChannels.get(2); // b channel (blue-yellow)
      cleanUp.push(labImage, labChannels as any);

      // Calculate vibrance factor (0 to 1 for vibrance 0 to 100)
      const saturationFactor = vibrance / 100.0;

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
          finalA = boostRedVibrance(aTemp, oriA32F, saturationFactor);
      }
      cleanUp.push(aTemp, scaleMat, oriA32F, neutralMat, aDiff, bDiff);

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
      cleanUp.push(mergeChannels as any, bTemp, lum);
      if (vibrance > 0 && finalA !== aTemp) {
          cleanUp.push(finalA);
      }

      // Convert back to BGR and then RGB
      const adjustedImage = new cv.Mat();
      cv.cvtColor(labAdjusted, adjustedImage, cv.COLOR_Lab2BGR);
      cleanUp.push(labAdjusted);

      const finalImage = new cv.Mat();

      cv.cvtColor(adjustedImage, finalImage, cv.COLOR_BGR2RGB);
      cv.cvtColor(finalImage, finalImage, cv.COLOR_RGB2RGBA);
      cleanUp.push(adjustedImage);

      // const image16Bit = finalImage.channels() === 4 ? cv.CV_16SC4 : cv.CV_16SC3;
      // finalImage.convertTo(finalImage, image16Bit);

      return finalImage;
  } catch (error) {
      console.error("Error in modify_image_vibrance:", error);
      throw error;
  } finally {
      cleanUp.forEach((mat) => mat.delete());
  }
}

export default modifyImageVibrance;