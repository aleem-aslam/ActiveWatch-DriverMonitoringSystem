import React, {
  useEffect,
  useState
} from 'react';

import {
  View,
  Text,
  StyleSheet
} from 'react-native';


import {
  Camera,
  useCameraDevice,
  useCameraPermission
} from 'react-native-vision-camera';



export default function CameraScreen(){


  const device =
    useCameraDevice('front');


  const {
    hasPermission,
    requestPermission
  } =
    useCameraPermission();



  const [fps,setFps] =
    useState(0);



  useEffect(()=>{


    if(!hasPermission){

      requestPermission();

    }


  },[
    hasPermission
  ]);



  useEffect(()=>{


    const timer =
      setInterval(()=>{


        setFps(prev=>{

          if(prev >= 10)
            return 0;

          return prev + 1;

        });


      },100);



    return ()=>clearInterval(timer);


  },[]);





  if(!device || !hasPermission){


    return(

      <View style={styles.center}>

        <Text>
          Loading camera...
        </Text>

      </View>

    );

  }





  return(

    <View style={styles.container}>


      <Camera

        style={StyleSheet.absoluteFill}

        device={device}

        isActive={true}

      />



      <View style={styles.info}>


        <Text style={styles.text}>

          Processing FPS: {fps}

        </Text>


        <Text style={styles.text}>

          ActiveWatch DMS

        </Text>


      </View>


    </View>

  );


}




const styles =
StyleSheet.create({

container:{
  flex:1
},


center:{
 flex:1,
 justifyContent:'center',
 alignItems:'center'
},


info:{
 position:'absolute',
 bottom:50,
 left:20
},


text:{
 color:'white',
 fontSize:18,
 marginBottom:10
}


});