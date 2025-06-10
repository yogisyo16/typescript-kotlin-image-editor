import cv from "@techstark/opencv-js";

// For 8 bit images converter into 16 bit
// used for delta logic calculation
export function convertTo16BitImage(image8Bit: cv.Mat): cv.Mat {
    const image16Bit = new cv.Mat();
    const convertImage16Bit = image8Bit.channels() === 4 ? cv.CV_16SC4 : cv.CV_16SC3;
    image8Bit.convertTo(image16Bit, convertImage16Bit);
    return image16Bit;
}

// For 16 bit images converter into 8 bit
// used for adjustment image
export function convert8BitImage(image16Bit: cv.Mat): cv.Mat {
    const image8Bit = new cv.Mat();
    const convertImage8Bit = image16Bit.channels() === 4 ? cv.CV_8UC4 : cv.CV_8UC3;
    image16Bit.convertTo(image8Bit, convertImage8Bit);
    return image8Bit;
}