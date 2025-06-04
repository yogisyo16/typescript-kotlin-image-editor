import cv from "@techstark/opencv-js";

function hueShiftedProcess(imageToProcess: cv.Mat): cv.Mat {
  try {
    const hsvImage = new cv.Mat();
    cv.cvtColor(imageToProcess, hsvImage, cv.COLOR_BGR2HSV);

    const channels = new cv.MatVector();
    cv.split(hsvImage, channels);
    const h = channels.get(0);
    const s = channels.get(1);
    const v = channels.get(2);

    const redMask = new cv.Mat(h.rows, h.cols, cv.CV_32F);
    const mask1 = new cv.Mat();
    const mask2 = new cv.Mat();
    cv.threshold(h, mask1, 10, 1, cv.THRESH_BINARY_INV);
    cv.threshold(h, mask2, 170, 1, cv.THRESH_BINARY);
    cv.addWeighted(mask1, 1, mask2, 1, 0, redMask);
    cv.GaussianBlur(redMask, redMask, { width: 11, height: 11 }, 0);

    const hShifted = new cv.Mat();
    cv.convertScaleAbs(h, hShifted, 1, redMask.data[0] * -5);
    cv.threshold(hShifted, hShifted, 179, 179, cv.THRESH_TRUNC);

    const hsvShifted = new cv.Mat();
    const mergeChannels = new cv.MatVector();
    mergeChannels.push_back(hShifted);
    mergeChannels.push_back(s);
    mergeChannels.push_back(v);
    cv.merge(mergeChannels, hsvShifted);

    const bgrResult = new cv.Mat();
    cv.cvtColor(hsvShifted, bgrResult, cv.COLOR_HSV2BGR);

    hsvImage.delete();
    channels.delete();
    redMask.delete();
    mask1.delete();
    mask2.delete();
    hShifted.delete();
    hsvShifted.delete();
    mergeChannels.delete();

    return bgrResult;
  } catch (error) {
    console.error("Hue shift processing failed:", error);
    return imageToProcess;
  }
}

// -- Implement from for saturation
async function modifyImageSaturation(src: cv.Mat, saturation: number): Promise<cv.Mat> {
  try {
    const srcClone = src.clone();
    if (!srcClone || srcClone.empty()) {
      throw new Error("Input image is empty");
    }

    const originalImage = new cv.Mat();
    cv.cvtColor(srcClone, originalImage, cv.COLOR_RGB2BGR);

    const labImage = new cv.Mat();
    cv.cvtColor(originalImage, labImage, cv.COLOR_BGR2Lab);

    const labChannels = new cv.MatVector();
    cv.split(labImage, labChannels);
    const lum = labChannels.get(0);
    const oriA = labChannels.get(1);
    const oriB = labChannels.get(2);

    const satRatio = 1 + saturation / 100.0;
    const aTemp = new cv.Mat();
    const bTemp = new cv.Mat();
    cv.convertScaleAbs(oriA, aTemp, satRatio, (1 - satRatio) * 128);
    cv.convertScaleAbs(oriB, bTemp, satRatio, (1 - satRatio) * 128);

    cv.threshold(aTemp, aTemp, 255, 255, cv.THRESH_TRUNC);
    cv.threshold(aTemp, aTemp, 0, 0, cv.THRESH_TOZERO);
    cv.threshold(bTemp, bTemp, 255, 255, cv.THRESH_TRUNC);
    cv.threshold(bTemp, bTemp, 0, 0, cv.THRESH_TOZERO);

    const labAdjusted = new cv.Mat();
    const mergeChannels = new cv.MatVector();
    mergeChannels.push_back(lum);
    mergeChannels.push_back(aTemp);
    mergeChannels.push_back(bTemp);
    cv.merge(mergeChannels, labAdjusted);

    let adjustedImage = new cv.Mat();
    cv.cvtColor(labAdjusted, adjustedImage, cv.COLOR_Lab2BGR);

    if (saturation < 0) {
      const hueShiftedImage = hueShiftedProcess(adjustedImage);
      adjustedImage.delete();
      adjustedImage = hueShiftedImage;
    }

    const finalImage = new cv.Mat();
    cv.cvtColor(adjustedImage, finalImage, cv.COLOR_BGR2RGB);

    srcClone.delete();
    originalImage.delete();
    labImage.delete();
    labChannels.delete();
    aTemp.delete();
    bTemp.delete();
    labAdjusted.delete();
    mergeChannels.delete();
    adjustedImage.delete();

    return finalImage;
  } catch (error) {
    console.error("Error in modify_image_saturation:", error);
    throw error;
  }
}

export default modifyImageSaturation;