import cv from "@techstark/opencv-js";

async function modifyImageBlacks(src: cv.Mat, score: number): Promise<cv.Mat> {
  // If score is 0, return a clone of the original image without modification.
  const srcClone = src.clone();

  // CRITICAL: Array to track all created Mats for cleanup to prevent memory leaks.
  const mats: cv.Mat[] = [];

  try {
    const originalMat = new cv.Mat();
    mats.push(originalMat);
    cv.cvtColor(srcClone, originalMat, cv.COLOR_RGBA2BGR);

    const { height, width } = originalMat.size();

    const floatTypeImage = originalMat.clone();
    mats.push(floatTypeImage);
    floatTypeImage.convertTo(floatTypeImage, cv.CV_32F);

    const bgrChannels = new cv.MatVector();
    cv.split(floatTypeImage, bgrChannels);

    const imgB = bgrChannels.get(0);
    const imgG = bgrChannels.get(1);
    const imgR = bgrChannels.get(2);
    mats.push(imgB, imgG, imgR);
    // bgrChannels.delete();

    const imgY = new cv.Mat(height, width, cv.CV_32F);
    const imgU = new cv.Mat(height, width, cv.CV_32F);
    const imgV = new cv.Mat(height, width, cv.CV_32F);
    mats.push(imgY, imgU, imgV);

    cv.addWeighted(imgR, 0.3, imgG, 0.59, 0.0, imgY);
    cv.addWeighted(imgY, 1.0, imgB, 0.11, 0.0, imgY);
    cv.addWeighted(imgR, -0.168736, imgG, -0.331264, 0.0, imgU);
    cv.addWeighted(imgU, 1.0, imgB, 0.5, 0.0, imgU);
    cv.addWeighted(imgR, 0.5, imgG, -0.418688, 0.0, imgV);
    cv.addWeighted(imgV, 1.0, imgB, -0.081312, 0.0, imgV);

    const shadowTonePercent = 0.8;
    const shadowAmountPercent = score / 57.0;
    const shadowRadius = 10;
    const shadowTone = shadowTonePercent * 255.0;
    const shadowGain = 1.0 + shadowAmountPercent * 3.0;

    const shadowMap = new cv.Mat();
    const tempMat = new cv.Mat(imgY.size(), cv.CV_32F, new cv.Scalar(255.0));
    mats.push(shadowMap, tempMat);

    // Using your preferred pattern for scalar multiplication
    const scalarMat1 = cv.Mat.ones(imgY.size(), imgY.type());
    scalarMat1.setTo(new cv.Scalar(255.0 / shadowTone));
    mats.push(scalarMat1);

    cv.multiply(imgY, scalarMat1, shadowMap);
    cv.subtract(tempMat, shadowMap, shadowMap);

    const mask = new cv.Mat();
    const invertedMask = new cv.Mat();
    mats.push(mask, invertedMask);

    cv.threshold(imgY, mask, shadowTone - 1, 1.0, cv.THRESH_BINARY);
    const onesMat = cv.Mat.ones(imgY.size(), cv.CV_32F);
    mats.push(onesMat);
    cv.subtract(onesMat, mask, invertedMask);

    cv.multiply(shadowMap, invertedMask, shadowMap);

    // Gaussian blur can be re-enabled if needed.
    // if (shadowAmountPercent * shadowRadius > 0) {
    //   const ksize = new cv.Size(shadowRadius, shadowRadius);
    //   cv.blur(shadowMap, shadowMap, ksize);
    // }
    
    const tData = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      tData[i] = (1 - Math.pow(1 - (i / 255.0), shadowGain)) * 255.0;
    }
    const t = cv.matFromArray(256, 1, cv.CV_32F, tData);
    const LUTShadow = new cv.Mat();
    mats.push(t, LUTShadow);

    cv.min(t, new cv.Scalar(255.0), t);
    cv.max(t, new cv.Scalar(0.0), t);
    t.convertTo(LUTShadow, cv.CV_8U);

    let finalY = imgY.clone();
    mats.push(finalY);

    if (shadowAmountPercent !== 0.0) {
      const scalarMat3 = cv.Mat.ones(shadowMap.size(), shadowMap.type());
      scalarMat3.setTo(new cv.Scalar(1.0 / 255.0));
      mats.push(scalarMat3);
      cv.multiply(shadowMap, scalarMat3, shadowMap);

      const lookup = new cv.Mat();
      const tempY = finalY.clone();
      mats.push(lookup, tempY);
      
      tempY.convertTo(tempY, cv.CV_8U);
      cv.LUT(tempY, LUTShadow, lookup);

      const tempShadow = cv.Mat.ones(shadowMap.size(), cv.CV_32F);
      mats.push(tempShadow);
      cv.subtract(tempShadow, shadowMap, tempShadow);

      cv.multiply(finalY, tempShadow, finalY);
      lookup.convertTo(lookup, cv.CV_32F);
      cv.multiply(lookup, shadowMap, lookup);
      cv.add(finalY, lookup, finalY);
    }

    const outputR = new cv.Mat();
    const outputG = new cv.Mat();
    const outputB = new cv.Mat();
    const temp1 = new cv.Mat();
    const temp2 = new cv.Mat();
    mats.push(outputR, outputG, outputB, temp1, temp2);

    const vForRedMat = cv.Mat.ones(imgV.size(), imgV.type());
    vForRedMat.setTo(new cv.Scalar(1.402));
    const uForGreenMat = cv.Mat.ones(imgU.size(), imgU.type());
    uForGreenMat.setTo(new cv.Scalar(0.34414));
    const vForGreenMat = cv.Mat.ones(imgV.size(), imgV.type());
    vForGreenMat.setTo(new cv.Scalar(0.71414));
    const uForBlueMat = cv.Mat.ones(imgU.size(), imgU.type());
    uForBlueMat.setTo(new cv.Scalar(1.772));
    mats.push(vForRedMat, uForGreenMat, vForGreenMat, uForBlueMat);

    cv.multiply(imgV, vForRedMat, temp1);
    cv.add(finalY, temp1, outputR);
    
    cv.multiply(imgU, uForGreenMat, temp1);
    cv.multiply(imgV, vForGreenMat, temp2);
    cv.subtract(finalY, temp1, outputG);
    cv.subtract(outputG, temp2, outputG);

    cv.multiply(imgU, uForBlueMat, temp1);
    cv.add(finalY, temp1, outputB);

    const outputChannels = new cv.MatVector();
    
    outputB.convertTo(outputB, cv.CV_8U);
    outputG.convertTo(outputG, cv.CV_8U);
    outputR.convertTo(outputR, cv.CV_8U);
    
    outputChannels.push_back(outputB);
    outputChannels.push_back(outputG);
    outputChannels.push_back(outputR);
    
    const outputMat = new cv.Mat();
    cv.merge(outputChannels, outputMat);
    // outputChannels.delete();
    
    const resultMat = new cv.Mat();
    cv.cvtColor(outputMat, resultMat, cv.COLOR_BGR2RGBA);
    // outputMat.delete();
    
    console.debug("test out");
    return resultMat;

  } finally {
    // Crucial: Clean up all intermediate Mat objects to prevent memory leaks.
    mats.forEach(mat => {
      if (mat && !mat.isDeleted()) {
        mat.delete();
      }
    });
  }
};

export default modifyImageBlacks;