import cv from "@techstark/opencv-js";
import { convertTo16BitImage } from "@/lib/adjustExt/bitImageChecking";
import computeDelta from "@/lib/adjustExt/deltaLogic";

// cleanAndExecuteAdjustment to remove the delta from currentImageEdit
// and apply with new value delta
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
    
    // currentImageEdit clean mat
    let cleanUpCurrentDelta = new cv.Mat();
    
    // Converter to 16 bit
    const originalMat = new cv.Mat();
    const cureendEditMat = new cv.Mat();

    // Convert original and image edit to 16 bit
    originalImage.convertTo(originalMat, cv.CV_16SC3);
    currentImageEdit.convertTo(cureendEditMat, cv.CV_16SC3);

    if (currentValue != 0) {
        // Function to compute delta and execution adjustment
        const currentValueMat = await computeDelta(originalImage, currentValue, adjustmentFunction);
        
        // Convert value of computeDelta to 16 bit (currentValueMat)
        currentValueMat.convertTo(currentValueMat, cv.CV_16SC3);
        
        cleanUpCurrentDelta = new cv.Mat();
        
        // cureendEditMat - currentValueMat = cleanUpCurrentDelta to get the delta value
        cv.subtract(cureendEditMat, currentValueMat, cleanUpCurrentDelta);
        
    } else {
        // If currentValue == 0 just return cureendEditMat (16 Bit image)
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

export default cleanAndExecuteAdjustment;
