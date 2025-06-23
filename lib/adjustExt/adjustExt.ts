import cv, { Point } from "@techstark/opencv-js";
import {computeDelta} from "@/lib/adjustExt/deltaLogic";
import { logImage } from "../utills/logImageAdjustment";

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
    
    // Prepare empty matrix for converter to 16 bit
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

    // Function to compute delta and execution adjustment
    const resultDeltaMat = await computeDelta(originalImage, newValue, adjustmentFunction);
    
    // Prepare empty matrix for converter to 16 bit
    const result16Bit = new cv.Mat();
    
    // Convert resultDeltaMat to 16 bit
    resultDeltaMat.convertTo(result16Bit, cv.CV_16SC3);
    
    // Prepare empty matrix for final adjustment
    const finalMat = new cv.Mat();

    // Add cleanUpCurrentDelta and result16Bit put it under finalMat
    cv.add(cleanUpCurrentDelta, result16Bit, finalMat);

    return finalMat;
}

export default cleanAndExecuteAdjustment;