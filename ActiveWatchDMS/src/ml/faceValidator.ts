import type {FaceResult} from '../../types';


export function isFaceGeometryPlausible(
 face:FaceResult
){


 if(!face.isFacePresent){

   return false;

 }



 const points =
 face.landmarks;



 if(points.length !== 468){

   return false;

 }



 const leftEye =
 points[33];


 const rightEye =
 points[263];



 const distance = Math.sqrt(

 Math.pow(
 leftEye.x-rightEye.x,
 2
 )

 +

 Math.pow(
 leftEye.y-rightEye.y,
 2
 )

 );



 console.log(
 "EYE DISTANCE:",
 distance
 );



 return distance > 0.05;


}