import { loadTensorflowModel, type TfliteModel } from 'react-native-fast-tflite';


let faceModel: TfliteModel | null = null;


/**
 * Load Face Landmark TFLite Model
 * Singleton loader to avoid loading model multiple times
 */
export async function loadFaceModel(): Promise<TfliteModel> {

  if (faceModel) {
    return faceModel;
  }


  try {

    const MODEL = require('../../assets/models/face_landmark.tflite');


    faceModel = await loadTensorflowModel(
      MODEL,
      []
    );


    console.log(
      "Face landmark model loaded successfully"
    );


    console.log(
      "Model Inputs:",
      faceModel.inputs
    );


    console.log(
      "Model Outputs:",
      faceModel.outputs
    );


    return faceModel;


  } catch (error) {


    console.log(
      "Failed to load face landmark model:",
      error
    );


    throw error;
  }
}


/**
 * Get already loaded model
 */
export function getFaceModel(): TfliteModel | null {

  return faceModel;

}