import cv from "@techstark/opencv-js";
import { sigmoid } from "@/lib/adjustImage/sigmoidAdjust";

function boostMagenta(tintScale: number, originalMat: cv.Mat, lumScalingFactor: cv.Mat): cv.Mat {
  const cleanUp: cv.Mat[] = [];
  try {
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
    cleanUp.push(redAdjustment, redScalarMat);

    const greenScalarMat = cv.Mat.ones(greenAdjustment.size(), cv.CV_32F);
    greenScalarMat.setTo(cv.Scalar.all(adjustedTint * 0.006));
    cv.multiply(greenAdjustment, greenScalarMat, greenAdjustment);
    cv.multiply(greenAdjustment, lumScalingFactor, greenAdjustment);
    cv.subtract(greenScale, greenAdjustment, greenScale);
    cleanUp.push(greenAdjustment, greenScalarMat);

    const blueScalarMat = cv.Mat.ones(blueAdjustment.size(), cv.CV_32F);
    blueScalarMat.setTo(cv.Scalar.all(adjustedTint * 0.04));
    cv.multiply(blueAdjustment, blueScalarMat, blueAdjustment);
    cv.multiply(blueAdjustment, lumScalingFactor, blueAdjustment);
    cv.add(blueScale, blueAdjustment, blueScale);
    cleanUp.push(blueAdjustment, blueScalarMat);

    const channels = new cv.MatVector();
    cv.split(originalMat, channels);

    const ch0 = channels.get(0);
    const ch1 = channels.get(1);
    const ch2 = channels.get(2);
    ch0.convertTo(ch0, cv.CV_32F);
    ch1.convertTo(ch1, cv.CV_32F);
    ch2.convertTo(ch2, cv.CV_32F);
    cleanUp.push(channels as any)

    cv.multiply(ch2, redScale, ch2);
    cv.multiply(ch1, greenScale, ch1);
    cv.multiply(ch0, blueScale, ch0);
    cleanUp.push(redScale, greenScale, blueScale);

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
    cleanUp.push(ch0, ch1, ch2, matVector as any);

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
    cleanUp.push(bChannel, scalarMat255);

    const bLabScalingFactor = sigmoid(bNorm, 8.0, 0.6, 2.5);
    const bScale = cv.Mat.ones(bLabScalingFactor.rows, bLabScalingFactor.cols, cv.CV_32F);
    const bAdjustment = cv.Mat.ones(bScale.rows, bScale.cols, cv.CV_32F);
    cleanUp.push(bNorm);

    const bScalarMat = cv.Mat.ones(bAdjustment.size(), cv.CV_32F);
    bScalarMat.setTo(cv.Scalar.all(adjustedTint / 145.0));
    cv.multiply(bAdjustment, bScalarMat, bAdjustment);
    cv.multiply(bAdjustment, bLabScalingFactor, bAdjustment);
    cv.subtract(bScale, bAdjustment, bScale);
    cleanUp.push(bLabScalingFactor, bScalarMat, bAdjustment);

    const labCh2 = labChannels.get(2);
    labCh2.convertTo(labCh2, cv.CV_32F);
    bScale.convertTo(bScale, cv.CV_32F);
    cv.multiply(labCh2, bScale, labCh2);
    labCh2.convertTo(labCh2, cv.CV_8U);
    cleanUp.push(labCh2, bScale);

    cv.merge(labChannels, labMat);
    cv.cvtColor(labMat, originalMat, cv.COLOR_Lab2BGR);
    cleanUp.push(labChannels as any, labMat);

    const finalChannels = new cv.MatVector();
    cv.split(originalMat, finalChannels);
    finalChannels.set(2, curRedChannels.clone());
    finalChannels.set(1, curGreenChannels.clone());

    cv.merge(finalChannels, originalMat);
    originalMat.convertTo(originalMat, cv.CV_8U);
    cleanUp.push(finalChannels as any, curRedChannels, curGreenChannels);

    return originalMat;
  } catch (error) {
    console.log(error);
    return originalMat;
  // } finally {
  //   cleanUp.forEach((mat) => mat.delete());
  }
}

// -- Green Temperature for Tint
function boostGreen(tintScale: number, originalMat: cv.Mat, lumScalingFactor: cv.Mat): cv.Mat {
  const cleanUp: cv.Mat[] = [];
  
  try {
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

    const aLabScalingFactor = sigmoid(aNorm, 8.0, 0.8, 8.0);
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

    return originalMat;
  } catch (error) {
    console.log(error);
    return originalMat;
  // } finally {
  //   cleanUp.forEach((mat) => mat.delete());
  }
}

// -- Implement adjustment Tint
async function modifyImageTint(src: cv.Mat, tint: number): Promise<cv.Mat> {
  const cleanUp: cv.Mat[] = [];

  try {
    const labImage = new cv.Mat();
    const originalMat = src.clone();
    tint = tint / 10;
    cv.cvtColor(originalMat, originalMat, cv.COLOR_BGRA2BGR);
    cv.cvtColor(originalMat, labImage, cv.COLOR_BGR2Lab);

    const labChannels = new cv.MatVector();
    cv.split(labImage, labChannels);
    cleanUp.push(labImage);

    const lum = labChannels.get(0).clone();
    lum.convertTo(lum, cv.CV_32F);
    const lumNorm = new cv.Mat();
    const scalarMat255 = cv.Mat.ones(lum.size(), cv.CV_32F);
    scalarMat255.setTo(cv.Scalar.all(255.0));
    cv.divide(lum, scalarMat255, lumNorm);
    cleanUp.push(scalarMat255);

    const dummyOnes = cv.Mat.ones(lum.rows, lum.cols, cv.CV_32F);
    const lumSub = new cv.Mat();
    cv.subtract(dummyOnes, lumNorm, lumSub);
    const lumScalingFactor = sigmoid(lumSub, 5.0, 0.5);
    cleanUp.push(lum, dummyOnes, lumNorm, lumSub);

    const bChannel = labChannels.get(2).clone();
    bChannel.convertTo(bChannel, cv.CV_32F);
    const bNorm = new cv.Mat();
    const bScalarMat255 = cv.Mat.ones(bChannel.size(), cv.CV_32F);
    bScalarMat255.setTo(cv.Scalar.all(255.0));
    cv.divide(bChannel, bScalarMat255, bNorm);
    const bLabBoostFactor = sigmoid(bNorm, 11.0, 0.625, 8.0);
    cleanUp.push(bChannel, bScalarMat255, labChannels as any, bNorm, bLabBoostFactor);

    const adjustedMat = tint >= 0
      ? await boostMagenta(tint, originalMat, lumScalingFactor)
      : await boostGreen(tint, originalMat, lumScalingFactor);

    cleanUp.push(lumScalingFactor);

    return adjustedMat;
  } catch(error) {
    console.log(error);
    return src;
  // } finally {
  //   cleanUp.forEach((mat) => mat.delete());
  }
}

export default modifyImageTint;