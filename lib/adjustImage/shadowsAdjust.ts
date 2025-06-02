import cv from "@techstark/opencv-js";

async function modifyImageShadows(src: cv.Mat, shadows: number): Promise<cv.Mat> {
  try {
    const srcClone = src.clone();
    if (!srcClone || srcClone.empty()) {
      throw new Error("Input image is empty");
    }

    const originalImage = new cv.Mat();
    cv.cvtColor(srcClone, originalImage, cv.COLOR_RGB2BGR);

    // Map shadows (0 to 100) to a darkening factor (1 to 0)
    const shadowFactor = 1 - (shadows / -100); // 1 (no change) to 0 (max darkening)

    const hsvImage = new cv.Mat();
    cv.cvtColor(originalImage, hsvImage, cv.COLOR_BGR2HSV);

    const channels = new cv.MatVector();
    cv.split(hsvImage, channels);
    const hue = channels.get(0);
    const saturation = channels.get(1);
    const value = channels.get(2);

    const scaledValue = new cv.Mat();
    // Scale the value channel to darken the image
    cv.convertScaleAbs(value, scaledValue, shadowFactor, 0);

    channels.set(2, scaledValue);
    cv.merge(channels, hsvImage);

    let adjustedImage = new cv.Mat();
    cv.cvtColor(hsvImage, adjustedImage, cv.COLOR_HSV2BGR);

    const finalImage = new cv.Mat();
    cv.cvtColor(adjustedImage, finalImage, cv.COLOR_BGR2RGB);

    // Clean up
    src.delete();
    originalImage.delete();
    hsvImage.delete();
    channels.delete();
    scaledValue.delete();
    adjustedImage.delete();

    return finalImage;
  } catch (error) {
    console.error("Error in modify_image_shadows:", error);
    throw error;
  }
}

export default modifyImageShadows;