import React,
{
createContext,
useContext,
useEffect,
useState
}
from 'react';


import {
Appearance
}
from 'react-native';


import {
LIGHT_COLORS,
DARK_COLORS
}
from '../theme/colors';



const ThemeContext =
createContext<any>(null);



export function ThemeProvider({children}:any){


const system =
Appearance.getColorScheme();



const [mode,setMode]=
useState(
system==="dark"
?
"dark"
:
"light"
);



const colors =
mode==="dark"
?
DARK_COLORS
:
LIGHT_COLORS;



return(

<ThemeContext.Provider

value={{
mode,
setMode,
colors
}}

>

{children}

</ThemeContext.Provider>


);


}



export function useTheme(){

return useContext(ThemeContext);

}