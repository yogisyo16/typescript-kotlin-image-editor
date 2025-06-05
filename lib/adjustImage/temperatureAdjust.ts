import cv from "@techstark/opencv-js";
import {sigmoid} from "@/lib/adjustImage/sigmoidAdjust"

async function boostCoolTemperature(
  temperatureScore: number,
  originalMat: cv.Mat,
  lumScalingFactor: cv.Mat
): Promise<cv.Mat> {
  const cleanUp: cv.Mat[] = [];

  try {
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
    cleanUp.push(redAdjustment);

    const greenScalarMat = cv.Mat.ones(greenAdjustment.size(), cv.CV_32F);
    greenScalarMat.setTo(cv.Scalar.all(adjustedTemp * 0.005)); // Reduced from 0.01 to 0.005
    cv.multiply(greenAdjustment, greenScalarMat, greenAdjustment);
    cv.multiply(greenAdjustment, lumScalingFactor, greenAdjustment);
    cv.subtract(greenScale, greenAdjustment, greenScale);
    cleanUp.push(greenAdjustment);

    const blueScalarMat = cv.Mat.ones(blueAdjustment.size(), cv.CV_32F);
    blueScalarMat.setTo(cv.Scalar.all(adjustedTemp * 0.02)); // Reduced from 0.04 to 0.02
    cv.multiply(blueAdjustment, blueScalarMat, blueAdjustment);
    cv.multiply(blueAdjustment, lumScalingFactor, blueAdjustment);
    cv.add(blueScale, blueAdjustment, blueScale);
    cleanUp.push(blueAdjustment);

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
    cleanUp.push(redScale, greenScale, blueScale);

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
    cleanUp.push(labMat);

    const bChannel = labChannels.get(2).clone();
    bChannel.convertTo(bChannel, cv.CV_32F);
    const bNorm = new cv.Mat();
    const scalarMat255 = cv.Mat.ones(bChannel.size(), cv.CV_32F);
    scalarMat255.setTo(cv.Scalar.all(255.0));
    cv.divide(bChannel, scalarMat255, bNorm);

    const bLabScalingFactor = sigmoid(bNorm, 8.0, 0.6, 2.5);
    const bScale = cv.Mat.ones(bLabScalingFactor.rows, bLabScalingFactor.cols, cv.CV_32F);
    const bAdjustment = cv.Mat.ones(bScale.rows, bScale.cols, cv.CV_32F);
    cleanUp.push(bNorm, scalarMat255);

    const bScalarMat = cv.Mat.ones(bAdjustment.size(), cv.CV_32F);
    bScalarMat.setTo(cv.Scalar.all(adjustedTemp / 145.0));
    cv.multiply(bAdjustment, bScalarMat, bAdjustment);
    cv.multiply(bAdjustment, bLabScalingFactor, bAdjustment);
    cv.add(bScale, bAdjustment, bScale); // Increase b for cooler tones
    cleanUp.push(bAdjustment, bScalarMat);

    const labCh2 = labChannels.get(2);
    labCh2.convertTo(labCh2, cv.CV_32F);
    bScale.convertTo(bScale, cv.CV_32F);
    cv.multiply(labCh2, bScale, labCh2);
    labCh2.convertTo(labCh2, cv.CV_8U);
    cleanUp.push(bScale);

    cv.merge(labChannels, labMat);
    cv.cvtColor(labMat, originalMat, cv.COLOR_Lab2BGR);

    // Final channel adjustments
    const finalChannels = new cv.MatVector();
    cv.split(originalMat, finalChannels);
    finalChannels.set(2, curRedChannels.clone());
    finalChannels.set(1, curGreenChannels.clone());

    cv.merge(finalChannels, originalMat);
    originalMat.convertTo(originalMat, cv.CV_8U);

    return originalMat;
  } catch (error) {
    console.error(error);
    return originalMat;
  } finally {
    cleanUp.forEach((mat) => mat.delete());
  }
}
  
  // -- warmTemparture for Temperature
