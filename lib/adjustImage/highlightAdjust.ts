import cv from "@techstark/opencv-js"

// -- Low Channel for highlight
function boostLowChannel(scaleRatio: number, originalMat: cv.Mat): cv.Mat {
  const cleanUp: cv.Mat[] = [];

  try {
    const adjustedImage = originalMat.clone();
    const highlightFactor = scaleRatio;

    const hsvImage = new cv.Mat();
    cv.cvtColor(adjustedImage, hsvImage, cv.COLOR_BGR2HSV);

    const channels = new cv.MatVector();
    cv.split(hsvImage, channels);
    const hue = channels.get(0);
    const saturation = channels.get(1);
    const value = channels.get(2);

    const scaledValue = new cv.Mat();
    cv.convertScaleAbs(value, scaledValue, 0.6 + highlightFactor * 0.4, 0);

    channels.set(2, scaledValue);

    cv.merge(channels, hsvImage);

    cv.cvtColor(hsvImage, adjustedImage, cv.COLOR_HSV2BGR);
    
    cleanUp.push(hsvImage, channels as any, scaledValue);

    return adjustedImage;
  } catch (error) {
    console.error("Highlight boost failed:", error);
    return originalMat;
  } finally {
    cleanUp.forEach((mat) => mat.delete());
  }
}

// -- Implement adjustment Highlights
async function modifyImageHighlights(src: cv.Mat, highlight: number): Promise<cv.Mat> {
  const cleanUp: cv.Mat[] = [];

  try {
    const srcClone = src.clone();
    if (!srcClone || srcClone.empty()) {
      throw new Error("Input image is empty");
    }

    const originalImage = new cv.Mat();
    cv.cvtColor(srcClone, originalImage, cv.COLOR_RGB2BGR);
    cleanUp.push(srcClone);

    const highlightFactor = highlight / 100;

    const hsvImage = new cv.Mat();
    cv.cvtColor(originalImage, hsvImage, cv.COLOR_BGR2HSV);
    cleanUp.push(originalImage);

    const channels = new cv.MatVector();
    cv.split(hsvImage, channels);
    const hue = channels.get(0);
    const saturation = channels.get(1);
    const value = channels.get(2);

    const scaledValue = new cv.Mat();
    if (highlightFactor >= 0) {
      cv.convertScaleAbs(value, scaledValue, 1 + highlightFactor * 0.7, 0);
    } else {
      cv.convertScaleAbs(value, scaledValue, 1 + highlightFactor * 0.5, 0);
    }

    channels.set(2, scaledValue);

    cv.merge(channels, hsvImage);

    let adjustedImage = new cv.Mat();
    cv.cvtColor(hsvImage, adjustedImage, cv.COLOR_HSV2BGR);
    cleanUp.push(hsvImage, channels as any, scaledValue);

    if (highlightFactor >= 0) {
      const boostedImage = boostLowChannel(highlightFactor, adjustedImage);
      // adjustedImage.delete();
      adjustedImage = boostedImage;
    }

    const finalImage = new cv.Mat();
    cv.cvtColor(adjustedImage, finalImage, cv.COLOR_BGR2RGB);
    cleanUp.push(adjustedImage);

    return finalImage;
  } catch (error) {
    console.error("Error in modify_image_highlights:", error);
    throw error;
  } finally {
    cleanUp.forEach((mat) => mat.delete());
  }
}

export default modifyImageHighlights;