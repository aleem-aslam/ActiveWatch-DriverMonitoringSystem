import React, {useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';


export default function CameraView(){

  const {
    hasPermission,
    requestPermission
  } = useCameraPermission();


  const device = useCameraDevice('front');


  React.useEffect(()=>{
    if(!hasPermission){
      requestPermission();
    }
  },[hasPermission]);


  if(!hasPermission){
    return(
      <View style={styles.center}>
        <Text>
          Requesting Camera Permission
        </Text>
      </View>
    );
  }


  if(!device){
    return(
      <View style={styles.center}>
        <Text>
          Camera Not Available
        </Text>
      </View>
    );
  }


  return(
    <Camera
      style={StyleSheet.absoluteFill}
      device={device}
      isActive={true}
    />
  );
}



const styles=StyleSheet.create({

  center:{
    flex:1,
    justifyContent:'center',
    alignItems:'center'
  }

});