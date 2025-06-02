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
    // Checking correct action result
    console.log("action : ", action);
    // New business logic will used
    let deltaMat: cv.Mat | null = null;
    console.log("currentValue : ", currentValue);
    console.log("newValue : ", newValue);
    
    if (newValue !== 0) {
        // Get adjust value from original
        const currentAdjustImage = await action(originalImage, newValue);
        
        deltaMat = currentAdjustImage.clone();
        currentAdjustImage.delete();
    } else {
        // no need to clean up, just use current image edit, since the value is 0
        deltaMat = currentImageEdit;
    }

    // now imageEdit already 0 exposure and we add with new exposure value
    const resultTotalMat = deltaMat.clone();
    deltaMat.delete();

    return resultTotalMat.clone();
}

function deltaValueCount(a: cv.Mat, b: cv.Mat): cv.Mat {
    const minusAlpha = new cv.Mat();
    cv.subtract(a, b, minusAlpha);
    return minusAlpha;
}

export default cleanAndExecuteAdjustment;
