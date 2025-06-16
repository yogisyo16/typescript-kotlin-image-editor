import cv from "@techstark/opencv-js";
import { sigmoid } from "@/lib/adjustImage/sigmoidAdjust";
import { logImage } from "@/lib/utills/logImageAdjustment";

async function boostCoolLowerHalf(
  temperatureScore: number,
  originalMat: cv.Mat,
  lumScalingFactor: cv.Mat,
  bLabBoostFactor: cv.Mat,
  blueScaleScore: number
): Promise<cv.Mat> {
  const matCleanUp: cv.Mat[] = [];
  const vecCleanUp: cv.MatVector[] = [];

  try {
    const adjustedTemp = Math.abs(temperatureScore) / 115.0;

    // --- Initial BGR Adjustments
    const channels = new cv.MatVector();
    vecCleanUp.push(channels);
    cv.split(originalMat, channels);
    // Get HANDLES to channels. DO NOT delete these individually.
    const bChannel = channels.get(0);
    const gChannel = channels.get(1);
    const rChannel = channels.get(2);
    bChannel.convertTo(bChannel, cv.CV_32F);
    gChannel.convertTo(gChannel, cv.CV_32F);
    rChannel.convertTo(rChannel, cv.CV_32F);

    // Calculate Green Scale
    const greenAdj = new cv.Mat();
    const greenScalar = cv.Mat.ones(lumScalingFactor.size(), cv.CV_32F);
    const ones = cv.Mat.ones(lumScalingFactor.size(), cv.CV_32F);
    const greenScale = new cv.Mat();
    matCleanUp.push(greenAdj, greenScalar, ones, greenScale);

    greenScalar.setTo(cv.Scalar.all(adjustedTemp * 0.5));
    cv.multiply(lumScalingFactor, greenScalar, greenAdj);
    cv.add(ones, greenAdj, greenScale);
    
    logImage(greenScale, "greenScale");
    // Calculate Blue Scale
    const blueAdj = new cv.Mat();
    const blueScalar = cv.Mat.ones(lumScalingFactor.size(), cv.CV_32F);
    const blueScale = new cv.Mat();
    matCleanUp.push(blueAdj, blueScalar, blueScale);

    blueScalar.setTo(cv.Scalar.all(adjustedTemp * blueScaleScore));
    cv.multiply(lumScalingFactor, blueScalar, blueAdj);
    cv.add(ones, blueAdj, blueScale);

    // Apply scaling
    cv.multiply(gChannel, greenScale, gChannel);
    cv.multiply(bChannel, blueScale, bChannel);

    // Merge for LAB adjustment
    const mergedForLab = new cv.Mat();
    matCleanUp.push(mergedForLab);
    const mergedVector = new cv.MatVector();
    vecCleanUp.push(mergedVector);
    mergedVector.push_back(bChannel);
    mergedVector.push_back(gChannel);
    mergedVector.push_back(rChannel);
    cv.merge(mergedVector, mergedForLab);
    mergedForLab.convertTo(mergedForLab, cv.CV_8U);
    
    // Keep a CLONE of the red channel. Clones must be cleaned up.
    const redTemp = rChannel.clone(); 
    matCleanUp.push(redTemp);

    // --- LAB Color Space Adjustments (B Channel)
    const labImage = new cv.Mat();
    matCleanUp.push(labImage);
    const labChannels = new cv.MatVector();
    vecCleanUp.push(labChannels);
    cv.cvtColor(mergedForLab, labImage, cv.COLOR_BGR2Lab);
    cv.split(labImage, labChannels);

    const bLabChannel = labChannels.get(2); // This is a HANDLE
    bLabChannel.convertTo(bLabChannel, cv.CV_32F);

    const bAdj = new cv.Mat();
    const bScalar = cv.Mat.ones(bLabBoostFactor.size(), cv.CV_32F);
    const labOnes = cv.Mat.ones(bLabBoostFactor.size(), cv.CV_32F);
    const bScale = new cv.Mat();
    matCleanUp.push(bAdj, bScalar, labOnes, bScale);
    bScalar.setTo(cv.Scalar.all(adjustedTemp / 3.0));
    cv.multiply(bLabBoostFactor, bScalar, bAdj);
    cv.subtract(labOnes, bAdj, bScale);

    cv.multiply(bLabChannel, bScale, bLabChannel);
    bLabChannel.convertTo(bLabChannel, cv.CV_8U);

    cv.merge(labChannels, labImage);
    cv.cvtColor(labImage, originalMat, cv.COLOR_Lab2BGR);

    // --- Final Channel Adjustments
    const finalChannels = new cv.MatVector();
    vecCleanUp.push(finalChannels);
    cv.split(originalMat, finalChannels);
    const finalG = finalChannels.get(1); // Handle
    const finalR = finalChannels.get(2); // Handle

    // Red channel final adjustment
    const redTempNorm = new cv.Mat();
    const scalar255 = cv.Mat.ones(redTemp.size(), cv.CV_32F);
    const redScaleFactor = sigmoid(redTempNorm, 11.0, 0.325, 0.6);
    const redScaleAfterAdj = new cv.Mat();
    const redScalarAfter = cv.Mat.ones(lumScalingFactor.size(), cv.CV_32F);
    const finalRedScale = new cv.Mat();
    const finalOnes = cv.Mat.ones(lumScalingFactor.size(), cv.CV_32F);
    matCleanUp.push(redTempNorm, scalar255, redScaleFactor, redScaleAfterAdj, redScalarAfter, finalRedScale, finalOnes);

    scalar255.setTo(cv.Scalar.all(255.0));
    cv.divide(redTemp, scalar255, redTempNorm);
    redScalarAfter.setTo(cv.Scalar.all(adjustedTemp * 1.2));
    cv.multiply(lumScalingFactor, redScalarAfter, redScaleAfterAdj);
    cv.multiply(redScaleAfterAdj, redScaleFactor, redScaleAfterAdj);
    cv.subtract(finalOnes, redScaleAfterAdj, finalRedScale);
    
    finalR.convertTo(finalR, cv.CV_32F);
    cv.multiply(finalR, finalRedScale, finalR);

    // Green channel final adjustment
    const greenScaleAfter = new cv.Mat();
    const greenScalarAfter = cv.Mat.ones(lumScalingFactor.size(), cv.CV_32F);
    const finalOnesGreen = cv.Mat.ones(lumScalingFactor.size(), cv.CV_32F);
    const finalGreenScale = new cv.Mat();
    matCleanUp.push(greenScaleAfter, greenScalarAfter, finalOnesGreen, finalGreenScale);
    
    greenScalarAfter.setTo(cv.Scalar.all(adjustedTemp * 0.7));
    cv.multiply(lumScalingFactor, greenScalarAfter, greenScaleAfter);
    cv.add(finalOnesGreen, greenScaleAfter, finalGreenScale);
    
    finalG.convertTo(finalG, cv.CV_32F);
    cv.multiply(finalG, finalGreenScale, finalG);

    // Merge final channels
    finalR.convertTo(finalR, cv.CV_8U);
    finalG.convertTo(finalG, cv.CV_8U);
    cv.merge(finalChannels, originalMat);

    return originalMat;
  } catch (error) {
    console.error("Error in boostCoolLowerHalf:", error);
    return originalMat;
  } finally {
    // This now cleans up Mats and MatVectors correctly and safely
    matCleanUp.forEach((mat) => mat.delete());
    vecCleanUp.forEach((vec) => vec.delete());
  }
}

