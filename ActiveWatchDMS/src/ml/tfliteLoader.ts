import {
  loadTensorflowModel,
  type TfliteModel,
} from 'react-native-fast-tflite';


let faceModel: TfliteModel | null = null;



export async function loadFaceModel(): Promise<TfliteModel> {


  if(faceModel){
    return faceModel;
  }


  const MODEL =
    require('../../assets/models/face_landmark.tflite');


  faceModel =
    await loadTensorflowModel(
      MODEL,
      []
    );


  console.log(
    "Face landmark model loaded"
  );


  console.log(
    "INPUTS",
    faceModel.inputs
  );


  console.log(
    "OUTPUTS",
    faceModel.outputs
  );


  return faceModel;

}



export function getFaceModel(){

  return faceModel;

}