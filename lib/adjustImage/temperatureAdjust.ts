import cv from "@techstark/opencv-js";
import { sigmoid } from "@/lib/adjustImage/sigmoidAdjust";
import { logImage } from "../utills/logImageAdjustment";

async function modifyImageTemperature(
    src: cv.Mat,
    colorTemperature: number
): Promise<cv.Mat> {
    if (colorTemperature === 0) {
        return src.clone();
    }

    const matCleanUp: cv.Mat[] = [];
    const vecCleanUp: cv.MatVector[] = [];
    
    const originalMat = src.clone();
    matCleanUp.push(originalMat);

    logImage(originalMat, "Original Image", colorTemperature, "Color Temperature");
    try {
        if (originalMat.channels() === 4) {
            cv.cvtColor(originalMat, originalMat, cv.COLOR_BGRA2BGR);
        }
        
        const labImage = new cv.Mat();
        matCleanUp.push(labImage);
        cv.cvtColor(originalMat, labImage, cv.COLOR_BGR2Lab);

        const labChannels = new cv.MatVector();
        vecCleanUp.push(labChannels);
        cv.split(labImage, labChannels);

        const lum = labChannels.get(0).clone();
        matCleanUp.push(lum);
        lum.convertTo(lum, cv.CV_32F);

        const divisor255 = cv.Mat.ones(lum.size(), cv.CV_32F);
        divisor255.setTo(new cv.Scalar(255.0));
        matCleanUp.push(divisor255);
        cv.divide(lum, divisor255, lum);

        const dummyOnes = cv.Mat.ones(lum.rows, lum.cols, cv.CV_32F);
        matCleanUp.push(dummyOnes);
        cv.subtract(dummyOnes, lum, lum);

        const lumScalingFactor = sigmoid(lum, 5.0, 0.5);
        matCleanUp.push(lumScalingFactor);

        let adjustedMat: cv.Mat;

        // --- CORRECTED LOGIC ---
        // If temperature is POSITIVE, we call the WARM function.
        if (colorTemperature > 0) {
            adjustedMat = boostWarmTemperature(colorTemperature, originalMat, lumScalingFactor);
        } 
        // If temperature is NEGATIVE, we call the COOL functions.
        else {
            let blueScaleScore = 4.9;
            if (colorTemperature < -50) {
                const x = Math.abs(colorTemperature);
                blueScaleScore = 5.0 + (x - 51) * (8.0 - 5.0) / (100 - 51);
            }

            const bChannel = labChannels.get(2).clone();
            matCleanUp.push(bChannel);
            bChannel.convertTo(bChannel, cv.CV_32F);
            cv.divide(bChannel, divisor255, bChannel);
            
            const bLabBoostFactor = sigmoid(bChannel, 11.0, 0.625, 2.0);
            matCleanUp.push(bLabBoostFactor);

            if (colorTemperature >= -50) {
                adjustedMat = boostCoolLowerHalf(
                    colorTemperature, originalMat, lumScalingFactor, bLabBoostFactor, blueScaleScore
                );
            } else {
                const lowerLumScalingFactor = sigmoid(lum, 5.0, 0.5, 1.0);
                matCleanUp.push(lowerLumScalingFactor);
                adjustedMat = boostCoolUpperHalf(
                    colorTemperature, originalMat, lowerLumScalingFactor, bLabBoostFactor, blueScaleScore
                );
            }
        }
        
        // Final conversion for display. BGR -> BGRA is common for web canvases.
        cv.cvtColor(adjustedMat, adjustedMat, cv.COLOR_BGR2BGRA);

        logImage(adjustedMat, 'Adjusted Image', colorTemperature, 'Adjusted Temperature');
        return adjustedMat;

    } catch (error) {
        console.error("Failed to modify image temperature:", error);
        if (originalMat.channels() === 3) {
            cv.cvtColor(originalMat, originalMat, cv.COLOR_BGR2BGRA);
        }
        return originalMat;
    } finally {
        // matCleanUp.forEach((mat) => { if (mat && !mat.isDeleted()) mat.delete(); });
        // vecCleanUp.forEach((vec) => { if (vec && !vec.isDeleted()) vec.delete(); });
    }
}


