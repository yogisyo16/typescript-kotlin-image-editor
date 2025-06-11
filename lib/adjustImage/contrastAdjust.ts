import cv, { cvtColor } from "@techstark/opencv-js";
import { sigmoid } from "@/lib/adjustImage/sigmoidAdjust";

function interpMatAllMat(x: cv.Mat, xp: cv.Mat, fp: cv.Mat): cv.Mat {
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
async function applyMidtonesContrast(originalMat: cv.Mat, contrastFactor: number): Promise<cv.Mat> {
  const cleanUp: cv.Mat[] = [];

  try {
    const labImg = new cv.Mat();
    cv.cvtColor(originalMat, labImg, cv.COLOR_BGR2Lab);
    labImg.convertTo(labImg, cv.CV_32F);

    const labChannels = new cv.MatVector();
    cv.split(labImg, labChannels);
    cleanUp.push(labImg);

    const lum = labChannels.get(0).clone();
    const oriA = labChannels.get(1).clone();
    const oriB = labChannels.get(2).clone();
    cleanUp.push(labChannels as any);

    const lNorm = new cv.Mat();
    const scalar255 = new cv.Mat(lum.rows, lum.cols, cv.CV_32F, new cv.Scalar(255));
    cv.divide(lum, scalar255, lNorm);
    cleanUp.push(scalar255, lum);

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

    const interpolationRes = await interpMatAllMat(lNorm, element, curveValue);
    const scalar255Mul = new cv.Mat(interpolationRes.rows, interpolationRes.cols, cv.CV_32F, new cv.Scalar(255));
    cv.multiply(interpolationRes, scalar255Mul, interpolationRes);
    cleanUp.push(lNorm, element, curveValue, scalar255Mul);

    const adjustedLab = new cv.Mat();
    const mergedChannels = new cv.MatVector();
    mergedChannels.push_back(interpolationRes);
    mergedChannels.push_back(oriA);
    mergedChannels.push_back(oriB);
    cv.merge(mergedChannels, adjustedLab);
    adjustedLab.convertTo(adjustedLab, cv.CV_8U);
    cleanUp.push(interpolationRes, oriA, oriB, mergedChannels as any);

    const result = new cv.Mat();
    cv.cvtColor(adjustedLab, result, cv.COLOR_Lab2BGR);
    cleanUp.push(adjustedLab);

    return result;
  } catch (error) {
    console.error(error);
    return originalMat;
  } finally {
    cleanUp.forEach((mat) => mat.delete());
  }
}

// -- For Boosting Red on Contrast
async function boostRedContrast(originalMat: cv.Mat, lum: cv.Mat, oriA: cv.Mat): Promise<cv.Mat> {
  const cleanUp: cv.Mat[] = [];
  try {
    const floatOriImg = originalMat.clone();
    floatOriImg.convertTo(floatOriImg, cv.CV_32F);

    const oriBgrChannels = new cv.MatVector();
    cv.split(floatOriImg, oriBgrChannels);
    cleanUp.push(floatOriImg, oriBgrChannels as any);

    const lNormalize = new cv.Mat();
    const scalar255 = new cv.Mat(lum.rows, lum.cols, cv.CV_32F, new cv.Scalar(255));
    cv.divide(lum, scalar255, lNormalize);
    cleanUp.push(scalar255);

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
    cleanUp.push(centerMat, negOneMat, widthMat);

    const redMask = new cv.Mat();
    const scalar150 = new cv.Mat(oriA.rows, oriA.cols, cv.CV_32F, new cv.Scalar(150));
    cv.subtract(oriA, scalar150, redMask);
    const scalar40 = new cv.Mat(redMask.rows, redMask.cols, cv.CV_32F, new cv.Scalar(40));
    cv.divide(redMask, scalar40, redMask);
    const scalarOne = new cv.Mat(redMask.rows, redMask.cols, cv.CV_32F, new cv.Scalar(1));
    cv.min(redMask, scalarOne, redMask);
    const scalarZero = new cv.Mat(redMask.rows, redMask.cols, cv.CV_32F, new cv.Scalar(0));
    cv.max(redMask, scalarZero, redMask);
    cleanUp.push(scalar150, scalar40,scalarOne, scalarZero);

    const combinedMask = new cv.Mat();
    cv.multiply(lNormalize, redMask, combinedMask);
    cleanUp.push(lNormalize, redMask);

    const curLabImg = new cv.Mat();
    cv.cvtColor(originalMat, curLabImg, cv.COLOR_BGR2Lab);
    curLabImg.convertTo(curLabImg, cv.CV_32F);

    const labChannels = new cv.MatVector();
    cv.split(curLabImg, labChannels);
    cleanUp.push(curLabImg);

    const curLum = labChannels.get(0).clone();
    const curOriA = labChannels.get(1).clone();
    const curOriB = labChannels.get(2).clone();

    const normalizeCurLum = new cv.Mat();
    const scalar255Cur = new cv.Mat(curLum.rows, curLum.cols, cv.CV_32F, new cv.Scalar(255));
    cv.divide(curLum, scalar255Cur, normalizeCurLum);

    const redScale = await sigmoid(normalizeCurLum, 8.3, 0.5, 50.0);
    cleanUp.push(scalar255Cur, normalizeCurLum, labChannels as any);

    const lumScale = new cv.Mat();
    const scalarTwo = new cv.Mat(redScale.rows, redScale.cols, cv.CV_32F, new cv.Scalar(2));
    cv.divide(redScale, scalarTwo, lumScale);
    cv.multiply(combinedMask, lumScale, lumScale);
    cv.subtract(curLum, lumScale, curLum);
    cleanUp.push(scalarTwo, lumScale);

    const aScale = new cv.Mat();
    cv.multiply(combinedMask, redScale, aScale);
    cv.add(curOriA, aScale, curOriA);
    cleanUp.push(aScale);

    const newLab = new cv.Mat();
    const newLabChannels = new cv.MatVector();
    newLabChannels.push_back(curLum);
    newLabChannels.push_back(curOriA);
    newLabChannels.push_back(curOriB);
    cv.merge(newLabChannels, newLab);
    newLab.convertTo(newLab, cv.CV_8U);
    cleanUp.push(curOriA, curOriB, newLabChannels as any);

    const bgrImage = new cv.Mat();
    cv.cvtColor(newLab, bgrImage, cv.COLOR_Lab2BGR);
    bgrImage.convertTo(bgrImage, cv.CV_32F);

    const bgrChannels = new cv.MatVector();
    cv.split(bgrImage, bgrChannels);
    cleanUp.push(newLab, bgrImage);

    const gCh = bgrChannels.get(1).clone();
    const rCh = bgrChannels.get(2).clone();
    cleanUp.push(bgrChannels as any);

    const greenScale = new cv.Mat();
    const scalar10 = new cv.Mat(combinedMask.rows, combinedMask.cols, cv.CV_32F, new cv.Scalar(10));
    cv.multiply(combinedMask, scalar10, greenScale);
    cv.add(gCh, greenScale, gCh);
    cleanUp.push(scalar10, greenScale);

    const newBgr = new cv.Mat();
    const newBgrChannels = new cv.MatVector();
    newBgrChannels.push_back(oriBgrChannels.get(0));
    newBgrChannels.push_back(gCh);
    newBgrChannels.push_back(rCh);
    cv.merge(newBgrChannels, newBgr);
    newBgr.convertTo(newBgr, cv.CV_8U);
    cleanUp.push(gCh, rCh, newBgrChannels as any);

    return newBgr;
  } catch(error) {
    console.log(error);
    return originalMat;
  } finally {
    cleanUp.forEach((mat) => mat.delete());
  }
}

// -- Implement adjustment Contrast
async function modifyImageContrast(src: cv.Mat, score: number): Promise<cv.Mat> {
  const cleanUp: cv.Mat[] = [];

  try {
    const srcClone = src.clone();
    // srcClone.convertTo(srcClone, src.channels() === 4 ? cv.CV_16SC4 : cv.CV_16SC3);
    // srcClone.convertTo(srcClone, src.channels() === 4 ? cv.CV_8UC4 : cv.CV_8UC3);
    cv.cvtColor(srcClone, srcClone, cv.COLOR_BGRA2BGR);
    const contrastFactor = score / 10;

    if (contrastFactor >= 0) {
      const lowVal = 4.0;
      const highVal = 9.0;
      const midpoint = 0.5;
      const contrastScale = lowVal + (highVal - lowVal) / (1 + Math.exp(-0.3 * (contrastFactor - 1)));

      const normalizeImg = srcClone.clone();
      normalizeImg.convertTo(normalizeImg, cv.CV_32F);
      const scalar255 = new cv.Mat(normalizeImg.rows, normalizeImg.cols, cv.CV_32FC3, new cv.Scalar(255, 255, 255));
      cv.divide(normalizeImg, scalar255, normalizeImg);

      const resultImg = await sigmoid(normalizeImg, contrastScale, midpoint, 0.9);
      cv.multiply(resultImg, scalar255, resultImg);
      resultImg.convertTo(resultImg, cv.CV_64F);
      cleanUp.push(normalizeImg, scalar255);

      const image8Bit = resultImg.channels() === 4 ? cv.CV_16SC4 : cv.CV_16SC3;
      cv.cvtColor(image8Bit, resultImg, cv.COLOR_BGR2BGRA);
      // resultImg.convertTo(resultImg, cv.CV_32SC4);
      console.debug("Result Type: ", resultImg.type(), "Original Image type: ", src.type());
      return resultImg;
    } else {
      const labImg = new cv.Mat();
      cv.cvtColor(srcClone, labImg, cv.COLOR_BGR2Lab);
      labImg.convertTo(labImg, cv.CV_32F);

      const labChannels = new cv.MatVector();
      cv.split(labImg, labChannels);
      cleanUp.push(labImg);

      const adjustedContrastScore = contrastFactor / 100;
      const lum = labChannels.get(0).clone();
      const oriA = labChannels.get(1).clone();
      const fScore = 131.0 * (adjustedContrastScore + 127) / (127 * (131 - adjustedContrastScore));
      const alphaC = fScore;
      const gammaC = 127 * (1 - fScore);
      cleanUp.push(labChannels as any);

      const floatMat = srcClone.clone();
      floatMat.convertTo(floatMat, cv.CV_32F);

      const resultMat = new cv.Mat();
      cv.addWeighted(floatMat, alphaC, floatMat, 0.0, gammaC, resultMat);
      resultMat.convertTo(resultMat, cv.CV_8UC4);
      cleanUp.push(floatMat);

      const boostScore = 60 * Math.pow(Math.abs(contrastFactor) / 10.0, 1.5);
      const afterMidtonesAdj = await applyMidtonesContrast(resultMat, boostScore);
      const afterRedBoostAdj = await boostRedContrast(afterMidtonesAdj, lum, oriA);
      cleanUp.push(lum, oriA, resultMat, afterMidtonesAdj);

      cv.cvtColor(afterRedBoostAdj, afterRedBoostAdj, cv.COLOR_Lab2BGR);
      cv.cvtColor(afterRedBoostAdj, afterRedBoostAdj, cv.COLOR_BGR2BGRA);
      // afterRedBoostAdj.convertTo(afterRedBoostAdj, cv.CV_16SC4);
      // const image16Bit2 = afterRedBoostAdj.channels() === 4 ? cv.CV_16SC4 : cv.CV_16SC3;
      // afterRedBoostAdj.convertTo(afterRedBoostAdj, image16Bit2);

      console.debug("Result Type: ", afterRedBoostAdj.type(), "Original Image type: ", src.type());
      return afterRedBoostAdj;
    }
  } catch (error) {
    console.log(error);
    return src;
  } finally {
    cleanUp.forEach((mat) => mat.delete());
  }
}

export default modifyImageContrast;