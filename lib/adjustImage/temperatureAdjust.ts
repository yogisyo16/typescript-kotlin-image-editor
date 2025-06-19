import cv from "@techstark/opencv-js";
import { sigmoid } from "@/lib/adjustImage/sigmoidAdjust";
import { logImage, logImageRgba } from "../utills/logImageAdjustment";

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

    logImage(originalMat, 'Original Image', colorTemperature);

    try {
        // Ensure the input is a 3-channel BGR image
        if (originalMat.channels() === 4) {
            cv.cvtColor(originalMat, originalMat, cv.COLOR_BGRA2BGR);
        }
        
        // Convert to LAB color space to calculate parameters
        const labImage = new cv.Mat();
        matCleanUp.push(labImage);
        cv.cvtColor(originalMat, labImage, cv.COLOR_BGR2Lab);

        const labChannels = new cv.MatVector();
        vecCleanUp.push(labChannels);
        cv.split(labImage, labChannels);

        // --- Calculate Luminance Scaling Factor (used by all helpers) ---
        const lum = labChannels.get(0).clone();
        matCleanUp.push(lum);
        lum.convertTo(lum, cv.CV_32F);

        const divisor255 = cv.Mat.ones(lum.size(), cv.CV_32F);
        divisor255.setTo(new cv.Scalar(255.0));
        matCleanUp.push(divisor255);
        cv.divide(lum, divisor255, lum);

        const dummyOnes = cv.Mat.ones(lum.rows, lum.cols, cv.CV_32F);
        matCleanUp.push(dummyOnes);
        cv.subtract(dummyOnes, lum, lum); // Invert luminance

        const lumScalingFactor = sigmoid(lum, 5.0, 0.5);
        matCleanUp.push(lumScalingFactor);

        let adjustedMat: cv.Mat;

        // --- Main Logic Branching (Original, Correct Order) ---
        if (colorTemperature > 0) {
            // Positive temperatures call the WARM function
            console.debug('WARM');
            adjustedMat = boostWarmTemperature(colorTemperature, originalMat, lumScalingFactor);
        } else {
            // Negative temperatures call the COOL functions
            console.debug('COOL');
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
                // For strongly cool temperatures, an alternate lum factor is created
                const lowerLumScalingFactor = sigmoid(lum, 5.0, 0.5, 1.0);
                matCleanUp.push(lowerLumScalingFactor);
                adjustedMat = boostCoolUpperHalf(
                    colorTemperature, originalMat, lowerLumScalingFactor, bLabBoostFactor, blueScaleScore
                );
            }
        }
        
        // Final conversion for display on a web canvas
        cv.cvtColor(adjustedMat, adjustedMat, cv.COLOR_BGR2RGBA);
        return adjustedMat;

    } catch (error) {
        console.error("Failed to modify image temperature:", error);
        if (originalMat.channels() === 3) {
            cv.cvtColor(originalMat, originalMat, cv.COLOR_BGR2RGBA);
        }
        return originalMat;
    } finally {
        // matCleanUp.forEach((mat) => { if (mat && !mat.isDeleted()) mat.delete(); });
        // vecCleanUp.forEach((vec) => { if (vec && !vec.isDeleted()) vec.delete(); });
    }
}