// ====================================================================================
// Helper Functions (with numbers reset to original Kotlin values for a clean start)
// ====================================================================================

// This is the last version from our calibration process.
// It has the correct Green channel values. We only need to tweak Red and Blue.
function boostWarmTemperature(
    adjustedTemperature: number,
    originalMat: cv.Mat,
    lumScalingFactor: cv.Mat
): cv.Mat {
    const matCleanUp: cv.Mat[] = [];
    const vecCleanUp: cv.MatVector[] = [];
    try {
        const adjustedTemp = adjustedTemperature * 4.372;

        // --- BGR Scale Calculations ---
        // Note: Variable names are kept to match Kotlin, but their application is swapped below.
        const redScale = cv.Mat.ones(lumScalingFactor.size(), cv.CV_32F);
        const greenScale = cv.Mat.ones(lumScalingFactor.size(), cv.CV_32F);
        const blueScale = cv.Mat.ones(lumScalingFactor.size(), cv.CV_32F);
        const redAdjustment = cv.Mat.ones(redScale.size(), cv.CV_32F);
        const greenAdjustment = cv.Mat.ones(greenScale.size(), cv.CV_32F);
        const blueAdjustment = cv.Mat.ones(blueScale.size(), cv.CV_32F);
        matCleanUp.push(redScale, greenScale, blueScale, redAdjustment, greenAdjustment, blueAdjustment);
        
        const redScalarMat = cv.Mat.ones(redAdjustment.size(), cv.CV_32F);
        redScalarMat.setTo(new cv.Scalar(adjustedTemp * 0.022));
        matCleanUp.push(redScalarMat);
        cv.multiply(redAdjustment, redScalarMat, redAdjustment);
        cv.multiply(redAdjustment, lumScalingFactor, redAdjustment);
        cv.add(redScale, redAdjustment, redScale);

        const greenScalarMat = cv.Mat.ones(greenAdjustment.size(), cv.CV_32F);
        greenScalarMat.setTo(new cv.Scalar(adjustedTemp * 0.0010));
        matCleanUp.push(greenScalarMat);
        cv.multiply(greenAdjustment, greenScalarMat, greenAdjustment);
        cv.multiply(greenAdjustment, lumScalingFactor, greenAdjustment);
        cv.add(greenScale, greenAdjustment, greenScale);

        const blueScalarMat = cv.Mat.ones(blueAdjustment.size(), cv.CV_32F);
        blueScalarMat.setTo(new cv.Scalar(adjustedTemp * 0.0015));
        matCleanUp.push(blueScalarMat);
        cv.multiply(blueAdjustment, blueScalarMat, blueAdjustment);
        cv.multiply(blueAdjustment, lumScalingFactor, blueAdjustment);
        cv.subtract(blueScale, blueAdjustment, blueScale);

        // --- First Channel Processing (with Blue and Red logic swapped) ---
        const channels = new cv.MatVector();
        vecCleanUp.push(channels);
        cv.split(originalMat, channels);
        
        const bChannel_orig = channels.get(0);
        const bChannel_clone = bChannel_orig.clone();
        bChannel_clone.convertTo(bChannel_clone, cv.CV_32F);
        // SWAPPED: Apply strong RED scale to BLUE channel
        cv.multiply(bChannel_clone, redScale, bChannel_clone);
        channels.set(0, bChannel_clone);
        matCleanUp.push(bChannel_clone);
        // This variable now holds the heavily boosted BLUE channel for the final step
        const channelForFinalBoost = bChannel_clone.clone(); 
        matCleanUp.push(channelForFinalBoost);

        const gChannel_orig = channels.get(1);
        const gChannel_clone = gChannel_orig.clone();
        gChannel_clone.convertTo(gChannel_clone, cv.CV_32F);
        cv.multiply(gChannel_clone, greenScale, gChannel_clone);
        const greenTemp = gChannel_clone.clone(); 
        channels.set(1, gChannel_clone);
        matCleanUp.push(gChannel_clone, greenTemp);

        const rChannel_orig = channels.get(2);
        const rChannel_clone = rChannel_orig.clone();
        rChannel_clone.convertTo(rChannel_clone, cv.CV_32F);
        // SWAPPED: Apply slight BLUE reduction to RED channel
        cv.multiply(rChannel_clone, blueScale, rChannel_clone);
        channels.set(2, rChannel_clone);
        matCleanUp.push(rChannel_clone);

        bChannel_orig.delete();
        gChannel_orig.delete();
        rChannel_orig.delete();
        
        cv.merge(channels, originalMat);
        originalMat.convertTo(originalMat, cv.CV_8U);

        // --- LAB Adjustments (This logic remains the same) ---
        const labMat = new cv.Mat();
        const labChannels = new cv.MatVector();
        matCleanUp.push(labMat);
        vecCleanUp.push(labChannels);
        cv.cvtColor(originalMat, labMat, cv.COLOR_BGR2Lab);
        cv.split(labMat, labChannels);
        const aChannel = labChannels.get(1).clone();
        matCleanUp.push(aChannel);
        aChannel.convertTo(aChannel, cv.CV_32F);
        const divisor255 = cv.Mat.ones(aChannel.size(), cv.CV_32F);
        divisor255.setTo(new cv.Scalar(255.0));
        matCleanUp.push(divisor255);
        cv.divide(aChannel, divisor255, aChannel);
        const aLabScalingFactor = sigmoid(aChannel, 11.0, 1.042, 4.0);
        const aScale = cv.Mat.ones(aLabScalingFactor.size(), cv.CV_32F);
        const aAdjustment = cv.Mat.ones(aScale.size(), cv.CV_32F);
        matCleanUp.push(aLabScalingFactor, aScale, aAdjustment);
        const aScalarMat = cv.Mat.ones(aAdjustment.size(), cv.CV_32F);
        aScalarMat.setTo(new cv.Scalar(adjustedTemp / 200.0));
        matCleanUp.push(aScalarMat);
        cv.multiply(aAdjustment, aScalarMat, aAdjustment);
        cv.multiply(aAdjustment, aLabScalingFactor, aAdjustment);
        cv.subtract(aScale, aAdjustment, aScale);
        const labA_handle = labChannels.get(1);
        const labA_clone = labA_handle.clone();
        labA_clone.convertTo(labA_clone, cv.CV_32F);
        cv.multiply(labA_clone, aScale, labA_clone);
        labA_clone.convertTo(labA_clone, cv.CV_8U);
        labChannels.set(1, labA_clone);
        matCleanUp.push(labA_clone);
        labA_handle.delete();
        cv.merge(labChannels, labMat);
        cv.cvtColor(labMat, originalMat, cv.COLOR_Lab2BGR);
        
        // --- Final Adjustments (Applying the 'Red' boost to the BLUE channel) ---
        const finalChannels = new cv.MatVector();
        vecCleanUp.push(finalChannels);
        cv.split(originalMat, finalChannels);
        cv.divide(greenTemp, divisor255, greenTemp);
        const finalBoostScalingFactor = sigmoid(greenTemp, 11.0, 1.042, 4.0);
        const finalScale = cv.Mat.ones(finalBoostScalingFactor.size(), cv.CV_32F);
        const finalAdjustment = cv.Mat.ones(finalScale.size(), cv.CV_32F);
        matCleanUp.push(finalBoostScalingFactor, finalScale, finalAdjustment);
        const finalAdjScalarMat = cv.Mat.ones(finalAdjustment.size(), cv.CV_32F);
        finalAdjScalarMat.setTo(new cv.Scalar(adjustedTemp / 200.0));
        matCleanUp.push(finalAdjScalarMat);
        cv.multiply(finalAdjustment, finalAdjScalarMat, finalAdjustment);
        cv.multiply(finalAdjustment, finalBoostScalingFactor, finalAdjustment);
        cv.add(finalScale, finalAdjustment, finalScale);
        
        // SWAPPED: Apply the final boost to the BLUE channel
        const finalB_handle = finalChannels.get(0);
        const finalB_modified = new cv.Mat();
        finalB_handle.convertTo(finalB_modified, cv.CV_32F);
        cv.multiply(channelForFinalBoost, finalScale, finalB_modified);
        finalB_modified.convertTo(finalB_modified, cv.CV_8U);
        finalChannels.set(0, finalB_modified);
        matCleanUp.push(finalB_modified);
        finalB_handle.delete();
        
        // Ensure other channels are converted back to 8U before merge
        finalChannels.get(1).convertTo(finalChannels.get(1), cv.CV_8U);
        finalChannels.get(2).convertTo(finalChannels.get(2), cv.CV_8U);
        
        cv.merge(finalChannels, originalMat);
        originalMat.convertTo(originalMat, cv.CV_8U);
        
        return originalMat;
    } catch (error) {
        console.error("Error in boostWarmTemperature:", error); 
        return originalMat;
    } finally {
        matCleanUp.forEach((mat) => { if (mat && !mat.isDeleted()) mat.delete(); });
        vecCleanUp.forEach((vec) => { if (vec && !vec.isDeleted()) vec.delete(); });
    }
}


