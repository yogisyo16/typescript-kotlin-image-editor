import cv from "@techstark/opencv-js";
import { convertTo16BitImage } from "@/lib/adjustExt/bitImageChecking";
import computeDelta from "@/lib/adjustExt/deltaLogic";
import { log } from "console";

// cleanAndExecuteAdjustment to remove the alpha from currentImageEdit
// and apply with new value apha
async function cleanAndExecuteAdjustment(
    currentValue: number,
    newValue: number,
    originalImage: cv.Mat,
    currentImageEdit: cv.Mat,
    adjustmentFunction: (image: cv.Mat, value: number) => Promise<cv.Mat>,
): Promise<cv.Mat> {
    if (currentValue === newValue) {
        return currentImageEdit;
    }

    console.debug(adjustmentFunction.name);
    // let imageDeltaProcessor = imageDeltaProcessor();
    let cleanUpCurrentDelta = new cv.Mat();
    
    const originalMat = new cv.Mat();
    const cureendEditMat = new cv.Mat();

    originalImage.convertTo(originalMat, cv.CV_16SC3);
    currentImageEdit.convertTo(cureendEditMat, cv.CV_16SC3);

    if (currentValue != 0) {
        
        const currentValueMat = await computeDelta(originalImage, currentValue, adjustmentFunction);
        
        currentValueMat.convertTo(currentValueMat, cv.CV_16SC3);
        
        cleanUpCurrentDelta = new cv.Mat();

        cv.subtract(cureendEditMat, currentValueMat, cleanUpCurrentDelta);
        
    } else {
        cleanUpCurrentDelta = cureendEditMat;
        
    }
    const resultDeltaMat = await computeDelta(originalImage, newValue, adjustmentFunction);
    const result16Bit = new cv.Mat();
    resultDeltaMat.convertTo(result16Bit, cv.CV_16SC3);
    
    const finalMat = new cv.Mat();
    cv.add(cleanUpCurrentDelta, result16Bit, finalMat);
    
    const finalMatConverted = new cv.Mat();
    finalMat.convertTo(finalMatConverted, cv.CV_8UC3);
    
    return finalMatConverted;
}

function minusCvMat(a: cv.Mat, b: cv.Mat): cv.Mat {
    const newMat = new cv.Mat();

    cv.subtract(a, b, newMat);

    return newMat;
}

function plusCvMath(a: cv.Mat, b: cv.Mat): cv.Mat {
    const newMat = new cv.Mat();

    cv.add(a, b, newMat);

    return newMat;
}


function logImage(a: cv.Mat, tag: string): void {
    const testRow = 200;
    const testCols = 310;
    const testRow1 = 270;
    const testCols1 = 430;
    const testRow2 = 310;
    const testCols2 = 450;
    console.log(tag + 'Debug finalHSV after conversion to BGR:');
    const finalPixel = a.ucharPtr(testRow, testCols);
    const finalPixel1 = a.ucharPtr(testRow1, testCols1);
    const finalPixel2 = a.ucharPtr(testRow2, testCols2);
    const [B, G, R, A] = finalPixel;
    const [B1, G1, R1, A1] = finalPixel1;
    const [B2, G2, R2, A2] = finalPixel2;
    console.log(tag + 'Final BGRA Channels: ', a.channels());
    console.log(tag + `Final BGRA Pixel Values: B=${B}, G=${G}, R=${R}, A=${A}`);
    console.log(tag +`Final BGRA Pixel Values: B=${B1}, G=${G1}, R=${R1}, A=${A1}`);
    console.log(tag + `Final BGRA Pixel Values: B=${B2}, G=${G2}, R=${R2}, A=${A2}`);
}

export default cleanAndExecuteAdjustment;
