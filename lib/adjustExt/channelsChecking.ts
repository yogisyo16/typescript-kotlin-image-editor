import cv from "@techstark/opencv-js";
function checkChannels(imageCheck: cv.Mat, imageAfterCheck: cv.Mat): cv.Mat {
    if (imageCheck.channels() === 4 && imageAfterCheck.channels() === 3) {
        console.log("Channel mismatch detected. Restoring alpha channel.");
        const correctedImage = new cv.Mat();
        cv.cvtColor(imageAfterCheck, correctedImage, cv.COLOR_BGR2BGRA, 0);
        
        return correctedImage;
    }
    return imageAfterCheck;
}

export default checkChannels;