// --- Helper function for COOL adjustments (temperature < -50) - CORRECTED
async function boostCoolUpperHalf(
  temperatureScore: number,
  originalMat: cv.Mat,
  lumScalingFactor: cv.Mat,
  bLabBoostFactor: cv.Mat,
  blueScaleScore: number
): Promise<cv.Mat> {
    const matCleanUp: cv.Mat[] = [];
    const vecCleanUp: cv.MatVector[] = [];
    
    try {
        const adjustedTemp = Math.abs(temperatureScore) / 115.0;

        // --- Initial BGR Adjustments
        const channels = new cv.MatVector();
        vecCleanUp.push(channels);
        cv.split(originalMat, channels);
        const bChannel = channels.get(0);
        const gChannel = channels.get(1);
        const rChannel = channels.get(2);
        bChannel.convertTo(bChannel, cv.CV_32F);
        gChannel.convertTo(gChannel, cv.CV_32F);
        rChannel.convertTo(rChannel, cv.CV_32F);
        
        const greenAdj = new cv.Mat();
        const greenScalar = cv.Mat.ones(lumScalingFactor.size(), cv.CV_32F);
        const ones = cv.Mat.ones(lumScalingFactor.size(), cv.CV_32F);
        const greenScale = new cv.Mat();
        const blueAdj = new cv.Mat();
        const blueScalar = cv.Mat.ones(lumScalingFactor.size(), cv.CV_32F);
        const blueScale = new cv.Mat();
        matCleanUp.push(greenAdj, greenScalar, ones, greenScale, blueAdj, blueScalar, blueScale);

        greenScalar.setTo(cv.Scalar.all(adjustedTemp * 0.5));
        cv.multiply(lumScalingFactor, greenScalar, greenAdj);
        cv.add(ones, greenAdj, greenScale);

        blueScalar.setTo(cv.Scalar.all(adjustedTemp * blueScaleScore));
        cv.multiply(lumScalingFactor, blueScalar, blueAdj);
        cv.add(ones, blueAdj, blueScale);

        cv.multiply(gChannel, greenScale, gChannel);
        cv.multiply(bChannel, blueScale, bChannel);
        
        const mergedForLab = new cv.Mat();
        matCleanUp.push(mergedForLab);
        const mergedVector = new cv.MatVector();
        vecCleanUp.push(mergedVector);
        mergedVector.push_back(bChannel);
        mergedVector.push_back(gChannel);
        mergedVector.push_back(rChannel);
        cv.merge(mergedVector, mergedForLab);
        mergedForLab.convertTo(mergedForLab, cv.CV_8U);

        const redTemp = rChannel.clone();
        matCleanUp.push(redTemp);

        // --- LAB Color Space Adjustments
        const labImage = new cv.Mat();
        matCleanUp.push(labImage);
        const labChannels = new cv.MatVector();
        vecCleanUp.push(labChannels);
        cv.cvtColor(mergedForLab, labImage, cv.COLOR_BGR2Lab);
        cv.split(labImage, labChannels);

        const bLabChannel = labChannels.get(2);
        bLabChannel.convertTo(bLabChannel, cv.CV_32F);
        
        const bAdj = new cv.Mat();
        const bScalar = cv.Mat.ones(bLabBoostFactor.size(), cv.CV_32F);
        const labOnes = cv.Mat.ones(bLabBoostFactor.size(), cv.CV_32F);
        const bScale = new cv.Mat();
        matCleanUp.push(bAdj, bScalar, labOnes, bScale);
        
        bScalar.setTo(cv.Scalar.all(adjustedTemp / 1.9)); // Different from lower_half
        cv.multiply(bLabBoostFactor, bScalar, bAdj);
        cv.subtract(labOnes, bAdj, bScale);

        cv.multiply(bLabChannel, bScale, bLabChannel);
        bLabChannel.convertTo(bLabChannel, cv.CV_8U);

        cv.merge(labChannels, labImage);
        cv.cvtColor(labImage, originalMat, cv.COLOR_Lab2BGR);

        // --- Final Channel Adjustments
        const finalChannels = new cv.MatVector();
        vecCleanUp.push(finalChannels);
        cv.split(originalMat, finalChannels);
        const finalB = finalChannels.get(0);
        const finalG = finalChannels.get(1);
        // finalChannels.get(2).delete(); // Delete the old red channel from the vector itself

        // Red channel final adjustment
        const redTempNorm = new cv.Mat();
        const scalar255 = cv.Mat.ones(redTemp.size(), cv.CV_32F);
        const redScaleFactor = sigmoid(redTempNorm, 11.0, 0.325, 0.6);
        const redScaleAfterAdj = new cv.Mat();
        const redScalarAfter = cv.Mat.ones(lumScalingFactor.size(), cv.CV_32F);
        const finalRedScale = new cv.Mat();
        const finalOnes = cv.Mat.ones(lumScalingFactor.size(), cv.CV_32F);
        matCleanUp.push(redTempNorm, scalar255, redScaleFactor, redScaleAfterAdj, redScalarAfter, finalRedScale, finalOnes);

        scalar255.setTo(cv.Scalar.all(255.0));
        cv.divide(redTemp, scalar255, redTempNorm);
        redScalarAfter.setTo(cv.Scalar.all(adjustedTemp * 2.0)); // Different from lower_half
        cv.multiply(lumScalingFactor, redScalarAfter, redScaleAfterAdj);
        cv.multiply(redScaleAfterAdj, redScaleFactor, redScaleAfterAdj);
        cv.subtract(finalOnes, redScaleAfterAdj, finalRedScale);

        const finalR = redTemp; // Use the cloned red channel
        finalR.convertTo(finalR, cv.CV_32F);
        cv.multiply(finalR, finalRedScale, finalR);

        // Green channel final adjustment
        const greenScaleAfter = new cv.Mat();
        const greenScalarAfter = cv.Mat.ones(lumScalingFactor.size(), cv.CV_32F);
        const finalOnesGreen = cv.Mat.ones(lumScalingFactor.size(), cv.CV_32F);
        const finalGreenScale = new cv.Mat();
        matCleanUp.push(greenScaleAfter, greenScalarAfter, finalOnesGreen, finalGreenScale);
        
        greenScalarAfter.setTo(cv.Scalar.all(adjustedTemp * 0.7));
        cv.multiply(lumScalingFactor, greenScalarAfter, greenScaleAfter);
        cv.add(finalOnesGreen, greenScaleAfter, finalGreenScale);

        finalG.convertTo(finalG, cv.CV_32F);
        cv.multiply(finalG, finalGreenScale, finalG);

        // Merge final channels
        finalR.convertTo(finalR, cv.CV_8U);
        finalG.convertTo(finalG, cv.CV_8U);

        finalChannels.set(1, finalG);
        finalChannels.set(2, finalR); // Set the newly adjusted red channel
        cv.merge(finalChannels, originalMat);

        return originalMat;
    } catch (error) {
        console.error("Error in boostCoolUpperHalf:", error);
        return originalMat;
    } finally {
        matCleanUp.forEach((mat) => mat.delete());
        vecCleanUp.forEach((vec) => vec.delete());
    }
}

