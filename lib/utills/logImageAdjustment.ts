import cv from "@techstark/opencv-js";

export function logImage(image: cv.Mat, text: string) {
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
  const [B, G, R, A] = finalPixel;
  const [B1, G1, R1, A1] = finalPixel1;
  const [B2, G2, R2, A2] = finalPixel2;
  console.debug('Channels: ', image.channels());
  console.debug(`Pixel Values: B=${B}, G=${G}, R=${R}, A=${A}`);
  console.debug(`Pixel Values: B=${B1}, G=${G1}, R=${R1}, A=${A1}`);
  console.debug(`Pixel Values: B=${B2}, G=${G2}, R=${R2}, A=${A2}`);
  console.log("-----------------------------------------------")
}