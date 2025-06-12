import cv from "@techstark/opencv-js";

// For 8 bit images converter into 16 bit
// used for delta logic calculation
// new code here no need checking, just change each to 16 bit and 8 bit
export function convertTo16BitImage(image8Bit: cv.Mat): cv.Mat {
    const image16Bit = new cv.Mat();
    image8Bit.convertTo(image16Bit, cv.CV_16SC3);
    return image16Bit;
}

// For 16 bit images converter into 8 bit
// used for adjustment image
export function convert8BitImage(image16Bit: cv.Mat): cv.Mat {
    const image8Bit = new cv.Mat();
    image16Bit.convertTo(image8Bit, cv.CV_8UC3);
    return image8Bit;
}