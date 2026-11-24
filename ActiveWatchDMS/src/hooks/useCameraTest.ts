import {
  useCameraDevice,
  useCameraPermission
} from 'react-native-vision-camera';


export function useCameraTest(){

  const {
    hasPermission,
    requestPermission
  } = useCameraPermission();


  const device = useCameraDevice('front');


  return {
    hasPermission,
    requestPermission,
    device
  };

}