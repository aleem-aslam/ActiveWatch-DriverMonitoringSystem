import type { TfliteModel } from 'react-native-fast-tflite';


export interface FaceResult {

  landmarks: number[];

  confidence: number;

}


/**
 * Convert Float32Array into pure ArrayBuffer
 * Required by react-native-fast-tflite
 */
function float32ToArrayBuffer(
  data: Float32Array
): ArrayBuffer {


  const buffer = new ArrayBuffer(
    data.byteLength
  );


  const view = new Float32Array(
    buffer
  );


  view.set(data);


  return buffer;

}



export async function runFaceModel(
  model: TfliteModel,
  input: Float32Array
): Promise<FaceResult | null> {


  try {


    const inputBuffer = float32ToArrayBuffer(
      input
    );



    const output = await model.run([
      inputBuffer
    ]);



    const landmarkBuffer =
      output[0] as ArrayBuffer;



    const confidenceBuffer =
      output[1] as ArrayBuffer;



    const landmarksTensor =
      new Float32Array(
        landmarkBuffer
      );



    const confidenceTensor =
      new Float32Array(
        confidenceBuffer
      );



    return {

      landmarks:
        Array.from(
          landmarksTensor
        ),


      confidence:
        confidenceTensor[0]

    };


  } catch(error) {


    console.error(
      "Face inference failed:",
      error
    );


    return null;

  }

}