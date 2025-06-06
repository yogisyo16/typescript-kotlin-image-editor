import cv from "@techstark/opencv-js";

// code to execute coerceIn function like kotlin
// this function used to clamping the value within a range
function coerceIn(value: number, min: number, max: number): number {
  if (min > max) {
    [min, max] = [max, min];
  }
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function mapClarityInput(value: number): number {
  let result: number;
  const comparingValue = coerceIn(value, -100, 100);

  if (comparingValue <= 0) {
    const shifted = comparingValue + 20;
    const calculation = (((shifted + 100) / 100.0) * (16 + 1) - 0.5);
    result = Math.round(calculation);
    return result;
  } else {
    const calculation = ((comparingValue / 100.0) * (25 + 17) + 20);
    result = Math.round(calculation);
    return result;
  }
}

function guidedFilter (I: cv.Mat, p: cv.Mat, r: number, eps: number): cv.Mat {
  return I;
}