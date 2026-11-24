import {Point3D} from './faceLandmarks';


export const LEFT_EYE=[
33,
160,
158,
133,
153,
144
];


export const RIGHT_EYE=[
362,
385,
387,
263,
373,
380
];



export function getEyePoints(
landmarks:Point3D[],
indexes:number[]
){


return indexes.map(
i=>landmarks[i]
);


}