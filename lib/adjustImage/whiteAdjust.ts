import cv from "@techstark/opencv-js";
import { sigmoid } from "@/lib/adjustImage/sigmoidAdjust";

function boostScaleForWhite(stdVal: number): number {
  const minBoost = 12.0;
  const maxBoost = 250.0;
  const decayFactor = 0.048;

  return Math.min(minBoost + (maxBoost - minBoost) * Math.exp(-decayFactor * stdVal), 100.0);
}

// -- BoostColor on WHITE
function boostColourFromWhite(scaleRatio: number, originalMat: cv.Mat): cv.Mat {
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

  const lumScalingFactor = sigmoid(lumNorm, 12.0, 0.1, 5.0);

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
async function modifyImageWhites(src: cv.Mat, whites: number): Promise<cv.Mat> {
  if (whites < 0) {
    const labImg = new cv.Mat();
    cv.cvtColor(src, labImg, cv.COLOR_BGR2Lab);
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

    const lumScalingFactor = sigmoid(lumNorm, 12.0, 0.5, 1.2);
    const scale = cv.Mat.ones(lum.size(), cv.CV_32F);

    // Create a Mat with the scalar value adjustedWhite
    const adjustedWhiteMat = cv.Mat.ones(lumScalingFactor.size(), cv.CV_32F);
    adjustedWhiteMat.setTo(new cv.Scalar(adjustedWhite));
    cv.multiply(lumScalingFactor, adjustedWhiteMat, scale);

    const oneMat = cv.Mat.ones(lum.size(), cv.CV_32F);
    cv.add(oneMat, scale, scale);

    const floatTypeMat = src.clone();
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
    cv.cvtColor(src, originalHsvMat, cv.COLOR_BGR2HSV);
    const originHsvChannels = new cv.MatVector();
    cv.split(originalHsvMat, originHsvChannels);
  
    const stdDev = new cv.Mat();
    const meanMat = new cv.Mat();
    cv.meanStdDev(originHsvChannels.get(2), meanMat, stdDev);
    const stdVal = stdDev.data64F[0];
  
    const whiteBoostRatio = (whites / 30.0) * (boostScaleForWhite(stdVal) / 100);
  
    const height = src.rows;
    const width = src.cols;
  
    const floatTypeImage = src.clone();
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
  
    let resultMat = src.clone();
    if (whites !== 0.0) {
      resultMat = boostColourFromWhite(whiteBoostRatio, outputMat);
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

export default modifyImageWhites;