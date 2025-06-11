import cv, { rows } from "@techstark/opencv-js";

async function modifyImageExposure(src: cv.Mat, score: number): Promise<cv.Mat> {
  const cleanUp: cv.Mat[] = [];

  try {
    const srcClone = src.clone();

    // srcClone.convertTo(srcClone, src.channels() === 4 ? cv.CV_16SC4 : cv.CV_16SC3);
    // srcClone.convertTo(srcClone, src.channels() === 4 ? cv.CV_8UC4 : cv.CV_8UC3);

    // Ensure input is 3 channels (BGR) to avoid RGBA issues
    cv.cvtColor(srcClone, srcClone, cv.COLOR_BGRA2BGR);

    const originalHsvMat = new cv.Mat();
    cv.cvtColor(srcClone, originalHsvMat, cv.COLOR_BGR2HSV);

    const hsvChannels: cv.MatVector = new cv.MatVector();
    cv.split(originalHsvMat, hsvChannels);
    const hue = hsvChannels.get(0);
    cleanUp.push(originalHsvMat);

    let factor = 1.0;
    let beta = 0.0;
    if (score > 0) {
        beta = 15 * score;
        factor = Math.pow(2.0, score / 2.2);
    } else {
        factor = Math.pow(2.0, score / 1.5);
    }
    // console.debug(score);

    const imageFloat = new cv.Mat();
    srcClone.convertTo(imageFloat, cv.CV_64FC3);

    // Multiply by factor using a Mat
    const factorMat = new cv.Mat(imageFloat.rows, imageFloat.cols, cv.CV_64FC3, new cv.Scalar(factor, factor, factor));
    cv.multiply(imageFloat, factorMat, imageFloat);
    cleanUp.push(factorMat);

    // Create a Mat for max score (255) instead of Scalar
    const maxMat = new cv.Mat(imageFloat.rows, imageFloat.cols, cv.CV_64FC3, new cv.Scalar(255, 255, 255));
    cv.min(imageFloat, maxMat, imageFloat);
    imageFloat.convertTo(srcClone, cv.CV_8UC3);
    cleanUp.push(imageFloat, maxMat);

    const adjustedMat = new cv.Mat();
    cv.convertScaleAbs(srcClone, adjustedMat, 1.0, beta);

    let finalHSV = new cv.Mat();
    cv.cvtColor(adjustedMat, finalHSV, cv.COLOR_BGR2HSV);
    cleanUp.push(adjustedMat);

    const finalHsvChannels = new cv.MatVector();
    cv.split(finalHSV, finalHsvChannels);

    const sTemp = finalHsvChannels.get(1);
    const vTemp = finalHsvChannels.get(2);

    const mergedHsv = new cv.MatVector();
    mergedHsv.push_back(hue);
    mergedHsv.push_back(sTemp);
    mergedHsv.push_back(vTemp);
    cv.merge(mergedHsv, finalHSV);

    const testRow = 200;
    const testCols = 310;
    const testRow1 = 270;
    const testCols1 = 430;
    const testRow2 = 310;
    const testCols2 = 450;

    // Note: At this point, finalHSV is still in HSV color space.
    // The channel values will be Hue, Saturation, and Value.
    // console.log(`--- Debugging Pixel at (Row: ${testRow}, Col: ${testCols}) ---`);
    // console.log(`finalHSV before conversion: rows=${finalHSV.rows}, cols=${finalHSV.cols}, channels=${finalHSV.channels()}, type=${finalHSV.type()}`);

    // const hsvPixel = finalHSV.ucharPtr(testRow, testCols);
    // const H = hsvPixel[0];
    // const S = hsvPixel[1];
    // const V = hsvPixel[2];

    // console.log(`HSV Pixel Values: H=${H}, S=${S}, V=${V}`);

    cv.cvtColor(finalHSV, finalHSV, cv.COLOR_HSV2BGR);
    

    console.log('Debug finalHSV after conversion to BGR:');
    const finalPixel = finalHSV.ucharPtr(testRow, testCols);
    const finalPixel1 = finalHSV.ucharPtr(testRow1, testCols1);
    const finalPixel2 = finalHSV.ucharPtr(testRow2, testCols2);
    const [B, G, R, A] = finalPixel;
    const [B1, G1, R1, A1] = finalPixel1;
    const [B2, G2, R2, A2] = finalPixel2;
    console.log('Final BGRA Channels: ', finalHSV.channels());
    console.log(`Final BGRA Pixel Values: B=${B}, G=${G}, R=${R}, A=${A}`);
    console.log(`Final BGRA Pixel Values: B=${B1}, G=${G1}, R=${R1}, A=${A1}`);
    console.log(`Final BGRA Pixel Values: B=${B2}, G=${G2}, R=${R2}, A=${A2}`);

    cv.cvtColor(finalHSV, finalHSV, cv.COLOR_BGR2BGRA);
    // const image16Bit = finalHSV.channels() === 4 ? cv.CV_16SC4 : cv.CV_16SC3;
    // const image8Bit = finalHSV.channels() === 4 ? cv.CV_8UC4 : cv.CV_8UC3;
    // finalHSV.convertTo(finalHSV, image8Bit);
    return finalHSV; 
  } catch (error) {
    console.error("Error modifying image exposure:", error);
    return src;
  } finally {
    cleanUp.forEach((mat) => mat.delete());
  }
}

export default modifyImageExposure;