async function boostWarmTemperature(
  temperatureScore: number,
  originalMat: cv.Mat,
  lumScalingFactor: cv.Mat
): Promise<cv.Mat> {
  const cleanUp: cv.Mat[] = [];
  try {
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
    cleanUp.push(redAdjustment, redScalarMat);

    const greenScalarMat = cv.Mat.ones(greenAdjustment.size(), cv.CV_32F);
    greenScalarMat.setTo(cv.Scalar.all(adjustedTemp * 0.006));
    cv.multiply(greenAdjustment, greenScalarMat, greenAdjustment);
    cv.multiply(greenAdjustment, lumScalingFactor, greenAdjustment);
    cv.add(greenScale, greenAdjustment, greenScale);
    cleanUp.push(greenAdjustment, greenScalarMat);

    const blueScalarMat = cv.Mat.ones(blueAdjustment.size(), cv.CV_32F);
    blueScalarMat.setTo(cv.Scalar.all(adjustedTemp * 0.04));
    cv.multiply(blueAdjustment, blueScalarMat, blueAdjustment);
    cv.multiply(blueAdjustment, lumScalingFactor, blueAdjustment);
    cv.subtract(blueScale, blueAdjustment, blueScale);
    cleanUp.push(blueAdjustment, blueScalarMat);

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
    cleanUp.push(redScale, greenScale, blueScale);

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
    cleanUp.push(labMat);

    const aChannel = labChannels.get(1).clone();
    aChannel.convertTo(aChannel, cv.CV_32F);
    const aNorm = new cv.Mat();
    const scalarMat255 = cv.Mat.ones(aChannel.size(), cv.CV_32F);
    scalarMat255.setTo(cv.Scalar.all(255.0));
    cv.divide(aChannel, scalarMat255, aNorm);
    cleanUp.push(aChannel, scalarMat255);

    const aLabScalingFactor = sigmoid(aNorm, 8.0, 0.6, 2.5);
    const aScale = cv.Mat.ones(aLabScalingFactor.rows, aLabScalingFactor.cols, cv.CV_32F);
    const aAdjustment = cv.Mat.ones(aScale.rows, aScale.cols, cv.CV_32F);
    cleanUp.push(aScale, aNorm);

    const aScalarMat = cv.Mat.ones(aAdjustment.size(), cv.CV_32F);
    aScalarMat.setTo(cv.Scalar.all(adjustedTemp / 145.0));
    cv.multiply(aAdjustment, aScalarMat, aAdjustment);
    cv.multiply(aAdjustment, aLabScalingFactor, aAdjustment);
    cv.add(aScale, aAdjustment, aScale); // Increase a for warmer tones
    cleanUp.push(aAdjustment, aScalarMat, aLabScalingFactor);

    const labCh1 = labChannels.get(1);
    labCh1.convertTo(labCh1, cv.CV_32F);
    aScale.convertTo(aScale, cv.CV_32F);
    cv.multiply(labCh1, aScale, labCh1);
    labCh1.convertTo(labCh1, cv.CV_8U);
    cleanUp.push(aScale, labCh1);

    cv.merge(labChannels, labMat);
    cv.cvtColor(labMat, originalMat, cv.COLOR_Lab2BGR);

    // Final channel adjustments
    const finalChannels = new cv.MatVector();
    cv.split(originalMat, finalChannels);
    finalChannels.set(2, curRedChannels.clone());
    finalChannels.set(1, curGreenChannels.clone());

    cv.merge(finalChannels, originalMat);
    originalMat.convertTo(originalMat, cv.CV_8U);

    return originalMat;
  } catch(error) {
    console.log(error);
    return originalMat
  } finally {
    cleanUp.forEach((mat) => mat.delete());
  }
}
  
  // -- Implement adjustment Termperature
async function modifyImageTemperature(src: cv.Mat, colorTemperature: number): Promise<cv.Mat> {
  const cleanUp: cv.Mat[] = [];

  try {
    const labImage = new cv.Mat();
    const originalMat = src.clone();

    // Convert to BGR color space
    cv.cvtColor(originalMat, originalMat, cv.COLOR_BGRA2BGR);
    cv.cvtColor(originalMat, labImage, cv.COLOR_BGR2Lab);

    // Split LAB channels
    const labChannels = new cv.MatVector();
    cv.split(labImage, labChannels);
    cleanUp.push(labImage);

    // Extract the L (lightness) channel
    const lum = labChannels.get(0).clone();
    lum.convertTo(lum, cv.CV_32F);
    const lumNorm = new cv.Mat();
    const scalarMat255 = cv.Mat.ones(lum.size(), cv.CV_32F);
    scalarMat255.setTo(cv.Scalar.all(255.0));
    cv.divide(lum, scalarMat255, lumNorm);
    cleanUp.push(lum, scalarMat255);

    const dummyOnes = cv.Mat.ones(lum.rows, lum.cols, cv.CV_32F);
    const lumSub = new cv.Mat();
    cv.subtract(dummyOnes, lumNorm, lumSub);
    const lumScalingFactor = sigmoid(lumSub, 5.0, 0.5);
    cleanUp.push(lumNorm, dummyOnes, lumSub);

    const adjustedMat = colorTemperature >= 0
      ? await boostWarmTemperature(colorTemperature, originalMat, lumScalingFactor)
      : await boostCoolTemperature(colorTemperature, originalMat, lumScalingFactor);

    // Convert for display
    cv.cvtColor(adjustedMat, adjustedMat, cv.COLOR_BGR2RGB);
    const result = adjustedMat.clone();

    // console.log("Temperature Adjusted", result);
    return result;
  } catch (error) {
    console.log(error);
    return src;
  } finally {
    cleanUp.forEach((mat) => mat.delete());
  }
}

export default modifyImageTemperature;