// --- FINAL, SIMPLIFIED boostWarmTemperature ---
async function boostWarmTemperature(
  temperatureScore: number,
  originalMat: cv.Mat // Note: It no longer needs lumScalingFactor from outside
): Promise<cv.Mat> {
  const matCleanUp: cv.Mat[] = [];
  const vecCleanUp: cv.MatVector[] = [];

  try {
    const asjutedTemp = temperatureScore * 473;
    // Create the luminance scaling factor right here inside the function
    const labImage = new cv.Mat();
    const lum = new cv.Mat();
    const lumNorm = new cv.Mat();
    const lumSub = new cv.Mat();
    const ones = cv.Mat.ones(originalMat.size(), cv.CV_32F);
    matCleanUp.push(labImage, lum, lumNorm, lumSub, ones);

    cv.cvtColor(originalMat, labImage, cv.COLOR_BGR2Lab);
    cv.split(labImage, lum); // We only need the L channel
    lum.convertTo(lumNorm, cv.CV_32F, 1.0 / 255.0);
    cv.subtract(ones, lumNorm, lumSub);
    const lumScalingFactor = sigmoid(lumSub, 5.0, 0.5);
    matCleanUp.push(lumScalingFactor);

    // A linear scaling factor for the temperature slider
    const tempValue = (temperatureScore / 100.0) * 4.372; 

    const channels = new cv.MatVector();
    vecCleanUp.push(channels);
    cv.split(originalMat, channels);

    const bChannel = channels.get(0);
    const gChannel = channels.get(1);
    const rChannel = channels.get(2);
    bChannel.convertTo(bChannel, cv.CV_32F);
    gChannel.convertTo(gChannel, cv.CV_32F);
    rChannel.convertTo(rChannel, cv.CV_32F);

    // 1. Boost RED channel
    const redAdj = new cv.Mat();
    const redScalar = cv.Mat.ones(lumScalingFactor.size(), cv.CV_32F);
    const redScale = new cv.Mat();
    matCleanUp.push(redAdj, redScalar, redScale);
    redScalar.setTo(cv.Scalar.all(tempValue * 0.25)); 
    cv.multiply(lumScalingFactor, redScalar, redAdj);
    cv.add(ones, redAdj, redScale);
    cv.multiply(rChannel, redScale, rChannel);

    // 2. Reduce BLUE channel
    const blueAdj = new cv.Mat();
    const blueScalar = cv.Mat.ones(lumScalingFactor.size(), cv.CV_32F);
    const blueScale = new cv.Mat();
    matCleanUp.push(blueAdj, blueScalar, blueScale);
    blueScalar.setTo(cv.Scalar.all(tempValue * 0.35));
    cv.multiply(lumScalingFactor, blueScalar, blueAdj);
    cv.subtract(ones, blueAdj, blueScale);
    cv.multiply(bChannel, blueScale, bChannel);

    // 3. (Optional) Slight green boost
    const greenAdj = new cv.Mat();
    const greenScalar = cv.Mat.ones(lumScalingFactor.size(), cv.CV_32F);
    const greenScale = new cv.Mat();
    matCleanUp.push(greenAdj, greenScalar, greenScale);
    greenScalar.setTo(cv.Scalar.all(tempValue * 0.05));
    cv.multiply(lumScalingFactor, greenScalar, greenAdj);
    cv.add(ones, greenAdj, greenScale);
    
    // TYPO FIX: The destination of the multiply must be the channel itself.
    cv.multiply(gChannel, greenScale, gChannel);
    
    cv.merge(channels, originalMat);
    originalMat.convertTo(originalMat, cv.CV_8U);
    const image16Bit = originalMat.channels() === 4 ? cv.CV_16SC4 : cv.CV_16SC3;
    originalMat.convertTo(originalMat, image16Bit);

    return originalMat;
  } catch (error) {
    console.error("Error in simplified boostWarmTemperature:", error);
    return originalMat;
  } finally {
    matCleanUp.forEach((mat) => mat.delete());
    vecCleanUp.forEach((vec) => vec.delete());
  }
}

