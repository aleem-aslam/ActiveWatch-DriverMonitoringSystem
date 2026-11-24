import type {Point3D, FaceResult} from '../../types';


const FACE_THRESHOLD = 0.5;


function sigmoid(x:number){

  return 1 / (1 + Math.exp(-x));

}



export function runFaceLandmarkModel(
  modelOutputs:any[]
):FaceResult{


  const landmarksFlat =
    new Float32Array(modelOutputs[0]);


  const rawPresence =
    new Float32Array(modelOutputs[1])[0];



  console.log(
    "RAW PRESENCE:",
    rawPresence
  );



  let faceScore = rawPresence;



  // only apply sigmoid if value is outside probability range
  if(rawPresence < 0 || rawPresence > 1){

    faceScore =
      sigmoid(rawPresence);

  }



  console.log(
    "FACE SCORE:",
    faceScore
  );



  const landmarks:Point3D[] =
    new Array(468);



  for(let i=0;i<468;i++){


    landmarks[i]={


      x:landmarksFlat[i*3],


      y:landmarksFlat[i*3+1],


      z:landmarksFlat[i*3+2]


    };


  }



  console.log(
    "FIRST LANDMARKS",
    landmarks.slice(0,5)
  );



  return {


    landmarks,


    faceScore,


    isFacePresent:
      faceScore >= FACE_THRESHOLD


  };


}