function boostWarmTemperature(
    adjustedTemperature: number,
    originalMat: cv.Mat,
    lumScalingFactor: cv.Mat
): cv.Mat {
    const matCleanUp: cv.Mat[] = [];
    const vecCleanUp: cv.MatVector[] = [];
    try {
        const adjustedTemp = adjustedTemperature * 4.122;

        // --- BGR Scale Calculations with original Kotlin values ---
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
        greenScalarMat.setTo(new cv.Scalar(adjustedTemp * 0.015));
        matCleanUp.push(greenScalarMat);
        cv.multiply(greenAdjustment, greenScalarMat, greenAdjustment);
        cv.multiply(greenAdjustment, lumScalingFactor, greenAdjustment);
        cv.add(greenScale, greenAdjustment, greenScale);

        const blueScalarMat = cv.Mat.ones(blueAdjustment.size(), cv.CV_32F);
        blueScalarMat.setTo(new cv.Scalar(adjustedTemp * 0.0001));
        matCleanUp.push(blueScalarMat);
        cv.multiply(blueAdjustment, blueScalarMat, blueAdjustment);
        cv.multiply(blueAdjustment, lumScalingFactor, blueAdjustment);
        cv.subtract(blueScale, blueAdjustment, blueScale);

        // --- First Channel Processing ---
        const channels = new cv.MatVector();
        vecCleanUp.push(channels);
        cv.split(originalMat, channels);
        
        const bChannel_orig = channels.get(0), gChannel_orig = channels.get(1), rChannel_orig = channels.get(2);
        
        const bChannel_clone = bChannel_orig.clone();
        bChannel_clone.convertTo(bChannel_clone, cv.CV_32F);
        cv.multiply(bChannel_clone, blueScale, bChannel_clone);
        channels.set(0, bChannel_clone);
        matCleanUp.push(bChannel_clone);

        const gChannel_clone = gChannel_orig.clone();
        gChannel_clone.convertTo(gChannel_clone, cv.CV_32F);
        cv.multiply(gChannel_clone, greenScale, gChannel_clone);
        const greenTemp = gChannel_clone.clone();
        channels.set(1, gChannel_clone);
        matCleanUp.push(gChannel_clone, greenTemp);

        const rChannel_clone = rChannel_orig.clone();
        rChannel_clone.convertTo(rChannel_clone, cv.CV_32F);
        cv.multiply(rChannel_clone, redScale, rChannel_clone);
        const currentRedChannel = rChannel_clone.clone();
        channels.set(2, rChannel_clone);
        matCleanUp.push(rChannel_clone, currentRedChannel);

        bChannel_orig.delete(); gChannel_orig.delete(); rChannel_orig.delete();
        
        cv.merge(channels, originalMat);
        originalMat.convertTo(originalMat, cv.CV_8U);

        // --- LAB Adjustments ---
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
        aScalarMat.setTo(new cv.Scalar(adjustedTemp / 800.0));
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
        
        // --- Final Adjustments to Red Channel ---
        const finalChannels = new cv.MatVector();
        vecCleanUp.push(finalChannels);
        cv.split(originalMat, finalChannels);
        cv.divide(greenTemp, divisor255, greenTemp);
        const scaleOfGreenFactor = sigmoid(greenTemp, 11.0, 1.042, 4.0);
        const redScaleByGreen = cv.Mat.ones(scaleOfGreenFactor.size(), cv.CV_32F);
        const redAdjByGreen = cv.Mat.ones(redScaleByGreen.size(), cv.CV_32F);
        matCleanUp.push(scaleOfGreenFactor, redScaleByGreen, redAdjByGreen);
        const redAdjScalarMat = cv.Mat.ones(redAdjByGreen.size(), cv.CV_32F);
        redAdjScalarMat.setTo(new cv.Scalar(adjustedTemp / 50.0));
        matCleanUp.push(redAdjScalarMat);
        cv.multiply(redAdjByGreen, redAdjScalarMat, redAdjByGreen);
        cv.multiply(redAdjByGreen, scaleOfGreenFactor, redAdjByGreen);
        cv.add(redScaleByGreen, redAdjByGreen, redScaleByGreen);
        
        const finalR_handle = finalChannels.get(2);
        const finalR_modified = new cv.Mat();
        finalR_handle.convertTo(finalR_modified, cv.CV_32F);
        cv.multiply(currentRedChannel, redScaleByGreen, finalR_modified);
        finalR_modified.convertTo(finalR_modified, cv.CV_8U);
        finalChannels.set(2, finalR_modified);
        matCleanUp.push(finalR_modified);
        finalR_handle.delete();
        
        finalChannels.get(0).convertTo(finalChannels.get(0), cv.CV_8U);
        finalChannels.get(1).convertTo(finalChannels.get(1), cv.CV_8U);

        cv.merge(finalChannels, originalMat);
        originalMat.convertTo(originalMat, cv.CV_8U);

        logImageRgba(originalMat, "boostWarmTemperature");
        return originalMat;
    } catch (error) {
        console.error("Error in boostWarmTemperature:", error); 
        return originalMat;
    } finally {
        // matCleanUp.forEach((mat) => { if (mat && !mat.isDeleted()) mat.delete(); });
        // vecCleanUp.forEach((vec) => { if (vec && !vec.isDeleted()) vec.delete(); });
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

        // --- First Channel Processing ---
        const channels = new cv.MatVector();
        vecCleanUp.push(channels);
        cv.split(originalMat, channels);
        
        const bChannel_orig = channels.get(0), gChannel_orig = channels.get(1), rChannel_orig = channels.get(2);
        
        const bChannel_clone = bChannel_orig.clone();
        bChannel_clone.convertTo(bChannel_clone, cv.CV_32F);
        cv.multiply(bChannel_clone, blueScale, bChannel_clone);
        channels.set(0, bChannel_clone);
        matCleanUp.push(bChannel_clone);

        const gChannel_clone = gChannel_orig.clone();
        gChannel_clone.convertTo(gChannel_clone, cv.CV_32F);
        cv.multiply(gChannel_clone, greenScale, gChannel_clone);
        channels.set(1, gChannel_clone);
        matCleanUp.push(gChannel_clone);

        const rChannel_clone = rChannel_orig.clone();
        rChannel_clone.convertTo(rChannel_clone, cv.CV_32F);
        // In the original logic, Red is multiplied by 1.0 (unchanged)
        const curRedChannel = rChannel_clone.clone();
        channels.set(2, rChannel_clone);
        matCleanUp.push(rChannel_clone, curRedChannel);

        bChannel_orig.delete(); gChannel_orig.delete(); rChannel_orig.delete();
        
        cv.merge(channels, originalMat);
        originalMat.convertTo(originalMat, cv.CV_8U);
        
        const divisor255 = cv.Mat.ones(curRedChannel.size(), cv.CV_32F);
        divisor255.setTo(new cv.Scalar(255.0));
        matCleanUp.push(divisor255);
        cv.divide(curRedChannel, divisor255, curRedChannel);

        // --- LAB Adjustments ---
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
        bScalarMat.setTo(new cv.Scalar(adjustedTemp / 3.0));
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
        
        // --- Final Channel Adjustments ---
        const finalChannels = new cv.MatVector();
        vecCleanUp.push(finalChannels);
        cv.split(originalMat, finalChannels);
        const finalB_orig = finalChannels.get(0), finalG_orig = finalChannels.get(1), finalR_orig = finalChannels.get(2);
        
        const scaleOfRedFactor = sigmoid(curRedChannel, 11.0, 0.325, 0.6);
        const redScale = cv.Mat.ones(scaleOfRedFactor.size(), cv.CV_32F);
        const redAdj = cv.Mat.ones(redScale.size(), cv.CV_32F);
        matCleanUp.push(scaleOfRedFactor, redScale, redAdj);
        const redAdjScalarMat = cv.Mat.ones(redAdj.size(), cv.CV_32F);
        redAdjScalarMat.setTo(new cv.Scalar(adjustedTemp * 1.2));
        matCleanUp.push(redAdjScalarMat);
        cv.multiply(redAdj, lumScalingFactor, redAdj);
        cv.multiply(redAdj, redAdjScalarMat, redAdj);
        cv.multiply(redAdj, scaleOfRedFactor, redAdj);
        cv.subtract(redScale, redAdj, redScale);
        
        const finalR_clone = finalR_orig.clone();
        finalR_clone.convertTo(finalR_clone, cv.CV_32F);
        cv.multiply(finalR_clone, redScale, finalR_clone);
        finalChannels.set(2, finalR_clone);
        matCleanUp.push(finalR_clone);
        
        const finalG_clone = finalG_orig.clone();
        const greenTemp = finalG_clone.clone();
        matCleanUp.push(greenTemp);
        finalG_clone.convertTo(finalG_clone, cv.CV_32F);
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
        
        cv.multiply(finalG_clone, greenScaleBoost, finalG_clone);
        finalChannels.set(1, finalG_clone);
        matCleanUp.push(finalG_clone);

        finalR_clone.convertTo(finalR_clone, cv.CV_8U);
        finalG_clone.convertTo(finalG_clone, cv.CV_8U);
        finalChannels.get(0).convertTo(finalChannels.get(0), cv.CV_8U);
        
        finalB_orig.delete(); finalG_orig.delete(); finalR_orig.delete();

        cv.merge(finalChannels, originalMat);
        originalMat.convertTo(originalMat, cv.CV_8U);
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
        const labBFactor = adjustedTemp / 1.9;
        const redAdjFactor = adjustedTemp * 2.0;

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

        const channels = new cv.MatVector();
        vecCleanUp.push(channels);
        cv.split(originalMat, channels);
        
        const bChannel_orig = channels.get(0), gChannel_orig = channels.get(1), rChannel_orig = channels.get(2);
        
        const bChannel_clone = bChannel_orig.clone();
        bChannel_clone.convertTo(bChannel_clone, cv.CV_32F);
        cv.multiply(bChannel_clone, blueScale, bChannel_clone);
        channels.set(0, bChannel_clone);
        matCleanUp.push(bChannel_clone);

        const gChannel_clone = gChannel_orig.clone();
        gChannel_clone.convertTo(gChannel_clone, cv.CV_32F);
        cv.multiply(gChannel_clone, greenScale, gChannel_clone);
        channels.set(1, gChannel_clone);
        matCleanUp.push(gChannel_clone);

        const rChannel_clone = rChannel_orig.clone();
        rChannel_clone.convertTo(rChannel_clone, cv.CV_32F);
        const curRedChannel = rChannel_clone.clone();
        channels.set(2, rChannel_clone);
        matCleanUp.push(rChannel_clone, curRedChannel);
        
        bChannel_orig.delete(); gChannel_orig.delete(); rChannel_orig.delete();

        cv.merge(channels, originalMat);
        originalMat.convertTo(originalMat, cv.CV_8U);
        
        const divisor255 = cv.Mat.ones(curRedChannel.size(), cv.CV_32F);
        divisor255.setTo(new cv.Scalar(255.0));
        matCleanUp.push(divisor255);
        cv.divide(curRedChannel, divisor255, curRedChannel);

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
        
        const finalChannels = new cv.MatVector();
        vecCleanUp.push(finalChannels);
        cv.split(originalMat, finalChannels);
        const finalB_orig = finalChannels.get(0), finalG_orig = finalChannels.get(1), finalR_orig = finalChannels.get(2);

        const scaleOfRedFactor = sigmoid(curRedChannel, 11.0, 0.325, 0.6);
        const redScale = cv.Mat.ones(scaleOfRedFactor.size(), cv.CV_32F);
        const redAdj = cv.Mat.ones(redScale.size(), cv.CV_32F);
        matCleanUp.push(scaleOfRedFactor, redScale, redAdj);
        const redAdjScalarMat = cv.Mat.ones(redAdj.size(), cv.CV_32F);
        redAdjScalarMat.setTo(new cv.Scalar(redAdjFactor)); // Use upper half factor
        matCleanUp.push(redAdjScalarMat);
        cv.multiply(redAdj, lumScalingFactor, redAdj);
        cv.multiply(redAdj, redAdjScalarMat, redAdj);
        cv.multiply(redAdj, scaleOfRedFactor, redAdj);
        cv.subtract(redScale, redAdj, redScale);
        
        const finalR_clone = finalR_orig.clone();
        finalR_clone.convertTo(finalR_clone, cv.CV_32F);
        cv.multiply(finalR_clone, redScale, finalR_clone);
        finalChannels.set(2, finalR_clone);
        matCleanUp.push(finalR_clone);
        
        const finalG_clone = finalG_orig.clone();
        const greenTemp = finalG_clone.clone();
        matCleanUp.push(greenTemp);
        finalG_clone.convertTo(finalG_clone, cv.CV_32F);
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
        
        cv.multiply(finalG_clone, greenScaleBoost, finalG_clone);
        finalChannels.set(1, finalG_clone);
        matCleanUp.push(finalG_clone);

        finalR_clone.convertTo(finalR_clone, cv.CV_8U);
        finalG_clone.convertTo(finalG_clone, cv.CV_8U);
        finalChannels.get(0).convertTo(finalChannels.get(0), cv.CV_8U);
        
        finalB_orig.delete(); finalG_orig.delete(); finalR_orig.delete();

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