function boostCoolLowerHalf(
    temperatureScore: number,
    originalMat: cv.Mat,
    lumScalingFactor: cv.Mat,
    bLabBoostFactor: cv.Mat,
    blueScaleScore: number
): cv.Mat {
    const matCleanUp: cv.Mat[] = [];
    const vecCleanUp: cv.MatVector[] = [];
    try {
        const adjustedTemp = temperatureScore / -24.15;

        // --- Scale Calculations ---
        // Note: 'blueScale' is a boosting factor, 'greenScale' is a boosting factor.
        const greenScale = cv.Mat.ones(lumScalingFactor.size(), cv.CV_32F);
        const blueScale = cv.Mat.ones(lumScalingFactor.size(), cv.CV_32F);
        const greenAdjustment = cv.Mat.ones(greenScale.size(), cv.CV_32F);
        const blueAdjustment = cv.Mat.ones(blueScale.size(), cv.CV_32F);
        matCleanUp.push(greenScale, blueScale, greenAdjustment, blueAdjustment);
        
        const greenScalarMat = cv.Mat.ones(greenAdjustment.size(), cv.CV_32F);
        greenScalarMat.setTo(new cv.Scalar(adjustedTemp * 0.5));
        matCleanUp.push(greenScalarMat);
        cv.multiply(greenAdjustment, greenScalarMat, greenAdjustment);
        cv.multiply(greenAdjustment, lumScalingFactor, greenAdjustment);
        cv.add(greenScale, greenAdjustment, greenScale);

        const blueScalarMat = cv.Mat.ones(blueAdjustment.size(), cv.CV_32F);
        blueScalarMat.setTo(new cv.Scalar(adjustedTemp * blueScaleScore));
        matCleanUp.push(blueScalarMat);
        cv.multiply(blueAdjustment, blueScalarMat, blueAdjustment);
        cv.multiply(blueAdjustment, lumScalingFactor, blueAdjustment);
        cv.add(blueScale, blueAdjustment, blueScale);

        // --- First Channel Processing (with Blue and Red logic swapped) ---
        const channels = new cv.MatVector();
        vecCleanUp.push(channels);
        cv.split(originalMat, channels);
        
        const bChannel_orig = channels.get(0), gChannel_orig = channels.get(1), rChannel_orig = channels.get(2);
        
        // SWAPPED: Blue channel is now unchanged (like Red was in the original logic)
        const bChannel_clone = bChannel_orig.clone();
        bChannel_clone.convertTo(bChannel_clone, cv.CV_32F);
        const channelForCalc = bChannel_clone.clone(); // This unchanged channel is used for a later calculation
        channels.set(0, bChannel_clone);
        matCleanUp.push(bChannel_clone, channelForCalc);

        // Green channel is boosted as before
        const gChannel_clone = gChannel_orig.clone();
        gChannel_clone.convertTo(gChannel_clone, cv.CV_32F);
        cv.multiply(gChannel_clone, greenScale, gChannel_clone);
        channels.set(1, gChannel_clone);
        matCleanUp.push(gChannel_clone);

        // SWAPPED: Red channel now gets the strong "blue" boost
        const rChannel_clone = rChannel_orig.clone();
        rChannel_clone.convertTo(rChannel_clone, cv.CV_32F);
        cv.multiply(rChannel_clone, blueScale, rChannel_clone);
        channels.set(2, rChannel_clone);
        matCleanUp.push(rChannel_clone);

        bChannel_orig.delete(); gChannel_orig.delete(); rChannel_orig.delete();
        
        cv.merge(channels, originalMat);
        originalMat.convertTo(originalMat, cv.CV_8U);
        
        const divisor255 = cv.Mat.ones(channelForCalc.size(), cv.CV_32F);
        divisor255.setTo(new cv.Scalar(255.0));
        matCleanUp.push(divisor255);
        cv.divide(channelForCalc, divisor255, channelForCalc);

        // --- LAB Adjustments (This part creates a warming effect, so it remains) ---
        const labMat = new cv.Mat();
        const labChannels = new cv.MatVector();
        matCleanUp.push(labMat);
        vecCleanUp.push(labChannels);
        cv.cvtColor(originalMat, labMat, cv.COLOR_BGR2Lab);
        cv.split(labMat, labChannels);
        
        const bScale = cv.Mat.ones(bLabBoostFactor.size(), cv.CV_32F);
        const bAdjustment = cv.Mat.ones(bScale.size(), cv.CV_32F);
        matCleanUp.push(bScale, bAdjustment);
        const bScalarMat = cv.Mat.ones(bAdjustment.size(), cv.CV_32F);
        bScalarMat.setTo(new cv.Scalar(adjustedTemp / 3.0)); // Factor for lower half
        matCleanUp.push(bScalarMat);
        cv.multiply(bAdjustment, bScalarMat, bAdjustment);
        cv.multiply(bAdjustment, bLabBoostFactor, bAdjustment);
        cv.subtract(bScale, bAdjustment, bScale);
        
        const labB_handle = labChannels.get(2);
        const labB_clone = labB_handle.clone();
        labB_clone.convertTo(labB_clone, cv.CV_32F);
        cv.multiply(labB_clone, bScale, labB_clone);
        labB_clone.convertTo(labB_clone, cv.CV_8U);
        labChannels.set(2, labB_clone);
        matCleanUp.push(labB_clone);
        labB_handle.delete();

        cv.merge(labChannels, labMat);
        cv.cvtColor(labMat, originalMat, cv.COLOR_Lab2BGR);
        
        // --- Final Channel Adjustments (with Blue and Red logic swapped) ---
        const finalChannels = new cv.MatVector();
        vecCleanUp.push(finalChannels);
        cv.split(originalMat, finalChannels);
        const finalB_orig = finalChannels.get(0), finalG_orig = finalChannels.get(1), finalR_orig = finalChannels.get(2);
        console.debug(originalMat, "original Mat");
        // SWAPPED: The "red reduction" logic is now applied to the BLUE channel
        const scaleOfBlueFactor = sigmoid(channelForCalc, 11.0, 0.325, 0.6);
        console.debug(scaleOfBlueFactor, "after Sigmoid");
        const blueReductionScale = cv.Mat.ones(scaleOfBlueFactor.size(), cv.CV_32F);
        const blueAdj = cv.Mat.ones(blueReductionScale.size(), cv.CV_32F);
        matCleanUp.push(scaleOfBlueFactor, blueReductionScale, blueAdj);
        const blueAdjScalarMat = cv.Mat.ones(blueAdj.size(), cv.CV_32F);
        blueAdjScalarMat.setTo(new cv.Scalar(adjustedTemp * 1.2)); // Factor for lower half
        matCleanUp.push(blueAdjScalarMat);
        cv.multiply(blueAdj, lumScalingFactor, blueAdj);
        cv.multiply(blueAdj, blueAdjScalarMat, blueAdj);
        cv.multiply(blueAdj, scaleOfBlueFactor, blueAdj);
        cv.subtract(blueReductionScale, blueAdj, blueReductionScale);
        
        const finalB_clone = finalB_orig.clone();
        finalB_clone.convertTo(finalB_clone, cv.CV_32F);
        cv.multiply(finalB_clone, blueReductionScale, finalB_clone);
        finalChannels.set(0, finalB_clone);
        matCleanUp.push(finalB_clone);
        
        // Green channel boost remains the same
        const finalG_clone = finalG_orig.clone();
        const greenTemp = finalG_clone.clone();
        matCleanUp.push(greenTemp);
        greenTemp.convertTo(greenTemp, cv.CV_32F);
        console.debug(finalG_clone, "finalG_clone");
        console.debug(greenTemp, "greenTemp");
        cv.divide(greenTemp, divisor255, greenTemp);
        const scaleOfGreenFactor = sigmoid(greenTemp, 11.0, 0.325, 0.6);
        console.debug(scaleOfGreenFactor, "after Sigmoid 2");
        const greenScaleBoost = cv.Mat.ones(scaleOfGreenFactor.size(), cv.CV_32F);
        const greenAdjFactor = cv.Mat.ones(greenScaleBoost.size(), cv.CV_32F);
        matCleanUp.push(scaleOfGreenFactor, greenScaleBoost, greenAdjFactor);
        const greenAdjScalarMat = cv.Mat.ones(greenAdjFactor.size(), cv.CV_32F);
        greenAdjScalarMat.setTo(new cv.Scalar(adjustedTemp * 0.7));
        matCleanUp.push(greenAdjScalarMat);
        cv.multiply(greenAdjFactor, greenAdjScalarMat, greenAdjFactor);
        cv.multiply(greenAdjFactor, scaleOfGreenFactor, greenAdjFactor);
        cv.add(greenScaleBoost, greenAdjFactor, greenScaleBoost);
        
        finalG_clone.convertTo(finalG_clone, cv.CV_32F);
        cv.multiply(finalG_clone, greenScaleBoost, finalG_clone);
        finalChannels.set(1, finalG_clone);
        matCleanUp.push(finalG_clone);

        finalB_clone.convertTo(finalB_clone, cv.CV_8U);
        finalG_clone.convertTo(finalG_clone, cv.CV_8U);
        // The Red channel (finalR_orig) is not modified in this final step, so just convert it
        finalR_orig.convertTo(finalR_orig, cv.CV_8U);

        console.debug(finalB_orig, "finalB_orig");
        console.debug(finalG_orig, "finalG_orig");
        console.debug(finalR_orig, "finalR_orig");
        
        // finalB_orig.delete(); finalG_orig.delete();
        console.debug(finalChannels, "finalChannels");
        cv.merge(finalChannels, originalMat);
        console.debug(originalMat, "final Mat");
        originalMat.convertTo(originalMat, cv.CV_8U);
        console.debug(originalMat, "final Mat converted");
        return originalMat;
    } catch (error) {
        console.error("Error in boostCoolLowerHalf:", error); return originalMat;
    } finally {
        // matCleanUp.forEach((mat) => { if (mat && !mat.isDeleted()) mat.delete(); });
        // vecCleanUp.forEach((vec) => { if (vec && !vec.isDeleted()) vec.delete(); });
    }
}


