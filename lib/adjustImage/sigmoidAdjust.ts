import cv from "@techstark/opencv-js";

export function sigmoid(input: cv.Mat, k: number, x0: number, numerator: number = 1.5): cv.Mat {
  const result = new cv.Mat(input.rows, input.cols, cv.CV_32F);
  let oneMat = new cv.Mat(input.rows, input.cols, cv.CV_32F, new cv.Scalar(1));

  if (input.channels() === 3) {
    oneMat = new cv.Mat(input.rows, input.cols, cv.CV_32FC3, new cv.Scalar(1, 1, 1));
    const x0Mat = new cv.Mat(input.rows, input.cols, cv.CV_32FC3, new cv.Scalar(x0, x0, x0));
    cv.subtract(input, x0Mat, result);
    const kMat = new cv.Mat(input.rows, input.cols, cv.CV_32FC3, new cv.Scalar(-k, -k, -k));
    cv.multiply(result, kMat, result);
    cv.exp(result, result);
    cv.add(result, oneMat, result);
    x0Mat.delete();
    kMat.delete();
  } else {
    const x0Mat = new cv.Mat(input.rows, input.cols, cv.CV_32F, new cv.Scalar(x0));
    cv.subtract(input, x0Mat, result);
    const kMat = new cv.Mat(input.rows, input.cols, cv.CV_32F, new cv.Scalar(-k));
    cv.multiply(result, kMat, result);
    cv.exp(result, result);
    cv.add(result, oneMat, result);
    x0Mat.delete();
    kMat.delete();
  }

  let scalarMat = new cv.Mat(input.rows, input.cols, cv.CV_32F, new cv.Scalar(1));
  if (input.channels() === 3) {
    scalarMat = new cv.Mat(input.rows, input.cols, cv.CV_32FC3, new cv.Scalar(numerator, numerator, numerator));
  } else {
    const numeratorMat = new cv.Mat(scalarMat.rows, scalarMat.cols, cv.CV_32F, new cv.Scalar(numerator));
    cv.multiply(scalarMat, numeratorMat, scalarMat);
    numeratorMat.delete();
  }

  cv.divide(scalarMat, result, result);

  oneMat.delete();
  scalarMat.delete();
  return result;
}