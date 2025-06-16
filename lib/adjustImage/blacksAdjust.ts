import cv from "@techstark/opencv-js";

async function modifyImageBlacks(src: cv.Mat, score: number): Promise<cv.Mat> {
  const srcClone = src.clone();
  if (!srcClone || !srcClone.data) {
    throw new Error("Input image is empty or invalid");
  }

  if (score === 0.0) {
    return srcClone;
  }

  const matsToClean: cv.Mat[] = [srcClone];

  try {
    const originalMat = new cv.Mat();
    matsToClean.push(originalMat);
    cv.cvtColor(srcClone, originalMat, cv.COLOR_RGBA2BGR);

    const { height, width } = originalMat.size();

    const floatTypeImage = new cv.Mat();
    matsToClean.push(floatTypeImage);
    originalMat.convertTo(floatTypeImage, cv.CV_32F);

    // --- BGR to YUV Manual Conversion ---
    const bgrChannels = new cv.MatVector();
    // matsToClean.push(bgrChannels);
    cv.split(floatTypeImage, bgrChannels);

    const imgB = bgrChannels.get(0);
    const imgG = bgrChannels.get(1);
    const imgR = bgrChannels.get(2);

    const imgY = new cv.Mat(height, width, cv.CV_32F);
    const imgU = new cv.Mat(height, width, cv.CV_32F);
    const imgV = new cv.Mat(height, width, cv.CV_32F);
    matsToClean.push(imgY, imgU, imgV);

    cv.addWeighted(imgR, 0.299, imgG, 0.587, 0.0, imgY);
    cv.addWeighted(imgY, 1.0, imgB, 0.114, 0.0, imgY);
    cv.addWeighted(imgR, -0.168736, imgG, -0.331264, 0.0, imgU);
    cv.addWeighted(imgU, 1.0, imgB, 0.5, 0.0, imgU);
    cv.addWeighted(imgR, 0.5, imgG, -0.418688, 0.0, imgV);
    cv.addWeighted(imgV, 1.0, imgB, -0.081312, 0.0, imgV);

    // --- Shadow Adjustment Logic ---
    const shadowAmountPercent = score / 57.0;
    const shadowGain = 1.0 + shadowAmountPercent * 3.0;

    const shadowMap = new cv.Mat();
    matsToClean.push(shadowMap);
    cv.pow(imgY, 2.2, shadowMap);
    cv.normalize(shadowMap, shadowMap, 255.0, 0.0, cv.NORM_MINMAX);
    
    // CORRECTED: Create a Mat for the scalar value 255
    const mat255 = cv.Mat.ones(shadowMap.size(), shadowMap.type());
    mat255.setTo(new cv.Scalar(255.0));
    matsToClean.push(mat255);
    cv.subtract(mat255, shadowMap, shadowMap);


    // --- Create and Apply Look-Up Table (LUT) ---
    const tData = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
        tData[i] = (1 - Math.pow(1 - (i / 255.0), shadowGain)) * 255.0;
    }
    const t = cv.matFromArray(256, 1, cv.CV_32F, tData);
    const lut = new cv.Mat();
    matsToClean.push(t, lut);
    t.convertTo(lut, cv.CV_8U);

    const lookupResult = new cv.Mat();
    const imgY8U = new cv.Mat();
    matsToClean.push(lookupResult, imgY8U);
    imgY.convertTo(imgY8U, cv.CV_8U);
    cv.LUT(imgY8U, lut, lookupResult);

    const finalY = new cv.Mat();
    const shadowMapNormalized = new cv.Mat();
    const lookupResult32F = new cv.Mat();
    matsToClean.push(finalY, shadowMapNormalized, lookupResult32F);

    shadowMap.convertTo(shadowMapNormalized, cv.CV_32F, 1.0 / 255.0);
    lookupResult.convertTo(lookupResult32F, cv.CV_32F);

    // CORRECTED: Create a Mat for the scalar value 1.0
    const oneMinusMap = new cv.Mat();
    const mat1 = cv.Mat.ones(shadowMapNormalized.size(), shadowMapNormalized.type());
    mat1.setTo(new cv.Scalar(1.0));
    matsToClean.push(oneMinusMap, mat1);
    cv.subtract(mat1, shadowMapNormalized, oneMinusMap);

    const term1 = new cv.Mat();
    const term2 = new cv.Mat();
    matsToClean.push(term1, term2);
    cv.multiply(imgY, oneMinusMap, term1);
    cv.multiply(lookupResult32F, shadowMapNormalized, term2);
    cv.add(term1, term2, finalY);


    // --- YUV to BGR Manual Conversion ---
    const outputR = new cv.Mat();
    const outputG = new cv.Mat();
    const outputB = new cv.Mat();
    const temp1 = new cv.Mat();
    const temp2 = new cv.Mat();
    matsToClean.push(outputR, outputG, outputB, temp1, temp2);

    // CORRECTED: Create Mats for all scalar multipliers
    const vRedScalar = cv.Mat.ones(imgV.size(), imgV.type());
    vRedScalar.setTo(new cv.Scalar(1.402));
    const uGreenScalar = cv.Mat.ones(imgU.size(), imgU.type());
    uGreenScalar.setTo(new cv.Scalar(0.344136));
    const vGreenScalar = cv.Mat.ones(imgV.size(), imgV.type());
    vGreenScalar.setTo(new cv.Scalar(0.714136));
    const uBlueScalar = cv.Mat.ones(imgU.size(), imgU.type());
    uBlueScalar.setTo(new cv.Scalar(1.772));
    matsToClean.push(vRedScalar, uGreenScalar, vGreenScalar, uBlueScalar);

    // R = Y + 1.402 * V
    cv.multiply(imgV, vRedScalar, temp1);
    cv.add(finalY, temp1, outputR);

    // G = Y - 0.344136 * U - 0.714136 * V
    cv.multiply(imgU, uGreenScalar, temp1);
    cv.multiply(imgV, vGreenScalar, temp2);
    cv.subtract(finalY, temp1, outputG);
    cv.subtract(outputG, temp2, outputG);

    // B = Y + 1.772 * U
    cv.multiply(imgU, uBlueScalar, temp1);
    cv.add(finalY, temp1, outputB);

    // --- Final Assembly ---
    const outputChannels = new cv.MatVector();
    // matsToClean.push(outputChannels);

    outputB.convertTo(outputB, cv.CV_8U);
    outputG.convertTo(outputG, cv.CV_8U);
    outputR.convertTo(outputR, cv.CV_8U);

    outputChannels.push_back(outputB);
    outputChannels.push_back(outputG);
    outputChannels.push_back(outputR);

    const outputMat = new cv.Mat();
    matsToClean.push(outputMat);
    cv.merge(outputChannels, outputMat);

    const resultMat = new cv.Mat();
    cv.cvtColor(outputMat, resultMat, cv.COLOR_BGR2RGBA);

    return resultMat;
  } catch (error) {
    console.error("Error in modifyImageBlacks:", error);
    return src.clone();
  } finally {
    matsToClean.forEach((mat) => {
      if (mat && !mat.isDeleted()) {
        mat.delete();
      }
    });
  }
}

export default modifyImageBlacks;