function boostCoolUpperHalf(
    temperatureScore: number,
    originalMat: cv.Mat,
    lumScalingFactor: cv.Mat,
    bLabBoostFactor: cv.Mat,
    blueScaleScore: number
): cv.Mat {
    const matCleanUp: cv.Mat[] = [];
    const vecCleanUp: cv.MatVector[] = [];
    try {
        const adjustedTemp = temperatureScore / -24.15;
        // The logic is identical to LowerHalf, just with two different numbers
        const labBFactor = adjustedTemp / 1.9;
        const redReductionFactor = adjustedTemp * 2.0;

        // The rest of the implementation is identical to boostCoolLowerHalf,
        // just using the two different factors above.
        // --- Scale Calculations ---
        const greenScale = cv.Mat.ones(lumScalingFactor.size(), cv.CV_32F);
        const blueScale = cv.Mat.ones(lumScalingFactor.size(), cv.CV_32F);
        const greenAdjustment = cv.Mat.ones(greenScale.size(), cv.CV_32F);
        const blueAdjustment = cv.Mat.ones(blueScale.size(), cv.CV_32F);
        matCleanUp.push(greenScale, blueScale, greenAdjustment, blueAdjustment);
        const greenScalarMat = cv.Mat.ones(greenAdjustment.size(), cv.CV_32F);
        greenScalarMat.setTo(new cv.Scalar(adjustedTemp * 0.5));
        matCleanUp.push(greenScalarMat);
        cv.multiply(greenAdjustment, greenScalarMat, greenAdjustment);
        cv.multiply(greenAdjustment, lumScalingFactor, greenAdjustment);
        cv.add(greenScale, greenAdjustment, greenScale);
        const blueScalarMat = cv.Mat.ones(blueAdjustment.size(), cv.CV_32F);
        blueScalarMat.setTo(new cv.Scalar(adjustedTemp * blueScaleScore));
        matCleanUp.push(blueScalarMat);
        cv.multiply(blueAdjustment, blueScalarMat, blueAdjustment);
        cv.multiply(blueAdjustment, lumScalingFactor, blueAdjustment);
        cv.add(blueScale, blueAdjustment, blueScale);

        // --- First Channel Processing (Swapped) ---
        const channels = new cv.MatVector();
        vecCleanUp.push(channels);
        cv.split(originalMat, channels);
        const bChannel_orig = channels.get(0), gChannel_orig = channels.get(1), rChannel_orig = channels.get(2);
        const bChannel_clone = bChannel_orig.clone();
        bChannel_clone.convertTo(bChannel_clone, cv.CV_32F);
        const channelForCalc = bChannel_clone.clone();
        channels.set(0, bChannel_clone);
        matCleanUp.push(bChannel_clone, channelForCalc);
        const gChannel_clone = gChannel_orig.clone();
        gChannel_clone.convertTo(gChannel_clone, cv.CV_32F);
        cv.multiply(gChannel_clone, greenScale, gChannel_clone);
        channels.set(1, gChannel_clone);
        matCleanUp.push(gChannel_clone);
        const rChannel_clone = rChannel_orig.clone();
        rChannel_clone.convertTo(rChannel_clone, cv.CV_32F);
        cv.multiply(rChannel_clone, blueScale, rChannel_clone);
        channels.set(2, rChannel_clone);
        matCleanUp.push(rChannel_clone);
        bChannel_orig.delete(); gChannel_orig.delete(); rChannel_orig.delete();
        cv.merge(channels, originalMat);
        originalMat.convertTo(originalMat, cv.CV_8U);
        
        // --- LAB Adjustments ---
        const divisor255 = cv.Mat.ones(channelForCalc.size(), cv.CV_32F);
        divisor255.setTo(new cv.Scalar(255.0));
        matCleanUp.push(divisor255);
        cv.divide(channelForCalc, divisor255, channelForCalc);
        const labMat = new cv.Mat();
        const labChannels = new cv.MatVector();
        matCleanUp.push(labMat);
        vecCleanUp.push(labChannels);
        cv.cvtColor(originalMat, labMat, cv.COLOR_BGR2Lab);
        cv.split(labMat, labChannels);
        const bScale = cv.Mat.ones(bLabBoostFactor.size(), cv.CV_32F);
        const bAdjustment = cv.Mat.ones(bScale.size(), cv.CV_32F);
        matCleanUp.push(bScale, bAdjustment);
        const bScalarMat = cv.Mat.ones(bAdjustment.size(), cv.CV_32F);
        bScalarMat.setTo(new cv.Scalar(labBFactor)); // Use upper half factor
        matCleanUp.push(bScalarMat);
        cv.multiply(bAdjustment, bScalarMat, bAdjustment);
        cv.multiply(bAdjustment, bLabBoostFactor, bAdjustment);
        cv.subtract(bScale, bAdjustment, bScale);
        const labB_handle = labChannels.get(2);
        const labB_clone = labB_handle.clone();
        labB_clone.convertTo(labB_clone, cv.CV_32F);
        cv.multiply(labB_clone, bScale, labB_clone);
        labB_clone.convertTo(labB_clone, cv.CV_8U);
        labChannels.set(2, labB_clone);
        matCleanUp.push(labB_clone);
        labB_handle.delete();
        cv.merge(labChannels, labMat);
        cv.cvtColor(labMat, originalMat, cv.COLOR_Lab2BGR);
        
        // --- Final Channel Adjustments (Swapped) ---
        const finalChannels = new cv.MatVector();
        vecCleanUp.push(finalChannels);
        cv.split(originalMat, finalChannels);
        const finalB_orig = finalChannels.get(0), finalG_orig = finalChannels.get(1), finalR_orig = finalChannels.get(2);
        const scaleOfBlueFactor = sigmoid(channelForCalc, 11.0, 0.325, 0.6);
        const blueReductionScale = cv.Mat.ones(scaleOfBlueFactor.size(), cv.CV_32F);
        const blueAdj = cv.Mat.ones(blueReductionScale.size(), cv.CV_32F);
        matCleanUp.push(scaleOfBlueFactor, blueReductionScale, blueAdj);
        const blueAdjScalarMat = cv.Mat.ones(blueAdj.size(), cv.CV_32F);
        blueAdjScalarMat.setTo(new cv.Scalar(redReductionFactor)); // Use upper half factor
        matCleanUp.push(blueAdjScalarMat);
        cv.multiply(blueAdj, lumScalingFactor, blueAdj);
        cv.multiply(blueAdj, blueAdjScalarMat, blueAdj);
        cv.multiply(blueAdj, scaleOfBlueFactor, blueAdj);
        cv.subtract(blueReductionScale, blueAdj, blueReductionScale);
        const finalB_clone = finalB_orig.clone();
        finalB_clone.convertTo(finalB_clone, cv.CV_32F);
        cv.multiply(finalB_clone, blueReductionScale, finalB_clone);
        finalChannels.set(0, finalB_clone);
        matCleanUp.push(finalB_clone);
        
        const finalG_clone = finalG_orig.clone();
        const greenTemp = finalG_clone.clone();
        matCleanUp.push(greenTemp);
        greenTemp.convertTo(greenTemp, cv.CV_32F);
        cv.divide(greenTemp, divisor255, greenTemp);
        const scaleOfGreenFactor = sigmoid(greenTemp, 11.0, 0.325, 0.6);
        const greenScaleBoost = cv.Mat.ones(scaleOfGreenFactor.size(), cv.CV_32F);
        const greenAdjFactor = cv.Mat.ones(greenScaleBoost.size(), cv.CV_32F);
        matCleanUp.push(scaleOfGreenFactor, greenScaleBoost, greenAdjFactor);
        const greenAdjScalarMat = cv.Mat.ones(greenAdjFactor.size(), cv.CV_32F);
        greenAdjScalarMat.setTo(new cv.Scalar(adjustedTemp * 0.7));
        matCleanUp.push(greenAdjScalarMat);
        cv.multiply(greenAdjFactor, greenAdjScalarMat, greenAdjFactor);
        cv.multiply(greenAdjFactor, scaleOfGreenFactor, greenAdjFactor);
        cv.add(greenScaleBoost, greenAdjFactor, greenScaleBoost);
        finalG_clone.convertTo(finalG_clone, cv.CV_32F);
        cv.multiply(finalG_clone, greenScaleBoost, finalG_clone);
        finalChannels.set(1, finalG_clone);
        matCleanUp.push(finalG_clone);

        finalB_clone.convertTo(finalB_clone, cv.CV_8U);
        finalG_clone.convertTo(finalG_clone, cv.CV_8U);
        finalR_orig.convertTo(finalR_orig, cv.CV_8U);
        
        finalB_orig.delete(); finalG_orig.delete();

        cv.merge(finalChannels, originalMat);
        originalMat.convertTo(originalMat, cv.CV_8U);
        return originalMat;
    } catch (error) {
        console.error("Error in boostCoolUpperHalf:", error); return originalMat;
    } finally {
        // matCleanUp.forEach((mat) => { if (mat && !mat.isDeleted()) mat.delete(); });
        // vecCleanUp.forEach((vec) => { if (vec && !vec.isDeleted()) vec.delete(); });
    }
}

export default modifyImageTemperature;