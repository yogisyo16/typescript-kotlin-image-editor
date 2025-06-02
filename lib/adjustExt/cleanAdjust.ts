import cv from "@techstark/opencv-js";

// cleanAndExecuteAdjustment to remove the alpha from currentImageEdit
// and apply with new value apha
async function cleanAndExecuteAdjustment(
    currentValue: number,
    newValue: number,
    originalImage: cv.Mat,
    currentImageEdit: cv.Mat,
    action: (image: cv.Mat, value: number) => Promise<cv.Mat>,
): Promise<cv.Mat> {
    // New business logic will used
    let deltaMat: cv.Mat | null = null;
    let alphaValue: cv.int64 | null = null;
    
    if (newValue !== 0) {
        const currentAdjustImage = await action(originalImage, newValue);
        
        deltaMat = currentAdjustImage.clone();
        currentAdjustImage.delete();
    } else {
        deltaMat = currentImageEdit;
    }

    const resultTotalMat = deltaMat.clone();
    deltaMat.delete();

    console.log("originalImage : ", originalImage.data16U);
    console.log("resultTotalMat : ", resultTotalMat.data16U);
    return resultTotalMat.clone();
}

function deltaValueCount(a: cv.Mat, b: cv.Mat): cv.Mat {
    const minusAlpha = new cv.Mat();
    cv.divide(a, b, minusAlpha);
    cv.subtract(a, b, minusAlpha);
    return minusAlpha;
}

export default cleanAndExecuteAdjustment;
