export interface Point3D {

x:number;
y:number;
z:number;

}



export function extractLandmarks(
data:number[]
):Point3D[]{


const points:Point3D[]=[];



for(
let i=0;
i<data.length;
i+=3
){


points.push({

x:data[i],
y:data[i+1],
z:data[i+2]

});


}


return points;


}