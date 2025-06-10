import cv from "@techstark/opencv-js";

async function modifyImageBlacks(src: cv.Mat, blacks: number): Promise<cv.Mat> {
  const cleanUp: cv.Mat[] = [];

  try {
    const srcClone = src.clone();
    if (!srcClone || srcClone.empty()) {
      throw new Error("Input image is empty");
    }

    srcClone.convertTo(srcClone, src.channels() === 4 ? cv.CV_16SC4 : cv.CV_16SC3);
    
    srcClone.convertTo(srcClone, src.channels() === 4 ? cv.CV_8UC4 : cv.CV_8UC3);

    const originalImage = new cv.Mat();
    cv.cvtColor(srcClone, originalImage, cv.COLOR_RGB2BGR);
    originalImage.convertTo(originalImage, src.channels() === 4 ? cv.CV_8UC4 : cv.CV_8UC3);

    const blackFactor = blacks / 100;

    const hsvImage = new cv.Mat();
    cv.cvtColor(originalImage, hsvImage, cv.COLOR_BGR2HSV);
    cleanUp.push(originalImage);

    const channels = new cv.MatVector();
    cv.split(hsvImage, channels);
    const hue = channels.get(0);
    const saturation = channels.get(1);
    const value = channels.get(2);

    const scaledValue = new cv.Mat();
    let contrastFactor = 0;
    if (blackFactor >= 0) {
      cv.convertScaleAbs(value, scaledValue, 1 - blackFactor * 0.5, -blackFactor * 10);
    } else {
      contrastFactor = 0.1 * (1 - Math.exp(-Math.abs(blackFactor) / 0.4));
      cv.convertScaleAbs(value, scaledValue, 1 + contrastFactor, blackFactor * 15);
    }

    channels.set(2, scaledValue);
    cleanUp.push(scaledValue);

    cv.merge(channels, hsvImage);

    let adjustedImage = new cv.Mat();
    cv.cvtColor(hsvImage, adjustedImage, cv.COLOR_HSV2BGR);
    cleanUp.push(hsvImage);

    // if (blackFactor >= 0 && typeof cv.GaussianBlur === 'function') {
    //   const blurredImage = new cv.Mat();
    //   cv.GaussianBlur(adjustedImage, blurredImage, { width: 3, height: 3 }, 0);
    //   adjustedImage.delete();
    //   adjustedImage = blurredImage;
    // }

    const finalImage = new cv.Mat();

    cv.cvtColor(adjustedImage, finalImage, cv.COLOR_BGR2RGB);
    cv.cvtColor(finalImage, finalImage, cv.COLOR_RGB2RGBA);
    const image16Bit = finalImage.channels() === 4 ? cv.CV_16SC4 : cv.CV_16SC3;
    finalImage.convertTo(finalImage, image16Bit);
    
    return finalImage;
  } catch (error) {
    console.error("Error in modify_image_blacks:", error);
    throw error;
  } finally {
    cleanUp.forEach((mat) => mat.delete());
  }
}

export default modifyImageBlacks;