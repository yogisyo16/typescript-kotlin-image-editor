import cv from "@techstark/opencv-js";

export function logImage(image: cv.Mat, text: string, score: number, text2: string) {
  const testRow = 200;
  const testCols = 310;
  const testRow1 = 270;
  const testCols1 = 430;
  const testRow2 = 310;
  const testCols2 = 450;

  console.debug(text);
  const finalPixel = image.ucharPtr(testRow, testCols);
  const finalPixel1 = image.ucharPtr(testRow1, testCols1);
  const finalPixel2 = image.ucharPtr(testRow2, testCols2);
  const [R, G, B, A] = finalPixel;
  const [R1, G1, B1, A1] = finalPixel1;
  const [R2, G2, B2, A2] = finalPixel2;
  console.debug('Channels for ', text, ' : ', image.channels());
  console.debug('Value score for ', text2, ' : ', score);
  console.debug(`Pixel Values: R=${R}, G=${G}, B=${B}, A=${A}`);
  console.debug(`Pixel Values: R=${R1}, G=${G1}, B=${B1}, A=${A1}`);
  console.debug(`Pixel Values: R=${R2}, G=${G2}, B=${B2}, A=${A2}`);
  console.log("-----------------------------------------------")
}