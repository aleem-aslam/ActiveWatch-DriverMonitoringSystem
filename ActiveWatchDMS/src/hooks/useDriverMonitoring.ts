
import {
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import { StyleSheet } from 'react-native';

export function useDriverMonitoring(){

  const {
    hasPermission,
    requestPermission
  } = useCameraPermission();


  const device = useCameraDevice('back');


  return {
    hasPermission,
    requestPermission,
    device
  };

}



const styles = StyleSheet.create({

container:{
 flex:1,
 justifyContent:'center',
 alignItems:'center'
}

});