async function modifyImageTemperature(
  src: cv.Mat,
  colorTemperature: number
): Promise<cv.Mat> {
  if (colorTemperature === 0) {
    return src.clone();
  }

  const cleanUp: cv.Mat[] = [];
  const srcClone = src.clone();
  
  srcClone.convertTo(srcClone, src.channels() === 4 ? cv.CV_16SC4 : cv.CV_16SC3);
  srcClone.convertTo(srcClone, src.channels() === 4 ? cv.CV_8UC4 : cv.CV_8UC3);

  cleanUp.push(srcClone);
  
  try {
    // This is the main logical change. We separate the warm and cool paths entirely.
    if (colorTemperature > 0) {
      await boostWarmTemperature(colorTemperature, srcClone);
      
    } else {
      cv.cvtColor(srcClone, srcClone, cv.COLOR_BGRA2BGR);

      const labImage = new cv.Mat();
      const labChannels = new cv.MatVector();
      const lum = new cv.Mat();
      const lumNorm = new cv.Mat();
      const lumSub = new cv.Mat();
      const ones = cv.Mat.ones(srcClone.size(), cv.CV_32F);
      const bNorm = new cv.Mat();
      cleanUp.push(labImage, lum, lumNorm, lumSub, ones, bNorm);
      // Note: MatVectors are cleaned up inside the cool helper functions.

      cv.cvtColor(srcClone, labImage, cv.COLOR_BGR2Lab);
      cv.split(labImage, labChannels);
      labChannels.get(0).copyTo(lum);

      lum.convertTo(lumNorm, cv.CV_32F, 1.0 / 255.0);
      cv.subtract(ones, lumNorm, lumSub);
      const lumScalingFactor = sigmoid(lumSub, 5.0, 0.5);
      cleanUp.push(lumScalingFactor);

      let blueScaleScore = 4.9;
      if (colorTemperature < -50) {
        const x = Math.abs(colorTemperature);
        blueScaleScore = 5.0 + ((x - 51) * (8.0 - 5.0)) / (100 - 51);
      }

      const bChannel = labChannels.get(2);
      bChannel.convertTo(bNorm, cv.CV_32F, 1.0 / 255.0);
      const bLabBoostFactor = sigmoid(bNorm, 11.0, 0.625, 2.0);
      cleanUp.push(bLabBoostFactor);
      // labChannels.delete(); // Clean up the vector now that we're done with it.

      if (colorTemperature >= -50) {
        await boostCoolLowerHalf(colorTemperature, srcClone, lumScalingFactor, bLabBoostFactor, blueScaleScore);
      } else {
        await boostCoolUpperHalf(colorTemperature, srcClone, lumScalingFactor, bLabBoostFactor, blueScaleScore);
      }
    }
    
    // Convert the final result for display
    cv.cvtColor(srcClone, srcClone, cv.COLOR_BGR2RGB);
    cv.cvtColor(srcClone, srcClone, cv.COLOR_RGB2RGBA);

    const result = srcClone.clone();
    return result;

  } catch (error) {
    console.error("Failed to modify image temperature:", error);
    return src.clone();
  } finally {
    cleanUp.forEach((mat) => mat.delete());
  }
}

export default modifyImageTemperature;