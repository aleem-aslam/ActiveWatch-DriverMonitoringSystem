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
  loadFaceModel
} from './src/ml/tfliteLoader';


import CameraScreen from './src/camera/CameraScreen';



export default function App(){


  const [loading,setLoading] =
    useState(true);


  const [error,setError] =
    useState<string | null>(null);



  useEffect(()=>{


    async function init(){


      try{


        await loadFaceModel();


        setLoading(false);


      }
      catch(e:any){


        setError(
          e.message
        );


      }


    }


    init();


  },[]);





  if(error){


    return(

      <View style={styles.center}>


        <Text style={styles.error}>

          Model Error:

          {'\n'}

          {error}

        </Text>


      </View>

    );


  }




  if(loading){


    return(

      <View style={styles.center}>


        <Text style={styles.text}>

          Loading AI Model...

        </Text>


      </View>

    );


  }




  return(

    <CameraScreen/>

  );


}





const styles =
StyleSheet.create({


center:{
 flex:1,
 justifyContent:'center',
 alignItems:'center'
},


text:{
 fontSize:20
},


error:{
 color:'red',
 fontSize:16,
 padding:20
}


});