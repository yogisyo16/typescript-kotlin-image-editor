import cv from "@techstark/opencv-js";

// cleanAndExecuteAdjustment to remove the delta from currentImageEdit
// and apply with new value delta
async function cleanAndExecuteAdjustment(
    currentValue: number,
    newValue: number,
    originalImage: cv.Mat,
    currentImageEdit: cv.Mat,
    action: (image: cv.Mat, value: number) => Promise<cv.Mat>,
): Promise<cv.Mat> {
    let resultingImageForThisStep: cv.Mat;

    if (newValue !== 0) {
        const currentAdjustImage = await action(originalImage, newValue);
        resultingImageForThisStep = currentAdjustImage.clone();
        deltaValueCount(currentImageEdit, currentAdjustImage);
        currentAdjustImage.delete();
    } else {
        resultingImageForThisStep = currentImageEdit.clone();
    }

    // Add the currentImageEdit to the final output
    const finalOutputMat = resultingImageForThisStep.clone();
    resultingImageForThisStep.delete();

    return finalOutputMat;
}

function deltaValueCount(a: cv.Mat, b: cv.Mat): cv.Mat {
    console.log(a, b);
    const originalMat = new cv.Mat();

    originalMat.convertTo(a, cv.CV_16SC3);
    
    const adjustedImage = new cv.Mat();
    
    adjustedImage.convertTo(b, cv.CV_16SC3);
    
    const deltaMat = new cv.Mat(originalMat, originalMat.type());
    
    cv.subtract(originalMat, adjustedImage, deltaMat);
    return deltaMat;
}

export default cleanAndExecuteAdjustment;