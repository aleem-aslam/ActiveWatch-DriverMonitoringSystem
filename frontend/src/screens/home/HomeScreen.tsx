import React,{useEffect,useRef} from 'react';

import {
View,
Text,
StyleSheet,
Animated,
TouchableOpacity
} from 'react-native';


import {
useTheme
} from '../../theme/ThemeContext';



export default function HomeScreen({navigation}:any){


const scale =
useRef(
new Animated.Value(0.8)
).current;


const opacity =
useRef(
new Animated.Value(0)
).current;



const {
colors
}=useTheme();



useEffect(()=>{


Animated.parallel([

Animated.spring(scale,{
toValue:1,
useNativeDriver:true
}),

Animated.timing(opacity,{
toValue:1,
duration:500,
useNativeDriver:true
})

]).start();



},[]);



return(

<Animated.View

style={[
styles.container,
{
backgroundColor:colors.background,
opacity
}
]}

>


<Text

style={[
styles.title,
{
color:colors.text
}
]}

>

Home

</Text>



<Animated.View

style={{
transform:[
{
scale
}
]
}}

>


<TouchableOpacity

style={[
styles.button,
{
backgroundColor:colors.primary
}
]}

onPress={()=>
navigation.navigate('Camera')
}

>


<Text style={styles.play}>
▶
</Text>


</TouchableOpacity>


</Animated.View>



<Text

style={[
styles.subtitle,
{
color:colors.muted
}
]}

>

Start Monitoring

</Text>



</Animated.View>


);


}



const styles=StyleSheet.create({

container:{
flex:1,
alignItems:'center',
paddingTop:70
},


title:{
fontSize:34,
fontWeight:'700'
},


button:{
height:150,
width:150,
borderRadius:75,
justifyContent:'center',
alignItems:'center',
marginTop:120
},


play:{
fontSize:60,
color:'white',
marginLeft:8
},


subtitle:{
marginTop:25,
fontSize:18
}

});